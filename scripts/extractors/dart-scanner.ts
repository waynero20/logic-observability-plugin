import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { ScanResult, ScanItem } from './function-scanner.js';

// ─── Dart-specific pattern detection ───

const AI_CALL_PATTERNS = [
  'anthropic.messages.create',
  'openai.chat.completions.create',
  '.messages.create',
  'GenerativeModel',
  'model.generateContent',
  'model.startChat',
];

const DB_WRITE_PATTERNS = [
  '.insert(', '.update(', '.delete(', '.upsert(',
  '.insertAll(', '.deleteAll(', '.updateAll(',
  '.rawInsert(', '.rawUpdate(', '.rawDelete(',
  // Drift ORM
  'into(', '.insertOnConflictUpdate(',
  // Firestore
  '.set(', '.add(',
  'FirebaseFirestore.instance',
];

const DB_READ_PATTERNS = [
  '.query(', '.rawQuery(', '.select(',
  '.get()', '.snapshots()',
  // Drift
  '.watch(', '.getSingle(', '.get()',
  // Firestore
  '.doc(', '.collection(',
];

const HTTP_PATTERNS = [
  'http.get(', 'http.post(', 'http.put(', 'http.delete(', 'http.patch(',
  'dio.get(', 'dio.post(', 'dio.put(', 'dio.delete(', 'dio.patch(',
  'client.get(', 'client.post(', 'client.put(', 'client.delete(',
  'Dio(', 'HttpClient(',
];

const TRACER_PATTERNS = ['tracer.span', 'tracer.startSpan', '.startActiveSpan', 'Tracer.'];
const DECISION_LOG_PATTERNS = ['decisionLog', 'logDecision', 'decision_point'];

// ─── Riverpod provider patterns ───

const RIVERPOD_PROVIDER_PATTERNS = [
  /final\s+(\w+)\s*=\s*(?:State)?(?:Notifier)?Provider(?:<[^>]*>)?\s*\(/,
  /final\s+(\w+)\s*=\s*FutureProvider(?:<[^>]*>)?\s*\(/,
  /final\s+(\w+)\s*=\s*StreamProvider(?:<[^>]*>)?\s*\(/,
  /final\s+(\w+)\s*=\s*ChangeNotifierProvider(?:<[^>]*>)?\s*\(/,
  /final\s+(\w+)\s*=\s*(?:Auto)?(?:Dispose)?(?:Family)?Provider(?:<[^>]*>)?\s*\(/,
  // Riverpod generator annotations
  /@riverpod/,
];

// ─── GoRouter patterns ───

const GOROUTER_PATTERNS = [
  /GoRouter\s*\(/,
  /GoRoute\s*\(/,
  /ShellRoute\s*\(/,
  /StatefulShellRoute\s*\(/,
];

// ─── Dart file collection ───

function collectDartFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(current: string): void {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry);

      // Skip common non-source directories
      if (
        entry === 'node_modules' || entry === '.dart_tool' ||
        entry === '.pub-cache' || entry === 'build' ||
        entry === '.git' || entry === '.idea' ||
        entry === 'ios' || entry === 'android' ||
        entry === 'macos' || entry === 'windows' ||
        entry === 'linux' || entry === 'web'
      ) continue;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.dart') && !entry.endsWith('.g.dart') && !entry.endsWith('.freezed.dart')) {
          // Skip generated files
          if (!entry.endsWith('_test.dart') && !fullPath.includes('/test/')) {
            files.push(fullPath);
          }
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  }

  walk(dir);
  return files;
}

// ─── Dart function parsing ───

interface DartFunction {
  name: string;
  filePath: string;
  line: number;
  bodyText: string;
  kind: 'function' | 'method' | 'provider' | 'route';
  className?: string;
}

/**
 * Find matching closing brace for a given opening brace position.
 * Handles nested braces, strings, and comments.
 */
function findMatchingBrace(text: string, openPos: number): number {
  let depth = 0;
  let i = openPos;
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;

  while (i < text.length) {
    const ch = text[i];
    const next = i + 1 < text.length ? text[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (inString) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === stringChar) inString = false;
      i++;
      continue;
    }

    if (ch === '/' && next === '/') { inLineComment = true; i += 2; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i += 2; continue; }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; i++; continue; }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function parseDartFunctions(filePath: string, content: string): DartFunction[] {
  const functions: DartFunction[] = [];
  const lines = content.split('\n');

  // ── Riverpod providers ──
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of RIVERPOD_PROVIDER_PATTERNS) {
      const match = line.match(pattern);
      if (match && match[1]) {
        // Find the body of the provider callback
        const lineStart = content.indexOf(line);
        const bracePos = content.indexOf('{', lineStart);
        if (bracePos !== -1) {
          const endBrace = findMatchingBrace(content, bracePos);
          if (endBrace !== -1) {
            functions.push({
              name: match[1],
              filePath,
              line: i + 1,
              bodyText: content.slice(bracePos, endBrace + 1),
              kind: 'provider',
            });
          }
        }
        break;
      }
    }

    // @riverpod annotated functions
    if (line.trim() === '@riverpod' || line.trim().startsWith('@Riverpod(')) {
      // Next non-annotation line should be the function
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        const fnMatch = lines[j].match(/^\s*(?:\w+\s+)*(\w+)\s*\(/);
        if (fnMatch) {
          const lineStart = lines.slice(0, j).join('\n').length + 1;
          const bracePos = content.indexOf('{', lineStart);
          if (bracePos !== -1) {
            const endBrace = findMatchingBrace(content, bracePos);
            if (endBrace !== -1) {
              functions.push({
                name: fnMatch[1],
                filePath,
                line: j + 1,
                bodyText: content.slice(bracePos, endBrace + 1),
                kind: 'provider',
              });
            }
          }
          break;
        }
      }
    }
  }

  // ── GoRouter route configs ──
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of GOROUTER_PATTERNS) {
      if (pattern.test(line)) {
        const lineStart = content.indexOf(line, lines.slice(0, i).join('\n').length);
        const bracePos = content.indexOf('(', lineStart);
        if (bracePos !== -1) {
          // For routes, find matching paren
          const endParen = findMatchingParen(content, bracePos);
          if (endParen !== -1) {
            // Extract route name from path: parameter
            const routeText = content.slice(bracePos, endParen + 1);
            const pathMatch = routeText.match(/path:\s*['"]([^'"]+)['"]/);
            const routeName = pathMatch ? `route_${pathMatch[1].replace(/[/:]/g, '_').replace(/^_/, '')}` : `route_${i + 1}`;
            functions.push({
              name: routeName,
              filePath,
              line: i + 1,
              bodyText: routeText,
              kind: 'route',
            });
          }
        }
        break;
      }
    }
  }

  // ── Top-level functions and class methods ──
  // Match Dart function signatures (simplified but handles common cases)
  const funcRegex = /^(\s*)(?:static\s+)?(?:(?:Future|Stream|FutureOr)\s*<[^>]*>\s+|(?:void|int|double|String|bool|dynamic|List|Map|Set|num)\s+|(\w+)\s+)?(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?:async\s*\*?\s*)?{/gm;

  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const indent = match[1];
    const funcName = match[3];
    const lineNum = content.slice(0, match.index).split('\n').length;

    // Skip keywords, constructors (PascalCase), lifecycle methods, private
    if (!funcName || funcName === 'main' || funcName === 'build' || funcName === 'initState' ||
        funcName === 'dispose' || funcName === 'didChangeDependencies' ||
        funcName === 'didUpdateWidget' || funcName.startsWith('_') ||
        funcName === 'if' || funcName === 'for' || funcName === 'while' ||
        funcName === 'switch' || funcName === 'catch' || funcName === 'return' ||
        /^[A-Z]/.test(funcName)) continue;  // Skip constructors (PascalCase class names)

    // Determine if this is inside a class
    const isMethod = indent.length >= 2;

    const bracePos = content.indexOf('{', match.index + match[0].length - 1);
    if (bracePos !== -1) {
      const endBrace = findMatchingBrace(content, bracePos);
      if (endBrace !== -1) {
        // Determine class name by looking backwards for class declaration
        let className: string | undefined;
        if (isMethod) {
          for (let searchLine = lineNum - 2; searchLine >= 0; searchLine--) {
            const classMatch = lines[searchLine].match(/^\s*(?:abstract\s+)?class\s+(\w+)/);
            if (classMatch) {
              className = classMatch[1];
              break;
            }
          }
        }

        const displayName = className ? `${className}.${funcName}` : funcName;

        // Skip if already captured as a provider
        if (!functions.some(f => f.line === lineNum)) {
          functions.push({
            name: displayName,
            filePath,
            line: lineNum,
            bodyText: content.slice(bracePos, endBrace + 1),
            kind: isMethod ? 'method' : 'function',
            className,
          });
        }
      }
    }
  }

  return functions;
}

function findMatchingParen(text: string, openPos: number): number {
  let depth = 0;
  let i = openPos;
  let inString = false;
  let stringChar = '';

  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === stringChar) inString = false;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; i++; continue; }
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

// ─── Pattern matching for categorization ───

function containsPattern(text: string, patterns: string[]): boolean {
  return patterns.some(p => text.includes(p));
}

function countBranches(bodyText: string): number {
  let count = 0;
  // Count if statements (avoid counting else if double)
  const ifMatches = bodyText.match(/\bif\s*\(/g);
  if (ifMatches) count += ifMatches.length;
  // Count switch statements
  const switchMatches = bodyText.match(/\bswitch\s*\(/g);
  if (switchMatches) count += switchMatches.length;
  // Count case clauses
  const caseMatches = bodyText.match(/\bcase\s+/g);
  if (caseMatches) count += caseMatches.length;
  // Count ternary operators
  const ternaryMatches = bodyText.match(/\?\s*[^?]/g);
  if (ternaryMatches) count += ternaryMatches.length;
  return count;
}

function extractCalls(bodyText: string): string[] {
  const calls = new Set<string>();
  // Match function/method calls: identifier.identifier.call( or identifier(
  const callRegex = /(?:[\w.]+)\s*(?:<[^>]*>)?\s*\(/g;
  let match;
  while ((match = callRegex.exec(bodyText)) !== null) {
    let call = match[0].replace(/\s*\($/, '');
    // Skip control flow keywords
    if (['if', 'for', 'while', 'switch', 'catch', 'when'].includes(call)) continue;
    calls.add(call);
  }
  return [...calls];
}

function isEntryPoint(fn: DartFunction): boolean {
  return fn.name.startsWith('handle') ||
    fn.kind === 'route' ||
    fn.name.includes('onPressed') ||
    fn.name.includes('onTap') ||
    fn.name.includes('onSubmit');
}

function categorizeDart(fn: DartFunction, calls: string[]): { category: string; recommended: boolean } {
  const text = fn.bodyText;

  if (containsPattern(text, AI_CALL_PATTERNS)) {
    return { category: 'aiCalls', recommended: true };
  }
  if (containsPattern(text, DB_WRITE_PATTERNS)) {
    return { category: 'dataMutations', recommended: true };
  }
  if (isEntryPoint(fn)) {
    return { category: 'entryPoints', recommended: true };
  }
  if (fn.kind === 'provider') {
    // Providers with logic are always interesting
    const branches = countBranches(text);
    if (branches >= 1 || calls.length >= 2) {
      return { category: 'entryPoints', recommended: true };
    }
  }
  if (countBranches(text) >= 3) {
    return { category: 'decisionTrees', recommended: true };
  }
  if (containsPattern(text, DB_READ_PATTERNS) || containsPattern(text, HTTP_PATTERNS)) {
    return { category: 'externalCalls', recommended: true };
  }
  return { category: 'utilities', recommended: false };
}

// ─── Main scanner ───

export function scanDartProject(targetDir: string, existingIRMap: Map<string, string> = new Map()): ScanResult {
  const dartFiles = collectDartFiles(targetDir);

  const categories: ScanResult['categories'] = {
    entryPoints: [],
    decisionTrees: [],
    aiCalls: [],
    externalCalls: [],
    dataMutations: [],
    utilities: [],
    alreadyDocumented: [],
  };

  let idCounter = 1;
  let recommended = 0;
  let skipped = 0;
  let totalFunctions = 0;

  for (const filePath of dartFiles) {
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const functions = parseDartFunctions(filePath, content);
    totalFunctions += functions.length;

    for (const fn of functions) {
      const calls = extractCalls(fn.bodyText);
      const branches = countBranches(fn.bodyText);
      const { category, recommended: isRecommended } = categorizeDart(fn, calls);
      const relativePath = relative(process.cwd(), fn.filePath);
      const fileRef = `${relativePath}:${fn.line}`;

      const existingIR = existingIRMap.get(fn.name) || existingIRMap.get(fileRef) || null;

      const item: ScanItem = {
        id: idCounter++,
        name: fn.name,
        filePath: fileRef,
        category: existingIR ? 'alreadyDocumented' : category,
        branchCount: branches,
        calls,
        hasTracer: containsPattern(fn.bodyText, TRACER_PATTERNS),
        hasDecisionLog: containsPattern(fn.bodyText, DECISION_LOG_PATTERNS),
        recommended: existingIR ? false : isRecommended,
        existingIR,
      };

      if (existingIR) {
        categories.alreadyDocumented.push(item);
      } else {
        (categories as any)[category].push(item);
        if (isRecommended) recommended++;
        else skipped++;
      }
    }
  }

  return {
    projectType: 'dart',
    totalFiles: dartFiles.length,
    totalFunctions,
    categories,
    recommended,
    skipped,
  };
}

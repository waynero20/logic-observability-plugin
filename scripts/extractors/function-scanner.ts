import { Project, SyntaxKind, Node, SourceFile } from 'ts-morph';
import { existsSync } from 'fs';
import { join } from 'path';

// ─── Interfaces ───

export interface ScanItem {
  id: number;
  name: string;
  filePath: string;
  category: string;
  branchCount: number;
  calls: string[];
  hasTracer: boolean;
  hasDecisionLog: boolean;
  recommended: boolean;
  existingIR: string | null;
}

export interface ScanResult {
  projectType: 'typescript' | 'dart' | 'python' | 'go' | 'unknown';
  totalFiles: number;
  totalFunctions: number;
  categories: {
    entryPoints: ScanItem[];
    decisionTrees: ScanItem[];
    aiCalls: ScanItem[];
    externalCalls: ScanItem[];
    dataMutations: ScanItem[];
    utilities: ScanItem[];
    alreadyDocumented: ScanItem[];
  };
  recommended: number;
  skipped: number;
}

// ─── Pattern detection ───

const AI_CALL_PATTERNS = [
  'anthropic.messages.create',
  'anthropic.completions.create',
  'openai.chat.completions.create',
  'openai.completions.create',
  '.messages.create',
];

const DB_WRITE_PATTERNS = ['.insert(', '.update(', '.delete(', '.upsert('];
const DB_READ_PATTERNS = ['.from(', '.select(', '.rpc('];

const TRACER_PATTERNS = ['tracer.span', 'tracer.startSpan', 'trace.getTracer', '.startActiveSpan'];
const DECISION_LOG_PATTERNS = ['decisionLog', 'logDecision', 'decision_point'];

function isAICall(callText: string): boolean {
  return AI_CALL_PATTERNS.some(pattern => callText.includes(pattern));
}

function isDBWrite(callText: string): boolean {
  return DB_WRITE_PATTERNS.some(p => callText.includes(p));
}

function isExternalCall(callText: string): boolean {
  return DB_READ_PATTERNS.some(p => callText.includes(p));
}

function hasTracerSpan(node: Node): boolean {
  const calls = findCalls(node);
  return calls.some(c => TRACER_PATTERNS.some(p => c.includes(p)));
}

function hasDecisionLog(node: Node): boolean {
  const calls = findCalls(node);
  return calls.some(c => DECISION_LOG_PATTERNS.some(p => c.includes(p)));
}

// ─── AST utilities ───

function countBranches(node: Node): number {
  let count = 0;
  count += node.getDescendantsOfKind(SyntaxKind.IfStatement).length;
  count += node.getDescendantsOfKind(SyntaxKind.SwitchStatement).length;
  count += node.getDescendantsOfKind(SyntaxKind.ConditionalExpression).length;
  count += node.getDescendantsOfKind(SyntaxKind.CaseClause).length;
  return count;
}

function findCalls(node: Node): string[] {
  const calls: string[] = [];
  for (const callExpr of node.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = callExpr.getExpression();
    calls.push(expr.getText());
  }
  return [...new Set(calls)];
}

function hasHTTPDecorator(node: Node): boolean {
  if (!Node.isMethodDeclaration(node) && !Node.isFunctionDeclaration(node)) return false;
  const decorators = ('getDecorators' in node) ? (node as any).getDecorators?.() ?? [] : [];
  const httpDecorators = ['Get', 'Post', 'Put', 'Delete', 'Patch'];
  return decorators.some((d: any) => httpDecorators.includes(d.getName?.()));
}

function isEntryPoint(name: string, node: Node): boolean {
  return name.startsWith('handle') || hasHTTPDecorator(node);
}

// ─── Categorization ───

function categorize(name: string, node: Node, calls: string[]): { category: string; recommended: boolean } {
  // Order matters — first match wins
  if (calls.some(c => isAICall(c))) {
    return { category: 'aiCalls', recommended: true };
  }
  if (calls.some(c => isDBWrite(c))) {
    return { category: 'dataMutations', recommended: true };
  }
  if (isEntryPoint(name, node)) {
    return { category: 'entryPoints', recommended: true };
  }
  if (countBranches(node) >= 3) {
    return { category: 'decisionTrees', recommended: true };
  }
  if (calls.some(c => isExternalCall(c))) {
    return { category: 'externalCalls', recommended: true };
  }
  return { category: 'utilities', recommended: false };
}

// ─── Project creation ───

export function createProject(tsconfigPath: string): Project {
  return new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false,
  });
}

export function createProjectFromDir(dir: string): Project {
  const project = new Project({ compilerOptions: { allowJs: true } });
  project.addSourceFilesAtPaths(`${dir}/**/*.ts`);
  project.addSourceFilesAtPaths(`${dir}/**/*.tsx`);
  return project;
}

// ─── Main scanner ───

interface FunctionInfo {
  name: string;
  node: Node;
  sourceFile: SourceFile;
  line: number;
}

function collectFunctions(project: Project): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (
      filePath.includes('node_modules') ||
      filePath.includes('.test.') ||
      filePath.includes('.spec.') ||
      filePath.endsWith('.d.ts')
    ) {
      continue;
    }

    // Exported function declarations
    for (const fn of sourceFile.getFunctions()) {
      if (fn.isExported()) {
        functions.push({
          name: fn.getName() || 'anonymous',
          node: fn,
          sourceFile,
          line: fn.getStartLineNumber(),
        });
      }
    }

    // Exported class methods
    for (const cls of sourceFile.getClasses()) {
      if (cls.isExported()) {
        for (const method of cls.getMethods()) {
          functions.push({
            name: `${cls.getName()}.${method.getName()}`,
            node: method,
            sourceFile,
            line: method.getStartLineNumber(),
          });
        }
      }
    }

    // Exported arrow functions
    for (const varStmt of sourceFile.getVariableStatements()) {
      if (varStmt.isExported()) {
        for (const decl of varStmt.getDeclarations()) {
          const initializer = decl.getInitializer();
          if (initializer && Node.isArrowFunction(initializer)) {
            functions.push({
              name: decl.getName(),
              node: initializer,
              sourceFile,
              line: decl.getStartLineNumber(),
            });
          }
        }
      }
    }
  }

  return functions;
}

export function scanProject(targetDir: string, existingIRMap: Map<string, string> = new Map()): ScanResult {
  const tsconfigPath = join(targetDir, 'tsconfig.json');
  const hasTsConfig = existsSync(tsconfigPath);

  const project = hasTsConfig
    ? createProject(tsconfigPath)
    : createProjectFromDir(targetDir);

  const totalFiles = project.getSourceFiles().filter(sf => {
    const fp = sf.getFilePath();
    return !fp.includes('node_modules') && !fp.includes('.test.') && !fp.includes('.spec.') && !fp.endsWith('.d.ts');
  }).length;

  const functions = collectFunctions(project);

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

  for (const fn of functions) {
    const calls = findCalls(fn.node);
    const branches = countBranches(fn.node);
    const { category, recommended: isRecommended } = categorize(fn.name, fn.node, calls);
    const relativePath = fn.sourceFile.getFilePath().replace(process.cwd() + '/', '');
    const fileRef = `${relativePath}:${fn.line}`;

    const existingIR = existingIRMap.get(fn.name) || existingIRMap.get(fileRef) || null;

    const item: ScanItem = {
      id: idCounter++,
      name: fn.name,
      filePath: fileRef,
      category: existingIR ? 'alreadyDocumented' : category,
      branchCount: branches,
      calls,
      hasTracer: hasTracerSpan(fn.node),
      hasDecisionLog: hasDecisionLog(fn.node),
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

  return {
    projectType: 'typescript',
    totalFiles,
    totalFunctions: functions.length,
    categories,
    recommended,
    skipped,
  };
}

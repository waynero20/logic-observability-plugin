import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, basename, dirname, relative } from 'path';
import yaml from 'js-yaml';
// validate-ir is called by the CLI wrapper in extract-logic.ts

// ─── Types (shared with extract-logic.ts) ───

type ConfidenceLevel = 'static_only' | 'runtime_only' | 'static_plus_runtime';

interface IRNode {
  id: string;
  type: 'task' | 'decision' | 'start' | 'end' | 'parallel_split' | 'parallel_join';
  label: string;
  code_ref?: string;
  logic_type?: 'deterministic' | 'configurable' | 'probabilistic';
  confidence?: ConfidenceLevel;
  description?: string;
  calls?: string[];
  span_name?: string | null;
  decision_point?: string | null;
  reason_codes?: string[];
  model?: string;
  confidence_range?: number[];
}

interface IREdge {
  from: string;
  to: string;
  condition?: string;
  reason_code?: string;
  confidence?: ConfidenceLevel;
}

interface IRFlow {
  flow: string;
  version: number;
  title: string;
  description: string;
  service: string;
  module: string;
  status: 'draft' | 'verified';
  last_extracted: string;
  nodes: IRNode[];
  edges: IREdge[];
  entry_point: string;
  exit_points: string[];
  estimated_duration_ms?: string;
  error_modes?: string[];
}

// ─── Pattern detection ───

const AI_CALL_PATTERNS = [
  'anthropic.messages.create', 'openai.chat.completions.create',
  '.messages.create', 'GenerativeModel', 'model.generateContent',
];

const CONFIG_PATTERNS = [
  'dotenv', 'Platform.environment', 'const.fromEnvironment',
  'Config.', 'config.', 'Settings.', 'settings.',
  'getConfig', 'getSettings', 'RemoteConfig',
  'SharedPreferences', 'FlutterSecureStorage',
];

function classifyLogicType(callTexts: string[], bodyText: string): 'deterministic' | 'configurable' | 'probabilistic' {
  if (callTexts.some(c => AI_CALL_PATTERNS.some(p => c.includes(p)))) return 'probabilistic';
  if (callTexts.some(c => CONFIG_PATTERNS.some(p => c.includes(p))) || CONFIG_PATTERNS.some(p => bodyText.includes(p))) return 'configurable';
  return 'deterministic';
}

// ─── Text-based Dart parser ───

interface DartStatement {
  kind: 'if' | 'switch' | 'call' | 'return' | 'try' | 'for' | 'variable' | 'other';
  text: string;
  line: number;
  condition?: string;
  thenBody?: string;
  elseBody?: string;
  cases?: Array<{ label: string; body: string }>;
  tryBody?: string;
  loopBody?: string;
}

/**
 * Find matching brace, handling strings and comments.
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

    if (inLineComment) { if (ch === '\n') inLineComment = false; i++; continue; }
    if (inBlockComment) { if (ch === '*' && next === '/') { inBlockComment = false; i += 2; continue; } i++; continue; }
    if (inString) { if (ch === '\\') { i += 2; continue; } if (ch === stringChar) inString = false; i++; continue; }

    if (ch === '/' && next === '/') { inLineComment = true; i += 2; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i += 2; continue; }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; i++; continue; }

    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}

function findMatchingParen(text: string, openPos: number): number {
  let depth = 0;
  let i = openPos;
  let inString = false;
  let stringChar = '';

  while (i < text.length) {
    const ch = text[i];
    if (inString) { if (ch === '\\') { i += 2; continue; } if (ch === stringChar) inString = false; i++; continue; }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; i++; continue; }
    if (ch === '(') depth++;
    if (ch === ')') { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}

/**
 * Extract top-level statements from a Dart function body.
 * This is a simplified parser that handles common patterns.
 */
function parseStatements(bodyText: string, baseLineOffset: number): DartStatement[] {
  const statements: DartStatement[] = [];
  // Remove outer braces
  let text = bodyText.trim();
  if (text.startsWith('{')) text = text.slice(1);
  if (text.endsWith('}')) text = text.slice(0, -1);

  let pos = 0;
  while (pos < text.length) {
    // Skip whitespace
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    if (pos >= text.length) break;

    const lineNum = baseLineOffset + text.slice(0, pos).split('\n').length;
    const remaining = text.slice(pos);

    // ── if statement ──
    const ifMatch = remaining.match(/^if\s*\(/);
    if (ifMatch) {
      const parenStart = pos + remaining.indexOf('(');
      const condParenEnd = findMatchingParen(text, parenStart);
      if (condParenEnd !== -1) {
        const condition = text.slice(parenStart + 1, condParenEnd);
        // Find then body
        let afterCond = condParenEnd + 1;
        while (afterCond < text.length && /\s/.test(text[afterCond])) afterCond++;
        if (text[afterCond] === '{') {
          const thenEnd = findMatchingBrace(text, afterCond);
          if (thenEnd !== -1) {
            const thenBody = text.slice(afterCond, thenEnd + 1);
            let elseBody: string | undefined;
            let endPos = thenEnd + 1;

            // Check for else
            let afterThen = thenEnd + 1;
            while (afterThen < text.length && /\s/.test(text[afterThen])) afterThen++;
            if (text.slice(afterThen).startsWith('else')) {
              let elseStart = afterThen + 4;
              while (elseStart < text.length && /\s/.test(text[elseStart])) elseStart++;
              if (text.slice(elseStart).startsWith('if')) {
                // else if — capture as else body including the if
                if (text[elseStart + 2] === ' ' || text[elseStart + 2] === '(') {
                  // Find the end of the else-if chain
                  const elseIfParenStart = text.indexOf('(', elseStart);
                  if (elseIfParenStart !== -1) {
                    const elseIfCondEnd = findMatchingParen(text, elseIfParenStart);
                    if (elseIfCondEnd !== -1) {
                      let afterElseCond = elseIfCondEnd + 1;
                      while (afterElseCond < text.length && /\s/.test(text[afterElseCond])) afterElseCond++;
                      if (text[afterElseCond] === '{') {
                        const elseIfBodyEnd = findMatchingBrace(text, afterElseCond);
                        if (elseIfBodyEnd !== -1) {
                          elseBody = text.slice(elseStart, elseIfBodyEnd + 1);
                          endPos = elseIfBodyEnd + 1;
                        }
                      }
                    }
                  }
                }
              } else if (text[elseStart] === '{') {
                const elseEnd = findMatchingBrace(text, elseStart);
                if (elseEnd !== -1) {
                  elseBody = text.slice(elseStart, elseEnd + 1);
                  endPos = elseEnd + 1;
                }
              }
            }

            statements.push({
              kind: 'if',
              text: remaining.slice(0, endPos - pos),
              line: lineNum,
              condition,
              thenBody,
              elseBody,
            });
            pos = endPos;
            continue;
          }
        }
      }
    }

    // ── switch statement ──
    const switchMatch = remaining.match(/^switch\s*\(/);
    if (switchMatch) {
      const switchParenStart = text.indexOf('(', pos);
      const switchParenEnd = findMatchingParen(text, switchParenStart);
      if (switchParenEnd !== -1) {
        const switchExpr = text.slice(switchParenStart + 1, switchParenEnd);
        let afterExpr = switchParenEnd + 1;
        while (afterExpr < text.length && /\s/.test(text[afterExpr])) afterExpr++;
        if (text[afterExpr] === '{') {
          const switchEnd = findMatchingBrace(text, afterExpr);
          if (switchEnd !== -1) {
            const switchBody = text.slice(afterExpr + 1, switchEnd);
            // Parse cases
            const cases: Array<{ label: string; body: string }> = [];
            const caseRegex = /\b(case\s+[^:]+|default)\s*:/g;
            let caseMatch;
            const casePositions: Array<{ label: string; start: number }> = [];
            while ((caseMatch = caseRegex.exec(switchBody)) !== null) {
              casePositions.push({
                label: caseMatch[1].replace(/^case\s+/, '').trim(),
                start: caseMatch.index + caseMatch[0].length,
              });
            }
            for (let i = 0; i < casePositions.length; i++) {
              const end = i + 1 < casePositions.length ? casePositions[i + 1].start - casePositions[i + 1].label.length - 6 : switchBody.length;
              cases.push({
                label: casePositions[i].label,
                body: switchBody.slice(casePositions[i].start, end).trim(),
              });
            }

            statements.push({
              kind: 'switch',
              text: text.slice(pos, switchEnd + 1),
              line: lineNum,
              condition: switchExpr,
              cases,
            });
            pos = switchEnd + 1;
            continue;
          }
        }
      }
    }

    // ── try statement ──
    if (remaining.startsWith('try')) {
      let afterTry = pos + 3;
      while (afterTry < text.length && /\s/.test(text[afterTry])) afterTry++;
      if (text[afterTry] === '{') {
        const tryEnd = findMatchingBrace(text, afterTry);
        if (tryEnd !== -1) {
          const tryBody = text.slice(afterTry, tryEnd + 1);
          // Skip catch/finally blocks for position tracking
          let endPos = tryEnd + 1;
          // Find catch/on/finally
          let afterTryBlock = tryEnd + 1;
          while (afterTryBlock < text.length && /\s/.test(text[afterTryBlock])) afterTryBlock++;
          const afterText = text.slice(afterTryBlock);
          if (afterText.startsWith('catch') || afterText.startsWith('on ') || afterText.startsWith('finally')) {
            const catchBrace = text.indexOf('{', afterTryBlock);
            if (catchBrace !== -1) {
              const catchEnd = findMatchingBrace(text, catchBrace);
              if (catchEnd !== -1) endPos = catchEnd + 1;
            }
          }

          statements.push({
            kind: 'try',
            text: text.slice(pos, endPos),
            line: lineNum,
            tryBody,
          });
          pos = endPos;
          continue;
        }
      }
    }

    // ── for/for-in/while loops ──
    const loopMatch = remaining.match(/^(?:for|while)\s*\(/);
    if (loopMatch) {
      const loopParenStart = text.indexOf('(', pos);
      const loopParenEnd = findMatchingParen(text, loopParenStart);
      if (loopParenEnd !== -1) {
        let afterParen = loopParenEnd + 1;
        while (afterParen < text.length && /\s/.test(text[afterParen])) afterParen++;
        if (text[afterParen] === '{') {
          const loopEnd = findMatchingBrace(text, afterParen);
          if (loopEnd !== -1) {
            statements.push({
              kind: 'for',
              text: text.slice(pos, loopEnd + 1),
              line: lineNum,
              loopBody: text.slice(afterParen, loopEnd + 1),
            });
            pos = loopEnd + 1;
            continue;
          }
        }
      }
    }

    // ── return statement ──
    if (remaining.startsWith('return ') || remaining.startsWith('return;')) {
      const semiPos = text.indexOf(';', pos);
      if (semiPos !== -1) {
        const returnText = text.slice(pos + 7, semiPos).trim();
        statements.push({
          kind: 'return',
          text: returnText,
          line: lineNum,
        });
        pos = semiPos + 1;
        continue;
      }
    }

    // ── variable declaration with call ──
    const varMatch = remaining.match(/^(?:final|var|const|(?:late\s+)?(?:final|var)\s+)?\s*(?:\w+(?:<[^>]*>)?)\s+\w+\s*=\s*/);
    if (varMatch) {
      const semiPos = findStatementEnd(text, pos);
      if (semiPos !== -1) {
        const stmtText = text.slice(pos, semiPos + 1);
        // Check if it contains a function call
        if (stmtText.includes('(')) {
          statements.push({
            kind: 'variable',
            text: stmtText,
            line: lineNum,
          });
        }
        pos = semiPos + 1;
        continue;
      }
    }

    // ── await expression ──
    if (remaining.startsWith('await ')) {
      const semiPos = findStatementEnd(text, pos);
      if (semiPos !== -1) {
        statements.push({
          kind: 'call',
          text: text.slice(pos + 6, semiPos).trim(),
          line: lineNum,
        });
        pos = semiPos + 1;
        continue;
      }
    }

    // ── General expression/call statement ──
    const semiPos = findStatementEnd(text, pos);
    if (semiPos !== -1 && semiPos > pos) {
      const stmtText = text.slice(pos, semiPos).trim();
      if (stmtText.includes('(') && !stmtText.startsWith('//')) {
        statements.push({
          kind: 'call',
          text: stmtText,
          line: lineNum,
        });
      }
      pos = semiPos + 1;
      continue;
    }

    // Skip unrecognized character
    pos++;
  }

  return statements;
}

function findStatementEnd(text: string, startPos: number): number {
  let i = startPos;
  let depth = 0;
  let inString = false;
  let stringChar = '';

  while (i < text.length) {
    const ch = text[i];
    if (inString) { if (ch === '\\') { i += 2; continue; } if (ch === stringChar) inString = false; i++; continue; }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; i++; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ';' && depth <= 0) return i;
    i++;
  }
  return -1;
}

// ─── AST walking → IR ───

interface ExtractContext {
  nodes: IRNode[];
  edges: IREdge[];
  idCounter: number;
  filePath: string;
  baseLineOffset: number;
}

function makeId(prefix: string, ctx: ExtractContext): string {
  const id = `${prefix}_${ctx.idCounter}`;
  ctx.idCounter++;
  return id;
}

function extractCallLabel(text: string): string {
  // Clean up call text for label
  let label = text.trim();
  // Remove await
  label = label.replace(/^await\s+/, '');
  // Remove variable assignment prefix: final x = ..., var x = ..., Type x = ...
  label = label.replace(/^(?:final|var|const)\s+\w+\s*=\s*/, '');
  label = label.replace(/^\w+(?:<[^>]*>)?\s+\w+\s*=\s*/, '');
  label = label.replace(/^\w+\s*=\s*/, '');
  // Remove await again (might be after assignment)
  label = label.replace(/^await\s+/, '');
  // Remove arguments
  label = label.replace(/\(.*$/s, '');
  // Remove trailing semicolons
  label = label.replace(/;$/, '');
  // Remove leading underscore from private methods
  label = label.replace(/\b_(\w)/g, '$1');
  return label;
}

function walkStatements(stmts: DartStatement[], ctx: ExtractContext, previousId: string): string {
  let lastId = previousId;

  for (const stmt of stmts) {
    switch (stmt.kind) {
      case 'if': {
        lastId = walkIf(stmt, ctx, lastId);
        break;
      }
      case 'switch': {
        lastId = walkSwitch(stmt, ctx, lastId);
        break;
      }
      case 'call':
      case 'variable': {
        const callLabel = extractCallLabel(stmt.text);
        if (!callLabel || callLabel.length < 2) break;
        const id = makeId('task', ctx);
        const calls = [callLabel];
        const logicType = classifyLogicType(calls, stmt.text);
        const node: IRNode = {
          id,
          type: 'task',
          label: callLabel,
          code_ref: `${ctx.filePath}:${stmt.line}`,
          logic_type: logicType,
          confidence: 'static_only',
          calls,
          span_name: null,
          decision_point: null,
          reason_codes: [],
        };
        if (logicType === 'probabilistic') node.model = 'unknown';
        ctx.nodes.push(node);
        ctx.edges.push({ from: lastId, to: id, confidence: 'static_only' });
        lastId = id;
        break;
      }
      case 'return': {
        // If the return has a function call, create a task for it
        if (stmt.text.includes('(')) {
          const callLabel = extractCallLabel(stmt.text);
          if (callLabel && callLabel.length >= 2) {
            const id = makeId('task', ctx);
            const calls = [callLabel];
            const logicType = classifyLogicType(calls, stmt.text);
            const node: IRNode = {
              id,
              type: 'task',
              label: callLabel,
              code_ref: `${ctx.filePath}:${stmt.line}`,
              logic_type: logicType,
              confidence: 'static_only',
              calls,
              span_name: null,
              decision_point: null,
              reason_codes: [],
            };
            ctx.nodes.push(node);
            ctx.edges.push({ from: lastId, to: id, confidence: 'static_only' });
            lastId = id;
          }
        }
        break;
      }
      case 'try': {
        if (stmt.tryBody) {
          const innerStmts = parseStatements(stmt.tryBody, stmt.line);
          lastId = walkStatements(innerStmts, ctx, lastId);
        }
        break;
      }
      case 'for': {
        if (stmt.loopBody) {
          const innerStmts = parseStatements(stmt.loopBody, stmt.line);
          lastId = walkStatements(innerStmts, ctx, lastId);
        }
        break;
      }
    }
  }

  return lastId;
}

function walkIf(stmt: DartStatement, ctx: ExtractContext, previousId: string): string {
  const condText = stmt.condition || 'condition';
  const decisionId = makeId('decision', ctx);

  const decisionNode: IRNode = {
    id: decisionId,
    type: 'decision',
    label: condText.length > 40 ? condText.slice(0, 37) + '...' : condText,
    code_ref: `${ctx.filePath}:${stmt.line}`,
    logic_type: classifyLogicType([], condText),
    confidence: 'static_only',
    reason_codes: [],
  };
  ctx.nodes.push(decisionNode);
  ctx.edges.push({ from: previousId, to: decisionId, confidence: 'static_only' });

  // Then branch
  let thenLastId = decisionId;
  if (stmt.thenBody) {
    const thenStmts = parseStatements(stmt.thenBody, stmt.line);
    thenLastId = walkStatements(thenStmts, ctx, decisionId);
  }
  // Mark first edge from decision as "yes"
  const yesEdge = ctx.edges.find(e => e.from === decisionId && !e.condition);
  if (yesEdge) yesEdge.condition = 'yes';

  // Else branch
  let elseLastId = decisionId;
  if (stmt.elseBody) {
    const elseStmts = parseStatements(stmt.elseBody, stmt.line);
    elseLastId = walkStatements(elseStmts, ctx, decisionId);
    const elseEdge = ctx.edges.find(e => e.from === decisionId && e.to !== (yesEdge?.to) && !e.condition);
    if (elseEdge) elseEdge.condition = 'no';
  }

  // Merge
  const mergeId = makeId('merge', ctx);

  if (!stmt.elseBody) {
    const merge: IRNode = { id: mergeId, type: 'task', label: '(merge)', logic_type: 'deterministic', confidence: 'static_only' };
    ctx.nodes.push(merge);
    ctx.edges.push({ from: decisionId, to: mergeId, condition: 'no', confidence: 'static_only' });
    if (thenLastId !== decisionId) {
      ctx.edges.push({ from: thenLastId, to: mergeId, confidence: 'static_only' });
    }
    return mergeId;
  }

  if (thenLastId !== decisionId && elseLastId !== decisionId && thenLastId !== elseLastId) {
    const merge: IRNode = { id: mergeId, type: 'task', label: '(merge)', logic_type: 'deterministic', confidence: 'static_only' };
    ctx.nodes.push(merge);
    ctx.edges.push({ from: thenLastId, to: mergeId, confidence: 'static_only' });
    ctx.edges.push({ from: elseLastId, to: mergeId, confidence: 'static_only' });
    return mergeId;
  }

  return thenLastId !== decisionId ? thenLastId : elseLastId !== decisionId ? elseLastId : decisionId;
}

function walkSwitch(stmt: DartStatement, ctx: ExtractContext, previousId: string): string {
  const exprText = stmt.condition || 'switch';
  const decisionId = makeId('decision', ctx);

  const decisionNode: IRNode = {
    id: decisionId,
    type: 'decision',
    label: exprText.length > 40 ? exprText.slice(0, 37) + '...' : exprText,
    code_ref: `${ctx.filePath}:${stmt.line}`,
    logic_type: classifyLogicType([], exprText),
    confidence: 'static_only',
    reason_codes: [],
  };
  ctx.nodes.push(decisionNode);
  ctx.edges.push({ from: previousId, to: decisionId, confidence: 'static_only' });

  const caseEnds: string[] = [];
  if (stmt.cases) {
    for (const c of stmt.cases) {
      const caseStmts = parseStatements(`{${c.body}}`, stmt.line);
      const lastId = walkStatements(caseStmts, ctx, decisionId);

      const caseEdge = ctx.edges.find(
        e => e.from === decisionId && !e.condition && !caseEnds.includes(e.to)
      );
      if (caseEdge) caseEdge.condition = c.label;

      if (lastId !== decisionId) caseEnds.push(lastId);
    }
  }

  if (caseEnds.length > 1) {
    const mergeId = makeId('merge', ctx);
    const merge: IRNode = { id: mergeId, type: 'task', label: '(merge)', logic_type: 'deterministic', confidence: 'static_only' };
    ctx.nodes.push(merge);
    for (const end of caseEnds) {
      ctx.edges.push({ from: end, to: mergeId, confidence: 'static_only' });
    }
    return mergeId;
  }

  return caseEnds.length === 1 ? caseEnds[0] : decisionId;
}

// ─── Label cleanup (Dart-specific extensions) ───

function cleanLabel(raw: string): string {
  let label = raw;
  label = label.replace(/^(this\.|await\s+|self\.)/, '');
  label = label.replace(/\(.*\)$/s, '');
  // ref.watch/ref.read → Provider name
  const refMatch = label.match(/ref\.(?:watch|read|listen)\s*\(\s*(\w+)/);
  if (refMatch) label = refMatch[1];
  if (label.includes('.')) {
    const parts = label.split('.');
    const meaningful = parts.filter(p => !['this', 'await', 'self', 'ref', 'context', 'widget'].includes(p));
    label = meaningful.length >= 2 ? meaningful.slice(-2).join(' ') : meaningful[meaningful.length - 1] || label;
  }
  label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
  label = label.replace(/_/g, ' ');
  label = label
    .replace(/^get /i, 'Fetch ')
    .replace(/^set /i, 'Update ')
    .replace(/^is /i, 'Check if ')
    .replace(/^has /i, 'Check has ')
    .replace(/^find /i, 'Look up ')
    .replace(/^create /i, 'Create ')
    .replace(/^delete /i, 'Remove ')
    .replace(/^update /i, 'Update ')
    .replace(/^send /i, 'Send ')
    .replace(/^fetch /i, 'Fetch ')
    .replace(/^validate /i, 'Validate ')
    .replace(/^check /i, 'Check ')
    .replace(/^handle /i, 'Handle ')
    .replace(/^process /i, 'Process ')
    .replace(/^build /i, 'Build ')
    .replace(/^navigate /i, 'Navigate ')
    .replace(/^push /i, 'Navigate to ')
    .replace(/^pop /i, 'Go back ')
    .replace(/^show /i, 'Show ')
    .replace(/^dismiss /i, 'Dismiss ')
    .replace(/^load /i, 'Load ')
    .replace(/^save /i, 'Save ')
    .replace(/^notify /i, 'Notify ')
    .replace(/^emit /i, 'Emit ');
  label = label.replace(/\b\w/g, c => c.toUpperCase());
  label = label.trim();
  if (label.length > 50) label = label.slice(0, 47) + '...';
  return label || raw;
}

function cleanDecisionLabel(raw: string): string {
  let label = raw;
  label = label.replace(/^!/, 'Not ');
  label = label.replace(/\s*==\s*/g, ' equals ');
  label = label.replace(/\s*!=\s*/g, ' not equals ');
  label = label.replace(/\s*&&\s*/g, ' and ');
  label = label.replace(/\s*\|\|\s*/g, ' or ');
  label = label.replace(/\.length\s*/g, ' count ');
  label = label.replace(/\.isEmpty\s*/g, ' is empty ');
  label = label.replace(/\.isNotEmpty\s*/g, ' is not empty ');
  label = label.replace(/\.contains\([^)]*\)/g, ' contains');
  label = label.replace(/['"]/g, '');
  label = label.replace(/\./g, ' ');
  label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
  label = label.replace(/_/g, ' ');
  label = label.trim();
  if (!label.endsWith('?')) label += '?';
  label = label.charAt(0).toUpperCase() + label.slice(1);
  if (label.length > 50) label = label.slice(0, 47) + '...';
  return label || raw;
}

function cleanFlowLabels(flow: IRFlow): void {
  for (const node of flow.nodes) {
    if (node.type === 'start' || node.type === 'end') continue;
    if (node.label === '(merge)') continue;
    node.label = node.type === 'decision' ? cleanDecisionLabel(node.label) : cleanLabel(node.label);
  }
}

// ─── Utility ───

function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/^_/, '')
    .replace(/-/g, '_')
    .toLowerCase();
}

function deriveFlowId(filePath: string, functionName: string): string {
  const cleanName = functionName.replace(/^\w+\./, ''); // Remove class prefix
  if (cleanName.startsWith('handle') || cleanName.length > 3) {
    return toSnakeCase(cleanName).replace(/_/g, '-');
  }
  const parts = filePath.replace(/\.dart$/, '').split('/');
  return parts.slice(-2).join('-').replace(/_/g, '-');
}

function deriveTitle(flowId: string): string {
  return flowId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ─── Find function at line ───

function findFunctionAtLine(content: string, targetLine: number): { name: string; bodyText: string; startLine: number } | null {
  const lines = content.split('\n');

  // Check Riverpod providers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of [
      /final\s+(\w+)\s*=\s*(?:State)?(?:Notifier)?Provider(?:<[^>]*>)?\s*\(/,
      /final\s+(\w+)\s*=\s*FutureProvider(?:<[^>]*>)?\s*\(/,
      /final\s+(\w+)\s*=\s*StreamProvider(?:<[^>]*>)?\s*\(/,
      /final\s+(\w+)\s*=\s*ChangeNotifierProvider(?:<[^>]*>)?\s*\(/,
    ]) {
      const match = line.match(pattern);
      if (match && match[1] && i + 1 === targetLine) {
        const lineStart = content.indexOf(line);
        const bracePos = content.indexOf('{', lineStart);
        if (bracePos !== -1) {
          const endBrace = findMatchingBrace(content, bracePos);
          if (endBrace !== -1) {
            return { name: match[1], bodyText: content.slice(bracePos, endBrace + 1), startLine: i + 1 };
          }
        }
      }
    }
  }

  // Check @riverpod annotated functions
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '@riverpod' || lines[i].trim().startsWith('@Riverpod(')) {
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        if (j + 1 === targetLine) {
          const fnMatch = lines[j].match(/^\s*(?:\w+\s+)*(\w+)\s*\(/);
          if (fnMatch) {
            const lineStart = lines.slice(0, j).join('\n').length + 1;
            const bracePos = content.indexOf('{', lineStart);
            if (bracePos !== -1) {
              const endBrace = findMatchingBrace(content, bracePos);
              if (endBrace !== -1) {
                return { name: fnMatch[1], bodyText: content.slice(bracePos, endBrace + 1), startLine: j + 1 };
              }
            }
          }
        }
      }
    }
  }

  // Check regular functions and methods
  const funcRegex = /^(\s*)(?:static\s+)?(?:(?:Future|Stream|FutureOr)\s*<[^>]*>\s+|(?:void|int|double|String|bool|dynamic|List|Map|Set|num)\s+|(\w+)\s+)?(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?:async\s*\*?\s*)?{/gm;

  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (lineNum !== targetLine) continue;

    const funcName = match[3];
    const bracePos = content.indexOf('{', match.index + match[0].length - 1);
    if (bracePos !== -1) {
      const endBrace = findMatchingBrace(content, bracePos);
      if (endBrace !== -1) {
        // Determine class name
        let className: string | undefined;
        const indent = match[1];
        if (indent.length >= 2) {
          const linesBefore = lines.slice(0, lineNum - 1);
          for (let k = linesBefore.length - 1; k >= 0; k--) {
            const classMatch = linesBefore[k].match(/^\s*(?:abstract\s+)?class\s+(\w+)/);
            if (classMatch) { className = classMatch[1]; break; }
          }
        }
        const name = className ? `${className}.${funcName}` : funcName;
        return { name, bodyText: content.slice(bracePos, endBrace + 1), startLine: lineNum };
      }
    }
  }

  return null;
}

// ─── Main extraction entry point ───

export function extractDartFunction(
  filePath: string,
  line: number,
  outputDir: string,
  serviceName?: string,
): IRFlow | null {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    console.error(`Could not read: ${filePath}`);
    return null;
  }

  const found = findFunctionAtLine(content, line);
  if (!found) {
    console.error(`No function found at ${filePath}:${line}`);
    return null;
  }

  const relPath = relative(process.cwd(), filePath);
  const flowId = deriveFlowId(relPath, found.name);

  const ctx: ExtractContext = {
    nodes: [],
    edges: [],
    idCounter: 1,
    filePath: relPath,
    baseLineOffset: found.startLine,
  };

  // Start node
  ctx.nodes.push({ id: 'start', type: 'start', label: 'Start', confidence: 'static_only' });

  // Parse and walk
  const stmts = parseStatements(found.bodyText, found.startLine);
  let lastId = walkStatements(stmts, ctx, 'start');

  // End node
  ctx.nodes.push({ id: 'end', type: 'end', label: 'End', confidence: 'static_only' });
  ctx.edges.push({ from: lastId, to: 'end', confidence: 'static_only' });

  const exitPoints = ctx.nodes.filter(n => n.type === 'end').map(n => n.id);

  const flow: IRFlow = {
    flow: flowId,
    version: 1,
    title: deriveTitle(flowId),
    description: `Auto-extracted flow from ${found.name} in ${relPath}`,
    service: serviceName || basename(dirname(process.cwd())),
    module: relPath.replace(/\.dart$/, ''),
    status: 'draft',
    last_extracted: new Date().toISOString(),
    nodes: ctx.nodes,
    edges: ctx.edges,
    entry_point: 'start',
    exit_points: exitPoints.length > 0 ? exitPoints : ['end'],
  };

  // Clean labels
  cleanFlowLabels(flow);

  // Write
  const outputPath = join(outputDir, `${flowId}.yaml`);
  mkdirSync(outputDir, { recursive: true });
  const yamlContent = yaml.dump(flow, { lineWidth: 120, noRefs: true });
  writeFileSync(outputPath, yamlContent);

  return flow;
}

/**
 * Extract all public functions from a Dart file.
 */
export function extractAllDartExports(filePath: string, outputDir: string, serviceName?: string): IRFlow[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    console.error(`Could not read: ${filePath}`);
    return [];
  }

  // Re-use the scanner's parsing logic
  const lines = content.split('\n');
  const flows: IRFlow[] = [];

  // Find all function start lines
  const funcRegex = /^(\s*)(?:static\s+)?(?:(?:Future|Stream|FutureOr)\s*<[^>]*>\s+|(?:void|int|double|String|bool|dynamic|List|Map|Set|num)\s+|(\w+)\s+)?(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?:async\s*\*?\s*)?{/gm;
  const providerRegex = /final\s+(\w+)\s*=\s*(?:State)?(?:Notifier)?(?:Future|Stream|ChangeNotifier)?Provider(?:<[^>]*>)?\s*\(/;

  const startLines: number[] = [];

  // Providers
  for (let i = 0; i < lines.length; i++) {
    if (providerRegex.test(lines[i])) startLines.push(i + 1);
  }

  // Functions
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const funcName = match[3];
    if (!funcName || funcName === 'main' || funcName === 'build' || funcName.startsWith('_')) continue;
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (!startLines.includes(lineNum)) startLines.push(lineNum);
  }

  for (const line of startLines) {
    const flow = extractDartFunction(filePath, line, outputDir, serviceName);
    if (flow) flows.push(flow);
  }

  return flows;
}

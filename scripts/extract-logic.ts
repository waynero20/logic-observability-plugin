import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename, dirname, relative } from 'path';
import { Project, SyntaxKind, Node, SourceFile } from 'ts-morph';
import yaml from 'js-yaml';
import { validate } from './validate-ir.js';

// ─── Types ───

interface IRNode {
  id: string;
  type: 'task' | 'decision' | 'start' | 'end' | 'parallel_split' | 'parallel_join';
  label: string;
  code_ref?: string;
  logic_type?: 'deterministic' | 'configurable' | 'probabilistic';
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

// ─── AI / Config detection ───

const AI_CALL_PATTERNS = [
  'anthropic.messages.create',
  'anthropic.completions.create',
  'openai.chat.completions.create',
  'openai.completions.create',
  '.messages.create',
];

const CONFIG_PATTERNS = [
  'process.env',
  'config.',
  'Config.',
  'settings.',
  'Settings.',
  'getConfig',
  'getSettings',
  '.env.',
];

const TRACER_PATTERNS = ['tracer.span', 'tracer.startSpan', '.startActiveSpan'];

function classifyLogicType(callTexts: string[], bodyText: string): 'deterministic' | 'configurable' | 'probabilistic' {
  if (callTexts.some(c => AI_CALL_PATTERNS.some(p => c.includes(p)))) return 'probabilistic';
  if (callTexts.some(c => CONFIG_PATTERNS.some(p => c.includes(p))) || CONFIG_PATTERNS.some(p => bodyText.includes(p))) return 'configurable';
  return 'deterministic';
}

function findTracerSpan(node: Node): string | null {
  for (const call of node.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const text = call.getExpression().getText();
    if (TRACER_PATTERNS.some(p => text.includes(p))) {
      const args = call.getArguments();
      if (args.length > 0) {
        const spanName = args[0].getText().replace(/['"]/g, '');
        return spanName;
      }
    }
  }
  return null;
}

function findCalls(node: Node): string[] {
  const calls: string[] = [];
  for (const callExpr of node.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    calls.push(callExpr.getExpression().getText());
  }
  return [...new Set(calls)];
}

// ─── AST walking → IR nodes/edges ───

interface ExtractContext {
  nodes: IRNode[];
  edges: IREdge[];
  idCounter: number;
  sourceFile: SourceFile;
  filePath: string;
}

function makeId(prefix: string, ctx: ExtractContext): string {
  const id = `${prefix}_${ctx.idCounter}`;
  ctx.idCounter++;
  return id;
}

function toSnakeCase(name: string): string {
  return name
    // Keep acronym runs together: "checkLLMResponse" → "check_LLM_Response"
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // Split camelCase: "checkResponse" → "check_Response"
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/^_/, '')
    .replace(/-/g, '_')
    .toLowerCase();
}

function extractCallNode(call: Node, ctx: ExtractContext): string {
  const callText = call.getText();
  const callName = call.getKind() === SyntaxKind.CallExpression
    ? (call as any).getExpression().getText()
    : callText;

  const id = makeId('task', ctx);
  const calls = [callName];
  const logicType = classifyLogicType(calls, callText);

  const node: IRNode = {
    id,
    type: 'task',
    label: callName,
    code_ref: `${ctx.filePath}:${call.getStartLineNumber()}`,
    logic_type: logicType,
    calls,
    span_name: null,
    decision_point: null,
    reason_codes: [],
  };

  if (logicType === 'probabilistic') {
    node.model = 'unknown';
  }

  ctx.nodes.push(node);
  return id;
}

function walkBlock(statements: Node[], ctx: ExtractContext, previousId: string): string {
  let lastId = previousId;

  for (const stmt of statements) {
    if (Node.isIfStatement(stmt)) {
      lastId = walkIfStatement(stmt, ctx, lastId);
    } else if (Node.isSwitchStatement(stmt)) {
      lastId = walkSwitchStatement(stmt, ctx, lastId);
    } else if (Node.isExpressionStatement(stmt)) {
      const expr = stmt.getExpression();
      if (Node.isCallExpression(expr)) {
        const callId = extractCallNode(expr, ctx);
        ctx.edges.push({ from: lastId, to: callId });
        lastId = callId;
      } else if (Node.isAwaitExpression(expr)) {
        const inner = expr.getExpression();
        if (inner && Node.isCallExpression(inner)) {
          const callId = extractCallNode(inner, ctx);
          ctx.edges.push({ from: lastId, to: callId });
          lastId = callId;
        }
      }
    } else if (Node.isVariableStatement(stmt)) {
      // Check if the variable is initialized with a call expression
      for (const decl of stmt.getDeclarations()) {
        const init = decl.getInitializer();
        if (init && Node.isCallExpression(init)) {
          const callId = extractCallNode(init, ctx);
          ctx.edges.push({ from: lastId, to: callId });
          lastId = callId;
        } else if (init && Node.isAwaitExpression(init)) {
          const inner = init.getExpression();
          if (inner && Node.isCallExpression(inner)) {
            const callId = extractCallNode(inner, ctx);
            ctx.edges.push({ from: lastId, to: callId });
            lastId = callId;
          }
        }
      }
    } else if (Node.isReturnStatement(stmt)) {
      const expr = stmt.getExpression();
      if (expr && Node.isCallExpression(expr)) {
        const callId = extractCallNode(expr, ctx);
        ctx.edges.push({ from: lastId, to: callId });
        lastId = callId;
      }
    } else if (Node.isTryStatement(stmt)) {
      // Walk the try block as a sequence
      const tryBlock = stmt.getTryBlock();
      if (tryBlock) {
        lastId = walkBlock(tryBlock.getStatements(), ctx, lastId);
      }
    } else if (Node.isForOfStatement(stmt) || Node.isForInStatement(stmt) || Node.isForStatement(stmt)) {
      const body = stmt.getStatement();
      if (Node.isBlock(body)) {
        lastId = walkBlock(body.getStatements(), ctx, lastId);
      }
    }
  }

  return lastId;
}

function walkIfStatement(ifStmt: any, ctx: ExtractContext, previousId: string): string {
  const conditionText = ifStmt.getExpression()?.getText() || 'condition';
  const decisionId = makeId('decision', ctx);

  const decisionNode: IRNode = {
    id: decisionId,
    type: 'decision',
    label: conditionText.length > 40 ? conditionText.slice(0, 37) + '...' : conditionText,
    code_ref: `${ctx.filePath}:${ifStmt.getStartLineNumber()}`,
    logic_type: classifyLogicType([], conditionText),
    reason_codes: [],
  };
  ctx.nodes.push(decisionNode);
  ctx.edges.push({ from: previousId, to: decisionId });

  // Then branch ("yes" path)
  const thenBlock = ifStmt.getThenStatement();
  let thenLastId = decisionId;
  if (Node.isBlock(thenBlock)) {
    thenLastId = walkBlock(thenBlock.getStatements(), ctx, decisionId);
  }
  // Mark the first edge from decision (to then-branch) as "yes"
  const yesEdge = ctx.edges.find(e => e.from === decisionId && !e.condition);
  if (yesEdge) yesEdge.condition = 'yes';

  // Else branch ("no" path)
  const elseStmt = ifStmt.getElseStatement();
  let elseLastId = decisionId;
  if (elseStmt) {
    if (Node.isIfStatement(elseStmt)) {
      elseLastId = walkIfStatement(elseStmt, ctx, decisionId);
      const elseEdge = ctx.edges.find(e => e.from === decisionId && e.to !== (yesEdge?.to) && !e.condition);
      if (elseEdge) elseEdge.condition = 'no';
    } else if (Node.isBlock(elseStmt)) {
      elseLastId = walkBlock(elseStmt.getStatements(), ctx, decisionId);
      if (elseLastId !== decisionId) {
        const elseEdge = ctx.edges.find(e => e.from === decisionId && e.to !== (yesEdge?.to) && !e.condition);
        if (elseEdge) elseEdge.condition = 'no';
      }
    }
  }

  // Create merge point for converging paths
  const mergeId = makeId('merge', ctx);

  if (!elseStmt) {
    // No else: "no" falls through. Create merge point that both paths converge to.
    const merge: IRNode = { id: mergeId, type: 'task', label: '(merge)', logic_type: 'deterministic' };
    ctx.nodes.push(merge);
    // "no" edge from decision to merge (fall-through)
    ctx.edges.push({ from: decisionId, to: mergeId, condition: 'no' });
    // then-branch also flows to merge
    if (thenLastId !== decisionId) {
      ctx.edges.push({ from: thenLastId, to: mergeId });
    }
    return mergeId;
  }

  if (thenLastId !== decisionId && elseLastId !== decisionId && thenLastId !== elseLastId) {
    // Both branches produced nodes — create a merge point
    const merge: IRNode = { id: mergeId, type: 'task', label: '(merge)', logic_type: 'deterministic' };
    ctx.nodes.push(merge);
    ctx.edges.push({ from: thenLastId, to: mergeId });
    ctx.edges.push({ from: elseLastId, to: mergeId });
    return mergeId;
  }

  return thenLastId !== decisionId ? thenLastId : elseLastId !== decisionId ? elseLastId : decisionId;
}

function walkSwitchStatement(switchStmt: any, ctx: ExtractContext, previousId: string): string {
  const exprText = switchStmt.getExpression()?.getText() || 'switch';
  const decisionId = makeId('decision', ctx);

  const decisionNode: IRNode = {
    id: decisionId,
    type: 'decision',
    label: exprText.length > 40 ? exprText.slice(0, 37) + '...' : exprText,
    code_ref: `${ctx.filePath}:${switchStmt.getStartLineNumber()}`,
    logic_type: classifyLogicType([], exprText),
    reason_codes: [],
  };
  ctx.nodes.push(decisionNode);
  ctx.edges.push({ from: previousId, to: decisionId });

  const caseEnds: string[] = [];
  for (const clause of switchStmt.getClauses()) {
    const caseLabel = Node.isCaseClause(clause)
      ? clause.getExpression()?.getText() || 'case'
      : 'default';
    const stmts = clause.getStatements();
    const lastId = walkBlock(stmts, ctx, decisionId);

    // Find the edge from decision to the first node in this case
    const caseEdge = ctx.edges.find(
      (e: IREdge) => e.from === decisionId && !e.condition && caseEnds.indexOf(e.to) === -1
    );
    if (caseEdge) caseEdge.condition = caseLabel;

    if (lastId !== decisionId) caseEnds.push(lastId);
  }

  // If multiple case branches, create merge
  if (caseEnds.length > 1) {
    const mergeId = makeId('merge', ctx);
    const merge: IRNode = { id: mergeId, type: 'task', label: '(merge)', logic_type: 'deterministic' };
    ctx.nodes.push(merge);
    for (const end of caseEnds) {
      ctx.edges.push({ from: end, to: mergeId });
    }
    return mergeId;
  }

  return caseEnds.length === 1 ? caseEnds[0] : decisionId;
}

// ─── Tracer callback unwrapping ───

const TRACER_CALL_PATTERNS = ['tracer.span', 'tracer.startSpan', 'tracer.startTrace', '.startActiveSpan'];

function tryUnwrapTracerCallback(block: Node): Node | null {
  if (!Node.isBlock(block)) return null;
  const stmts = (block as any).getStatements();
  if (!stmts || stmts.length !== 1) return null;

  const stmt = stmts[0];
  // Handle: return tracer.span(...)
  let callExpr: Node | undefined;
  if (Node.isReturnStatement(stmt)) {
    const expr = stmt.getExpression();
    if (expr && Node.isCallExpression(expr)) {
      callExpr = expr;
    } else if (expr && Node.isAwaitExpression(expr)) {
      const inner = expr.getExpression();
      if (inner && Node.isCallExpression(inner)) callExpr = inner;
    }
  }
  // Handle: tracer.span(...) as expression statement
  if (!callExpr && Node.isExpressionStatement(stmt)) {
    const expr = stmt.getExpression();
    if (Node.isCallExpression(expr)) {
      callExpr = expr;
    } else if (Node.isAwaitExpression(expr)) {
      const inner = expr.getExpression();
      if (inner && Node.isCallExpression(inner)) callExpr = inner;
    }
  }

  if (!callExpr || !Node.isCallExpression(callExpr)) return null;

  const callText = (callExpr as any).getExpression().getText();
  if (!TRACER_CALL_PATTERNS.some(p => callText.includes(p))) return null;

  // Find the callback argument (last argument that is an arrow function or function expression)
  const args = (callExpr as any).getArguments();
  for (let i = args.length - 1; i >= 0; i--) {
    const arg = args[i];
    if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) {
      const cbBody = arg.getBody();
      if (cbBody && Node.isBlock(cbBody)) return cbBody;
      break;
    }
  }

  return null;
}

// ─── Main extraction ───

function deriveFlowId(filePath: string, functionName: string): string {
  // Use function name if it's descriptive, otherwise use module path
  if (functionName.startsWith('handle') || functionName.length > 3) {
    return toSnakeCase(functionName).replace(/_/g, '-');
  }
  const parts = filePath.replace(/\.(ts|tsx)$/, '').split('/');
  return parts.slice(-2).join('-').replace(/_/g, '-');
}

function deriveTitle(flowId: string): string {
  return flowId
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function extractFunction(
  filePath: string,
  line: number,
  outputDir: string,
  serviceName?: string,
): IRFlow | null {
  const project = new Project({ compilerOptions: { allowJs: true } });
  project.addSourceFilesAtPaths(filePath);

  const sourceFile = project.getSourceFiles()[0];
  if (!sourceFile) {
    console.error(`Could not load: ${filePath}`);
    return null;
  }

  // Find the function at the given line
  let targetNode: Node | undefined;
  let functionName = 'unknown';

  for (const fn of sourceFile.getFunctions()) {
    if (fn.getStartLineNumber() <= line && fn.getEndLineNumber() >= line) {
      targetNode = fn;
      functionName = fn.getName() || 'anonymous';
      break;
    }
  }

  if (!targetNode) {
    for (const cls of sourceFile.getClasses()) {
      for (const method of cls.getMethods()) {
        if (method.getStartLineNumber() <= line && method.getEndLineNumber() >= line) {
          targetNode = method;
          functionName = `${cls.getName()}.${method.getName()}`;
          break;
        }
      }
    }
  }

  if (!targetNode) {
    for (const varStmt of sourceFile.getVariableStatements()) {
      for (const decl of varStmt.getDeclarations()) {
        const init = decl.getInitializer();
        if (init && Node.isArrowFunction(init) &&
            decl.getStartLineNumber() <= line && init.getEndLineNumber() >= line) {
          targetNode = init;
          functionName = decl.getName();
          break;
        }
      }
    }
  }

  if (!targetNode) {
    console.error(`No function found at ${filePath}:${line}`);
    return null;
  }

  const relPath = relative(process.cwd(), filePath);
  const flowId = deriveFlowId(relPath, functionName);

  const ctx: ExtractContext = {
    nodes: [],
    edges: [],
    idCounter: 1,
    sourceFile,
    filePath: relPath,
  };

  // Start node
  const startNode: IRNode = { id: 'start', type: 'start', label: 'Start' };
  ctx.nodes.push(startNode);

  // Walk the function body — unwrap tracer.span/startTrace callbacks
  let body: Node | undefined;
  if (Node.isFunctionDeclaration(targetNode) || Node.isMethodDeclaration(targetNode)) {
    body = targetNode.getBody();
  } else if (Node.isArrowFunction(targetNode)) {
    body = targetNode.getBody();
  }

  // Check if body is a single return of tracer.span(name, meta, callback)
  // If so, unwrap and extract from the callback body instead
  if (body && Node.isBlock(body)) {
    const unwrapped = tryUnwrapTracerCallback(body);
    if (unwrapped) {
      body = unwrapped;
    }
  }

  let lastId = 'start';
  if (body && Node.isBlock(body)) {
    lastId = walkBlock(body.getStatements(), ctx, 'start');
  }

  // End node
  const endNode: IRNode = { id: 'end', type: 'end', label: 'End' };
  ctx.nodes.push(endNode);
  ctx.edges.push({ from: lastId, to: 'end' });

  // Find tracer span and attach to first task node if found
  const spanName = findTracerSpan(targetNode);
  if (spanName) {
    const firstTask = ctx.nodes.find(n => n.type === 'task' && n.id !== 'start');
    if (firstTask) firstTask.span_name = spanName;
  }

  // Build exit points
  const exitPoints = ctx.nodes
    .filter(n => n.type === 'end')
    .map(n => n.id);

  const flow: IRFlow = {
    flow: flowId,
    version: 1,
    title: deriveTitle(flowId),
    description: `Auto-extracted flow from ${functionName} in ${relPath}`,
    service: serviceName || basename(dirname(process.cwd())),
    module: relPath.replace(/\.(ts|tsx)$/, ''),
    status: 'draft',
    last_extracted: new Date().toISOString(),
    nodes: ctx.nodes,
    edges: ctx.edges,
    entry_point: 'start',
    exit_points: exitPoints.length > 0 ? exitPoints : ['end'],
  };

  // Write to file
  const outputPath = join(outputDir, `${flowId}.yaml`);
  mkdirSync(outputDir, { recursive: true });
  const yamlContent = yaml.dump(flow, { lineWidth: 120, noRefs: true });
  writeFileSync(outputPath, yamlContent);

  return flow;
}

// ─── Label cleanup (--label flag) ───

function cleanLabel(raw: string): string {
  let label = raw;
  // Remove common prefixes like this., await, etc.
  label = label.replace(/^(this\.|await\s+)/, '');
  // tracer.span('name', ...) → use span name
  const spanMatch = label.match(/tracer\.\w+\(['"]([^'"]+)['"]/);
  if (spanMatch) {
    label = spanMatch[1].replace(/\./g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  // Function calls: remove arguments and parens
  label = label.replace(/\(.*\)$/s, '');
  // Property access chains: use last meaningful part
  if (label.includes('.')) {
    const parts = label.split('.');
    label = parts[parts.length - 1];
  }
  // CamelCase → space separated
  label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
  // snake_case → space separated
  label = label.replace(/_/g, ' ');
  // Capitalize first letter
  label = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  // Trim and limit length
  label = label.trim();
  if (label.length > 40) label = label.slice(0, 37) + '...';
  return label || raw;
}

function cleanLabels(flow: IRFlow): void {
  for (const node of flow.nodes) {
    if (node.type === 'start' || node.type === 'end') continue;
    if (node.label === '(merge)') continue;
    node.label = cleanLabel(node.label);
  }
  // Re-write the YAML file
  const outputPath = join(process.cwd(), 'docs', 'flows', `${flow.flow}.yaml`);
  if (existsSync(outputPath)) {
    const yamlContent = yaml.dump(flow, { lineWidth: 120, noRefs: true });
    writeFileSync(outputPath, yamlContent);
  }
}

// ─── Extract all exported functions from a file ───

function extractAllExports(filePath: string, outputDir: string, serviceName?: string): IRFlow[] {
  const project = new Project({ compilerOptions: { allowJs: true } });
  project.addSourceFilesAtPaths(filePath);
  const sourceFile = project.getSourceFiles()[0];
  if (!sourceFile) {
    console.error(`Could not load: ${filePath}`);
    return [];
  }

  const flows: IRFlow[] = [];

  // Exported function declarations
  for (const fn of sourceFile.getFunctions()) {
    if (fn.isExported()) {
      const line = fn.getStartLineNumber();
      const flow = extractFunction(filePath, line, outputDir, serviceName);
      if (flow) flows.push(flow);
    }
  }

  // Exported arrow functions (const x = () => ...)
  for (const varStmt of sourceFile.getVariableStatements()) {
    if (varStmt.isExported()) {
      for (const decl of varStmt.getDeclarations()) {
        const init = decl.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
          const line = decl.getStartLineNumber();
          const flow = extractFunction(filePath, line, outputDir, serviceName);
          if (flow) flows.push(flow);
        }
      }
    }
  }

  // Exported class methods
  for (const cls of sourceFile.getClasses()) {
    if (cls.isExported()) {
      for (const method of cls.getMethods()) {
        const line = method.getStartLineNumber();
        const flow = extractFunction(filePath, line, outputDir, serviceName);
        if (flow) flows.push(flow);
      }
    }
  }

  return flows;
}

// ─── CLI ───

const args = process.argv.slice(2);
const flags = args.filter((a: string) => a.startsWith('--'));
const positional = args.filter((a: string) => !a.startsWith('--'));
const jsonMode = flags.includes('--json');
const labelMode = flags.includes('--label');

if (positional.length === 0) {
  console.error('Usage: tsx scripts/extract-logic.ts <file[:line]> [<file[:line]>...] [--json] [--label]');
  console.error('  If no :line is given, extracts all exported functions from the file.');
  process.exit(1);
}

const outputDir = join(process.cwd(), 'docs', 'flows');
const results: IRFlow[] = [];

for (const ref of positional) {
  const colonIdx = ref.lastIndexOf(':');
  const hasLine = colonIdx > 0 && !isNaN(parseInt(ref.slice(colonIdx + 1), 10));

  if (hasLine) {
    const filePath = ref.slice(0, colonIdx);
    const line = parseInt(ref.slice(colonIdx + 1), 10);
    console.log(`Extracting: ${filePath}:${line}...`);
    const flow = extractFunction(filePath, line, outputDir);
    if (flow) {
      if (labelMode) cleanLabels(flow);
      const outputPath = join(outputDir, `${flow.flow}.yaml`);
      const issues = validate(outputPath);
      const errors = issues.filter((i: string) => !i.startsWith('Warning:'));
      if (errors.length > 0) {
        console.error(`  Validation errors for ${flow.flow}:`);
        errors.forEach((e: string) => console.error(`    - ${e}`));
      } else {
        console.log(`  ✓ ${flow.flow}.yaml written and validated`);
      }
      results.push(flow);
    }
  } else {
    // No line number — extract all exported functions
    console.log(`Extracting all exports from: ${ref}...`);
    const flows = extractAllExports(ref, outputDir);
    for (const flow of flows) {
      if (labelMode) cleanLabels(flow);
      const outputPath = join(outputDir, `${flow.flow}.yaml`);
      const issues = validate(outputPath);
      const errors = issues.filter((i: string) => !i.startsWith('Warning:'));
      if (errors.length > 0) {
        console.error(`  Validation errors for ${flow.flow}:`);
        errors.forEach((e: string) => console.error(`    - ${e}`));
      } else {
        console.log(`  ✓ ${flow.flow}.yaml written and validated`);
      }
      results.push(flow);
    }
  }
}

if (jsonMode) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(`\nExtracted ${results.length} flow(s). Files written to docs/flows/`);
  console.log('Run /generate-all to produce diagrams.');
}

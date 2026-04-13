import { readFileSync } from 'fs';
import yaml from 'js-yaml';

const VALID_NODE_TYPES = ['task', 'decision', 'start', 'end', 'parallel_split', 'parallel_join'];
const VALID_LOGIC_TYPES = ['deterministic', 'configurable', 'probabilistic'];
const VALID_CONFIDENCE_LEVELS = ['static_only', 'runtime_only', 'static_plus_runtime'];
const VALID_STATUSES = ['draft', 'verified'];

interface IRNode {
  id: string;
  type: string;
  label: string;
  logic_type?: string;
  confidence?: string;
  [key: string]: unknown;
}

interface RuntimeData {
  observed?: boolean;
  frequency?: number;
  error_rate?: number;
  avg_latency_ms?: number;
}

interface IREdge {
  from: string;
  to: string;
  condition?: string;
  confidence?: string;
  runtime?: RuntimeData;
  [key: string]: unknown;
}

interface IRFlow {
  flow: string;
  version: number;
  title: string;
  description: string;
  status: string;
  nodes: IRNode[];
  edges: IREdge[];
  entry_point: string;
  exit_points: string[];
  [key: string]: unknown;
}

export function validate(filePath: string): string[] {
  const errors: string[] = [];
  const warnings: string[] = [];

  let ir: IRFlow;
  try {
    const content = readFileSync(filePath, 'utf-8');
    ir = yaml.load(content) as IRFlow;
  } catch (e) {
    return [`FATAL: Cannot parse ${filePath}: ${(e as Error).message}`];
  }

  // Required metadata
  if (!ir.flow) errors.push('Missing required field: flow');
  if (!ir.title) errors.push('Missing required field: title');
  if (!ir.description) errors.push('Missing required field: description');
  if (ir.status && !VALID_STATUSES.includes(ir.status)) {
    errors.push(`Invalid status "${ir.status}": must be "draft" or "verified"`);
  }

  // Nodes
  if (!ir.nodes || ir.nodes.length === 0) {
    errors.push('Flow must have at least one node');
    return errors;
  }

  const nodeIds = new Set<string>();
  for (const node of ir.nodes) {
    if (!node.id) { errors.push('Node missing id'); continue; }
    if (nodeIds.has(node.id)) errors.push(`Duplicate node ID: "${node.id}"`);
    nodeIds.add(node.id);

    if (!node.label) errors.push(`Node "${node.id}" missing label`);
    if (!VALID_NODE_TYPES.includes(node.type)) {
      errors.push(`Node "${node.id}" has invalid type "${node.type}"`);
    }
    if (['task', 'decision'].includes(node.type)) {
      if (!node.logic_type) {
        errors.push(`Node "${node.id}" (${node.type}) missing logic_type`);
      } else if (!VALID_LOGIC_TYPES.includes(node.logic_type)) {
        errors.push(`Node "${node.id}" has invalid logic_type "${node.logic_type}"`);
      }
    }
    if (node.confidence && !VALID_CONFIDENCE_LEVELS.includes(node.confidence)) {
      errors.push(`Node "${node.id}" has invalid confidence "${node.confidence}"`);
    }
  }

  // Edges
  if (!ir.edges) errors.push('Missing edges array');
  else {
    for (const edge of ir.edges) {
      if (!nodeIds.has(edge.from)) errors.push(`Edge references unknown source node: "${edge.from}"`);
      if (!nodeIds.has(edge.to)) errors.push(`Edge references unknown target node: "${edge.to}"`);
      if (edge.confidence && !VALID_CONFIDENCE_LEVELS.includes(edge.confidence)) {
        errors.push(`Edge ${edge.from}→${edge.to} has invalid confidence "${edge.confidence}"`);
      }
      if (edge.runtime) {
        if (typeof edge.runtime.observed !== 'boolean') {
          warnings.push(`Warning: edge ${edge.from}→${edge.to} runtime.observed should be boolean`);
        }
        if (edge.runtime.frequency !== undefined && (edge.runtime.frequency < 0 || edge.runtime.frequency > 1)) {
          errors.push(`Edge ${edge.from}→${edge.to} runtime.frequency must be 0.0–1.0`);
        }
        if (edge.runtime.error_rate !== undefined && (edge.runtime.error_rate < 0 || edge.runtime.error_rate > 1)) {
          errors.push(`Edge ${edge.from}→${edge.to} runtime.error_rate must be 0.0–1.0`);
        }
      }
    }
  }

  // Entry/exit points
  if (ir.entry_point && !nodeIds.has(ir.entry_point)) {
    errors.push(`entry_point references unknown node: "${ir.entry_point}"`);
  }
  if (ir.exit_points) {
    for (const ep of ir.exit_points) {
      if (!nodeIds.has(ep)) errors.push(`exit_point references unknown node: "${ep}"`);
    }
  }

  // Reachability check (warning only)
  if (ir.entry_point && ir.edges) {
    const reachable = new Set<string>();
    const queue = [ir.entry_point];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const edge of ir.edges) {
        if (edge.from === current && !reachable.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }
    for (const node of ir.nodes) {
      if (!reachable.has(node.id)) {
        warnings.push(`Warning: node "${node.id}" is unreachable from entry_point`);
      }
    }
  }

  return [...errors, ...warnings];
}

// CLI entry point — only runs when executed directly
const isDirectRun = process.argv[1]?.includes('validate-ir');
if (isDirectRun) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: tsx scripts/validate-ir.ts <path-to-yaml>');
    process.exit(1);
  }

  const issues = validate(filePath);
  if (issues.length === 0) {
    console.log(`✓ ${filePath} is valid`);
    process.exit(0);
  } else {
    const errors = issues.filter(i => !i.startsWith('Warning:'));
    const warnings = issues.filter(i => i.startsWith('Warning:'));
    if (errors.length > 0) {
      console.error(`✗ ${filePath} has ${errors.length} error(s):`);
      errors.forEach(e => console.error(`  - ${e}`));
    }
    if (warnings.length > 0) {
      warnings.forEach(w => console.warn(`  ${w}`));
    }
    process.exit(errors.length > 0 ? 1 : 0);
  }
}

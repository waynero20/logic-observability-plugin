import { readFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import dagre from '@dagrejs/dagre';

// ─── Types ───

export type ConfidenceLevel = 'static_only' | 'runtime_only' | 'static_plus_runtime';

export interface RuntimeData {
  observed: boolean;
  frequency?: number;
  error_rate?: number;
  avg_latency_ms?: number;
}

export interface IRNode {
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

export interface IREdge {
  from: string;
  to: string;
  condition?: string;
  reason_code?: string;
  confidence?: ConfidenceLevel;
  runtime?: RuntimeData;
}

export interface IRFlow {
  flow: string;
  version: number;
  title: string;
  description: string;
  service?: string;
  module?: string;
  status: string;
  last_extracted?: string;
  nodes: IRNode[];
  edges: IREdge[];
  entry_point: string;
  exit_points: string[];
  estimated_duration_ms?: string;
  error_modes?: string[];
}

export interface PositionedNode extends IRNode {
  position: { x: number; y: number };
  width: number;
  height: number;
}

// ─── Load IR files ───

// Normalize steps-format YAML into the nodes/edges IR format
function normalizeFlow(raw: any): IRFlow | null {
  // Already in IR format
  if (raw.nodes && raw.edges) return raw as IRFlow;

  // Steps-format: convert to IR
  if (!raw.steps || !Array.isArray(raw.steps) || raw.steps.length === 0) return null;

  const nodes: IRNode[] = [];
  const edges: IREdge[] = [];

  nodes.push({ id: '__start', type: 'start', label: 'Start' });

  for (const step of raw.steps) {
    const hasOutcome = step.outcome && typeof step.outcome === 'object';
    const callsList = step.calls
      ? (typeof step.calls === 'string' ? step.calls.split(',').map((s: string) => s.trim()) : step.calls)
      : undefined;

    nodes.push({
      id: step.id,
      type: hasOutcome ? 'decision' : 'task',
      label: step.label || step.id,
      logic_type: step.logic_type || 'deterministic',
      calls: callsList,
      description: step.description,
      code_ref: step.code_ref,
    });
  }

  nodes.push({ id: '__end', type: 'end', label: 'End' });

  edges.push({ from: '__start', to: raw.steps[0].id });
  for (let i = 0; i < raw.steps.length - 1; i++) {
    edges.push({ from: raw.steps[i].id, to: raw.steps[i + 1].id });
  }
  edges.push({ from: raw.steps[raw.steps.length - 1].id, to: '__end' });

  return {
    flow: raw.id || raw.flow || 'unknown',
    version: raw.version || 1,
    title: raw.name || raw.title || raw.id || 'Untitled',
    description: raw.description || '',
    service: raw.service,
    module: raw.module,
    status: raw.status || 'draft',
    nodes,
    edges,
    entry_point: '__start',
    exit_points: ['__end'],
  };
}

export function loadFlows(flowsDir?: string): IRFlow[] {
  const dir = flowsDir || join(process.cwd(), 'docs', 'flows');
  const files = readdirSync(dir).filter(f =>
    (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.startsWith('.')
  );

  const flows: IRFlow[] = [];
  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), 'utf-8');
      const raw = yaml.load(content) as any;
      if (!raw) continue;
      const flow = normalizeFlow(raw);
      if (flow) flows.push(flow);
    } catch (e) {
      console.warn(`Skipping ${file}: ${(e as Error).message}`);
    }
  }
  return flows;
}

export function ensureOutputDir(dir?: string): string {
  const outputDir = dir || join(process.cwd(), 'docs', 'flows', 'generated');
  mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

// ─── Layout with dagre ───

export function layoutNodes(nodes: IRNode[], edges: IREdge[]): PositionedNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 250, nodesep: 100, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    let dims: { width: number; height: number };
    if (node.type === 'task') {
      const labelLen = node.label.length;
      const callsLen = node.calls ? `calls: ${node.calls.join(', ')}`.length : 0;
      const textLen = Math.max(labelLen, callsLen);
      const w = Math.max(260, Math.min(400, textLen * 8 + 40));
      const charsPerLine = Math.floor((w - 40) / 7.5);
      const labelLines = Math.max(1, Math.ceil(labelLen / charsPerLine));
      const callsLines = callsLen > 0 ? Math.max(1, Math.ceil(callsLen / charsPerLine)) : 0;
      const totalLines = labelLines + callsLines;
      const h = Math.max(64, 44 + totalLines * 20);
      dims = { width: w, height: h };
    } else if (['decision', 'parallel_split', 'parallel_join'].includes(node.type)) {
      dims = { width: 160, height: 80 };
    } else {
      dims = { width: 80, height: 80 };
    }
    g.setNode(node.id, dims);
  }

  for (const edge of edges) {
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  return nodes.map(node => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
      width: pos.width,
      height: pos.height,
    };
  });
}

// ─── Colors ───

export const COLORS = {
  bg: '#0f0f0f',
  nodeBg: '#1a1a1a',
  text: '#e0e0e0',
  accent: '#6366f1',
  deterministic: '#22c55e',
  configurable: '#f59e0b',
  probabilistic: '#8b5cf6',
};

export function getNodeColor(logicType?: string): string {
  if (logicType === 'probabilistic') return COLORS.probabilistic;
  if (logicType === 'configurable') return COLORS.configurable;
  return COLORS.deterministic;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

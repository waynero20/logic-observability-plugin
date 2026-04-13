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

export function loadFlows(flowsDir?: string): IRFlow[] {
  const dir = flowsDir || join(process.cwd(), 'docs', 'flows');
  const files = readdirSync(dir).filter(f =>
    (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.startsWith('.')
  );

  const flows: IRFlow[] = [];
  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), 'utf-8');
      const flow = yaml.load(content) as IRFlow;
      if (flow?.flow && flow?.nodes) flows.push(flow);
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
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 60 });

  for (const node of nodes) {
    const dims = node.type === 'task'
      ? { width: 180, height: 50 }
      : ['decision', 'parallel_split', 'parallel_join'].includes(node.type)
        ? { width: 60, height: 60 }
        : { width: 40, height: 40 };
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

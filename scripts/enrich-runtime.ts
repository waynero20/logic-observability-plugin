import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

// ─── Types ───

type ConfidenceLevel = 'static_only' | 'runtime_only' | 'static_plus_runtime';

interface RuntimeData {
  observed: boolean;
  frequency?: number;
  error_rate?: number;
  avg_latency_ms?: number;
}

interface IRNode {
  id: string;
  type: string;
  label: string;
  confidence?: ConfidenceLevel;
  span_name?: string | null;
  [key: string]: unknown;
}

interface IREdge {
  from: string;
  to: string;
  confidence?: ConfidenceLevel;
  runtime?: RuntimeData;
  [key: string]: unknown;
}

interface IRFlow {
  flow: string;
  nodes: IRNode[];
  edges: IREdge[];
  [key: string]: unknown;
}

interface TraceSpanSummary {
  span_name: string;
  call_count: number;
  error_count: number;
  avg_latency_ms: number;
  // Edge-level: which downstream spans were called and how often
  downstream?: Array<{
    target_span: string;
    frequency: number;
    error_rate: number;
    avg_latency_ms: number;
  }>;
}

// ─── Load trace data ───

function loadTraceData(tracePath: string): TraceSpanSummary[] {
  const content = readFileSync(tracePath, 'utf-8');
  return JSON.parse(content) as TraceSpanSummary[];
}

// ─── Enrich a single flow ───

function enrichFlow(flow: IRFlow, traces: TraceSpanSummary[]): { enriched: boolean; nodesUpdated: number; edgesUpdated: number } {
  const spanIndex = new Map<string, TraceSpanSummary>();
  for (const t of traces) spanIndex.set(t.span_name, t);

  let nodesUpdated = 0;
  let edgesUpdated = 0;

  // Enrich nodes that have span_name
  for (const node of flow.nodes) {
    if (!node.span_name) continue;
    const trace = spanIndex.get(node.span_name);
    if (!trace) continue;

    // Upgrade confidence
    if (node.confidence === 'static_only') {
      node.confidence = 'static_plus_runtime';
    } else if (!node.confidence) {
      node.confidence = 'runtime_only';
    }
    nodesUpdated++;
  }

  // Build node-to-span map for edge enrichment
  const nodeSpanMap = new Map<string, string>();
  for (const node of flow.nodes) {
    if (node.span_name) nodeSpanMap.set(node.id, node.span_name);
  }

  // Enrich edges where both endpoints have span data
  for (const edge of flow.edges) {
    const fromSpan = nodeSpanMap.get(edge.from);
    const toSpan = nodeSpanMap.get(edge.to);
    if (!fromSpan || !toSpan) continue;

    const fromTrace = spanIndex.get(fromSpan);
    if (!fromTrace?.downstream) continue;

    const downstream = fromTrace.downstream.find(d => d.target_span === toSpan);
    if (!downstream) continue;

    edge.runtime = {
      observed: true,
      frequency: downstream.frequency,
      error_rate: downstream.error_rate,
      avg_latency_ms: downstream.avg_latency_ms,
    };

    if (edge.confidence === 'static_only') {
      edge.confidence = 'static_plus_runtime';
    } else if (!edge.confidence) {
      edge.confidence = 'runtime_only';
    }
    edgesUpdated++;
  }

  return { enriched: nodesUpdated > 0 || edgesUpdated > 0, nodesUpdated, edgesUpdated };
}

// ─── CLI ───

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: tsx scripts/enrich-runtime.ts <trace-data.json> [flows-dir]');
  console.error('');
  console.error('trace-data.json: JSON array of TraceSpanSummary objects');
  console.error('  Each entry: { span_name, call_count, error_count, avg_latency_ms, downstream? }');
  console.error('  downstream: [{ target_span, frequency, error_rate, avg_latency_ms }]');
  console.error('');
  console.error('Export from your OTEL backend (Honeycomb, Jaeger, etc.) and pass here.');
  process.exit(1);
}

const tracePath = args[0];
const flowsDir = args[1] || join(process.cwd(), 'docs', 'flows');

const traces = loadTraceData(tracePath);
console.log(`Loaded ${traces.length} span summaries from ${tracePath}`);

const files = readdirSync(flowsDir).filter(f =>
  (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.startsWith('.')
);

let totalNodes = 0;
let totalEdges = 0;
let flowsEnriched = 0;

for (const file of files) {
  const filePath = join(flowsDir, file);
  const content = readFileSync(filePath, 'utf-8');
  const flow = yaml.load(content) as IRFlow;
  if (!flow?.flow || !flow?.nodes) continue;

  const result = enrichFlow(flow, traces);
  if (result.enriched) {
    const yamlContent = yaml.dump(flow, { lineWidth: 120, noRefs: true });
    writeFileSync(filePath, yamlContent);
    console.log(`  ✓ ${file}: ${result.nodesUpdated} nodes, ${result.edgesUpdated} edges enriched`);
    totalNodes += result.nodesUpdated;
    totalEdges += result.edgesUpdated;
    flowsEnriched++;
  } else {
    console.log(`  ⊘ ${file}: no matching spans found`);
  }
}

console.log(`\nEnriched ${flowsEnriched} flow(s): ${totalNodes} nodes, ${totalEdges} edges updated.`);
console.log('Run /generate-all to regenerate diagrams with runtime data.');

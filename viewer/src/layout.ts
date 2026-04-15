import dagre from '@dagrejs/dagre';
import type { IRNode, IREdge } from './types';

// Estimate node dimensions, dynamically sizing height for long labels
function estimateNodeDims(node: IRNode): { width: number; height: number } {
  const labelLen = node.label.length;

  if (node.type === 'task') {
    // Account for calls text too when sizing
    const callsLen = node.calls ? `calls: ${node.calls.join(', ')}`.length : 0;
    const textLen = Math.max(labelLen, callsLen);
    // Width: min 220, ~8px per char, max 400
    const w = Math.max(220, Math.min(400, textLen * 8 + 40));
    // Estimate wrapped lines
    const charsPerLine = Math.floor((w - 40) / 7.5);
    const labelLines = Math.max(1, Math.ceil(labelLen / charsPerLine));
    const callsLines = callsLen > 0 ? Math.max(1, Math.ceil(callsLen / charsPerLine)) : 0;
    const totalLines = labelLines + callsLines;
    // Base height 50 + 20px per line, min 70
    const h = Math.max(70, 50 + totalLines * 20);
    return { width: w, height: h };
  }
  if (['decision', 'parallel_split', 'parallel_join'].includes(node.type)) {
    const w = Math.max(180, Math.min(300, labelLen * 7 + 50));
    return { width: w, height: 100 };
  }
  // Event (start/end): circle + label below
  const w = Math.max(100, Math.min(180, labelLen * 7 + 30));
  return { width: w, height: 100 };
}

export function layoutFlow(nodes: IRNode[], edges: IREdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    ranksep: 300,
    nodesep: 120,
    edgesep: 50,
    marginx: 60,
    marginy: 60,
  });

  for (const node of nodes) {
    g.setNode(node.id, estimateNodeDims(node));
  }

  for (const edge of edges) {
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  const xyNodes = nodes.map(node => {
    const pos = g.node(node.id);
    const nodeType = node.type === 'task' ? 'taskNode'
      : ['decision', 'parallel_split', 'parallel_join'].includes(node.type) ? 'gatewayNode'
      : 'eventNode';

    return {
      id: node.id,
      type: nodeType,
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
      data: { ...node },
    };
  });

  const xyEdges = edges.map((edge, i) => ({
    id: `e-${edge.from}-${edge.to}-${i}`,
    source: edge.from,
    target: edge.to,
    type: 'smoothstep',
    label: edge.condition || undefined,
    style: { stroke: '#555', strokeWidth: 2 },
    labelStyle: { fill: '#ccc', fontSize: 12, fontWeight: 500 },
    labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.95 },
    labelBgPadding: [8, 5] as [number, number],
    labelBgBorderRadius: 4,
    markerEnd: { type: 'arrowclosed' as const, color: '#555' },
  }));

  return { nodes: xyNodes, edges: xyEdges };
}

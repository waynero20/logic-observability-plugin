import dagre from '@dagrejs/dagre';
import type { IRNode, IREdge } from './types';

function estimateNodeDims(node: IRNode): { width: number; height: number } {
  const labelLen = node.label.length;

  if (node.type === 'task') {
    const callsLen = node.calls ? `${node.calls.join(', ')}`.length : 0;
    const textLen = Math.max(labelLen, callsLen);
    const w = Math.max(200, Math.min(280, textLen * 7 + 40));
    const charsPerLine = Math.floor((w - 32) / 7);
    const labelLines = Math.max(1, Math.ceil(labelLen / charsPerLine));
    const callsLines = callsLen > 0 ? Math.max(1, Math.ceil(callsLen / charsPerLine)) : 0;
    const totalLines = labelLines + callsLines;
    const h = Math.max(50, 30 + totalLines * 20);
    return { width: w, height: h };
  }

  if (['decision', 'parallel_split', 'parallel_join'].includes(node.type)) {
    const w = Math.max(160, Math.min(240, labelLen * 7 + 50));
    const charsPerLine = Math.floor(w / 7);
    const lines = Math.max(1, Math.ceil(labelLen / charsPerLine));
    return { width: w, height: 50 + lines * 16 };
  }

  // Event (start/end)
  const w = Math.max(80, Math.min(160, labelLen * 7 + 30));
  return { width: w, height: 60 };
}

export function layoutFlow(nodes: IRNode[], edges: IREdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    ranksep: 80,
    nodesep: 50,
    edgesep: 30,
    marginx: 40,
    marginy: 40,
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
    const nodeType = node.type === 'task'
      ? 'taskNode'
      : ['decision', 'parallel_split', 'parallel_join'].includes(node.type)
        ? 'gatewayNode'
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
    style: { stroke: '#3f3f46', strokeWidth: 1.5 },
    labelStyle: { fill: '#a1a1aa', fontSize: 11, fontWeight: 500 },
    labelBgStyle: { fill: '#18181c', fillOpacity: 0.95 },
    labelBgPadding: [8, 5] as [number, number],
    labelBgBorderRadius: 4,
    markerEnd: { type: 'arrowclosed' as const, color: '#3f3f46', width: 16, height: 16 },
  }));

  return { nodes: xyNodes, edges: xyEdges };
}

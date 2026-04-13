import dagre from '@dagrejs/dagre';
import type { IRNode, IREdge } from './types';

// Estimate node width based on label length to prevent text overlap
function estimateNodeDims(node: IRNode): { width: number; height: number } {
  const labelLen = node.label.length;

  if (node.type === 'task') {
    // Scale width with label: min 220, ~8px per char, max 360
    const w = Math.max(220, Math.min(360, labelLen * 8 + 40));
    return { width: w, height: 70 };
  }
  if (['decision', 'parallel_split', 'parallel_join'].includes(node.type)) {
    // Gateway: label renders outside diamond, so reserve width for text
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
    ranksep: 250,
    nodesep: 100,
    edgesep: 40,
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

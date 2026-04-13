import dagre from '@dagrejs/dagre';
import type { IRNode, IREdge } from './types';

export function layoutFlow(nodes: IRNode[], edges: IREdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 200, nodesep: 80, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    const dims = node.type === 'task'
      ? { width: 260, height: 64 }
      : ['decision', 'parallel_split', 'parallel_join'].includes(node.type)
        ? { width: 160, height: 80 }
        : { width: 80, height: 80 };
    g.setNode(node.id, dims);
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
    labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.9 },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 4,
    markerEnd: { type: 'arrowclosed' as const, color: '#555' },
  }));

  return { nodes: xyNodes, edges: xyEdges };
}

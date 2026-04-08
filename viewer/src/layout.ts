import dagre from '@dagrejs/dagre';
import type { IRNode, IREdge } from './types';

export function layoutFlow(nodes: IRNode[], edges: IREdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 60 });

  for (const node of nodes) {
    const dims = node.type === 'task'
      ? { width: 200, height: 56 }
      : ['decision', 'parallel_split', 'parallel_join'].includes(node.type)
        ? { width: 70, height: 70 }
        : { width: 48, height: 48 };
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
    style: { stroke: '#555' },
    labelStyle: { fill: '#999', fontSize: 11 },
  }));

  return { nodes: xyNodes, edges: xyEdges };
}

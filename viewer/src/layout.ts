import dagre from '@dagrejs/dagre';
import type { IRNode, IREdge } from './types';

function isMergeNode(node: IRNode): boolean {
  return node.type === 'parallel_join' || node.label === 'Continue' || node.label === '(merge)';
}

function estimateNodeDims(node: IRNode): { width: number; height: number } {
  // Merge/join nodes are tiny circles
  if (isMergeNode(node)) {
    return { width: 30, height: 30 };
  }

  const labelLen = node.label.length;

  if (node.type === 'task') {
    const hasDescription = !!node.description;
    const w = Math.max(220, Math.min(300, labelLen * 7.5 + 50));
    const charsPerLine = Math.floor((w - 36) / 7);
    const labelLines = Math.max(1, Math.ceil(labelLen / charsPerLine));
    const descLines = hasDescription ? 1 : 0;
    const totalLines = labelLines + descLines;
    const h = Math.max(60, 44 + totalLines * 20);
    return { width: w, height: h };
  }

  if (['decision', 'parallel_split'].includes(node.type)) {
    const w = Math.max(180, Math.min(260, labelLen * 7 + 60));
    const charsPerLine = Math.floor(w / 7);
    const lines = Math.max(1, Math.ceil(labelLen / charsPerLine));
    return { width: w, height: 60 + lines * 16 };
  }

  // Event (start/end) — slightly bigger for readability
  const w = Math.max(100, Math.min(180, labelLen * 7 + 40));
  return { width: w, height: 70 };
}

export function layoutFlow(nodes: IRNode[], edges: IREdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    ranksep: 100,
    nodesep: 60,
    edgesep: 40,
    marginx: 50,
    marginy: 50,
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
    const merge = isMergeNode(node);

    const nodeType = merge
      ? 'gatewayNode'
      : node.type === 'task'
        ? 'taskNode'
        : ['decision', 'parallel_split'].includes(node.type)
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
    animated: !!edge.runtime?.observed,
    style: {
      stroke: edge.condition?.toLowerCase().startsWith('yes') || edge.condition?.toLowerCase().includes('available') || edge.condition?.toLowerCase().includes('active')
        ? '#34d399'
        : edge.condition?.toLowerCase().startsWith('no') || edge.condition?.toLowerCase().includes('block') || edge.condition?.toLowerCase().includes('invalid')
          ? '#f87171'
          : edge.condition?.toLowerCase() === 'otherwise'
            ? '#71717a'
            : '#52525b',
      strokeWidth: edge.condition ? 2 : 1.5,
    },
    labelStyle: {
      fill: edge.condition?.toLowerCase().startsWith('yes') || edge.condition?.toLowerCase().includes('available')
        ? '#34d399'
        : edge.condition?.toLowerCase().startsWith('no') || edge.condition?.toLowerCase().includes('block')
          ? '#f87171'
          : '#a1a1aa',
      fontSize: 11,
      fontWeight: 600,
    },
    labelBgStyle: { fill: '#18181c', fillOpacity: 0.95 },
    labelBgPadding: [10, 6] as [number, number],
    labelBgBorderRadius: 6,
    markerEnd: { type: 'arrowclosed' as const, color: '#52525b', width: 18, height: 18 },
  }));

  return { nodes: xyNodes, edges: xyEdges };
}

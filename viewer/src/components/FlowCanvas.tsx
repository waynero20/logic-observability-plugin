import { useCallback, useState, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { IRFlow, IRNode } from '../types';
import { layoutFlow } from '../layout';
import { TaskNode } from './TaskNode';
import { GatewayNode } from './GatewayNode';
import { EventNode } from './EventNode';
import { NodePanel } from './NodePanel';

const nodeTypes: NodeTypes = {
  taskNode: TaskNode as any,
  gatewayNode: GatewayNode as any,
  eventNode: EventNode as any,
};

export function FlowCanvas({ flow, filter, search }: { flow: IRFlow; filter: string | null; search: string }) {
  const [selectedNode, setSelectedNode] = useState<IRNode | null>(null);

  const { nodes, edges } = useMemo(() => {
    const result = layoutFlow(flow.nodes, flow.edges);
    const searchLower = search.toLowerCase().trim();

    const hasFilter = !!filter;
    const hasSearch = searchLower.length > 0;

    if (!hasFilter && !hasSearch) return result;

    const filteredIds = hasFilter
      ? new Set(flow.nodes.filter(n => n.logic_type === filter).map(n => n.id))
      : null;
    const searchIds = hasSearch
      ? new Set(flow.nodes.filter(n => n.label.toLowerCase().includes(searchLower)).map(n => n.id))
      : null;

    return {
      nodes: result.nodes.map(n => {
        const matchesFilter = !filteredIds || filteredIds.has(n.id);
        const matchesSearch = !searchIds || searchIds.has(n.id);
        return {
          ...n,
          style: matchesFilter && matchesSearch ? {} : { opacity: 0.12 },
        };
      }),
      edges: result.edges,
    };
  }, [flow, filter, search]);

  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedNode(node.data as IRNode);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelectedNode(null)}
        fitView
        fitViewOptions={{ padding: 0.3, minZoom: 0.1, maxZoom: 1.2 }}
        minZoom={0.05}
        maxZoom={3}
        defaultEdgeOptions={{ style: { strokeWidth: 1.5 } }}
        nodesDraggable
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.03)" />
        <Controls
          showInteractive={false}
          position="bottom-left"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />
        <MiniMap
          position="bottom-right"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            width: 140,
            height: 90,
          }}
          maskColor="rgba(0,0,0,0.6)"
          nodeColor={(node: any) => {
            const type = node.data?.type;
            if (type === 'decision') return '#fbbf24';
            if (type === 'start') return '#34d399';
            if (type === 'end') return '#f87171';
            return '#52525b';
          }}
          pannable
          zoomable
        />
      </ReactFlow>
      <NodePanel node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}

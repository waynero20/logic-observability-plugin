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

export function FlowCanvas({ flow, filter }: { flow: IRFlow; filter: string | null }) {
  const [selectedNode, setSelectedNode] = useState<IRNode | null>(null);

  const { nodes, edges } = useMemo(() => {
    const result = layoutFlow(flow.nodes, flow.edges);

    if (filter) {
      const filteredIds = new Set(
        flow.nodes
          .filter(n => n.logic_type === filter)
          .map(n => n.id)
      );
      return {
        nodes: result.nodes.map(n => ({
          ...n,
          style: filteredIds.has(n.id) || !filter ? {} : { opacity: 0.2 },
        })),
        edges: result.edges,
      };
    }

    return result;
  }, [flow, filter]);

  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedNode(node.data as IRNode);
  }, []);

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelectedNode(null)}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#222" />
        <Controls
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6 }}
        />
        <MiniMap
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6 }}
          maskColor="rgba(0,0,0,0.5)"
          nodeColor="#444"
        />
      </ReactFlow>
      <NodePanel node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}

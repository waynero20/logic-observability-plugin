import { Handle, Position } from '@xyflow/react';
import type { IRNode } from '../types';

const colorMap: Record<string, string> = {
  deterministic: 'var(--deterministic)',
  configurable: 'var(--configurable)',
  probabilistic: 'var(--probabilistic)',
};

export function GatewayNode({ data, selected }: { data: IRNode; selected?: boolean }) {
  const color = colorMap[data.logic_type || 'deterministic'];

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: 8, height: 8 }} />
      <div style={{ position: 'relative', width: 140, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'absolute',
            width: 64,
            height: 64,
            top: 8,
            left: 38,
            background: 'var(--bg-surface)',
            border: `2px solid ${selected ? 'var(--accent)' : color}`,
            transform: 'rotate(45deg)',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        />
        <div
          style={{
            position: 'relative',
            fontSize: 11,
            color: 'var(--text-primary)',
            textAlign: 'center',
            maxWidth: 130,
            lineHeight: 1.3,
            zIndex: 1,
            fontWeight: 500,
            padding: '0 4px',
          }}
        >
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#555', width: 8, height: 8 }} />
    </>
  );
}

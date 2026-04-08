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
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
      <div style={{ position: 'relative', width: 60, height: 60 }}>
        <div
          style={{
            position: 'absolute',
            width: 44,
            height: 44,
            top: 8,
            left: 8,
            background: 'var(--bg-surface)',
            border: `2px solid ${selected ? 'var(--accent)' : color}`,
            transform: 'rotate(45deg)',
            borderRadius: 4,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 9,
            color: 'var(--text-primary)',
            textAlign: 'center',
            maxWidth: 56,
            lineHeight: 1.2,
            zIndex: 1,
          }}
        >
          {data.label.length > 20 ? data.label.slice(0, 17) + '...' : data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
    </>
  );
}

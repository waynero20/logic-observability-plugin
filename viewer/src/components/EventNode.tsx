import { Handle, Position } from '@xyflow/react';
import type { IRNode } from '../types';

export function EventNode({ data, selected }: { data: IRNode; selected?: boolean }) {
  const isEnd = data.type === 'end';

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: 8, height: 8 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--bg-surface)',
            border: `${isEnd ? 4 : 2}px solid ${selected ? 'var(--accent)' : 'var(--deterministic)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <span style={{ fontSize: 10, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.2, fontWeight: 600 }}>
            {isEnd ? 'END' : 'START'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 100, lineHeight: 1.3 }}>
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#555', width: 8, height: 8 }} />
    </>
  );
}

import { Handle, Position } from '@xyflow/react';
import type { IRNode } from '../types';

export function EventNode({ data, selected }: { data: IRNode; selected?: boolean }) {
  const isEnd = data.type === 'end';

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--bg-surface)',
          border: `${isEnd ? 3 : 2}px solid ${selected ? 'var(--accent)' : 'var(--deterministic)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 9, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.1 }}>
          {data.label.length > 10 ? data.label.slice(0, 8) + '..' : data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
    </>
  );
}

import { Handle, Position } from '@xyflow/react';
import type { IRNode } from '../types';

export function GatewayNode({ data, selected }: { data: IRNode; selected?: boolean }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: 'var(--amber)', width: 7, height: 7, border: '2px solid var(--bg)' }} />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
      }}>
        {/* Diamond */}
        <div style={{ position: 'relative', width: 40, height: 40 }}>
          <div style={{
            position: 'absolute',
            inset: 4,
            background: selected ? 'var(--amber-dim)' : 'var(--bg-elevated)',
            border: selected ? '1.5px solid var(--amber)' : '1px solid var(--border-strong)',
            borderRadius: 3,
            transform: 'rotate(45deg)',
            boxShadow: selected ? '0 0 16px var(--amber-dim)' : 'var(--shadow-sm)',
            transition: 'all 150ms ease',
          }} />
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--amber)"
            strokeWidth="2.5"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1,
            }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
        {/* Label */}
        <div style={{
          fontSize: 11,
          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: 1.4,
          fontWeight: 500,
          maxWidth: 200,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}>
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--amber)', width: 7, height: 7, border: '2px solid var(--bg)' }} />
    </>
  );
}

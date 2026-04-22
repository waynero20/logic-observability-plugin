import { Handle, Position } from '@xyflow/react';
import type { IRNode } from '../types';

export function GatewayNode({ data, selected }: { data: IRNode; selected?: boolean }) {
  // Merge/join nodes should be minimal
  const isMerge = data.type === 'parallel_join' || data.label === 'Continue' || data.label === '(merge)';

  if (isMerge) {
    return (
      <>
        <Handle type="target" position={Position.Top} style={{ background: 'var(--text-muted)', width: 6, height: 6, border: '2px solid var(--bg)' }} />
        <div style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--bg-hover)',
          border: '1.5px solid var(--border-strong)',
          cursor: 'default',
        }} />
        <Handle type="source" position={Position.Bottom} style={{ background: 'var(--text-muted)', width: 6, height: 6, border: '2px solid var(--bg)' }} />
      </>
    );
  }

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: 'var(--amber)', width: 8, height: 8, border: '2px solid var(--bg)' }} />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
      }}>
        {/* Diamond with question mark */}
        <div style={{ position: 'relative', width: 48, height: 48 }}>
          <div style={{
            position: 'absolute',
            inset: 4,
            background: selected ? 'var(--amber-dim)' : 'var(--bg-elevated)',
            border: selected ? '2px solid var(--amber)' : '1.5px solid var(--border-strong)',
            borderRadius: 4,
            transform: 'rotate(45deg)',
            boxShadow: selected ? '0 0 20px var(--amber-dim)' : 'var(--shadow)',
            transition: 'all 180ms ease',
          }} />
          <svg
            width="18"
            height="18"
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
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <circle cx="12" cy="17" r="0.5" fill="var(--amber)" />
          </svg>
        </div>
        {/* Label */}
        <div style={{
          fontSize: 12,
          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: 1.4,
          fontWeight: 600,
          fontStyle: 'italic',
          maxWidth: 220,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}>
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--amber)', width: 8, height: 8, border: '2px solid var(--bg)' }} />
    </>
  );
}

import { Handle, Position } from '@xyflow/react';
import type { IRNode } from '../types';

export function TaskNode({ data, selected }: { data: IRNode; selected?: boolean }) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: 'var(--accent)', width: 7, height: 7, border: '2px solid var(--bg)' }} />
      <div
        style={{
          background: selected
            ? 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-active) 100%)'
            : 'var(--bg-elevated)',
          border: selected ? '1.5px solid var(--accent)' : '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          padding: '10px 16px',
          minWidth: 180,
          maxWidth: 280,
          textAlign: 'center',
          cursor: 'pointer',
          boxShadow: selected ? '0 0 20px var(--accent-glow)' : 'var(--shadow-sm)',
          transition: 'all 150ms ease',
        }}
      >
        <div style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          fontWeight: 500,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}>
          {data.label}
        </div>
        {data.calls && data.calls.length > 0 && (
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            marginTop: 6,
            lineHeight: 1.3,
            fontFamily: 'monospace',
          }}>
            {data.calls.join(', ')}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent)', width: 7, height: 7, border: '2px solid var(--bg)' }} />
    </>
  );
}

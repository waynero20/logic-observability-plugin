import { Handle, Position } from '@xyflow/react';
import type { IRNode } from '../types';

export function EventNode({ data, selected }: { data: IRNode; selected?: boolean }) {
  const isEnd = data.type === 'end';
  const color = isEnd ? 'var(--red)' : 'var(--green)';
  const dimColor = isEnd ? 'var(--red-dim)' : 'var(--green-dim)';

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: color, width: 7, height: 7, border: '2px solid var(--bg)' }} />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: selected ? dimColor : 'var(--bg-elevated)',
          border: `${isEnd ? 2.5 : 1.5}px solid ${selected ? color : 'var(--border-strong)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: selected ? `0 0 16px ${dimColor}` : 'var(--shadow-sm)',
          transition: 'all 150ms ease',
        }}>
          {isEnd ? (
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill={color} stroke="none">
              <polygon points="8,5 19,12 8,19" />
            </svg>
          )}
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          textAlign: 'center',
          maxWidth: 140,
          lineHeight: 1.3,
          fontWeight: 500,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}>
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 7, height: 7, border: '2px solid var(--bg)' }} />
    </>
  );
}

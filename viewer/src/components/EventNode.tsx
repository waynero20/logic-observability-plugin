import { Handle, Position } from '@xyflow/react';
import type { IRNode } from '../types';

export function EventNode({ data, selected }: { data: IRNode; selected?: boolean }) {
  const isEnd = data.type === 'end';
  const color = isEnd ? 'var(--red)' : 'var(--green)';
  const dimColor = isEnd ? 'var(--red-dim)' : 'var(--green-dim)';

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: color, width: 8, height: 8, border: '2px solid var(--bg)' }} />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: selected ? dimColor : 'var(--bg-elevated)',
          border: `${isEnd ? 3 : 2}px solid ${selected ? color : 'var(--border-strong)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: selected ? `0 0 20px ${dimColor}` : 'var(--shadow)',
          transition: 'all 180ms ease',
        }}>
          {isEnd ? (
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: color }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill={color} stroke="none">
              <polygon points="8,5 19,12 8,19" />
            </svg>
          )}
        </div>
        <div style={{
          fontSize: 11,
          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          textAlign: 'center',
          maxWidth: 160,
          lineHeight: 1.4,
          fontWeight: 600,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}>
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 8, height: 8, border: '2px solid var(--bg)' }} />
    </>
  );
}

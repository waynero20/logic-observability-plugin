import { Handle, Position } from '@xyflow/react';
import type { IRNode } from '../types';

const logicColors: Record<string, { accent: string; bg: string }> = {
  deterministic: { accent: 'var(--green)', bg: 'var(--green-dim)' },
  configurable: { accent: 'var(--amber)', bg: 'var(--amber-dim)' },
  probabilistic: { accent: 'var(--purple)', bg: 'var(--purple-dim)' },
};

export function TaskNode({ data, selected }: { data: IRNode; selected?: boolean }) {
  const colors = data.logic_type ? logicColors[data.logic_type] : null;
  const accentColor = colors?.accent || 'var(--border-strong)';

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: accentColor, width: 8, height: 8, border: '2px solid var(--bg)' }} />
      <div
        style={{
          background: selected
            ? 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-active) 100%)'
            : 'var(--bg-elevated)',
          border: selected ? `2px solid ${accentColor}` : '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          padding: 0,
          minWidth: 200,
          maxWidth: 300,
          textAlign: 'center',
          cursor: 'pointer',
          boxShadow: selected ? `0 0 24px ${colors?.bg || 'var(--accent-glow)'}` : 'var(--shadow)',
          transition: 'all 180ms ease',
          overflow: 'hidden',
        }}
      >
        {/* Logic type color strip at top */}
        <div style={{
          height: 4,
          background: accentColor,
          borderRadius: '10px 10px 0 0',
        }} />

        <div style={{ padding: '12px 18px 14px' }}>
          <div style={{
            fontSize: 13,
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            fontWeight: 600,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}>
            {data.label}
          </div>

          {data.description && (
            <div style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              marginTop: 6,
              lineHeight: 1.4,
              maxHeight: 28,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {data.description}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: accentColor, width: 8, height: 8, border: '2px solid var(--bg)' }} />
    </>
  );
}

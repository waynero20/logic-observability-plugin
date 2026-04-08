import { Handle, Position } from '@xyflow/react';
import type { IRNode } from '../types';

const colorMap: Record<string, string> = {
  deterministic: 'var(--deterministic)',
  configurable: 'var(--configurable)',
  probabilistic: 'var(--probabilistic)',
};

export function TaskNode({ data, selected }: { data: IRNode; selected?: boolean }) {
  const color = colorMap[data.logic_type || 'deterministic'];

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
      <div
        style={{
          background: 'var(--bg-surface)',
          border: `2px solid ${selected ? 'var(--accent)' : color}`,
          borderRadius: 8,
          padding: '8px 14px',
          minWidth: 160,
          maxWidth: 220,
          textAlign: 'center',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {data.label}
        </div>
        {data.logic_type && (
          <div style={{ fontSize: 9, color, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {data.logic_type === 'probabilistic' ? 'AI-powered' : data.logic_type === 'configurable' ? 'Config-driven' : 'Rule-based'}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
    </>
  );
}

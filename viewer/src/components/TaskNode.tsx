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
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: 8, height: 8 }} />
      <div
        style={{
          background: 'var(--bg-surface)',
          border: `2px solid ${selected ? 'var(--accent)' : color}`,
          borderRadius: 10,
          padding: '12px 20px',
          minWidth: 180,
          maxWidth: 400,
          textAlign: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          overflow: 'hidden',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, fontWeight: 500 }}>
          {data.label}
        </div>
        {data.calls && data.calls.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3, wordBreak: 'break-all' }}>
            calls: {data.calls.join(', ')}
          </div>
        )}
        {data.logic_type && (
          <div style={{ fontSize: 10, color, marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            {data.logic_type === 'probabilistic' ? 'AI-powered' : data.logic_type === 'configurable' ? 'Config-driven' : 'Rule-based'}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#555', width: 8, height: 8 }} />
    </>
  );
}

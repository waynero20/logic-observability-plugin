import { Handle, Position } from '@xyflow/react';
import type { IRNode } from '../types';

const colorMap: Record<string, string> = {
  deterministic: 'var(--deterministic)',
  configurable: 'var(--configurable)',
  probabilistic: 'var(--probabilistic)',
};

export function GatewayNode({ data, selected }: { data: IRNode; selected?: boolean }) {
  const color = colorMap[data.logic_type || 'deterministic'];

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#555', width: 8, height: 8 }} />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
      }}>
        <div style={{ position: 'relative', width: 52, height: 52 }}>
          <div
            style={{
              position: 'absolute',
              width: 38,
              height: 38,
              top: 7,
              left: 7,
              background: 'var(--bg-surface)',
              border: `2px solid ${selected ? 'var(--accent)' : color}`,
              transform: 'rotate(45deg)',
              borderRadius: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-muted)',
            zIndex: 1,
          }}>
            ?
          </div>
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-primary)',
          textAlign: 'center',
          lineHeight: 1.3,
          fontWeight: 500,
          maxWidth: 200,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}>
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#555', width: 8, height: 8 }} />
    </>
  );
}

import type { IRFlow } from '../types';

export function FlowSelector({
  flows,
  selected,
  onSelect,
}: {
  flows: IRFlow[];
  selected: string;
  onSelect: (flowId: string) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: '6px 12px',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      overflowX: 'auto',
    }}>
      {flows.map(flow => (
        <button
          key={flow.flow}
          onClick={() => onSelect(flow.flow)}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: selected === flow.flow ? 600 : 400,
            border: selected === flow.flow ? '1px solid var(--accent)' : '1px solid transparent',
            borderRadius: 6,
            cursor: 'pointer',
            background: selected === flow.flow ? 'var(--accent)' : 'var(--bg-surface)',
            color: selected === flow.flow ? '#fff' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
          }}
        >
          {flow.title}
          <span style={{
            marginLeft: 8,
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 500,
            background: flow.status === 'verified' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
            color: flow.status === 'verified' ? '#22c55e' : 'var(--text-muted)',
          }}>
            {flow.status}
          </span>
        </button>
      ))}
    </div>
  );
}

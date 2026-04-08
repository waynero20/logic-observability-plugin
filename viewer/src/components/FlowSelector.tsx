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
      gap: 2,
      padding: '4px 8px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      overflowX: 'auto',
    }}>
      {flows.map(flow => (
        <button
          key={flow.flow}
          onClick={() => onSelect(flow.flow)}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            background: selected === flow.flow ? 'var(--accent)' : 'transparent',
            color: selected === flow.flow ? '#fff' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          {flow.title}
          <span style={{
            marginLeft: 6,
            fontSize: 10,
            opacity: 0.7,
            padding: '1px 4px',
            borderRadius: 3,
            background: flow.status === 'verified' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
          }}>
            {flow.status}
          </span>
        </button>
      ))}
    </div>
  );
}

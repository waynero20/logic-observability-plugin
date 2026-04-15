import type { IRFlow } from '../types';

export function FlowHeader({
  flow,
  search,
  onSearchChange,
  filter,
  onFilterChange,
}: {
  flow: IRFlow;
  search: string;
  onSearchChange: (v: string) => void;
  filter: string | null;
  onFilterChange: (v: string | null) => void;
}) {
  return (
    <div style={{
      padding: '14px 20px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      {/* Left: flow info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: -0.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {flow.title}
          </h1>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 4,
            background: flow.status === 'verified' ? 'var(--green-dim)' : 'var(--accent-dim)',
            color: flow.status === 'verified' ? 'var(--green)' : 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            flexShrink: 0,
          }}>
            {flow.status}
          </span>
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span>{flow.nodes.length} nodes</span>
          <span style={{ color: 'var(--border-strong)' }}>/</span>
          <span>{flow.edges.length} edges</span>
          {flow.service && (
            <>
              <span style={{ color: 'var(--border-strong)' }}>/</span>
              <span>{flow.service}</span>
            </>
          )}
        </div>
      </div>

      {/* Right: controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Filter nodes..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px 6px 28px',
              fontSize: 12,
              color: 'var(--text-primary)',
              width: 170,
              outline: 'none',
              transition: 'border-color var(--transition)',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--border-accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        <select
          value={filter || ''}
          onChange={e => onFilterChange(e.target.value || null)}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text-primary)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">All types</option>
          <option value="deterministic">Rule-based</option>
          <option value="configurable">Config-driven</option>
          <option value="probabilistic">AI-powered</option>
        </select>
      </div>
    </div>
  );
}

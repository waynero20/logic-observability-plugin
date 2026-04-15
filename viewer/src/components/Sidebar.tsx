import { useState, useMemo } from 'react';
import type { IRFlow } from '../types';

export function Sidebar({
  flows,
  selected,
  onSelect,
  collapsed,
  onToggle,
}: {
  flows: IRFlow[];
  selected: string;
  onSelect: (flowId: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return flows;
    const q = query.toLowerCase();
    return flows.filter(
      f =>
        f.title.toLowerCase().includes(q) ||
        f.flow.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q)
    );
  }, [flows, query]);

  if (collapsed) {
    return (
      <div style={{
        width: 48,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        flexShrink: 0,
      }}>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
          }}
          title="Expand sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <div style={{
          writingMode: 'vertical-rl',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          marginTop: 16,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          {flows.length} Flows
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: 'var(--sidebar-width)',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 14px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'var(--accent-dim)',
              border: '1px solid var(--border-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.3 }}>Logic Observer</span>
          </div>
          <button
            onClick={onToggle}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
            }}
            title="Collapse sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search flows..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '7px 10px 7px 32px',
              fontSize: 12,
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color var(--transition)',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--border-accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          {filtered.length} of {flows.length} flows
        </div>
      </div>

      {/* Flow list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
        {filtered.map(flow => {
          const isActive = selected === flow.flow;
          return (
            <button
              key={flow.flow}
              onClick={() => onSelect(flow.flow)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 10px',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                marginBottom: 1,
                transition: 'all var(--transition)',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.target as HTMLElement).style.background = 'var(--bg-hover)';
                  (e.target as HTMLElement).style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.target as HTMLElement).style.background = 'transparent';
                  (e.target as HTMLElement).style.color = 'var(--text-secondary)';
                }
              }}
            >
              <div style={{ lineHeight: 1.4, marginBottom: 2 }}>{flow.title}</div>
              <div style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                fontWeight: 400,
              }}>
                {flow.nodes.length} nodes
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

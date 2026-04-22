import { useState } from 'react';
import type { IRFlow } from '../types';

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

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
  const [showLegend, setShowLegend] = useState(false);

  const stepCount = flow.nodes.filter(n => n.type === 'task').length;
  const decisionCount = flow.nodes.filter(n => n.type === 'decision').length;

  return (
    <div style={{
      padding: '14px 20px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Top row: title + controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{
              fontSize: 16,
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
              padding: '2px 8px',
              borderRadius: 4,
              background: flow.status === 'verified' ? 'var(--green-dim)' : 'var(--amber-dim)',
              color: flow.status === 'verified' ? 'var(--green)' : 'var(--amber)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              flexShrink: 0,
            }}>
              {flow.status === 'verified' ? 'Verified' : 'Draft'}
            </span>
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span>{stepCount} step{stepCount !== 1 ? 's' : ''}</span>
            {decisionCount > 0 && (
              <>
                <span style={{ color: 'var(--border-strong)' }}>&middot;</span>
                <span>{decisionCount} decision{decisionCount !== 1 ? 's' : ''}</span>
              </>
            )}
            {flow.service && (
              <>
                <span style={{ color: 'var(--border-strong)' }}>&middot;</span>
                <span>{flow.service}</span>
              </>
            )}
          </div>
        </div>

        {/* Controls */}
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
              placeholder="Search steps..."
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
            <option value="deterministic">Fixed rules</option>
            <option value="configurable">Settings-based</option>
            <option value="probabilistic">AI-powered</option>
          </select>
          <button
            onClick={() => setShowLegend(!showLegend)}
            style={{
              background: showLegend ? 'var(--accent-dim)' : 'var(--bg-elevated)',
              border: `1px solid ${showLegend ? 'var(--border-accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px',
              fontSize: 11,
              color: showLegend ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all var(--transition)',
            }}
          >
            Legend
          </button>
        </div>
      </div>

      {/* Description */}
      {flow.description && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginTop: 8,
          lineHeight: 1.5,
          maxWidth: 700,
        }}>
          {flow.description}
        </div>
      )}

      {/* Legend panel */}
      {showLegend && (
        <div style={{
          marginTop: 10,
          padding: '10px 14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4, alignSelf: 'center' }}>
            Color Guide
          </div>
          <LegendDot color="var(--green)" label="Fixed rules (always works the same)" />
          <LegendDot color="var(--amber)" label="Settings-based (changes with configuration)" />
          <LegendDot color="var(--purple)" label="AI-powered (uses machine learning)" />

          <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '4px 0' }} />

          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4, alignSelf: 'center' }}>
            Shapes
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 10, borderRadius: 3, background: 'var(--bg-active)', border: '1px solid var(--border-strong)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Action step</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, background: 'var(--bg-active)', border: '1px solid var(--border-strong)', transform: 'rotate(45deg)', borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Decision point</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green-dim)', border: '1.5px solid var(--green)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Start / End</span>
          </div>
        </div>
      )}
    </div>
  );
}

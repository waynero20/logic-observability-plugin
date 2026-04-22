import { useState } from 'react';
import type { IRNode } from '../types';

const badgeColors: Record<string, { bg: string; text: string; label: string; desc: string }> = {
  deterministic: { bg: 'var(--green-dim)', text: 'var(--green)', label: 'Fixed Rules', desc: 'This step always works the same way — no variation.' },
  configurable: { bg: 'var(--amber-dim)', text: 'var(--amber)', label: 'Settings-Based', desc: 'This step can change depending on system settings or configuration.' },
  probabilistic: { bg: 'var(--purple-dim)', text: 'var(--purple)', label: 'AI-Powered', desc: 'This step uses artificial intelligence — results may vary.' },
};

const friendlyType: Record<string, { label: string; desc: string }> = {
  task: { label: 'Action Step', desc: 'Something the system does.' },
  decision: { label: 'Decision Point', desc: 'The system checks a condition and picks a path.' },
  start: { label: 'Starting Point', desc: 'Where the process begins.' },
  end: { label: 'End Point', desc: 'Where the process finishes.' },
  parallel_split: { label: 'Split', desc: 'Multiple things happen at the same time.' },
  parallel_join: { label: 'Rejoin', desc: 'Paths come back together.' },
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export function NodePanel({ node, onClose }: { node: IRNode | null; onClose: () => void }) {
  const [showTechnical, setShowTechnical] = useState(false);

  if (!node) return null;

  const badge = node.logic_type ? badgeColors[node.logic_type] : null;
  const typeInfo = friendlyType[node.type] || { label: node.type, desc: '' };

  return (
    <div style={{
      position: 'absolute',
      right: 12,
      top: 12,
      bottom: 12,
      width: 320,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px 16px',
      overflowY: 'auto',
      zIndex: 10,
      boxShadow: 'var(--shadow-lg)',
      animation: 'slideIn 150ms ease',
    }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}>
            {node.label}
          </h3>
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              background: 'var(--bg-hover)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.3,
            }}>
              {typeInfo.label}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14,
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
            flexShrink: 0,
            transition: 'all var(--transition)',
          }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.background = 'var(--bg-active)';
            (e.target as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.background = 'var(--bg-hover)';
            (e.target as HTMLElement).style.color = 'var(--text-muted)';
          }}
        >
          &times;
        </button>
      </div>

      <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

      {/* How it works badge */}
      {badge && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: badge.bg,
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: badge.text,
              flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: badge.text }}>{badge.label}</div>
              <div style={{ fontSize: 10, color: badge.text, opacity: 0.8, marginTop: 2 }}>{badge.desc}</div>
            </div>
          </div>
        </div>
      )}

      {/* What this step does */}
      {node.description && (
        <Section label="What this step does">
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{node.description}</div>
        </Section>
      )}

      {/* Possible outcomes (reason codes) */}
      {node.reason_codes && node.reason_codes.length > 0 && (
        <Section label="Possible Outcomes">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {node.reason_codes.map((code, i) => (
              <div key={i} style={{
                fontSize: 11,
                fontWeight: 500,
                padding: '5px 10px',
                borderRadius: 4,
                background: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{ color: 'var(--amber)', fontSize: 9 }}>&#9679;</span>
                {code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* AI model info */}
      {node.model && (
        <Section label="AI Model Used">
          <div style={{
            fontSize: 12,
            color: 'var(--purple)',
            padding: '6px 10px',
            background: 'var(--purple-dim)',
            borderRadius: 4,
          }}>
            {node.model}
          </div>
        </Section>
      )}

      {/* Confidence (translated) */}
      {node.confidence && (
        <Section label="Reliability">
          <span style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 500,
            padding: '4px 10px',
            borderRadius: 4,
            background: node.confidence === 'static_plus_runtime' ? 'var(--green-dim)' :
                         node.confidence === 'runtime_only' ? 'var(--blue-dim)' :
                         'var(--bg-hover)',
            color: node.confidence === 'static_plus_runtime' ? 'var(--green)' :
                   node.confidence === 'runtime_only' ? 'var(--blue)' :
                   'var(--text-muted)',
          }}>
            {node.confidence === 'static_plus_runtime' ? 'Verified in production' :
             node.confidence === 'runtime_only' ? 'Observed in production only' :
             'Documented from code (not yet verified in production)'}
          </span>
        </Section>
      )}

      {/* Technical details toggle */}
      {(node.code_ref || (node.calls && node.calls.length > 0) || node.span_name) && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0 12px' }} />
          <button
            onClick={() => setShowTechnical(!showTechnical)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 11,
              cursor: 'pointer',
              padding: '4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 500,
              transition: 'color var(--transition)',
            }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--text-secondary)'}
            onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--text-muted)'}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: showTechnical ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}>
              <path d="M9 18l6-6-6-6" />
            </svg>
            Technical details
          </button>

          {showTechnical && (
            <div style={{ marginTop: 8 }}>
              {node.code_ref && (
                <Section label="Source Code">
                  <code style={{
                    display: 'inline-block',
                    fontSize: 11,
                    color: 'var(--accent)',
                    background: 'var(--accent-dim)',
                    padding: '3px 8px',
                    borderRadius: 4,
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                  }}>
                    {node.code_ref}
                  </code>
                </Section>
              )}

              {node.calls && node.calls.length > 0 && (
                <Section label="Function Calls">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {node.calls.map((call, i) => (
                      <code key={i} style={{
                        display: 'block',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-hover)',
                        padding: '4px 8px',
                        borderRadius: 4,
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                      }}>
                        {call}
                      </code>
                    ))}
                  </div>
                </Section>
              )}

              {node.span_name && (
                <Section label="Monitoring Span">
                  <code style={{ fontSize: 11, color: 'var(--blue)', fontFamily: 'monospace' }}>{node.span_name}</code>
                </Section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

import type { IRNode } from '../types';

const badgeColors: Record<string, { bg: string; text: string; label: string }> = {
  deterministic: { bg: 'var(--green-dim)', text: 'var(--green)', label: 'Rule-based' },
  configurable: { bg: 'var(--amber-dim)', text: 'var(--amber)', label: 'Config-driven' },
  probabilistic: { bg: 'var(--purple-dim)', text: 'var(--purple)', label: 'AI-powered' },
};

const typeIcons: Record<string, string> = {
  task: 'Task',
  decision: 'Decision',
  start: 'Start',
  end: 'End',
  parallel_split: 'Fork',
  parallel_join: 'Join',
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
  if (!node) return null;

  const badge = node.logic_type ? badgeColors[node.logic_type] : null;

  return (
    <div style={{
      position: 'absolute',
      right: 12,
      top: 12,
      bottom: 12,
      width: 300,
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
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}>
            {node.label}
          </h3>
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              display: 'inline-block',
              padding: '1px 6px',
              borderRadius: 3,
              background: 'var(--bg-hover)',
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {typeIcons[node.type] || node.type}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{node.id}</span>
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
            width: 26,
            height: 26,
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

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

      {badge && (
        <div style={{ marginBottom: 16 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 500,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: badge.bg,
            color: badge.text,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: badge.text,
            }} />
            {badge.label}
          </span>
        </div>
      )}

      {node.description && (
        <Section label="Description">
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{node.description}</div>
        </Section>
      )}

      {node.code_ref && (
        <Section label="Code Reference">
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
        <Section label="Calls">
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

      {node.reason_codes && node.reason_codes.length > 0 && (
        <Section label="Reason Codes">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {node.reason_codes.map((code, i) => (
              <span key={i} style={{
                fontSize: 10,
                fontWeight: 500,
                padding: '3px 7px',
                borderRadius: 4,
                background: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
              }}>
                {code}
              </span>
            ))}
          </div>
        </Section>
      )}

      {node.span_name && (
        <Section label="Tracer Span">
          <code style={{ fontSize: 11, color: 'var(--blue)', fontFamily: 'monospace' }}>{node.span_name}</code>
        </Section>
      )}

      {node.model && (
        <Section label="AI Model">
          <code style={{ fontSize: 11, color: 'var(--purple)', fontFamily: 'monospace' }}>{node.model}</code>
        </Section>
      )}

      {node.confidence && (
        <Section label="Confidence">
          <span style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 500,
            padding: '3px 8px',
            borderRadius: 4,
            background: node.confidence === 'static_plus_runtime' ? 'var(--green-dim)' :
                         node.confidence === 'runtime_only' ? 'var(--blue-dim)' :
                         'var(--bg-hover)',
            color: node.confidence === 'static_plus_runtime' ? 'var(--green)' :
                   node.confidence === 'runtime_only' ? 'var(--blue)' :
                   'var(--text-muted)',
          }}>
            {node.confidence === 'static_plus_runtime' ? 'Verified (static + runtime)' :
             node.confidence === 'runtime_only' ? 'Runtime only' :
             'Static only'}
          </span>
        </Section>
      )}
    </div>
  );
}

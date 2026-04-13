import type { IRNode } from '../types';

const badgeColors: Record<string, { bg: string; text: string; label: string }> = {
  deterministic: { bg: 'rgba(34,197,94,0.15)', text: 'var(--deterministic)', label: 'Rule-based' },
  configurable: { bg: 'rgba(245,158,11,0.15)', text: 'var(--configurable)', label: 'Config-driven' },
  probabilistic: { bg: 'rgba(139,92,246,0.15)', text: 'var(--probabilistic)', label: 'AI-powered' },
};

export function NodePanel({ node, onClose }: { node: IRNode | null; onClose: () => void }) {
  if (!node) return null;

  const badge = node.logic_type ? badgeColors[node.logic_type] : null;

  return (
    <div style={{
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 'min(320px, 85vw)',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      padding: '16px 18px',
      overflowY: 'auto',
      zIndex: 10,
      boxShadow: '-4px 0 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, flex: 1, wordBreak: 'break-word' }}>{node.label}</h3>
        <button
          onClick={onClose}
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '2px 8px', borderRadius: 4, marginLeft: 8, flexShrink: 0 }}
        >
          &times;
        </button>
      </div>

      {badge && (
        <span style={{
          display: 'inline-block',
          fontSize: 11,
          padding: '3px 8px',
          borderRadius: 4,
          background: badge.bg,
          color: badge.text,
          marginBottom: 12,
        }}>
          {badge.label}
        </span>
      )}

      {node.description && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Description</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{node.description}</div>
        </div>
      )}

      {node.code_ref && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Code Reference</div>
          <code style={{ fontSize: 12, color: 'var(--accent)', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 3, wordBreak: 'break-all' }}>
            {node.code_ref}
          </code>
        </div>
      )}

      {node.calls && node.calls.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Calls</div>
          {node.calls.map((call, i) => (
            <code key={i} style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 3, marginBottom: 2, wordBreak: 'break-all' }}>
              {call}
            </code>
          ))}
        </div>
      )}

      {node.reason_codes && node.reason_codes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Reason Codes</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {node.reason_codes.map((code, i) => (
              <span key={i} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                {code}
              </span>
            ))}
          </div>
        </div>
      )}

      {node.span_name && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Tracer Span</div>
          <code style={{ fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{node.span_name}</code>
        </div>
      )}

      {node.model && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>AI Model</div>
          <code style={{ fontSize: 12, color: 'var(--probabilistic)' }}>{node.model}</code>
        </div>
      )}

      {node.confidence && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Confidence</div>
          <span style={{
            display: 'inline-block',
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 4,
            background: node.confidence === 'static_plus_runtime' ? 'rgba(34,197,94,0.15)' :
                         node.confidence === 'runtime_only' ? 'rgba(59,130,246,0.15)' :
                         'rgba(156,163,175,0.15)',
            color: node.confidence === 'static_plus_runtime' ? '#22c55e' :
                   node.confidence === 'runtime_only' ? '#3b82f6' :
                   '#9ca3af',
          }}>
            {node.confidence === 'static_plus_runtime' ? 'Verified (static + runtime)' :
             node.confidence === 'runtime_only' ? 'Runtime only' :
             'Static only'}
          </span>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 10, color: 'var(--text-muted)' }}>
        Type: {node.type} | ID: {node.id}
      </div>
    </div>
  );
}

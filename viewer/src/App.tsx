import { useState, useEffect } from 'react';
import type { IRFlow } from './types';
import { FlowSelector } from './components/FlowSelector';
import { FlowCanvas } from './components/FlowCanvas';

function App() {
  const [flows, setFlows] = useState<IRFlow[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/flows')
      .then(res => res.json())
      .then((data: IRFlow[]) => {
        setFlows(data);
        if (data.length > 0) setSelectedFlowId(data[0].flow);
      })
      .catch(() => setError('Failed to load flows'));
  }, []);

  const selectedFlow = flows.find(f => f.flow === selectedFlowId);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        {error}
      </div>
    );
  }

  if (flows.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        No flows found. Point the viewer at a directory containing IR YAML files.
      </div>
    );
  }

  return (
    <>
      <div className="header-bar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3 }}>
            Logic Observer
          </div>
          {selectedFlow && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', paddingLeft: 10 }}>
              {selectedFlow.nodes.length} nodes &middot; {selectedFlow.edges.length} edges
            </span>
          )}
        </div>
        <div className="header-controls" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 13,
              color: 'var(--text-primary)',
              width: 200,
              outline: 'none',
            }}
          />
          <select
            value={filter || ''}
            onChange={e => setFilter(e.target.value || null)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 13,
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          >
            <option value="">All types</option>
            <option value="deterministic">Deterministic</option>
            <option value="configurable">Configurable</option>
            <option value="probabilistic">AI-powered</option>
          </select>
        </div>
      </div>

      <FlowSelector flows={flows} selected={selectedFlowId} onSelect={setSelectedFlowId} />

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {selectedFlow && <FlowCanvas flow={selectedFlow} filter={filter} search={search} />}
      </div>
    </>
  );
}

export default App;

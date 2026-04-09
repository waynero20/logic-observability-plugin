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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          Logic Observer
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
              color: 'var(--text-primary)',
              width: 160,
            }}
          />
          <select
            value={filter || ''}
            onChange={e => setFilter(e.target.value || null)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
              color: 'var(--text-primary)',
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

      {selectedFlow && <FlowCanvas flow={selectedFlow} filter={filter} search={search} />}
    </>
  );
}

export default App;

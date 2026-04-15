import { useState, useEffect, useMemo } from 'react';
import type { IRFlow } from './types';
import { Sidebar } from './components/Sidebar';
import { FlowCanvas } from './components/FlowCanvas';
import { FlowHeader } from './components/FlowHeader';

function App() {
  const [flows, setFlows] = useState<IRFlow[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetch('/api/flows')
      .then(res => res.json())
      .then((data: IRFlow[]) => {
        setFlows(data);
        if (data.length > 0) setSelectedFlowId(data[0].flow);
      })
      .catch(() => setError('Failed to load flows'));
  }, []);

  const selectedFlow = useMemo(
    () => flows.find(f => f.flow === selectedFlowId),
    [flows, selectedFlowId]
  );

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 12,
        color: 'var(--text-muted)',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span style={{ fontSize: 14 }}>{error}</span>
      </div>
    );
  }

  if (flows.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 16,
        color: 'var(--text-muted)',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <span style={{ fontSize: 14 }}>Loading flows...</span>
      </div>
    );
  }

  return (
    <>
      <Sidebar
        flows={flows}
        selected={selectedFlowId}
        onSelect={setSelectedFlowId}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {selectedFlow && (
          <FlowHeader
            flow={selectedFlow}
            search={search}
            onSearchChange={setSearch}
            filter={filter}
            onFilterChange={setFilter}
          />
        )}

        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {selectedFlow && (
            <FlowCanvas flow={selectedFlow} filter={filter} search={search} />
          )}
        </div>
      </div>
    </>
  );
}

export default App;

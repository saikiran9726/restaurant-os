import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth, fetchVersion } from './api/client.js';
import { useAppStore } from './stores/useAppStore.js';

export function App(): React.JSX.Element {
  const { setLastBootCheck } = useAppStore();

  const {
    data: healthData,
    isLoading: isHealthLoading,
    isError: isHealthError,
    error: healthError,
    refetch: refetchHealth,
    isFetching,
  } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetchHealth();
      setLastBootCheck(res.data.timestamp);
      return res;
    },
    refetchInterval: 15000,
  });

  const { data: versionData } = useQuery({
    queryKey: ['version'],
    queryFn: fetchVersion,
    staleTime: 60000,
  });

  const isDbConnected = healthData?.data.db === 'connected';
  const isApiOk = healthData?.data.status === 'ok';

  return (
    <main className="container" role="main">
      <header className="header">
        <div className="title-group">
          <h1 className="title">Restaurant OS</h1>
          <span className="dev-badge" aria-label="Development Mode Badge">
            Boot Diagnostics
          </span>
        </div>
        <div className="actions-bar">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void refetchHealth()}
            disabled={isFetching}
            aria-busy={isFetching}
          >
            {isFetching ? 'Checking...' : 'Re-check Status'}
          </button>
        </div>
      </header>

      <section aria-labelledby="system-status-heading">
        <h2 id="system-status-heading" className="card-title" style={{ marginBottom: '1rem' }}>
          System Health Overview
        </h2>

        <div className="grid">
          {/* API Server Status */}
          <div className="card">
            <span className="card-title">API Server</span>
            <div className="card-value">
              <span
                className={`status-indicator ${
                  isHealthLoading ? 'status-loading' : isApiOk ? 'status-ok' : 'status-error'
                }`}
                aria-hidden="true"
              />
              <span>
                {isHealthLoading
                  ? 'Connecting...'
                  : isApiOk
                    ? 'Online (200 OK)'
                    : 'Offline / Error'}
              </span>
            </div>
            <small style={{ color: '#94a3b8' }}>
              Latency: {healthData ? `${healthData.latencyMs}ms` : '--'}
            </small>
          </div>

          {/* Database Connection */}
          <div className="card">
            <span className="card-title">PostgreSQL Database</span>
            <div className="card-value">
              <span
                className={`status-indicator ${
                  isHealthLoading ? 'status-loading' : isDbConnected ? 'status-ok' : 'status-error'
                }`}
                aria-hidden="true"
              />
              <span>
                {isHealthLoading
                  ? 'Testing query...'
                  : isDbConnected
                    ? 'Connected (Pool Active)'
                    : 'Disconnected'}
              </span>
            </div>
            <small style={{ color: '#94a3b8' }}>Checked with `SELECT 1` query</small>
          </div>

          {/* API Version & Environment */}
          <div className="card">
            <span className="card-title">API Environment</span>
            <div className="card-value">
              <span>{versionData?.environment ?? 'development'}</span>
            </div>
            <small style={{ color: '#94a3b8' }}>Version: {versionData?.version ?? '0.1.0'}</small>
          </div>

          {/* Server Uptime */}
          <div className="card">
            <span className="card-title">Process Uptime</span>
            <div className="card-value">
              <span>{healthData ? `${Math.floor(healthData.data.uptime)}s` : '--'}</span>
            </div>
            <small style={{ color: '#94a3b8' }}>
              Timestamp:{' '}
              {healthData?.data.timestamp
                ? new Date(healthData.data.timestamp).toLocaleTimeString()
                : '--'}
            </small>
          </div>
        </div>
      </section>

      {/* Error Details if any */}
      {isHealthError && (
        <section
          aria-live="polite"
          style={{
            background: '#7f1d1d33',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <h3 style={{ color: '#f87171', marginBottom: '0.5rem' }}>Connection Failed</h3>
          <p style={{ color: '#fca5a5', fontSize: '0.9rem' }}>
            {healthError instanceof Error ? healthError.message : 'Unknown error occurred'}
          </p>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Ensure the API server is running on port 4000 and PostgreSQL is running.
          </p>
        </section>
      )}

      {/* Raw Health Check Payload */}
      <section aria-labelledby="raw-payload-heading">
        <h2 id="raw-payload-heading" className="card-title">
          Diagnostic Response Payload
        </h2>
        <div className="info-box">
          <pre>
            {JSON.stringify(
              healthData
                ? {
                    status: healthData.data.status,
                    db: healthData.data.db,
                    timestamp: healthData.data.timestamp,
                    uptime: healthData.data.uptime,
                    latencyMs: healthData.latencyMs,
                  }
                : { status: 'waiting_for_response' },
              null,
              2,
            )}
          </pre>
        </div>
      </section>
    </main>
  );
}
export default App;

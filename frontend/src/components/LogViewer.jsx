import { useState, useEffect, useRef } from 'react';

export default function LogViewer({ logs }) {
  const containerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getStatusClass = (code) => {
    if (code >= 500) return 's5xx';
    if (code >= 400) return 's4xx';
    if (code >= 300) return 's3xx';
    return 's2xx';
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
    } catch {
      return ts;
    }
  };

  return (
    <div className="glass-card log-viewer">
      <div className="log-viewer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {logs.length > 0 && <span className="live-dot"></span>}
          <h3>📋 Server Logs</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '8px' }}>
            {logs.length} entries
          </span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            style={{ accentColor: 'var(--accent-cyan)' }}
          />
          Auto-scroll
        </label>
      </div>

      <div ref={containerRef} style={{ maxHeight: '440px', overflowY: 'auto' }}>
        {logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <p>No logs yet. Click <strong>Generate &amp; Analyze</strong> to start.</p>
          </div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="log-entry">
              <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
              <span className="log-ip">{log.ip}</span>
              <span className={`log-method ${log.method}`}>{log.method}</span>
              <span className="log-path" title={log.path}>{log.path}</span>
              <span className={`log-status ${getStatusClass(log.status_code)}`}>
                {log.status_code}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

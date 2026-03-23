import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = 'http://localhost:5000';

const SEVERITY_COLOR = {
  Critical: 'var(--color-critical)',
  High: 'var(--color-high)',
  Medium: 'var(--color-medium)',
  Low: 'var(--color-low)',
};

function formatTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ts; }
}

function getStatusClass(code) {
  if (code >= 500) return 's5xx';
  if (code >= 400) return 's4xx';
  if (code >= 300) return 's3xx';
  return 's2xx';
}

export default function LiveMonitor() {
  const [logs, setLogs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [attackRatio, setAttackRatio] = useState(0.3);
  const [connected, setConnected] = useState(false);
  const [logCount, setLogCount] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [minuteBuckets, setMinuteBuckets] = useState(Array(10).fill(0));
  const socketRef = useRef(null);
  const logContainerRef = useRef(null);
  const minuteRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => { setConnected(false); setIsStreaming(false); });

    socket.on('new_logs', (data) => {
      if (!data.logs) return;
      setLogs(prev => [...data.logs, ...prev].slice(0, 1000));
      setLogCount(c => c + data.logs.length);

      // Track logs per minute in the last 10 minutes
      const now = Date.now();
      const bucket = Math.floor(now / 60000) % 10;
      setMinuteBuckets(prev => {
        const next = [...prev];
        next[bucket] = (next[bucket] || 0) + data.logs.length;
        return next;
      });
    });

    socket.on('new_incidents', (data) => {
      if (!data.incidents) return;
      setIncidents(prev => [...data.incidents.map(i => ({ ...i, ts: Date.now() })), ...prev].slice(0, 50));
    });

    // Reset minute buckets every minute
    minuteRef.current = setInterval(() => {
      const bucket = Math.floor(Date.now() / 60000) % 10;
      setMinuteBuckets(prev => { const next = [...prev]; next[bucket] = 0; return next; });
    }, 60000);

    return () => {
      socket.disconnect();
      clearInterval(minuteRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const toggleStream = () => {
    if (!socketRef.current) return;
    const next = !isStreaming;
    socketRef.current.emit('toggle_stream', { active: next, attack_ratio: attackRatio });
    setIsStreaming(next);
    if (!next) setLogCount(c => c); // keep count, don't reset
  };

  const handleRatioChange = (e) => {
    const r = Number(e.target.value);
    setAttackRatio(r);
    if (socketRef.current && isStreaming) {
      socketRef.current.emit('toggle_stream', { active: true, attack_ratio: r });
    }
  };

  const maxBucket = Math.max(...minuteBuckets, 1);
  const recentIncidents = incidents.slice(0, 15);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2>📡 Live Monitor</h2>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
              background: connected ? 'rgba(52,211,153,0.12)' : 'rgba(255,45,85,0.12)',
              color: connected ? 'var(--color-low)' : 'var(--color-critical)',
              border: `1px solid ${connected ? 'rgba(52,211,153,0.25)' : 'rgba(255,45,85,0.2)'}`,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: connected ? 'pulse-dot 2s infinite' : 'none' }} />
              {connected ? 'Connected' : 'Disconnected'}
            </span>
            {isStreaming && (
              <span className="live-indicator"><span className="pulse-dot" /> LIVE</span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            Real-time threat detection &amp; log stream
          </p>
        </div>
        <div className="header-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Attack%:</label>
            <select className="filter-select" value={attackRatio} onChange={handleRatioChange}>
              <option value={0.1}>10%</option>
              <option value={0.2}>20%</option>
              <option value={0.3}>30%</option>
              <option value={0.5}>50%</option>
              <option value={0.7}>70%</option>
              <option value={0.9}>90%</option>
            </select>
          </div>
          <button
            className={`btn ${isStreaming ? 'btn-danger' : 'btn-primary'}`}
            onClick={toggleStream}
            disabled={!connected}
            id="monitor-toggle-stream"
          >
            {isStreaming ? '⏹️ Stop' : '▶️ Start Stream'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setLogs([]); setIncidents([]); setLogCount(0); setMinuteBuckets(Array(10).fill(0)); }} id="monitor-clear">
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Logs Received', value: logCount, color: 'var(--accent-cyan)' },
          { label: 'Threats Detected', value: incidents.length, color: 'var(--color-critical)' },
          { label: 'Critical', value: incidents.filter(i => i.severity === 'Critical').length, color: 'var(--color-critical)' },
          { label: 'High', value: incidents.filter(i => i.severity === 'High').length, color: 'var(--color-high)' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Activity graph */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
          📈 Log Activity (last 10 minutes)
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
          {minuteBuckets.map((val, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', borderRadius: 4,
                height: `${Math.round((val / maxBucket) * 52)}px`,
                minHeight: val > 0 ? 4 : 0,
                background: 'linear-gradient(to top, var(--accent-cyan), var(--accent-purple))',
                transition: 'height 0.4s ease',
                opacity: i === (Math.floor(Date.now() / 60000) % 10) ? 1 : 0.5,
              }} />
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>-{9 - i}m</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* Log feed */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div className="log-viewer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isStreaming && <span className="live-dot" />}
              <h3>📋 Live Log Feed</h3>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>{logs.length} entries</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} style={{ accentColor: 'var(--accent-cyan)' }} />
              Auto-scroll
            </label>
          </div>
          <div ref={logContainerRef} style={{ maxHeight: 480, overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📡</div>
                <p>Click <strong>Start Stream</strong> to begin monitoring.</p>
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="log-entry" style={{ borderLeft: log.status_code >= 400 ? '2px solid var(--color-critical)' : '2px solid transparent' }}>
                  <span className="log-timestamp">{formatTime(log.timestamp)}</span>
                  <span className="log-ip">{log.ip}</span>
                  <span className={`log-method ${log.method}`}>{log.method}</span>
                  <span className="log-path" title={log.path}>{log.path}</span>
                  <span className={`log-status ${getStatusClass(log.status_code)}`}>{log.status_code}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Threat feed */}
        <div className="glass-card" style={{ overflow: 'hidden', maxHeight: 580, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bg-glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <h3>⚡ Threat Feed</h3>
            {incidents.length > 0 && (
              <span className="severity-badge severity-critical" style={{ fontSize: '0.7rem' }}>{incidents.length} detected</span>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {recentIncidents.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 16px' }}>
                <div className="empty-icon" style={{ fontSize: '2rem' }}>🛡️</div>
                <p style={{ fontSize: '0.82rem' }}>No threats detected yet</p>
              </div>
            ) : (
              recentIncidents.map((inc, idx) => (
                <div key={idx} className="animate-fade-in" style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  borderLeft: `3px solid ${SEVERITY_COLOR[inc.severity] || 'var(--text-muted)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: SEVERITY_COLOR[inc.severity] }}>{inc.severity}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatTime(new Date(inc.ts).toISOString())}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 3 }}>{inc.threat_type}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{inc.source_ip}</div>
                  {inc.summary && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{inc.summary?.slice(0, 90)}{inc.summary?.length > 90 ? '…' : ''}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

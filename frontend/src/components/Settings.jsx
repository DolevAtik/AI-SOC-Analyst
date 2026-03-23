import { useState, useEffect } from 'react';
import { healthCheck } from '../api';

const DEFAULTS = {
  bruteForceThreshold: 5,
  sqlInjectionEnabled: true,
  unauthorizedAccessEnabled: true,
  suspiciousIpEnabled: true,
  defaultAttackRatio: 30,
  logBatchSize: 50,
  maxLogsInMemory: 500,
  autoScrollLogs: true,
  showTimestamps: true,
  compactView: false,
  blockedIPs: '45.142.212.100\n185.220.101.1\n194.165.16.4\n91.108.4.0\n198.235.24.15',
};

function loadSettings() {
  try {
    const saved = localStorage.getItem('soc_settings');
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

function Section({ title, icon, children }) {
  return (
    <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 20 }}>
      <h3 style={{ marginBottom: 18, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ flex: 1, paddingRight: 20 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        {description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
        background: value ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background 0.25s',
        boxShadow: value ? '0 0 12px rgba(0,240,255,0.3)' : 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 0.25s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }} />
    </div>
  );
}

export default function Settings() {
  const [cfg, setCfg] = useState(loadSettings);
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const set = (key, val) => setCfg(prev => ({ ...prev, [key]: val }));

  const save = () => {
    localStorage.setItem('soc_settings', JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const reset = () => { setCfg({ ...DEFAULTS }); localStorage.removeItem('soc_settings'); };

  const checkHealth = async () => {
    setHealthLoading(true);
    setHealth(null);
    try {
      const res = await healthCheck();
      setHealth({ ok: true, data: res });
    } catch (err) {
      setHealth({ ok: false, error: err.message });
    } finally { setHealthLoading(false); }
  };

  useEffect(() => { checkHealth(); }, []);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>⚙️ Settings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            Configure detection thresholds, display preferences &amp; stream defaults
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={reset} id="settings-reset">↺ Restore Defaults</button>
          <button className="btn btn-primary" onClick={save} id="settings-save">
            {saved ? '✅ Saved!' : '💾 Save Settings'}
          </button>
        </div>
      </div>

      {/* Detection Thresholds */}
      <Section title="Detection Thresholds" icon="🔍">
        <SettingRow
          label="Brute Force Login Threshold"
          description="Minimum failed login attempts from one IP to trigger an alert"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min={2} max={20} step={1} value={cfg.bruteForceThreshold}
              onChange={e => set('bruteForceThreshold', Number(e.target.value))}
              style={{ width: 120, accentColor: 'var(--accent-cyan)' }}
            />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, minWidth: 24 }}>{cfg.bruteForceThreshold}</span>
          </div>
        </SettingRow>
        <SettingRow
          label="SQL Injection Detection"
          description="Regex-based detection of SQL injection payloads in request paths"
        >
          <Toggle value={cfg.sqlInjectionEnabled} onChange={v => set('sqlInjectionEnabled', v)} />
        </SettingRow>
        <SettingRow
          label="Unauthorized Access Detection"
          description="Flag requests to admin and sensitive paths from unrecognized sources"
        >
          <Toggle value={cfg.unauthorizedAccessEnabled} onChange={v => set('unauthorizedAccessEnabled', v)} />
        </SettingRow>
        <SettingRow
          label="Suspicious IP Monitoring"
          description="Cross-reference traffic against the IP blocklist below"
        >
          <Toggle value={cfg.suspiciousIpEnabled} onChange={v => set('suspiciousIpEnabled', v)} />
        </SettingRow>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.83rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
            Blocked IP List (one per line)
          </div>
          <textarea
            value={cfg.blockedIPs}
            onChange={e => set('blockedIPs', e.target.value)}
            rows={5}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--bg-glass-border)',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text-primary)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', resize: 'vertical',
              lineHeight: 1.7, outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent-cyan)')}
            onBlur={e => (e.target.style.borderColor = 'var(--bg-glass-border)')}
          />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {cfg.blockedIPs.split('\n').filter(l => l.trim()).length} IPs in blocklist
          </div>
        </div>
      </Section>

      {/* Stream Defaults */}
      <Section title="Stream Defaults" icon="📡">
        <SettingRow
          label="Default Attack Ratio"
          description="Percentage of generated logs that simulate attack traffic"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min={0} max={90} step={10} value={cfg.defaultAttackRatio}
              onChange={e => set('defaultAttackRatio', Number(e.target.value))}
              style={{ width: 120, accentColor: 'var(--color-critical)' }}
            />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, minWidth: 36 }}>{cfg.defaultAttackRatio}%</span>
          </div>
        </SettingRow>
        <SettingRow
          label="Log Batch Size"
          description="Number of log entries generated per stream cycle"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min={5} max={100} step={5} value={cfg.logBatchSize}
              onChange={e => set('logBatchSize', Number(e.target.value))}
              style={{ width: 120, accentColor: 'var(--accent-purple)' }}
            />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, minWidth: 36 }}>{cfg.logBatchSize}</span>
          </div>
        </SettingRow>
      </Section>

      {/* Display Preferences */}
      <Section title="Display Preferences" icon="🖥️">
        <SettingRow label="Max Logs In Memory" description="Maximum number of log entries kept in the browser before discarding old ones">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min={100} max={2000} step={100} value={cfg.maxLogsInMemory}
              onChange={e => set('maxLogsInMemory', Number(e.target.value))}
              style={{ width: 120, accentColor: 'var(--accent-cyan)' }}
            />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, minWidth: 46 }}>{cfg.maxLogsInMemory}</span>
          </div>
        </SettingRow>
        <SettingRow label="Auto-scroll Logs" description="Automatically scroll to newest log entries in the live feed">
          <Toggle value={cfg.autoScrollLogs} onChange={v => set('autoScrollLogs', v)} />
        </SettingRow>
        <SettingRow label="Show Timestamps" description="Display timestamp column in the log viewer">
          <Toggle value={cfg.showTimestamps} onChange={v => set('showTimestamps', v)} />
        </SettingRow>
        <SettingRow label="Compact View" description="Reduce spacing between log entries for higher density display">
          <Toggle value={cfg.compactView} onChange={v => set('compactView', v)} />
        </SettingRow>
      </Section>

      {/* System Info */}
      <Section title="System Information" icon="🔧">
        <SettingRow label="Backend API" description="Flask REST API endpoint">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>
            http://localhost:5000
          </span>
        </SettingRow>
        <SettingRow label="WebSocket Server" description="Real-time event bus">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>
            http://localhost:5000
          </span>
        </SettingRow>
        <SettingRow label="Frontend" description="Vite/React dev server">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>
            http://localhost:5173
          </span>
        </SettingRow>
        <SettingRow label="Application Version" description="">
          <span style={{ fontFamily: "'JetBrains Mono', monospace', fontSize: '0.82rem'" }}>v1.0.0</span>
        </SettingRow>

        {/* Health check */}
        <div style={{ marginTop: 20, padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--bg-glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>🩺 Backend Health Check</span>
            <button className="btn btn-secondary btn-sm" onClick={checkHealth} disabled={healthLoading} id="settings-health-check">
              {healthLoading ? 'Checking…' : 'Run Check'}
            </button>
          </div>
          {health && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: health.ok ? 'rgba(52,211,153,0.08)' : 'rgba(255,45,85,0.08)',
              border: `1px solid ${health.ok ? 'rgba(52,211,153,0.2)' : 'rgba(255,45,85,0.2)'}`,
            }}>
              {health.ok ? (
                <div>
                  <div style={{ color: 'var(--color-low)', fontWeight: 600, marginBottom: 4 }}>✅ Backend is healthy</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    Service: {health.data.service} · {health.data.timestamp}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ color: 'var(--color-critical)', fontWeight: 600, marginBottom: 4 }}>❌ Backend unreachable</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{health.error}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

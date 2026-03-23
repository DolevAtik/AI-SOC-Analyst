import { useState, useEffect, useCallback } from 'react';
import { getIncidents, getStats, clearIncidents } from '../api';
import StatsCharts from './StatsCharts';

const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function formatDate(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ts; }
}

function exportCSV(data) {
  const headers = ['Severity', 'Threat Type', 'Source IP', 'Summary', 'Action', 'Timestamp'];
  const rows = data.map(i => [
    i.severity, i.threat_type, i.source_ip,
    `"${(i.summary || '').replace(/"/g, "'")}"`,
    `"${(i.recommended_action || '').replace(/"/g, "'")}"`,
    i.detected_at || '',
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `soc-report-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

async function reportIncident(data) {
  const res = await fetch('/api/incidents/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

/* ─── Modal ────────────────────────────────────────── */
const EMPTY_FORM = { severity: 'High', threat_type: 'Brute Force Attack', source_ip: '', summary: '', recommended_action: '' };
const THREAT_TYPES = ['Brute Force Attack', 'SQL Injection', 'Unauthorized Access Attempt', 'Suspicious IP Activity', 'Other'];

function inputStyle(focused) {
  return {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${focused ? 'var(--accent-cyan)' : 'var(--bg-glass-border)'}`,
    borderRadius: 'var(--radius-sm)', padding: '9px 13px',
    color: 'var(--text-primary)', fontFamily: 'inherit',
    fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.15s',
  };
}

function ReportModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [focus, setFocus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.source_ip.trim()) { setError('Source IP is required.'); return; }
    if (!form.summary.trim()) { setError('Summary is required.'); return; }
    if (!form.recommended_action.trim()) { setError('Recommended action is required.'); return; }
    setError('');
    setSubmitting(true);
    try {
      await reportIncident(form);
      onSuccess();
    } catch (err) {
      setError('Failed to submit incident. Is the backend running?');
    } finally {
      setSubmitting(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const fieldLabel = (label, required) => (
    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
      {label}{required && <span style={{ color: 'var(--color-critical)', marginLeft: 3 }}>*</span>}
    </div>
  );

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: 540, padding: '28px 32px' }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>🚨 Report Manual Incident</h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
              Manually log a security incident into the database
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Row: Severity + Threat Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              {fieldLabel('Severity', true)}
              <select
                value={form.severity}
                onChange={e => set('severity', e.target.value)}
                style={{ ...inputStyle(focus === 'severity'), cursor: 'pointer' }}
                onFocus={() => setFocus('severity')} onBlur={() => setFocus('')}
              >
                {['Critical', 'High', 'Medium', 'Low'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              {fieldLabel('Threat Type', true)}
              <select
                value={form.threat_type}
                onChange={e => set('threat_type', e.target.value)}
                style={{ ...inputStyle(focus === 'type'), cursor: 'pointer' }}
                onFocus={() => setFocus('type')} onBlur={() => setFocus('')}
              >
                {THREAT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Source IP */}
          <div style={{ marginBottom: 16 }}>
            {fieldLabel('Source IP', true)}
            <input
              type="text"
              placeholder="e.g. 192.168.1.100"
              value={form.source_ip}
              onChange={e => set('source_ip', e.target.value)}
              style={inputStyle(focus === 'ip')}
              onFocus={() => setFocus('ip')} onBlur={() => setFocus('')}
            />
          </div>

          {/* Summary */}
          <div style={{ marginBottom: 16 }}>
            {fieldLabel('Summary', true)}
            <textarea
              placeholder="Describe what happened (e.g. Multiple failed SSH login attempts from this IP over 10 minutes)"
              value={form.summary}
              onChange={e => set('summary', e.target.value)}
              rows={3}
              style={{ ...inputStyle(focus === 'summary'), resize: 'vertical', lineHeight: 1.6 }}
              onFocus={() => setFocus('summary')} onBlur={() => setFocus('')}
            />
          </div>

          {/* Recommended Action */}
          <div style={{ marginBottom: 22 }}>
            {fieldLabel('Recommended Action', true)}
            <input
              type="text"
              placeholder="e.g. Block IP in firewall, notify security team"
              value={form.recommended_action}
              onChange={e => set('recommended_action', e.target.value)}
              style={inputStyle(focus === 'action')}
              onFocus={() => setFocus('action')} onBlur={() => setFocus('')}
            />
          </div>

          {/* Severity preview badge */}
          <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Preview:</span>
            <span className={`severity-badge severity-${form.severity.toLowerCase()}`}>{form.severity}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{form.threat_type}</span>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '9px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16,
              background: 'var(--color-critical-bg)', color: 'var(--color-critical)', fontSize: '0.82rem',
              border: '1px solid rgba(255,45,85,0.2)',
            }}>{error}</div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting} id="modal-submit-incident">
              {submitting ? 'Submitting…' : '🚨 Submit Incident'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Reports Page ──────────────────────────────────── */
export default function Reports() {
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortField, setSortField] = useState('detected_at');
  const [sortDir, setSortDir] = useState('desc');
  const [confirmClear, setConfirmClear] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [incRes, statsRes] = await Promise.all([getIncidents(500), getStats()]);
      setIncidents(incRes.incidents || []);
      setStats(statsRes.stats || {});
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortIcon = (field) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const topIPs = Object.entries(
    incidents.reduce((acc, i) => { acc[i.source_ip] = (acc[i.source_ip] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const filtered = incidents
    .filter(i => (!severityFilter || i.severity === severityFilter) && (!typeFilter || i.threat_type === typeFilter))
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === 'severity') { va = SEVERITY_ORDER[va] ?? 99; vb = SEVERITY_ORDER[vb] ?? 99; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const uniqueTypes = [...new Set(incidents.map(i => i.threat_type))];

  const handleClear = async () => {
    await clearIncidents();
    setIncidents([]);
    setStats({});
    setConfirmClear(false);
  };

  const handleReportSuccess = () => {
    setShowModal(false);
    setSuccessMsg('✅ Incident reported successfully!');
    setTimeout(() => setSuccessMsg(''), 4000);
    load();
  };

  return (
    <>
      {/* Modal */}
      {showModal && <ReportModal onClose={() => setShowModal(false)} onSuccess={handleReportSuccess} />}

      <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>📄 Reports &amp; Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            Full incident history, statistics &amp; export
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)} id="reports-report-incident">
            🚨 Report Incident
          </button>
          <button className="btn btn-secondary btn-sm" onClick={load} id="reports-refresh">🔄 Refresh</button>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(filtered)} id="reports-export" disabled={filtered.length === 0}>⬇️ Export CSV</button>
          {!confirmClear
            ? <button className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)} id="reports-clear">🗑️ Clear All</button>
            : (
              <span style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-danger btn-sm" onClick={handleClear}>Confirm</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(false)}>Cancel</button>
              </span>
            )
          }
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div style={{
          background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
          borderRadius: 'var(--radius-md)', padding: '11px 16px', marginBottom: 18,
          color: 'var(--color-low)', fontSize: '0.875rem', fontWeight: 600,
        }}>{successMsg}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : incidents.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state" style={{ padding: '60px 24px' }}>
            <div className="empty-icon">📄</div>
            <p>No incidents in the database.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setShowModal(true)}>
              🚨 Report First Incident
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="stats-grid stagger-children" style={{ marginBottom: 24 }}>
            <div className="glass-card stat-card stat-total">
              <div className="stat-icon">📊</div>
              <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{incidents.length}</div>
              <div className="stat-label">Total Incidents</div>
            </div>
            <div className="glass-card stat-card stat-critical">
              <div className="stat-icon">🔴</div>
              <div className="stat-value">{incidents.filter(i => i.severity === 'Critical').length}</div>
              <div className="stat-label">Critical</div>
            </div>
            <div className="glass-card stat-card stat-high">
              <div className="stat-icon">🟠</div>
              <div className="stat-value">{incidents.filter(i => i.severity === 'High').length}</div>
              <div className="stat-label">High Severity</div>
            </div>
            <div className="glass-card stat-card">
              <div className="stat-icon">🌐</div>
              <div className="stat-value" style={{ color: 'var(--accent-purple)', fontFamily: "'JetBrains Mono', monospace", fontSize: '1.1rem' }}>
                {topIPs[0]?.[0] || '—'}
              </div>
              <div className="stat-label">Top Threat IP</div>
            </div>
          </div>

          {/* Charts */}
          <StatsCharts stats={stats} />

          {/* Top IPs */}
          <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: '0.95rem' }}>🌐 Top Source IPs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topIPs.map(([ip, count], i) => (
                <div key={ip} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 20, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>#{i + 1}</span>
                  <span style={{ minWidth: 130, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>{ip}</span>
                  <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(count / (topIPs[0]?.[1] || 1)) * 100}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: 4, transition: 'width 0.8s ease' }} />
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, minWidth: 32, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Incident table */}
          <div className="glass-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <h3>🔍 Incident Log <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>({filtered.length} / {incidents.length})</span></h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="filter-select" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
                  <option value="">All Severities</option>
                  {['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="">All Types</option>
                  {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="incidents-table-wrapper">
              <table className="incidents-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('severity')} style={{ cursor: 'pointer' }}>Severity{sortIcon('severity')}</th>
                    <th onClick={() => handleSort('threat_type')} style={{ cursor: 'pointer' }}>Threat Type{sortIcon('threat_type')}</th>
                    <th onClick={() => handleSort('source_ip')} style={{ cursor: 'pointer' }}>Source IP{sortIcon('source_ip')}</th>
                    <th>Summary</th>
                    <th onClick={() => handleSort('detected_at')} style={{ cursor: 'pointer' }}>Time{sortIcon('detected_at')}</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((inc, idx) => (
                    <tr key={idx} className="animate-fade-in" style={{ animationDelay: `${Math.min(idx, 10) * 40}ms` }}>
                      <td>
                        <span className={`severity-badge severity-${(inc.severity || '').toLowerCase()}`}>{inc.severity}</span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{inc.threat_type}</td>
                      <td className="ip-cell">{inc.source_ip}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: 280 }}>{inc.summary}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{formatDate(inc.detected_at)}</td>
                      <td>
                        <div className="incident-action" style={{ fontSize: '0.75rem' }}>⚡ {inc.recommended_action}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 200 && (
                <div style={{ padding: '12px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                  Showing first 200 of {filtered.length}. Export CSV for full data.
                </div>
              )}
            </div>
          </div>
        </>
      )}
      </div>
    </>
  );
}

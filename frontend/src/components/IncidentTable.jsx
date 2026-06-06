import { useState, useMemo } from 'react';

const SEVERITY_ORDER = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function exportCSV(incidents) {
  const headers = ['Severity', 'Threat Type', 'Source IP', 'Summary', 'Recommended Action', 'Timestamp'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = incidents.map(i => [
    escape(i.severity),
    escape(i.threat_type),
    escape(i.source_ip),
    escape(i.summary),
    escape(i.recommended_action),
    escape(i.timestamp),
  ].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `incidents_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function IncidentTable({ incidents }) {
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter]         = useState('');
  const [sortField, setSortField]           = useState('severity');
  const [sortDir, setSortDir]               = useState('desc');

  if (!incidents || incidents.length === 0) {
    return (
      <div className="glass-card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-glass-border)' }}>
          <h3>🔍 Detected Incidents</h3>
        </div>
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <p>No incidents detected yet. Generate and analyze logs to start threat detection.</p>
        </div>
      </div>
    );
  }

  const realIncidents = incidents.filter(i => i.incident_detected);

  if (realIncidents.length === 0) {
    return (
      <div className="glass-card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-glass-border)' }}>
          <h3>🔍 Detected Incidents</h3>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🛡️</div>
          <p>All clear! No threats detected in the analyzed logs.</p>
        </div>
      </div>
    );
  }

  const severities  = [...new Set(realIncidents.map(i => i.severity).filter(Boolean))].sort((a, b) => (SEVERITY_ORDER[b] ?? 0) - (SEVERITY_ORDER[a] ?? 0));
  const threatTypes = [...new Set(realIncidents.map(i => i.threat_type).filter(Boolean))].sort();

  const filtered = useMemo(() => {
    let list = realIncidents;
    if (severityFilter) list = list.filter(i => i.severity === severityFilter);
    if (typeFilter)     list = list.filter(i => i.threat_type === typeFilter);
    return [...list].sort((a, b) => {
      let av, bv;
      if (sortField === 'severity') {
        av = SEVERITY_ORDER[a.severity] ?? 0;
        bv = SEVERITY_ORDER[b.severity] ?? 0;
      } else {
        av = a[sortField] ?? '';
        bv = b[sortField] ?? '';
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [realIncidents, severityFilter, typeFilter, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortIcon = (field) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="glass-card">
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3>🔍 Detected Incidents</h3>
          <span className="severity-badge severity-critical" style={{ fontSize: '0.7rem' }}>
            {filtered.length} / {realIncidents.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Severity filter */}
          <select
            className="filter-select"
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            style={{ fontSize: '0.78rem' }}
          >
            <option value="">All Severities</option>
            {severities.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Threat type filter */}
          <select
            className="filter-select"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ fontSize: '0.78rem', maxWidth: 180 }}
          >
            <option value="">All Threat Types</option>
            {threatTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {/* Reset */}
          {(severityFilter || typeFilter) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSeverityFilter(''); setTypeFilter(''); }}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              ✕ Reset
            </button>
          )}
          {/* Export */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => exportCSV(filtered)}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            title="Export visible incidents to CSV"
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔎</div>
          <p>No incidents match the current filters.</p>
        </div>
      ) : (
        <div className="incidents-table-wrapper">
          <table className="incidents-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('severity')}>Severity{sortIcon('severity')}</th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('threat_type')}>Threat Type{sortIcon('threat_type')}</th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('source_ip')}>Source IP{sortIcon('source_ip')}</th>
                <th>Summary</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((incident, idx) => (
                <tr key={idx} className="animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                  <td>
                    <span className={`severity-badge severity-${(incident.severity || '').toLowerCase()}`}>
                      {incident.severity}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{incident.threat_type}</td>
                  <td className="ip-cell">{incident.source_ip}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: '350px' }}>
                    {incident.summary}
                  </td>
                  <td>
                    <div className="incident-action" style={{ fontSize: '0.78rem' }}>
                      ⚡ {incident.recommended_action}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

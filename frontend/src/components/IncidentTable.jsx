export default function IncidentTable({ incidents }) {
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

  return (
    <div className="glass-card">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3>🔍 Detected Incidents</h3>
        <span className="severity-badge severity-critical" style={{ fontSize: '0.7rem' }}>
          {realIncidents.length} threats
        </span>
      </div>
      <div className="incidents-table-wrapper">
        <table className="incidents-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Threat Type</th>
              <th>Source IP</th>
              <th>Summary</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {realIncidents.map((incident, idx) => (
              <tr key={idx} className="animate-fade-in" style={{ animationDelay: `${idx * 60}ms` }}>
                <td>
                  <span className={`severity-badge severity-${(incident.severity || '').toLowerCase()}`}>
                    {incident.severity}
                  </span>
                </td>
                <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {incident.threat_type}
                </td>
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
    </div>
  );
}

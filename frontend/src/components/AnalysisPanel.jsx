import React from 'react';

export default function AnalysisPanel({ incidents, loading }) {
  const realIncidents = (incidents || []).filter(i => i.incident_detected);

  return (
    <div className="analysis-panel-layout" style={{ display: 'block' }}>
      <div className="glass-card analysis-panel stagger-children">
        <div className="analysis-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3>🧠 Analysis Results</h3>
            {loading && <div className="spinner"></div>}
          </div>
          {realIncidents.length > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {realIncidents.length} threat{realIncidents.length !== 1 ? 's' : ''} identified
            </span>
          )}
        </div>

        {loading ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }}></div>
            <p style={{ marginTop: '16px' }}>Analyzing logs for threats...</p>
          </div>
        ) : realIncidents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛡️</div>
            <p>No active threats. System appears secure.</p>
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {realIncidents.map((inc, idx) => (
              <div key={idx} className={`incident-card animate-slide-in severity-${(inc.severity || '').toLowerCase()}`} style={{ animationDelay: `${idx * 80}ms` }}>
                <div className="incident-card-header">
                  <span className="incident-type">
                    {inc.threat_type === 'Brute Force Attack' && '🔐 '}
                    {inc.threat_type === 'SQL Injection' && '💉 '}
                    {inc.threat_type === 'Unauthorized Access Attempt' && '🚫 '}
                    {inc.threat_type === 'Suspicious IP Activity' && '👁️ '}
                    {inc.threat_type}
                  </span>
                  <span className={`severity-badge severity-${(inc.severity || '').toLowerCase()}`}>
                    {inc.severity}
                  </span>
                </div>
                <p className="incident-summary">{inc.summary}</p>
                
                {inc.ai_insight && (
                  <div className="ai-insight-box">
                    <strong>✨ AI Insight:</strong>
                    <p>{inc.ai_insight}</p>
                  </div>
                )}

                <div className="incident-action">
                  ⚡ <strong>Action:</strong>&nbsp; {inc.recommended_action}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

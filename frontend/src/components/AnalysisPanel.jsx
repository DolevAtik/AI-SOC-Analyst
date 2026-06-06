import { useState } from 'react';

const SEV_ICON = { Critical: '🔴', High: '🟠', Medium: '🟡', Low: '🟢' };
const TYPE_ICON = {
  'Brute Force Attack':          '🔐',
  'SQL Injection':               '💉',
  'Unauthorized Access Attempt': '🚫',
  'Suspicious IP Activity':      '👁️',
  'XSS Injection':               '🕷️',
  'Path Traversal':              '📁',
  'Request Flood / DoS':         '🌊',
  'Credential Stuffing':         '🔑',
};

function IncidentCard({ inc, idx }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`incident-card animate-slide-in severity-${(inc.severity || '').toLowerCase()}`}
      style={{ animationDelay: `${idx * 60}ms`, cursor: 'pointer' }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Header row */}
      <div className="incident-card-header">
        <span className="incident-type">
          {TYPE_ICON[inc.threat_type] || '⚡'} {inc.threat_type}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {inc.mitre_technique_id && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
              padding: '1px 6px', borderRadius: 3,
              background: 'rgba(0,212,255,0.08)', color: 'var(--accent-cyan)',
              border: '1px solid rgba(0,212,255,0.2)',
            }}>{inc.mitre_technique_id}</span>
          )}
          <span className={`severity-badge severity-${(inc.severity || '').toLowerCase()}`}>
            {SEV_ICON[inc.severity]} {inc.severity}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            ▾
          </span>
        </div>
      </div>

      {/* Source IP + tactic row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--accent-cyan)', background: 'rgba(0,212,255,0.06)',
          border: '1px solid rgba(0,212,255,0.15)', borderRadius: 4, padding: '1px 7px',
        }}>
          {inc.source_ip}
        </span>
        {inc.mitre_tactic && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            📌 {inc.mitre_tactic}
          </span>
        )}
      </div>

      {/* Summary */}
      <p className="incident-summary">{inc.summary}</p>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 10, animation: 'fadeIn 0.2s ease' }}>
          {inc.ai_insight && (
            <div className="ai-insight-box" style={{ marginBottom: 10 }}>
              <strong>✨ AI Insight</strong>
              <p>{inc.ai_insight}</p>
            </div>
          )}

          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--bg-glass-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 8 }}>
              ⚡ RECOMMENDED ACTION
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {inc.recommended_action}
            </div>
          </div>

          {inc.mitre_technique_id && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <a
                href={`https://attack.mitre.org/techniques/${inc.mitre_technique_id.replace('.', '/').replace('/', '/')}/`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  fontSize: '0.7rem', padding: '3px 10px', borderRadius: 10,
                  background: 'rgba(0,212,255,0.06)',
                  border: '1px solid rgba(0,212,255,0.2)',
                  color: 'var(--accent-cyan)', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                🔗 MITRE {inc.mitre_technique_id}
              </a>
              <span style={{
                fontSize: '0.7rem', padding: '3px 10px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-muted)',
              }}>
                {inc.mitre_tactic}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnalysisPanel({ incidents, loading, activeSeverity, activeType }) {
  const real = (incidents || []).filter(i => i.incident_detected);

  const filtered = real.filter(i =>
    (!activeSeverity || i.severity === activeSeverity) &&
    (!activeType     || i.threat_type === activeType)
  );

  const hasFilter = activeSeverity || activeType;

  return (
    <div className="analysis-panel-layout" style={{ display: 'block' }}>
      <div className="glass-card analysis-panel stagger-children">
        <div className="analysis-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3>🧠 Analysis Results</h3>
            {loading && <div className="spinner" />}
            {hasFilter && (
              <span style={{
                fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10,
                background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
                color: 'var(--accent-cyan)',
              }}>
                filtered: {filtered.length}/{real.length}
              </span>
            )}
          </div>
          {real.length > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {real.length} threat{real.length !== 1 ? 's' : ''} · click to expand
            </span>
          )}
        </div>

        {loading ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
            <p style={{ marginTop: '16px' }}>Analyzing logs for threats…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{hasFilter ? '🔍' : '🛡️'}</div>
            <p>{hasFilter ? 'No threats match the active filter.' : 'No active threats. System appears secure.'}</p>
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filtered.map((inc, idx) => (
              <IncidentCard key={`${inc.source_ip}-${inc.threat_type}-${idx}`} inc={inc} idx={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

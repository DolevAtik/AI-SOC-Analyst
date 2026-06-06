import { useState, useEffect } from 'react';
import { getAttackChains } from '../api';

const SEV_COLOR = {
  Critical: 'var(--color-critical)',
  High:     'var(--color-high)',
  Medium:   'var(--color-medium)',
  Low:      'var(--color-low)',
};

const MITRE_TACTIC_ICON = {
  'Credential Access': '🔑',
  'Initial Access':    '🚪',
  'Discovery':         '🔭',
  'Collection':        '📦',
  'Impact':            '💥',
  'Command and Control': '📡',
  'Lateral Movement':  '↔️',
  'Exfiltration':      '📤',
};

function formatTime(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ts; }
}

export default function AttackChain() {
  const [chains, setChains]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getAttackChains()
      .then(d => setChains(d.chains || []))
      .catch(() => setChains([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      </div>
    );
  }

  if (chains.length === 0) {
    return (
      <div className="glass-card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-glass-border)' }}>
          <h3>🔗 Attack Chains</h3>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🔗</div>
          <p>No multi-stage campaigns detected yet.<br/>Attack chains appear when the same IP uses multiple attack techniques.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3>🔗 Attack Chains <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>Multi-stage campaigns</span></h3>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 20, padding: '3px 10px' }}>
          {chains.length} campaign{chains.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ padding: '12px 0' }}>
        {chains.map((chain, idx) => {
          const isOpen = expanded === idx;
          const color  = SEV_COLOR[chain.severity_max] || 'var(--color-medium)';

          return (
            <div
              key={chain.ip}
              style={{
                borderBottom: idx < chains.length - 1 ? '1px solid var(--bg-glass-border)' : 'none',
              }}
            >
              {/* Chain header — clickable */}
              <div
                onClick={() => setExpanded(isOpen ? null : idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px', cursor: 'pointer',
                  transition: 'background 0.15s',
                  background: isOpen ? 'rgba(255,255,255,0.02)' : 'transparent',
                }}
              >
                {/* Severity indicator */}
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: color, flexShrink: 0,
                  boxShadow: `0 0 6px ${color}`,
                }} />

                {/* IP */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.9rem', fontWeight: 700,
                  color: 'var(--accent-cyan)', minWidth: 130,
                }}>{chain.ip}</span>

                {/* Attack type pills */}
                <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                  {chain.attack_types.map(type => (
                    <span key={type} style={{
                      fontSize: '0.68rem', fontWeight: 600,
                      padding: '2px 8px', borderRadius: 20,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                    }}>{type}</span>
                  ))}
                </div>

                {/* Count + severity */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {chain.count} incidents
                  </span>
                  <span className={`severity-badge severity-${chain.severity_max.toLowerCase()}`}>
                    {chain.severity_max}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                    ▾
                  </span>
                </div>
              </div>

              {/* Expanded timeline */}
              {isOpen && (
                <div style={{ padding: '0 20px 16px 44px', animation: 'fadeIn 0.2s ease' }}>
                  {/* Time range */}
                  <div style={{ display: 'flex', gap: 20, marginBottom: 14, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>🕐 First seen: <strong style={{ color: 'var(--text-secondary)' }}>{formatTime(chain.first_seen)}</strong></span>
                    <span>🕐 Last seen: <strong style={{ color: 'var(--text-secondary)' }}>{formatTime(chain.last_seen)}</strong></span>
                  </div>

                  {/* Kill chain steps */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {chain.attack_types.map((type, i) => {
                      const mitre = {
                        'Brute Force Attack':          { tactic: 'Credential Access', id: 'T1110.001' },
                        'Credential Stuffing':         { tactic: 'Credential Access', id: 'T1110.004' },
                        'SQL Injection':               { tactic: 'Initial Access',    id: 'T1190' },
                        'XSS Injection':               { tactic: 'Initial Access',    id: 'T1190' },
                        'Path Traversal':              { tactic: 'Collection',         id: 'T1005' },
                        'Unauthorized Access Attempt': { tactic: 'Discovery',          id: 'T1083' },
                        'Suspicious IP Activity':      { tactic: 'Command and Control', id: 'T1071' },
                        'Request Flood / DoS':         { tactic: 'Impact',             id: 'T1499' },
                      }[type] || { tactic: 'Unknown', id: '?' };

                      return (
                        <div key={type} style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                          {/* Timeline line */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 12 }} />
                            {i < chain.attack_types.length - 1 && (
                              <div style={{ width: 2, flex: 1, background: `linear-gradient(${color}, rgba(255,255,255,0.08))`, minHeight: 24 }} />
                            )}
                          </div>
                          {/* Content */}
                          <div style={{ paddingLeft: 12, paddingBottom: 14, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {MITRE_TACTIC_ICON[mitre.tactic] || '⚡'} {type}
                              </span>
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                                padding: '2px 7px', borderRadius: 4,
                                background: 'rgba(0,212,255,0.08)', color: 'var(--accent-cyan)',
                                border: '1px solid rgba(0,212,255,0.2)',
                              }}>{mitre.id}</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {mitre.tactic}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

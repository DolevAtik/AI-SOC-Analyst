import { useState, useEffect } from 'react';

const SCENARIO_META = {
  random: {
    label: 'Random Mix',
    description: 'Classic mode — random attack types every batch, configurable attack ratio.',
    duration_min: null,
    icon: '🎲',
    color: 'var(--accent-cyan)',
    phases: [],
  },
  ransomware: {
    label: 'Ransomware Pre-Stage',
    description: 'Full kill chain: recon → brute force → lateral movement → data staging → pre-encryption.',
    duration_min: 8,
    icon: '🔒',
    color: '#ff2d55',
    phases: ['Reconnaissance', 'Credential Attack', 'Lateral Movement', 'Data Staging', 'Pre-Encryption'],
  },
  apt: {
    label: 'APT Campaign',
    description: 'Advanced Persistent Threat — slow, stealthy, multi-stage. Low noise, high damage.',
    duration_min: 12,
    icon: '🕵️',
    color: '#a855f7',
    phases: ['Low-and-Slow Recon', 'Initial Compromise', 'Persistence', 'Data Exfiltration'],
  },
  webapp: {
    label: 'Web App Penetration',
    description: 'Automated web attack: directory fuzzing → SQLi → admin bypass → DB dump.',
    duration_min: 5,
    icon: '💉',
    color: '#ff9500',
    phases: ['Directory Fuzzing', 'SQL Injection', 'Admin Bypass', 'Database Dump'],
  },
  insider: {
    label: 'Insider Threat',
    description: 'Trusted user gradually exceeds their scope — subtle, difficult to detect.',
    duration_min: 10,
    icon: '🧑‍💼',
    color: '#fbbf24',
    phases: ['Normal Behavior', 'Scope Creep', 'Privilege Escalation', 'Data Exfiltration'],
  },
  ddos: {
    label: 'DDoS + Exploit',
    description: 'HTTP flood from botnet IPs while attacker exploits the distraction.',
    duration_min: 6,
    icon: '🌊',
    color: '#34d399',
    phases: ['Target Identification', 'HTTP Flood', 'Cover Exploitation'],
  },
};

const SCENARIO_ORDER = ['random', 'ransomware', 'apt', 'webapp', 'insider', 'ddos'];

export default function ScenarioPanel({ socket, isStreaming, currentScenario, phaseInfo, onScenarioChange }) {
  const [selected, setSelected] = useState(currentScenario || 'random');

  useEffect(() => {
    if (currentScenario) setSelected(currentScenario);
  }, [currentScenario]);

  const handleSelect = (name) => {
    setSelected(name);
    onScenarioChange?.(name);
    socket?.emit('set_scenario', { name });
  };

  const meta       = SCENARIO_META[selected] || SCENARIO_META.random;
  const isScenario = selected !== 'random';
  const phase      = phaseInfo;

  return (
    <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: '0.95rem' }}>🎭 Simulation Mode</h3>
        {isScenario && phase && !phase.completed && (
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
            padding: '3px 10px', borderRadius: 20,
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.25)',
            color: 'var(--accent-cyan)',
          }}>
            {isStreaming ? '▶ RUNNING' : '⏸ PAUSED'}
          </span>
        )}
      </div>

      {/* Scenario cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 10,
        marginBottom: isScenario && phase ? 16 : 0,
      }}>
        {SCENARIO_ORDER.map(name => {
          const m       = SCENARIO_META[name];
          const active  = selected === name;
          return (
            <button
              key={name}
              onClick={() => handleSelect(name)}
              style={{
                background: active ? `${m.color}14` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${active ? m.color + '55' : 'var(--bg-glass-border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                position: 'relative',
                outline: 'none',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 7, height: 7, borderRadius: '50%',
                  background: m.color, boxShadow: `0 0 6px ${m.color}`,
                }} />
              )}
              <div style={{ fontSize: '1.2rem', marginBottom: 5 }}>{m.icon}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: active ? m.color : 'var(--text-primary)', marginBottom: 3 }}>
                {m.label}
              </div>
              {m.duration_min && (
                <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                  ~{m.duration_min} min · {m.phases.length} phases
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Phase progress — only when a scenario is active */}
      {isScenario && phase && isStreaming && !phase.completed && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--bg-glass-border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginTop: 4,
        }}>
          {/* Phase header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: meta.color }}>
                  {meta.icon} {phase.phase_name}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--bg-glass-border)', borderRadius: 10, padding: '1px 7px' }}>
                  Phase {(phase.phase_index || 0) + 1} / {phase.phase_count || meta.phases.length}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
                {phase.phase_desc}
              </div>
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', minWidth: 36, textAlign: 'right' }}>
              {phase.progress || 0}%
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              width: `${phase.progress || 0}%`, height: '100%',
              background: `linear-gradient(90deg, ${meta.color}, ${meta.color}aa)`,
              borderRadius: 3, transition: 'width 0.5s ease',
            }} />
          </div>

          {/* Phase breadcrumb */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {meta.phases.map((phaseName, i) => {
              const phaseIdx = phase.phase_index || 0;
              const isDone   = i < phaseIdx;
              const isCur    = i === phaseIdx;
              return (
                <span key={phaseName} style={{
                  fontSize: '0.65rem', fontWeight: isCur ? 700 : 400,
                  padding: '2px 8px', borderRadius: 10,
                  background: isDone ? `${meta.color}20` : isCur ? `${meta.color}30` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isCur ? meta.color + '60' : isDone ? meta.color + '30' : 'rgba(255,255,255,0.08)'}`,
                  color: isCur ? meta.color : isDone ? meta.color + 'bb' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                  {isDone ? '✓ ' : isCur ? '▶ ' : ''}{phaseName}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Scenario description (when not running) */}
      {isScenario && (!isStreaming || !phase) && (
        <div style={{
          marginTop: 4, padding: '10px 14px',
          background: `${meta.color}08`,
          border: `1px solid ${meta.color}25`,
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8rem', color: 'var(--text-secondary)',
        }}>
          {meta.icon} {meta.description}
          {meta.duration_min && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
              · ~{meta.duration_min} min
            </span>
          )}
        </div>
      )}
    </div>
  );
}

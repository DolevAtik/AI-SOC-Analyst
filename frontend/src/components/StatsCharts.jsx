import { useState } from 'react';

const SEVERITY_COLORS = {
  Critical: '#ff2d55',
  High:     '#ff9500',
  Medium:   '#fbbf24',
  Low:      '#34d399',
};

const TYPE_COLORS = {
  'Brute Force Attack':          '#ff2d55',
  'SQL Injection':               '#ff9500',
  'Unauthorized Access Attempt': '#fbbf24',
  'Suspicious IP Activity':      '#34d399',
  'XSS Injection':               '#a855f7',
  'Path Traversal':              '#06b6d4',
  'Request Flood / DoS':         '#f97316',
  'Credential Stuffing':         '#ec4899',
};

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

export default function StatsCharts({ stats, activeSeverity, activeType, onSeverityClick, onTypeClick }) {
  const [hoveredSev,  setHoveredSev]  = useState(null);
  const [hoveredType, setHoveredType] = useState(null);

  const severity = stats?.by_severity || {};
  const types    = stats?.by_type     || {};

  // ── Donut ─────────────────────────────────────────────────────────────────
  const total = Object.values(severity).reduce((a, b) => a + b, 0) || 0;
  let cumPct = 0;
  const segments = ['Critical', 'High', 'Medium', 'Low']
    .filter(s => severity[s])
    .map(s => {
      const pct    = (severity[s] / (total || 1)) * 100;
      const offset = cumPct;
      cumPct += pct;
      return { label: s, pct, offset, color: SEVERITY_COLORS[s], count: severity[s] };
    });

  const activeSegment = hoveredSev || activeSeverity;

  // ── Bar chart ─────────────────────────────────────────────────────────────
  const typeEntries = Object.entries(types).sort((a, b) => b[1] - a[1]);
  const maxType     = typeEntries[0]?.[1] || 1;
  return (
    <div className="charts-grid">

      {/* ── Donut — severity ────────────────────────────────────────────── */}
      <div className="glass-card chart-card" style={{ userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3>📊 Severity Distribution</h3>
          {activeSeverity && (
            <button
              onClick={() => onSeverityClick?.(null)}
              style={{
                fontSize: '0.68rem', padding: '2px 8px', borderRadius: 10,
                background: `${SEVERITY_COLORS[activeSeverity]}20`,
                border: `1px solid ${SEVERITY_COLORS[activeSeverity]}60`,
                color: SEVERITY_COLORS[activeSeverity],
                cursor: 'pointer', fontWeight: 700,
              }}
            >
              {activeSeverity} ✕
            </button>
          )}
        </div>

        {total === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <div className="empty-icon">📊</div><p>No data yet</p>
          </div>
        ) : (
          <div className="donut-chart-container">
            {/* SVG Donut */}
            <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
              <svg width="140" height="140" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                  {segments.map(seg => (
                    <filter key={`glow-${seg.label}`} id={`glow-${seg.label}`}>
                      <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  ))}
                </defs>

                {/* Track */}
                <circle cx="21" cy="21" r="15.91549" fill="transparent"
                  stroke="rgba(255,255,255,0.05)" strokeWidth="4" />

                {/* Segments */}
                {segments.map(seg => {
                  const isActive = activeSeverity === seg.label;
                  const isHovered = hoveredSev === seg.label;
                  const dim = activeSeverity && !isActive;
                  return (
                    <circle
                      key={seg.label}
                      cx="21" cy="21" r="15.91549"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={isActive || isHovered ? 5.5 : 4}
                      strokeOpacity={dim ? 0.2 : 1}
                      strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
                      strokeDashoffset={`${100 - seg.offset + 25}`}
                      filter={isActive || isHovered ? `url(#glow-${seg.label})` : undefined}
                      style={{
                        cursor: 'pointer',
                        transition: 'stroke-width 0.15s, stroke-opacity 0.2s',
                      }}
                      onClick={() => onSeverityClick?.(isActive ? null : seg.label)}
                      onMouseEnter={() => setHoveredSev(seg.label)}
                      onMouseLeave={() => setHoveredSev(null)}
                    />
                  );
                })}
              </svg>

              {/* Center label */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
                transition: 'all 0.2s',
              }}>
                {activeSegment ? (
                  <>
                    <span style={{
                      fontSize: '22px', fontWeight: 800, lineHeight: 1,
                      color: SEVERITY_COLORS[activeSegment] || '#f1f5f9',
                    }}>
                      {severity[activeSegment] || 0}
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: SEVERITY_COLORS[activeSegment], marginTop: 2, letterSpacing: '0.04em' }}>
                      {activeSegment.toUpperCase()}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{total}</span>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', marginTop: 2 }}>TOTAL</span>
                  </>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="donut-legend">
              {segments.map(seg => {
                const isActive  = activeSeverity === seg.label;
                const dim       = activeSeverity && !isActive;
                return (
                  <div
                    key={seg.label}
                    className="donut-legend-item"
                    onClick={() => onSeverityClick?.(isActive ? null : seg.label)}
                    onMouseEnter={() => setHoveredSev(seg.label)}
                    onMouseLeave={() => setHoveredSev(null)}
                    style={{
                      cursor: 'pointer',
                      opacity: dim ? 0.35 : 1,
                      background: isActive ? `${seg.color}12` : 'transparent',
                      borderRadius: 6,
                      padding: '3px 6px',
                      margin: '-3px -6px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span className="donut-legend-dot" style={{ background: seg.color }} />
                    <span style={{ color: isActive ? seg.color : 'var(--text-secondary)', fontWeight: isActive ? 700 : 400 }}>
                      {seg.label}
                    </span>
                    <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto', color: isActive ? seg.color : 'var(--text-primary)' }}>
                      {seg.count}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: 32, textAlign: 'right' }}>
                      {Math.round((seg.count / total) * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {total > 0 && (
          <div style={{ marginTop: 12, fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Click a segment to filter incidents
          </div>
        )}
      </div>

      {/* ── Bar chart — threat types ─────────────────────────────────────── */}
      <div className="glass-card chart-card" style={{ userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3>🎯 Threat Types</h3>
          {activeType && (
            <button
              onClick={() => onTypeClick?.(null)}
              style={{
                fontSize: '0.68rem', padding: '2px 8px', borderRadius: 10,
                background: `${TYPE_COLORS[activeType] || 'var(--accent-cyan)'}20`,
                border: `1px solid ${TYPE_COLORS[activeType] || 'var(--accent-cyan)'}60`,
                color: TYPE_COLORS[activeType] || 'var(--accent-cyan)',
                cursor: 'pointer', fontWeight: 700,
                maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {activeType.replace(' Attack', '').replace(' Attempt', '')} ✕
            </button>
          )}
        </div>

        {typeEntries.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <div className="empty-icon">🎯</div><p>No data yet</p>
          </div>
        ) : (
          <div className="chart-bar-group">
            {typeEntries.map(([type, count]) => {
              const color    = TYPE_COLORS[type] || 'var(--accent-cyan)';
              const isActive = activeType === type;
              const isHov    = hoveredType === type;
              const dim      = activeType && !isActive;
              const pct      = (count / maxType) * 100;
              return (
                <div
                  key={type}
                  className="chart-bar-item"
                  onClick={() => onTypeClick?.(isActive ? null : type)}
                  onMouseEnter={() => setHoveredType(type)}
                  onMouseLeave={() => setHoveredType(null)}
                  style={{
                    cursor: 'pointer',
                    opacity: dim ? 0.3 : 1,
                    background: isActive || isHov ? `${color}0d` : 'transparent',
                    borderRadius: 6,
                    padding: '4px 6px',
                    margin: '0 -6px',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{
                    fontSize: '0.78rem', minWidth: 140,
                    color: isActive ? color : 'var(--text-secondary)',
                    fontWeight: isActive ? 700 : 400,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <span>{TYPE_ICON[type] || '⚡'}</span>
                    <span>{type.replace(' Attack', '').replace(' Attempt', '')}</span>
                  </span>
                  <div className="chart-bar-track" style={{ flex: 1 }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: isActive || isHov
                        ? `linear-gradient(90deg, ${color}, ${color}bb)`
                        : `${color}88`,
                      borderRadius: 4,
                      transition: 'width 0.6s ease, background 0.15s',
                      boxShadow: isActive ? `0 0 8px ${color}66` : 'none',
                    }} />
                  </div>
                  <span className="chart-bar-count" style={{
                    color: isActive ? color : 'var(--text-secondary)',
                    fontWeight: isActive ? 700 : 400,
                  }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {typeEntries.length > 0 && (
          <div style={{ marginTop: 12, fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Click a bar to filter incidents
          </div>
        )}
      </div>
    </div>
  );
}

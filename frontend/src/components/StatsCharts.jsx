export default function StatsCharts({ stats }) {
  const severity = stats?.by_severity || {};
  const types = stats?.by_type || {};

  const maxSeverity = Math.max(...Object.values(severity), 1);
  const maxType = Math.max(...Object.values(types), 1);

  const severityColors = {
    Critical: 'critical',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
  };

  const typeColors = {
    'Brute Force Attack': 'brute-force',
    'SQL Injection': 'sql-injection',
    'Unauthorized Access Attempt': 'unauthorized',
    'Suspicious IP Activity': 'suspicious-ip',
  };

  const severityEntries = ['Critical', 'High', 'Medium', 'Low'];
  const typeEntries = Object.keys(typeColors);

  // Donut chart data
  const total = Object.values(severity).reduce((a, b) => a + b, 0) || 1;
  const donutColors = { Critical: '#ff2d55', High: '#ff6b35', Medium: '#fbbf24', Low: '#34d399' };
  let cumulativePercent = 0;
  const donutSegments = severityEntries
    .filter(s => severity[s])
    .map(s => {
      const pct = (severity[s] / total) * 100;
      const offset = cumulativePercent;
      cumulativePercent += pct;
      return { label: s, pct, offset, color: donutColors[s], count: severity[s] };
    });

  return (
    <div className="charts-grid">
      {/* Severity Distribution — Donut */}
      <div className="glass-card chart-card">
        <h3>📊 Severity Distribution</h3>
        {total <= 1 && Object.keys(severity).length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <div className="empty-icon">📊</div>
            <p>No data yet</p>
          </div>
        ) : (
          <div className="donut-chart-container">
            <div style={{ position: 'relative', width: 130, height: 130 }}>
              <svg className="donut-svg" width="130" height="130" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.91549" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                {donutSegments.map((seg, i) => (
                  <circle
                    key={i}
                    cx="21" cy="21" r="15.91549"
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth="4"
                    strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
                    strokeDashoffset={`${100 - seg.offset + 25}`}
                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                  />
                ))}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{Object.values(severity).reduce((a,b) => a+b, 0)}</span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', marginTop: '2px' }}>TOTAL</span>
              </div>
            </div>
            <div className="donut-legend">
              {donutSegments.map((seg, i) => (
                <div key={i} className="donut-legend-item">
                  <span className="donut-legend-dot" style={{ background: seg.color }}></span>
                  <span style={{ color: 'var(--text-secondary)' }}>{seg.label}</span>
                  <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto' }}>{seg.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Threat Types — Bar Chart */}
      <div className="glass-card chart-card">
        <h3>🎯 Threat Types</h3>
        {Object.keys(types).length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <div className="empty-icon">🎯</div>
            <p>No data yet</p>
          </div>
        ) : (
          <div className="chart-bar-group">
            {typeEntries.map(type => (
              <div key={type} className="chart-bar-item">
                <span className="chart-bar-label">{type.replace(' Attack', '').replace(' Attempt', '')}</span>
                <div className="chart-bar-track">
                  <div
                    className={`chart-bar-fill ${typeColors[type]}`}
                    style={{ width: `${((types[type] || 0) / maxType) * 100}%` }}
                  ></div>
                </div>
                <span className="chart-bar-count">{types[type] || 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { geolocateIPs } from '../api';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const SEV_COLOR = {
  Critical: '#ff2d55',
  High:     '#ff9500',
  Medium:   '#fbbf24',
  Low:      '#34d399',
};

export default function AttackMap({ incidents }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => {
    if (!incidents || incidents.length === 0) return;

    const uniqueIPs = [...new Set(
      incidents
        .filter(i => i.incident_detected && i.source_ip)
        .map(i => i.source_ip)
    )].slice(0, 50);

    if (uniqueIPs.length === 0) return;

    setLoading(true);
    setError(null);

    geolocateIPs(uniqueIPs)
      .then(data => {
        // Merge geo data with severity from incidents
        const ipSeverity = {};
        incidents.forEach(i => {
          if (i.source_ip && i.severity) {
            const cur = ipSeverity[i.source_ip];
            const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
            if (!cur || rank[i.severity] > rank[cur]) {
              ipSeverity[i.source_ip] = i.severity;
            }
          }
        });

        const enriched = (data.locations || []).map(loc => ({
          ...loc,
          severity: ipSeverity[loc.query] || 'Medium',
        }));
        setLocations(enriched);
      })
      .catch(() => setError('Geolocation unavailable'))
      .finally(() => setLoading(false));
  }, [incidents]);

  const countryCount = locations.reduce((acc, l) => {
    acc[l.country] = (acc[l.country] || 0) + 1;
    return acc;
  }, {});
  const topCountries = Object.entries(countryCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3>🌍 Attack Origin Map</h3>
        {loading && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Geolocating IPs…</span>}
        {error  && <span style={{ fontSize: '0.78rem', color: 'var(--color-high)' }}>{error}</span>}
        {!loading && !error && locations.length > 0 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {locations.length} IPs · {topCountries.length} countries
          </span>
        )}
      </div>

      {locations.length === 0 && !loading ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-icon">🌍</div>
          <p>No attack origins to map yet. Start the live stream to collect data.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
          {/* Map */}
          <div style={{
            background: 'rgba(0,212,255,0.03)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-glass-border)',
            overflow: 'hidden',
          }}>
            <ComposableMap
              projection="geoNaturalEarth1"
              style={{ width: '100%', height: 'auto' }}
              projectionConfig={{ scale: 140 }}
            >
              <ZoomableGroup>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map(geo => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="rgba(255,255,255,0.04)"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: 'none' },
                          hover:   { fill: 'rgba(0,212,255,0.1)', outline: 'none' },
                          pressed: { outline: 'none' },
                        }}
                      />
                    ))
                  }
                </Geographies>
                {locations.map((loc, i) => (
                  <Marker key={i} coordinates={[loc.lon, loc.lat]}>
                    <circle
                      r={5}
                      fill={SEV_COLOR[loc.severity] || '#fbbf24'}
                      fillOpacity={0.85}
                      stroke="rgba(0,0,0,0.4)"
                      strokeWidth={1}
                      style={{ cursor: 'pointer' }}
                    >
                      <title>{loc.query} · {loc.country} · {loc.severity}</title>
                    </circle>
                    <circle
                      r={9}
                      fill="none"
                      stroke={SEV_COLOR[loc.severity] || '#fbbf24'}
                      strokeWidth={1}
                      strokeOpacity={0.4}
                    />
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>
          </div>

          {/* Top countries sidebar */}
          {topCountries.length > 0 && (
            <div style={{ minWidth: 160 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.06em' }}>
                TOP ORIGINS
              </div>
              {topCountries.map(([country, count], i) => (
                <div key={country} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 16, textAlign: 'right' }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
                      {country}
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 3 }}>
                      <div style={{ width: `${(count / (topCountries[0]?.[1] || 1)) * 100}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)', minWidth: 20, textAlign: 'right' }}>{count}</span>
                </div>
              ))}

              {/* Legend */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--bg-glass-border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.06em' }}>SEVERITY</div>
                {Object.entries(SEV_COLOR).map(([sev, color]) => (
                  <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sev}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

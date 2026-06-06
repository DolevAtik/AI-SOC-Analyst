import { useState, useEffect } from 'react';
import { geolocateIPs } from '../api';

const SEV_COLOR = {
  Critical: '#ff2d55',
  High:     '#ff9500',
  Medium:   '#fbbf24',
  Low:      '#34d399',
};

const REGION_ORDER = [
  'Europe', 'Asia', 'North America', 'South America', 'Africa', 'Oceania', 'Unknown',
];

function countryCodeToFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  );
}

function getRegion(countryCode) {
  const eu = ['GB','DE','FR','NL','RU','UA','PL','RO','SE','NO','FI','DK','IT','ES','PT','CH','AT','BE','CZ','SK','HU','GR','TR','BY','MD','RS','HR','BG','LT','LV','EE'];
  const as = ['CN','IN','JP','KR','TW','HK','SG','TH','VN','ID','PH','MY','PK','BD','IR','IQ','SA','AE','IL','AF','KZ','UZ'];
  const na = ['US','CA','MX'];
  const sa = ['BR','AR','CL','CO','PE','VE','EC','BO'];
  const af = ['ZA','NG','EG','KE','GH','ET','TZ','MA','DZ','TN'];
  const oc = ['AU','NZ'];
  if (eu.includes(countryCode)) return 'Europe';
  if (as.includes(countryCode)) return 'Asia';
  if (na.includes(countryCode)) return 'North America';
  if (sa.includes(countryCode)) return 'South America';
  if (af.includes(countryCode)) return 'Africa';
  if (oc.includes(countryCode)) return 'Oceania';
  return 'Unknown';
}

export default function AttackMap({ incidents }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [view, setView]           = useState('countries'); // 'countries' | 'regions'

  useEffect(() => {
    if (!incidents || incidents.length === 0) return;

    const uniqueIPs = [...new Set(
      incidents.filter(i => i.incident_detected && i.source_ip).map(i => i.source_ip)
    )].slice(0, 50);

    if (uniqueIPs.length === 0) return;

    setLoading(true);

    const ipSeverity = {};
    incidents.forEach(i => {
      if (!i.source_ip || !i.severity) return;
      const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      if (!ipSeverity[i.source_ip] || rank[i.severity] > rank[ipSeverity[i.source_ip]])
        ipSeverity[i.source_ip] = i.severity;
    });

    geolocateIPs(uniqueIPs)
      .then(data => setLocations(
        (data.locations || []).map(l => ({ ...l, severity: ipSeverity[l.query] || 'Medium' }))
      ))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [incidents]);

  if (!incidents || incidents.filter(i => i.incident_detected).length === 0) {
    return (
      <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>🌍 Attack Origin Intelligence</h3>
        <div className="empty-state" style={{ padding: '32px 0' }}>
          <div className="empty-icon">🌍</div>
          <p>No attack origins yet. Start the live stream to collect data.</p>
        </div>
      </div>
    );
  }

  // Aggregate by country
  const byCountry = {};
  locations.forEach(loc => {
    const key = loc.countryCode || 'XX';
    if (!byCountry[key]) byCountry[key] = { code: key, country: loc.country, ips: [], sevCounts: {}, region: getRegion(key) };
    byCountry[key].ips.push(loc.query);
    byCountry[key].sevCounts[loc.severity] = (byCountry[key].sevCounts[loc.severity] || 0) + 1;
  });

  const countries = Object.values(byCountry).sort((a, b) => b.ips.length - a.ips.length);
  const maxCount  = countries[0]?.ips.length || 1;
  const total     = locations.length;

  // Aggregate by region
  const byRegion = {};
  countries.forEach(c => {
    if (!byRegion[c.region]) byRegion[c.region] = { name: c.region, count: 0, countries: [] };
    byRegion[c.region].count += c.ips.length;
    byRegion[c.region].countries.push(c.code);
  });
  const regions = REGION_ORDER.map(r => byRegion[r]).filter(Boolean);
  const maxRegion = regions[0]?.count || 1;

  return (
    <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3>🌍 Attack Origin Intelligence</h3>
          {!loading && locations.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
              {total} attacker IP{total !== 1 ? 's' : ''} · {countries.length} countr{countries.length !== 1 ? 'ies' : 'y'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {loading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Geolocating…</span>}
          {['countries', 'regions'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontSize: '0.72rem', padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
              background: view === v ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${view === v ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
              color: view === v ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: view === v ? 700 : 400, textTransform: 'capitalize',
            }}>{v}</button>
          ))}
        </div>
      </div>

      {locations.length === 0 && !loading ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '16px 0' }}>
          Geolocation data not available. Check backend connectivity.
        </div>
      ) : view === 'countries' ? (
        /* Countries view */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {countries.slice(0, 12).map(c => {
            const topSev = ['Critical','High','Medium','Low'].find(s => c.sevCounts[s]) || 'Low';
            const barPct  = (c.ips.length / maxCount) * 100;
            return (
              <div key={c.code} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--bg-glass-border)',
                borderLeft: `3px solid ${SEV_COLOR[topSev]}`,
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{countryCodeToFlag(c.code)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.country || c.code}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {c.ips.length} IP{c.ips.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <span className={`severity-badge severity-${topSev.toLowerCase()}`} style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                    {topSev}
                  </span>
                </div>
                {/* Bar */}
                <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${barPct}%`, height: '100%', background: SEV_COLOR[topSev], borderRadius: 2, transition: 'width 0.8s ease' }} />
                </div>
                {/* Sample IPs */}
                <div style={{ marginTop: 7, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {c.ips.slice(0, 3).map(ip => (
                    <span key={ip} style={{
                      fontSize: '0.65rem', fontFamily: "'JetBrains Mono', monospace",
                      color: 'var(--accent-cyan)', background: 'rgba(0,212,255,0.06)',
                      border: '1px solid rgba(0,212,255,0.15)', borderRadius: 3, padding: '1px 5px',
                    }}>{ip}</span>
                  ))}
                  {c.ips.length > 3 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '1px 4px' }}>+{c.ips.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Regions view */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {regions.map(r => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: 130 }}>{r.name}</span>
              <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{
                  width: `${(r.count / maxRegion) * 100}%`, height: '100%',
                  background: 'var(--accent-gradient)', borderRadius: 5, transition: 'width 0.8s ease',
                }} />
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-cyan)', minWidth: 28, textAlign: 'right' }}>{r.count}</span>
              <div style={{ display: 'flex', gap: 3, minWidth: 60 }}>
                {r.countries.slice(0, 4).map(code => (
                  <span key={code} style={{ fontSize: '1rem' }}>{countryCodeToFlag(code)}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

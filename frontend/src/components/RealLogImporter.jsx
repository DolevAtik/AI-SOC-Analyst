import { useState } from 'react';
import { parseRealLogs } from '../api';

const EXAMPLE_LOGS = `185.220.101.34 - - [06/Apr/2026:08:00:01 +0000] "POST /login HTTP/1.1" 401 0 "-" "python-requests/2.28"
185.220.101.34 - - [06/Apr/2026:08:00:02 +0000] "POST /login HTTP/1.1" 401 0 "-" "python-requests/2.28"
185.220.101.34 - - [06/Apr/2026:08:00:03 +0000] "POST /login HTTP/1.1" 401 0 "-" "python-requests/2.28"
185.220.101.34 - - [06/Apr/2026:08:00:04 +0000] "POST /login HTTP/1.1" 401 0 "-" "python-requests/2.28"
185.220.101.34 - - [06/Apr/2026:08:00:05 +0000] "POST /login HTTP/1.1" 401 0 "-" "python-requests/2.28"
192.168.1.10 - - [06/Apr/2026:08:01:00 +0000] "GET /api/v1/users/1?id=' OR 1=1-- HTTP/1.1" 500 823 "-" "sqlmap/1.7.12"
10.0.0.5 - bob [06/Apr/2026:08:02:00 +0000] "GET /dashboard HTTP/1.1" 200 4210 "-" "Mozilla/5.0"`;

const SEVERITY_COLOR = {
  Critical: 'var(--color-critical)',
  High:     'var(--color-high)',
  Medium:   'var(--color-medium)',
  Low:      'var(--color-low)',
};

export default function RealLogImporter() {
  const [logText, setLogText]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);   // { parsedCount, failedCount, failedLines, incidents }
  const [error, setError]       = useState(null);

  const handleAnalyze = async () => {
    if (!logText.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const { ok, data } = await parseRealLogs(logText);
      if (!ok && data.error) {
        setError(data);
      } else {
        setResult({
          parsedCount:  data.parsed_count,
          failedCount:  data.failed_count,
          failedLines:  data.failed_lines || [],
          incidentCount: data.incidents_found,
          incidents:    data.incidents || [],
        });
      }
    } catch (err) {
      setError({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadExample = () => {
    setLogText(EXAMPLE_LOGS);
    setResult(null);
    setError(null);
  };

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 4 }}>
            📂 Import Real Server Logs
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
            Paste Apache / Nginx <strong>Combined Log Format</strong> lines for live threat analysis.
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={loadExample}
          id="real-log-load-example"
          style={{ flexShrink: 0 }}
        >
          Load Example
        </button>
      </div>

      {/* Textarea */}
      <textarea
        id="real-log-input"
        value={logText}
        onChange={e => setLogText(e.target.value)}
        rows={7}
        placeholder={'192.168.1.1 - alice [06/Apr/2026:08:00:00 +0000] "GET /admin HTTP/1.1" 403 512 "-" "Mozilla/5.0"'}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--bg-glass-border)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px',
          color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.78rem', resize: 'vertical', lineHeight: 1.7,
          outline: 'none', transition: 'border-color 0.15s',
          boxSizing: 'border-box',
        }}
        onFocus={e  => (e.target.style.borderColor = 'var(--accent-cyan)')}
        onBlur={e   => (e.target.style.borderColor = 'var(--bg-glass-border)')}
      />

      {/* Line counter + action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 12 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {logText.split('\n').filter(l => l.trim()).length} lines entered
        </span>
        <button
          id="real-log-analyze-btn"
          className="btn btn-primary"
          onClick={handleAnalyze}
          disabled={loading || !logText.trim()}
        >
          {loading ? '⏳ Analyzing…' : '🔍 Analyze Logs'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          marginTop: 16, padding: '14px 16px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.2)',
        }}>
          <div style={{ color: 'var(--color-critical)', fontWeight: 600, marginBottom: 8 }}>
            ❌ {error.error}
          </div>
          {error.examples && (
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                Expected format examples:
              </div>
              {error.examples.map((ex, i) => (
                <code key={i} style={{
                  display: 'block', fontSize: '0.72rem',
                  color: 'var(--accent-cyan)', fontFamily: "'JetBrains Mono', monospace",
                  marginBottom: 4, wordBreak: 'break-all',
                }}>
                  {ex}
                </code>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: 16 }}>
          {/* Stats row */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap',
          }}>
            {[
              { label: 'Parsed', value: result.parsedCount, color: 'var(--color-low)' },
              { label: 'Failed to Parse', value: result.failedCount, color: result.failedCount > 0 ? 'var(--color-medium)' : 'var(--text-muted)' },
              { label: 'Threats Found', value: result.incidentCount, color: result.incidentCount > 0 ? 'var(--color-critical)' : 'var(--color-low)' },
            ].map(stat => (
              <div key={stat.label} style={{
                flex: 1, minWidth: 100, padding: '10px 14px',
                background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--bg-glass-border)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: stat.color, fontFamily: "'JetBrains Mono', monospace" }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Incidents */}
          {result.incidents.filter(i => i.incident_detected).length === 0 ? (
            <div style={{
              padding: '12px 16px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
              color: 'var(--color-low)', fontSize: '0.85rem', fontWeight: 500,
            }}>
              ✅ No threats detected in the provided logs.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {result.incidents.filter(i => i.incident_detected).map((inc, idx) => (
                <div key={idx} style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid var(--bg-glass-border)`,
                  borderLeft: `3px solid ${SEVERITY_COLOR[inc.severity] || 'var(--text-muted)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700,
                      background: `${SEVERITY_COLOR[inc.severity]}22`,
                      color: SEVERITY_COLOR[inc.severity],
                      border: `1px solid ${SEVERITY_COLOR[inc.severity]}44`,
                    }}>
                      {inc.severity}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{inc.threat_type}</span>
                    <span style={{
                      marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.75rem', color: 'var(--accent-cyan)',
                    }}>
                      {inc.source_ip}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>
                    {inc.summary}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    💡 {inc.recommended_action}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Failed lines */}
          {result.failedLines.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                ⚠️ {result.failedLines.length} line(s) couldn't be parsed (click to view)
              </summary>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.failedLines.map((fl) => (
                  <code key={fl.line} style={{
                    fontSize: '0.72rem', color: 'var(--color-medium)',
                    fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all',
                  }}>
                    Line {fl.line}: {fl.content}
                  </code>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

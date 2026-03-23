import { useState } from 'react';
import { analyzeManualLog } from '../api';

export default function ManualLogInput() {
  const [logText, setLogText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!logText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await analyzeManualLog(logText);
      setResult(res.analysis);
    } catch (err) {
      setError('Failed to analyze log. Check console for details.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card manual-input-card animate-slide-in">
      <div className="card-header">
        <h3>🔍 Manual Log Investigator</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Paste a raw log string to get specialized AI analysis and remediation tips.
        </p>
      </div>

      <div className="input-area">
        <textarea
          placeholder="Paste raw log entry here (e.g. 192.168.1.1 [2024-03-10] GET /admin/config 403...)"
          value={logText}
          onChange={(e) => setLogText(e.target.value)}
          disabled={loading}
        />
        <button 
          className="btn btn-primary" 
          onClick={handleAnalyze} 
          disabled={loading || !logText.trim()}
          style={{ width: '100%', marginTop: '12px' }}
        >
          {loading ? <><div className="spinner"></div> Researching...</> : '🚀 Analyze with AI'}
        </button>
      </div>

      {error && <div className="error-message" style={{ color: 'var(--color-critical)', marginTop: '12px', fontSize: '0.85rem' }}>⚠️ {error}</div>}

      {result && (
        <div className="manual-result animate-fade-in">
          <div className="result-header">
            <span className={`severity-badge severity-${(result.threat_level || 'Low').toLowerCase()}`}>
              {result.threat_level} Severity
            </span>
          </div>
          
          <div className="result-section">
            <strong>Analysis:</strong>
            <p>{result.analysis}</p>
          </div>

          <div className="ai-insight-box fix-tip-box">
            <strong>🛡️ Fix Tip:</strong>
            <p>{result.fix_tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

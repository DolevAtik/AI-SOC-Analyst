const API_BASE = '/api';

export async function generateLogs(count = 50, attackRatio = 0.3) {
  const res = await fetch(`${API_BASE}/logs/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, attack_ratio: attackRatio }),
  });
  if (!res.ok) throw new Error(`Generate logs failed: ${res.status}`);
  return res.json();
}

export async function analyzeLogs(logs) {
  const res = await fetch(`${API_BASE}/logs/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logs }),
  });
  if (!res.ok) throw new Error(`Analyze logs failed: ${res.status}`);
  return res.json();
}

export async function streamLogs(count = 50, attackRatio = 0.3) {
  const res = await fetch(`${API_BASE}/logs/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, attack_ratio: attackRatio }),
  });
  if (!res.ok) throw new Error(`Stream logs failed: ${res.status}`);
  return res.json();
}

export async function getIncidents(limit = 100, severity = null, threatType = null) {
  const params = new URLSearchParams({ limit });
  if (severity) params.append('severity', severity);
  if (threatType) params.append('threat_type', threatType);
  const res = await fetch(`${API_BASE}/incidents?${params}`);
  if (!res.ok) throw new Error(`Get incidents failed: ${res.status}`);
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`Get stats failed: ${res.status}`);
  return res.json();
}

export async function clearIncidents() {
  const res = await fetch(`${API_BASE}/incidents/clear`, { method: 'POST' });
  if (!res.ok) throw new Error(`Clear incidents failed: ${res.status}`);
  return res.json();
}

export async function healthCheck() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function analyzeManualLog(logText) {
  const res = await fetch(`${API_BASE}/analyze/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ log_text: logText }),
  });
  if (!res.ok) throw new Error(`Manual analysis failed: ${res.status}`);
  return res.json();
}

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api';

let _authToken = null;
export function setAuthToken(token) { _authToken = token; }

function jsonHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (_authToken) h['Authorization'] = `Bearer ${_authToken}`;
  return h;
}
function getHeaders() {
  const h = {};
  if (_authToken) h['Authorization'] = `Bearer ${_authToken}`;
  return h;
}

export function getAuthToken() { return _authToken; }

export async function generateLogs(count = 50, attackRatio = 0.3) {
  const res = await fetch(`${API_BASE}/logs/generate`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ count, attack_ratio: attackRatio }),
  });
  if (!res.ok) throw new Error(`Generate logs failed: ${res.status}`);
  return res.json();
}

export async function analyzeLogs(logs) {
  const res = await fetch(`${API_BASE}/logs/analyze`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ logs }),
  });
  if (!res.ok) throw new Error(`Analyze logs failed: ${res.status}`);
  return res.json();
}

export async function streamLogs(count = 50, attackRatio = 0.3) {
  const res = await fetch(`${API_BASE}/logs/stream`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ count, attack_ratio: attackRatio }),
  });
  if (!res.ok) throw new Error(`Stream logs failed: ${res.status}`);
  return res.json();
}

export async function getIncidents(limit = 100, severity = null, threatType = null) {
  const params = new URLSearchParams({ limit });
  if (severity) params.append('severity', severity);
  if (threatType) params.append('threat_type', threatType);
  const res = await fetch(`${API_BASE}/incidents?${params}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Get incidents failed: ${res.status}`);
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/stats`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Get stats failed: ${res.status}`);
  return res.json();
}

export async function clearIncidents() {
  const res = await fetch(`${API_BASE}/incidents/clear`, { method: 'POST', headers: getHeaders() });
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
    headers: jsonHeaders(),
    body: JSON.stringify({ log_text: logText }),
  });
  if (!res.ok) throw new Error(`Manual analysis failed: ${res.status}`);
  return res.json();
}

export async function getBlocklist() {
  const res = await fetch(`${API_BASE}/blocklist`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Get blocklist failed: ${res.status}`);
  return res.json();
}

export async function updateBlocklist(ips) {
  const res = await fetch(`${API_BASE}/blocklist`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ ips }),
  });
  if (!res.ok) throw new Error(`Update blocklist failed: ${res.status}`);
  return res.json();
}

export async function parseRealLogs(logText) {
  const res = await fetch(`${API_BASE}/logs/parse`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ log_text: logText }),
  });
  // 422 = parse error but valid JSON with details
  const data = await res.json();
  if (!res.ok && res.status !== 422) throw new Error(`Parse real logs failed: ${res.status}`);
  return { ok: res.ok, status: res.status, data };
}

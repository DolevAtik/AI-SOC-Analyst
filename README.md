# 🛡️ AI SOC Analyst

Real-time Security Operations Center dashboard — detects attack patterns using a hybrid heuristic + AI engine, and lets you investigate threats via a built-in Claude-powered chat assistant.

[![CI](https://github.com/DolevAtik/AI-SOC-Analyst/actions/workflows/ci.yml/badge.svg)](https://github.com/DolevAtik/AI-SOC-Analyst/actions)
![React](https://img.shields.io/badge/React-19-blue)
![Python](https://img.shields.io/badge/Python-3.11-cyan)
![Claude](https://img.shields.io/badge/AI-Claude_Opus_4.8-purple)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

### 🔍 Threat Detection — 8 attack types
| Attack | How it's detected |
|---|---|
| Brute Force | Repeated failed logins from the same IP |
| SQL Injection | SQLi payloads in paths and query params |
| XSS | Script injection patterns |
| Path Traversal | `../` and encoded variants |
| Request Flood / DoS | Abnormal request volume per IP |
| Credential Stuffing | Many usernames from one IP |
| Unauthorized Access | Access to `/admin`, `/.env`, etc. |
| Suspicious IP | IPs matching the managed blocklist |

### 🤖 AI — Claude Opus 4.8
- **Batch analysis** — automatic security summary for every log batch
- **Manual log analysis** — paste any log, get `threat_level`, `analysis`, and `fix_tip`
- **SOC Chat** — ask questions about active incidents in natural language

### 📊 Dashboard
- Real-time incident feed and stats via WebSocket
- Severity/type charts, attack map, and attack chain timeline
- Incident table with filters, sorting, CSV + PDF export
- Scenario panel — simulate specific attack sequences
- IP blocklist management

### 🔐 Auth
- Google OAuth via Supabase
- JWT session management between frontend and backend

---

## 🚀 Quick Start

**Backend**
```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
FLASK_SECRET_KEY=any-secret
# Optional: DATABASE_URL=postgresql://...

cd backend && pip install -r requirements.txt && py app.py
# → http://localhost:5000
```

**Frontend**
```bash
# frontend/.env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_API_URL=http://localhost:5000

cd frontend && npm install && npm run dev
# → http://localhost:5173
```

---

## 🐳 Docker

```bash
# Production (nginx + prebuilt images)
docker compose up

# Development (hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost |
| Backend API | http://localhost:5000 |

Images on Docker Hub:
[`dolevatik/soc-analyst-backend`](https://hub.docker.com/r/dolevatik/soc-analyst-backend) ·
[`dolevatik/soc-analyst-frontend`](https://hub.docker.com/r/dolevatik/soc-analyst-frontend)

---

## ⚙️ CI/CD

Every push to `main` runs the full pipeline automatically:

```
push to main
     ↓
GitHub Actions
├── Frontend — lint, build, security audit
├── Backend  — flake8, security audit
└── Docker   — build & push to Docker Hub
     ↓
Railway  — auto-deploys backend
Vercel   — auto-deploys frontend
```

No manual steps needed after merge.

---

## 🪟 Real Windows Mode

Instead of simulated logs, the backend can read your machine's actual **Windows Security Event Log** in real time and pipe the events through the same detectors. Useful for testing the system against genuine login attempts, lockouts, and privilege escalations happening on the local machine.

### Supported Event IDs

| Event ID | Meaning | Detector triggered |
|---|---|---|
| 4625 | Failed logon | Brute Force |
| 4624 | Successful logon | — |
| 4740 | Account lockout | Brute Force |
| 4648 | Logon with explicit credentials | — |
| 4672 | Special privileges assigned | Unauthorized Access |
| 4776 | NTLM credential validation | Brute Force |

### Requirements
- `pip install pywin32`
- Backend must run as **Administrator** (the Security log is restricted)

### How to start

```powershell
# Open an elevated PowerShell
Start-Process powershell -Verb RunAs

# In the new Admin window:
cd "C:\path\to\AI-SOC-Analyst\backend"
py app.py
```

Then switch the dashboard source mode to **Real Windows**.

### 🧪 Test examples

**Brute Force** — generate 5 failed logon events (Event ID 4625):
```powershell
for ($i = 0; $i -lt 5; $i++) {
    net use \\localhost\IPC$ /user:fakeuser wrongpass 2>$null
}
```

**Credential Stuffing** — same IP, many different usernames:
```powershell
"alice","bob","admin","root","john.doe" | ForEach-Object {
    net use \\localhost\IPC$ /user:$_ wrongpass 2>$null
}
```

**Verify events were logged** (run as Admin):
```powershell
Get-WinEvent -LogName Security -MaxEvents 20 |
  Where-Object { $_.Id -in @(4625, 4740) } |
  Select-Object TimeCreated, Id, Message |
  Format-List
```

Within seconds the dashboard should show the corresponding alerts.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Socket.io-client |
| Backend | Python, Flask, Flask-SocketIO, Flask-Limiter |
| AI | Anthropic Claude Opus 4.8 |
| Auth | Supabase (Google OAuth) |
| Database | SQLite (default) / PostgreSQL |
| Real-time | WebSockets via gevent |
| CI/CD | GitHub Actions → Docker Hub → Railway / Vercel |

---

Developed by **Dolev Atik** · MIT License

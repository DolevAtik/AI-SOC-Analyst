# 🛡️ AI SOC Analyst

An AI-powered Security Operations Center dashboard. Monitors server traffic in real time, detects attack patterns using a hybrid heuristic + AI engine, and provides an interactive threat investigation assistant powered by Claude.

![CI](https://github.com/DolevAtik/AI-SOC-Analyst/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.10+-cyan.svg)
![React](https://img.shields.io/badge/react-19-blue.svg)
![AI](https://img.shields.io/badge/AI-Claude_Opus_4.8-purple.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## Features

### Threat Detection (8 attack types)
| Attack | What it detects |
|---|---|
| Brute Force | Repeated failed logins from the same IP |
| SQL Injection | SQLi payloads in URLs and parameters |
| Unauthorized Access | Access attempts to sensitive paths (`/admin`, `/.env`, etc.) |
| Suspicious IP | Activity from IPs on the blocklist |
| XSS | Script injection payloads |
| Path Traversal | `../../../etc/passwd` and variants |
| Request Flood / DoS | Single IP sending abnormally high request volume |
| Credential Stuffing | Login attempts across many different usernames |

### Log Sources (3 modes)
- **Simulation** — Realistic synthetic logs with configurable attack ratio
- **Real Windows** — Live Windows Security Event Log (requires Admin)
- **Mixed** — Combine real and simulated logs simultaneously

### AI (Claude Opus 4.8)
- **Batch analysis** — Claude provides a security summary for every log batch
- **Manual log analysis** — Paste any log entry and get `threat_level`, `analysis`, and `fix_tip`
- **AI Chat** — Ask questions about active incidents in natural language

### Dashboard
- Real-time stats and incident feed via WebSocket
- Severity/type charts, attack map, and attack chain visualization
- Incident table with filters, sorting, and CSV/PDF export
- Attack ratio slider and source mode switcher
- IP blocklist management
- Scenario panel for simulating specific attack sequences

### Authentication
- Google OAuth sign-in via Supabase Auth
- JWT-based session management between frontend and backend

---

## Quick Start

### 1. Clone
```bash
git clone https://github.com/DolevAtik/AI-SOC-Analyst.git
cd AI-SOC-Analyst
```

### 2. Configure environment

**`backend/.env`**
```
ANTHROPIC_API_KEY=sk-ant-api03-...
FLASK_SECRET_KEY=any-random-string

# Optional: use PostgreSQL instead of SQLite
# DATABASE_URL=postgresql://user:password@host:5432/soc_analyst
```
Get your API key at [console.anthropic.com](https://console.anthropic.com).

**`frontend/.env`**
```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_API_URL=http://localhost:5000
```
Get these values from your [Supabase project dashboard](https://supabase.com/dashboard).

### 3. Backend
```bash
cd backend
pip install -r requirements.txt
py app.py
```
Runs at `http://localhost:5000`

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs at `http://localhost:5173`

---

## Docker

Docker images are published to Docker Hub — no local build required.

### Production (nginx + pre-built images)

```bash
docker compose up
```

| Service | URL |
|---|---|
| Frontend (nginx) | http://localhost |
| Backend API | http://localhost:5000 |

The nginx container proxies `/api` and `/socket.io` to the backend automatically.

### Development (hot-reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

| Service | URL |
|---|---|
| Frontend (Vite dev server) | http://localhost:5173 |
| Backend API | http://localhost:5000 |

Source files are mounted as volumes — changes to `backend/` and `frontend/src/` reload instantly.

### Data persistence

SQLite database is stored in a named Docker volume (`soc-db`) — incidents survive container restarts.
To reset: `docker volume rm ai_soc_analyst_soc-db`

---

## Real Windows Mode

Reads live Windows Security Event Log entries and runs them through the same detectors as simulation mode.

### Supported Event IDs
| Event ID | Meaning | Detector triggered |
|---|---|---|
| 4625 | Failed logon | Brute Force |
| 4624 | Successful logon | — |
| 4740 | Account lockout | Brute Force |
| 4648 | Logon with explicit credentials | — |
| 4672 | Special privileges assigned (admin) | Unauthorized Access |
| 4776 | NTLM credential validation | Brute Force |

### Requirements
- `pywin32` installed: `pip install pywin32`
- Backend must run as **Administrator** (Security log is restricted)

### Run as Administrator
```powershell
Start-Process powershell -Verb RunAs
# In the new Admin window:
cd "C:\path\to\AI-SOC-Analyst\backend"
py app.py
```

### Test Brute Force detection
```powershell
# Generates Event ID 4625 (Failed Logon) five times
for ($i = 0; $i -lt 5; $i++) {
    net use \\localhost\IPC$ /user:fakeuser wrongpass 2>$null
}
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Socket.io-client, CSS Glassmorphism |
| Backend | Python 3.10+, Flask, Flask-SocketIO, Flask-Limiter |
| AI | Anthropic Claude Opus 4.8 |
| Auth | Supabase Auth (Google OAuth) |
| Database | SQLite (default) / PostgreSQL (optional) |
| Real-time | WebSockets (gevent) |
| CI | GitHub Actions |

---

## Project Structure

```
AI-SOC-Analyst/
├── .github/
│   └── workflows/
│       └── ci.yml              # Lint + build checks on every push/PR
├── backend/
│   ├── app.py                  # Flask API + WebSocket server
│   ├── analyzer.py             # Threat detection engine + Claude AI
│   ├── log_generator.py        # Simulated log generator (8 attack types)
│   ├── windows_event_reader.py # Windows Security Event Log reader
│   ├── auth.py                 # JWT verification middleware
│   ├── db.py                   # SQLite / PostgreSQL layer
│   └── requirements.txt
└── frontend/
    └── src/
        ├── api.js              # Backend communication layer
        └── components/
            ├── Dashboard.jsx
            ├── LiveMonitor.jsx
            ├── IncidentTable.jsx
            ├── StatsCharts.jsx
            ├── AttackMap.jsx
            ├── AttackChain.jsx
            ├── ScenarioPanel.jsx
            ├── Reports.jsx
            ├── ManualLogInput.jsx
            ├── RealLogImporter.jsx
            ├── FloatingAgent.jsx  # AI chat assistant
            ├── ThreatChat.jsx
            ├── Settings.jsx
            └── Toast.jsx
```

---

## Security Notes

- Never commit `.env` files to version control
- `ANTHROPIC_API_KEY` must only live in `backend/.env` — never hardcoded
- Real Windows mode requires Admin privileges only for the backend process
- Supabase anon key is safe to expose client-side (row-level security enforces access)

---

## Credits

Developed by **Dolev Atik**

## License

MIT

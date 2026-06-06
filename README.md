# 🛡️ AI SOC Analyst

An AI-powered Security Operations Center dashboard. Monitors server traffic in real time, detects attack patterns using a hybrid heuristic + AI engine, and provides an interactive threat investigation assistant powered by Claude.

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
- Incident table with filters, sorting, and CSV export
- Attack ratio slider and source mode switcher
- IP blocklist management

---

## Quick Start

### 1. Clone
```bash
git clone https://github.com/DolevAtik/AI-SOC-Analyst.git
cd AI-SOC-Analyst
```

### 2. Configure environment
Create `backend/.env`:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
FLASK_SECRET_KEY=any-random-string
```
Get your API key at [console.anthropic.com](https://console.anthropic.com).

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

## Real Windows Mode — Reading Live Security Events

This mode reads actual Windows Security Event Log entries and feeds them through the same detectors as simulation mode.

### Supported Event IDs
| Event ID | Meaning | Detector triggered |
|---|---|---|
| 4625 | Failed logon | Brute Force |
| 4624 | Successful logon | — |
| 4740 | Account lockout | Brute Force |
| 4648 | Logon with explicit credentials | — |
| 4672 | Special privileges assigned (admin) | Unauthorized Access |
| 4776 | NTLM credential validation | Brute Force |

Windows Firewall DROP/BLOCK entries are also read if the firewall log is enabled.

### Requirements
- `pywin32` installed: `pip install pywin32`
- Backend must run as **Administrator** (Security log is restricted)

### How to run as Administrator
Open PowerShell and run:
```powershell
Start-Process powershell -Verb RunAs
```
In the new Admin window:
```powershell
cd "C:\path\to\AI-SOC-Analyst\backend"
py app.py
```

### How to test with real events

**Test Brute Force detection** — run this in a separate (non-Admin) terminal:
```powershell
# Generates 5x Event ID 4625 (Failed Logon)
net use \\localhost\IPC$ /user:fakeuser wrongpass 2>$null
net use \\localhost\IPC$ /user:fakeuser wrongpass 2>$null
net use \\localhost\IPC$ /user:fakeuser wrongpass 2>$null
net use \\localhost\IPC$ /user:fakeuser wrongpass 2>$null
net use \\localhost\IPC$ /user:fakeuser wrongpass 2>$null
```
Within seconds a **Brute Force** alert should appear in the dashboard.

**Test Credential Stuffing** — try multiple different usernames:
```powershell
net use \\localhost\IPC$ /user:alice wrongpass 2>$null
net use \\localhost\IPC$ /user:bob wrongpass 2>$null
net use \\localhost\IPC$ /user:admin wrongpass 2>$null
net use \\localhost\IPC$ /user:root wrongpass 2>$null
net use \\localhost\IPC$ /user:john.doe wrongpass 2>$null
```

**Verify events were logged** (run as Admin):
```powershell
Get-WinEvent -LogName Security -MaxEvents 10 |
  Where-Object { $_.Id -in @(4625, 4624, 4740) } |
  Select-Object TimeCreated, Id, Message |
  Format-List
```

### Enable Windows Firewall logging (optional)
To also capture firewall DROP events:
```powershell
# Run as Admin
netsh advfirewall set allprofiles logging droppedconnections enable
netsh advfirewall set allprofiles logging filename "%systemroot%\system32\LogFiles\Firewall\pfirewall.log"
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Socket.io-client, CSS Glassmorphism |
| Backend | Python 3.10+, Flask, Flask-SocketIO, Flask-Limiter |
| AI | Anthropic Claude Opus 4.8 |
| Database | SQLite |
| Real-time | WebSockets (gevent) |

---

## Project Structure

```
AI-SOC-Analyst/
├── backend/
│   ├── app.py                  # Flask API + WebSocket server
│   ├── analyzer.py             # Threat detection engine + Claude AI
│   ├── log_generator.py        # Simulated log generator (8 attack types)
│   ├── windows_event_reader.py # Windows Security Event Log reader
│   ├── db.py                   # SQLite layer
│   └── requirements.txt
└── frontend/
    └── src/
        └── components/
            ├── Dashboard.jsx
            ├── LiveMonitor.jsx
            ├── Reports.jsx
            └── Settings.jsx
```

---

## Security Notes

- Never commit `.env` to version control
- The `ANTHROPIC_API_KEY` must only be stored in `.env` — never hardcoded
- Real Windows mode requires Admin privileges only for the backend process

---

## Credits

Developed by **Dolev Atik**

## License

MIT

---

## Docker

Docker images are published to Docker Hub — no local build required.

### Prerequisites

Create `backend/.env` with your secrets (see `backend/.env.example`):
```
ANTHROPIC_API_KEY=sk-ant-api03-...
FLASK_SECRET_KEY=any-random-string
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
```

Create `frontend/.env` (see `frontend/.env.example`):
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### Production (nginx + pre-built images)

```bash
docker compose up
```

| Service | URL |
|---|---|
| Frontend (nginx) | http://localhost |
| Backend API | http://localhost:5000 |

The frontend nginx container proxies `/api` and `/socket.io` requests to the backend automatically — no manual port configuration needed.

### Development (hot-reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

| Service | URL |
|---|---|
| Frontend (Vite dev server) | http://localhost:5173 |
| Backend API | http://localhost:5000 |

Source files are mounted as volumes — changes to `backend/` and `frontend/src/` reload instantly without rebuilding.

### Pull images manually

```bash
docker pull dolevatik/soc-analyst-backend:latest
docker pull dolevatik/soc-analyst-frontend:latest
```

### Data persistence

SQLite database is stored in a named Docker volume (`soc-db`) — incidents survive container restarts.
To reset: `docker volume rm ai_soc_analyst_soc-db`

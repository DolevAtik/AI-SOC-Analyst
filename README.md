# 🛡️ AI SOC Analyst

An AI-powered Security Operations Center dashboard that generates simulated server logs, analyzes them for threats, and presents findings in a premium dark-themed React UI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![React](https://img.shields.io/badge/react-19-blue.svg)

## ✨ Features

- **🔐 Brute Force Detection** — Identifies repeated login failures from the same IP
- **💉 SQL Injection Detection** — Regex-based detection of injection payloads in requests
- **🚫 Unauthorized Access** — Flags access attempts to sensitive/admin paths
- **👁️ Suspicious IP Monitoring** — Cross-references against a built-in IP blocklist
- **📊 Risk Scoring** — Assigns Low / Medium / High / Critical severity levels
- **📈 Real-Time Dashboard** — Premium dark-theme UI with glassmorphism design
- **📋 Live Log Viewer** — Color-coded monospace log feed with auto-scroll
- **🧠 Analysis Panel** — Detailed threat cards with recommended actions

## 🏗️ Architecture

```
ai-soc-analyst/
├── backend/
│   ├── app.py              # Flask REST API
│   ├── analyzer.py          # Threat detection engine
│   ├── log_generator.py     # Simulated log generator
│   ├── db.py                # SQLite database layer
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root component with sidebar
│   │   ├── api.js           # Backend API client
│   │   ├── index.css        # Design system
│   │   └── components/
│   │       ├── Dashboard.jsx
│   │       ├── LogViewer.jsx
│   │       ├── IncidentTable.jsx
│   │       ├── AnalysisPanel.jsx
│   │       └── StatsCharts.jsx
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

1. **Install dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Run the server**:
   On Windows, use the Python launcher to ensure the correct version (3.13+) is used:
   ```bash
   py app.py
   ```
   *Note: If you encounter encoding issues in the terminal, ensure your terminal supports UTF-8 or use the `py` launcher as shown.*

The API will be available at `http://localhost:5000`.

### Frontend

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

The dashboard will be available at `http://localhost:5173`.

## 📡 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/logs/generate` | POST | Generate simulated server logs |
| `/api/logs/analyze` | POST | Analyze logs for security threats |
| `/api/logs/stream` | POST | Generate + analyze in one shot |
| `/api/incidents` | GET | List stored incidents (filterable) |
| `/api/stats` | GET | Dashboard aggregate statistics |
| `/api/incidents/clear` | POST | Clear all stored incidents |
| `/api/health` | GET | Health check |

## 🐳 Docker

```bash
docker-compose up --build
```

## 📄 License

MIT

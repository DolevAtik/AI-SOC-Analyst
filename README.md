# 🛡️ AI SOC Analyst Assistant

An advanced, AI-powered Security Operations Center (SOC) dashboard. This project monitors real-time server traffic, identifies malicious patterns using a hybrid heuristic-AI engine, and provides interactive threat investigation tools.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-cyan.svg)
![React](https://img.shields.io/badge/react-19-blue.svg)
![AI](https://img.shields.io/badge/AI-Gemini_2.5_Flash-purple.svg)

---

## 🚀 Overview

AI SOC Analyst transforms raw server logs into actionable security intelligence. It detects **Brute Force**, **SQL Injection**, and **Unauthorized Access** attempts while providing a specialized AI Assistant to help analysts understand and mitigate threats instantly.

### 🧩 The Four Pillars
1.  **🧪 Dashboard Simulation**: A sandbox to generate and visualize live log streams, perfect for testing detection rules and simulating attack scenarios.
2.  **📡 Live Monitor**: A high-performance real-time feed that samples live traffic and identifies active threats as they happen using WebSockets.
3.  **📄 Reports & Analytics**: An incident management hub with detailed history, manual reporting, and **CSV / Excel export** for forensic documentation.
4.  **⚙️ Settings**: Centralized control for detection thresholds, AI configuration, and IP blocklist management.

---

## 🛠️ Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/DolevAtik/AI-SOC-Analyst.git
cd AI-SOC-Analyst
```

### 2. Configure Environment
Create a `.env` file in the `backend/` directory:
```bash
GEMINI_API_KEY=your_api_key_here
```

### 3. Run with Docker (Recommended)
The fastest way to get the entire stack (Frontend + Backend) running:
```bash
docker-compose up --build
```
Access the Dashboard at: **`http://localhost:5173`**

---

## 💻 Manual Setup

If you prefer to run the components separately:

### Backend (Flask)
```bash
cd backend
pip install -r requirements.txt
python app.py
```
*Runs at `http://localhost:5000`*

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
*Runs at `http://localhost:5173`*

---

## ⚙️ Tech Stack

*   **Frontend**: React 19, Vite, Socket.io-client, Vanilla CSS (Glassmorphism).
*   **Backend**: Python, Flask, Flask-SocketIO, Eventlet.
*   **AI Engine**: Google Gemini 2.5 Flash API.
*   **Database**: SQLite (Local persistent storage).
*   **Infrastructure**: Docker, Docker Compose.

---

## 👨‍💻 Credits
Developed by **Dolev Atik**.

## 📄 License
MIT License

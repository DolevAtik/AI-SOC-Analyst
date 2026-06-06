# 🖼️ AI SOC Analyst — Frontend

This is the React-based dashboard for the AI SOC Analyst. It features a premium dark-themed UI with real-time log viewing and threat analysis panels.

## 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Verify Connection**:
   The frontend is configured to proxy API requests to `http://localhost:5000`. Ensure the **Backend API** is running before using the dashboard.

## 🛠️ Tech Stack

- **React 19**
- **Vite** (Build Tool)
- **Vanilla CSS** (Custom Design System)
- **Lucide React** (Icons)
- **Recharts** (Data Visualization)

## 📁 Structure

- `src/components/` — UI components (Dashboard, LogViewer, etc.)
- `src/api.js` — Backend communication layer
- `src/index.css` — Global styles and design tokens

---

## הרצה דרך Docker

ניתן למשוך את תמונת ה-frontend מה-Docker Hub ולהריץ יחד עם ה-backend:

```bash
docker pull dolevatik/soc-analyst-frontend:latest
docker pull dolevatik/soc-analyst-backend:latest
docker compose up
```

ה-frontend יהיה זמין לאחר מכן בכתובת הנחושה על ידי `docker compose` (בדרך כלל `http://localhost:5173`).


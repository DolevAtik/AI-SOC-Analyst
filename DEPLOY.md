# מדריך Deploy — AI SOC Analyst

> **תאריך עדכון:** יוני 2026  
> **סביבת יעד:** Railway (Backend + DB) + Vercel (Frontend)  
> **עלות משוערת:** 5–10$ לחודש

---

## לפני הכל — אזהרת אבטחה חשובה

קובץ `backend/.env` מכיל מפתחות אמיתיים.  
**וודא שהוא מוגן לפני כל Push:**

```bash
# בדוק שהשורות האלה קיימות ב-.gitignore (בתיקיית השורש)
echo ".env" >> .gitignore
echo "backend/.env" >> .gitignore
git rm --cached backend/.env   # מסיר מה-tracking אם כבר נוסף בעבר
```

---

## תרשים ארכיטקטורה

```
משתמש (Browser)
       │
       ▼
  [Vercel] ← React + Vite (Frontend)
       │  REST API + WebSocket
       ▼
  [Railway] ← Flask + SocketIO (Backend)
       │  DATABASE_URL
       ▼
  [Railway PostgreSQL] ← DB
```

---

## שלב 0 — הכנות מקדמיות

### 0.1 חשבונות שצריך לפתוח (חינמיים)

| שירות | כתובת | שימוש |
|-------|--------|--------|
| Railway | railway.app | Backend + PostgreSQL |
| Vercel | vercel.com | Frontend |
| Clerk | clerk.com | אימות משתמשים (כבר מוגדר) |
| GitHub | github.com | Source code |

### 0.2 Push את הקוד ל-GitHub

```bash
# אם עוד לא עשית git init:
git init
git add .
git commit -m "Initial deployment setup"

# צור repo חדש ב-GitHub (דרך האתר) ואז:
git remote add origin https://github.com/<YOUR_USERNAME>/ai-soc-analyst.git
git push -u origin main
```

> **חשוב:** וודא ש-`backend/.env` **לא** מופיע ב-`git status` לפני ה-Push.

---

## שלב 1 — הגדרת Clerk (אימות משתמשים)

הפרויקט **כבר** מכיל את כל הקוד ל-Clerk. צריך רק להגדיר את המפתחות.

### 1.1 כניסה ל-Clerk Dashboard

1. היכנס ל-[clerk.com](https://clerk.com) → **Dashboard**
2. בחר את האפליקציה שלך (או צור חדשה: **"Create Application"**)
3. בחר שם (למשל: `AI SOC Analyst`) ובחר שיטות כניסה: Email + Google

### 1.2 שמור את המפתחות הבאים

לך ל-**API Keys** בצד שמאל:

```
Publishable Key:  pk_live_XXXXXXXXXX    ← לפרונטאנד
Secret Key:       sk_live_XXXXXXXXXX    ← לבקאנד (לא בשימוש כרגע)
JWKS URL:         https://<your-domain>.clerk.accounts.dev/.well-known/jwks.json
```

ה-`CLERK_JWKS_URL` כבר מוגדר ב-`.env` — **עדכן אותו** אם יצרת אפליקציה חדשה.

### 1.3 הגדר Allowed Origins ב-Clerk

לך ל-**Domains** (או **JWT Templates**):
- הוסף את כתובת ה-Vercel שלך לאחר השלמת ה-Deploy (תחזור לכאן בשלב 4)

---

## שלב 2 — Deploy Backend ל-Railway

### 2.1 צור פרויקט חדש ב-Railway

1. היכנס ל-[railway.app](https://railway.app) → **New Project**
2. בחר **"Deploy from GitHub repo"**
3. חבר את חשבון GitHub שלך ובחר את הריפו

### 2.2 הגדר את ה-Root Directory

Railway יזהה את הפרויקט כ-Monorepo.  
לך ל-**Settings** של ה-Service → **Source** → הגדר:
```
Root Directory: backend
```

### 2.3 הוסף Dockerfile לבקאנד

צור קובץ `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "--worker-class", "geventwebsocket.gunicorn.workers.GeventWebSocketWorker", \
     "--workers", "1", "--bind", "0.0.0.0:5000", "app:app"]
```

### 2.4 הוסף PostgreSQL ל-Railway

1. בפרויקט Railway לחץ **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway יצור אוטומטית משתנה סביבה בשם `DATABASE_URL` — זה בדיוק מה שה-`db.py` מחכה לו

### 2.5 הגדר Environment Variables ב-Railway

לך ל-Service שלך → **Variables** → הוסף:

```
ANTHROPIC_API_KEY    = sk-ant-api03-...   (מה-.env שלך)
FLASK_SECRET_KEY     = a3f8e2d1...        (מה-.env שלך)
CLERK_JWKS_URL       = https://...clerk.accounts.dev/.well-known/jwks.json
CORS_ORIGINS         = https://<your-vercel-url>.vercel.app
```

> **DATABASE_URL** — Railway מזריק אותו אוטומטית, לא צריך להוסיף ידנית.

### 2.6 Deploy

Railway יבצע Deploy אוטומטי עם כל Push ל-main.  
לחץ **"Deploy"** ידנית אם צריך.

בדוק שה-Backend עולה בלוגים, ואז גש ל:
```
https://<your-railway-url>/api/health
```
אמור להחזיר:
```json
{"status": "healthy", ...}
```

---

## שלב 3 — Deploy Frontend ל-Vercel

### 3.1 עדכן את ה-API URL בפרונטאנד

ב-`frontend/src/api.js` (או `vite.config.js`) — הכתובת של הבקאנד מגיעה מ-env var.  
צור קובץ `frontend/.env.production`:

```env
VITE_API_URL=https://<your-railway-url>.railway.app
VITE_CLERK_PUBLISHABLE_KEY=pk_live_XXXXXXXXXX
```

> **חשוב:** קובץ `.env.production` עם מפתחות **אמיתיים** — הוסף גם אותו ל-`.gitignore` אם הוא מכיל סודות. `VITE_` variables נצרבים ב-build ולא נשמרים בשרת.

### 3.2 עדכן את `api.js` לתמוך ב-env var

פתח את `frontend/src/api.js` ובדוק שה-BASE_URL נקרא מ-`import.meta.env.VITE_API_URL`:

```js
const BASE_URL = import.meta.env.VITE_API_URL || '';
```

### 3.3 צור Vercel Project

1. היכנס ל-[vercel.com](https://vercel.com) → **New Project**
2. ייבא את הריפו מ-GitHub
3. הגדר:
   ```
   Framework Preset:  Vite
   Root Directory:    frontend
   Build Command:     npm run build
   Output Directory:  dist
   ```

### 3.4 הגדר Environment Variables ב-Vercel

לך ל-**Project Settings** → **Environment Variables**:

```
VITE_API_URL                  = https://<your-railway-url>.railway.app
VITE_CLERK_PUBLISHABLE_KEY    = pk_live_XXXXXXXXXX
```

### 3.5 Deploy

לחץ **"Deploy"** — Vercel יבנה ויעלה את ה-Frontend.  
תקבל URL בפורמט: `https://ai-soc-analyst.vercel.app`

---

## שלב 4 — חיבור הכל יחד

### 4.1 עדכן CORS ב-Railway

חזור ל-Railway → **Variables** → עדכן:
```
CORS_ORIGINS = https://ai-soc-analyst.vercel.app
```

לאחר מכן **Redeploy** את ה-Backend.

### 4.2 עדכן Allowed Origins ב-Clerk

1. חזור ל-Clerk Dashboard → **Domains**
2. הוסף: `https://ai-soc-analyst.vercel.app`

### 4.3 בדיקת קצה לקצה

פתח את כתובת Vercel בדפדפן:
1. ✅ מסך הכניסה של Clerk מוצג
2. ✅ לאחר התחברות — הדאשבורד נטען
3. ✅ WebSocket מתחבר (בכרטיסיה Live Monitor)
4. ✅ ניתוח לוגים עובד

---

## שלב 5 — הגדרת Domain מותאם אישית (אופציונלי)

### Vercel (Frontend)
1. קנה domain (Namecheap, Cloudflare וכו')
2. ב-Vercel → **Domains** → **Add Domain** → הוסף את הדומיין
3. עקוב אחרי הוראות ה-DNS שמציג Vercel (CNAME record)

### Railway (Backend)
1. Railway → **Settings** → **Networking** → **Custom Domain**
2. הוסף subdomian, לדוגמה: `api.your-domain.com`
3. עדכן את `VITE_API_URL` ב-Vercel ל-`https://api.your-domain.com`

---

## מגבלות ידועות בענן

| פיצ'ר | בענן | מקומי |
|--------|------|--------|
| מצב Simulation | ✅ עובד | ✅ עובד |
| Real Windows Events | ❌ לא זמין (שרת Linux) | ✅ עובד |
| מצב Mixed | ❌ חלקי | ✅ עובד |
| ייבוא לוגי Apache/Nginx | ✅ עובד | ✅ עובד |

> **Real Windows Events** — הפיצ'ר דורש גישה ל-Windows Event Log שאינה קיימת בשרתי ענן. הוא נשאר זמין למי שמריץ את הפרויקט מקומית.

---

## פתרון בעיות נפוצות

### Backend לא עולה ב-Railway

```bash
# בדוק שה-Dockerfile נמצא ב-backend/
# בדוק שכל ה-requirements מותקנים (psycopg2-binary מוצגת כשגיאה נפוצה)
```

**בעיה:** `psycopg2` נכשל בהתקנה  
**פתרון:** ודא ש-`requirements.txt` מכיל `psycopg2-binary` (לא `psycopg2`)

---

### WebSocket לא מתחבר

**סיבה שכיחה:** CORS_ORIGINS לא מוגדר נכון  
**פתרון:** ודא שהערך ב-Railway הוא בדיוק ה-URL של Vercel **ללא** `/` בסוף

---

### `401 Unauthorized` על כל הבקשות

**סיבה:** `CLERK_JWKS_URL` שגוי או לא מוגדר  
**פתרון:** העתק מ-Clerk Dashboard את ה-JWKS URL ועדכן ב-Railway

---

### הפרונטאנד מתחבר ל-localhost

**סיבה:** `VITE_API_URL` לא הוגדר ב-Vercel  
**פתרון:** הוסף את המשתנה ב-Vercel → Settings → Environment Variables → **Redeploy**

---

## סיכום Environment Variables

### Railway (Backend)
| משתנה | מקור |
|--------|-------|
| `ANTHROPIC_API_KEY` | Anthropic Console |
| `FLASK_SECRET_KEY` | ערך רנדומלי (מה-.env) |
| `CLERK_JWKS_URL` | Clerk Dashboard → API Keys |
| `CORS_ORIGINS` | כתובת Vercel שלך |
| `DATABASE_URL` | Railway מזריק אוטומטית |

### Vercel (Frontend)
| משתנה | מקור |
|--------|-------|
| `VITE_API_URL` | כתובת Railway שלך |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |

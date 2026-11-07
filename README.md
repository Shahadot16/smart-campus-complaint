<div align="center">

<img src="frontend/public/brand/iubat-logo.png" alt="IUBAT" height="88" />

# IUBAT Smart Campus

### Complaint &amp; Maintenance Platform for the Engineering Faculty

Students report campus problems, maintenance staff fix them, department heads approve costs,
and administrators see everything — **live**, with deadlines, QR codes, analytics and smart (AI) assistance.

<br />

![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-8-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-realtime-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)

<br />

### [🔗 **Live demo** → iubat-smart-campus.onrender.com](https://iubat-smart-campus.onrender.com)

_Sign in with a [demo account](#-demo-accounts) · free host, so the first load may take ~50s to wake up._

<br />

[**Quick start**](#-quick-start) · [**Features**](#-what-it-can-do) · [**Architecture**](#-how-it-is-built) · [**Deploy**](#-deployment) · [**Tests**](#-tests)

</div>

---

> **TL;DR** — A full **MERN** (MongoDB · Express · React · Node.js) system built for the engineering
> faculty of the **International University of Business Agriculture and Technology (IUBAT)**.
> No database install needed to run it locally — an embedded MongoDB starts on its own.

---

## 🖼️ Screenshots

> _Add your screenshots here so the repo looks great. Drop images in `docs/` and link them below._

| Login | Student dashboard | Admin analytics |
|:---:|:---:|:---:|
| _login.png_ | _dashboard.png_ | _analytics.png_ |

---

## ⚡ Quick start

**Requirements:** Node.js 18+ (24 recommended). **No MongoDB install** — an embedded database runs by itself.

```bash
# 1) Backend (API + database) — first terminal
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm start                   # http://localhost:5000/api

# 2) Frontend (React) — second terminal
cd frontend
npm install
npm run dev                 # http://localhost:5173  ← open this in the browser
```

On first run, demo data (IUBAT buildings, rooms, users and complaints) is created automatically.
To wipe everything and start fresh: `cd backend && npm run seed -- --reset`

### 🔑 Demo accounts

| Role | Email | Password |
|---|---|---|
| 👩‍🎓 Student | `student@iubat.edu` | `Student@123` |
| 🔧 Maintenance Staff | `staff@iubat.edu` | `Staff@123` |
| 🧑‍💼 Department Head (CSE) | `cse.head@iubat.edu` | `Head@123` |
| 🛡️ Administrator | `admin@iubat.edu` | `Admin@123` |

> On the login page, pick a role card then click **“Fill demo account”**.

### 🐳 Run with Docker (optional)

```bash
docker compose up --build       # app + MongoDB replica set → http://localhost:5000
```

---

## ✨ What it can do

### Everyone
- 🔐 **Role-based login** (Student / Staff / Department Head / Administrator) with IUBAT branding
- ⚡ **Live updates** over WebSockets — notifications, status changes and chat appear instantly
- 💬 **Chat** inside every complaint between the student, assigned staff and admins
- 🤖 **Campus assistant** chatbot: *“status of CMP-2026-0001”*, *“my complaints”*, *“how long do fixes take?”*
- 🌐 **Bangla / English** switch · installable as an app (**PWA**)
- 🛡️ **Security:** short-lived access tokens + rotating refresh tokens, account lock after 5 wrong
  passwords, email verification, password reset, **two-step verification** (authenticator app),
  signed-in device list with remote sign-out

### 👩‍🎓 Students
- 📸 Report an issue with photos — choose **building → floor → room** or **scan the QR sticker**
  in the room and the form fills itself
- 🧠 **Smart suggestions** — category &amp; priority from the text; warns about similar open complaints
- 📢 **Public issue board** with **“Me too”** votes — 5 votes auto-raise the priority
- 🕶️ **Anonymous reporting** for sensitive issues · private complaints
- 🔎 Track by tracking ID, rate the fix, ask to reopen · drafts saved automatically

### 🔧 Maintenance staff
- 📋 Task list sorted by priority with **SLA countdowns**
- 🧰 Record **spare parts used** (stock deducted, cost added to the complaint)
- 🧾 Raise **costed work orders** for approval

### 🧑‍💼 Department heads
- 📊 Dashboard and complaint list for their **own department only**
- ✅ **Approve or reject work orders** above the department limit

### 🛡️ Administrators
- 🎯 Review, assign with **smart staff ranking** (skills, building, workload, rating, SLA record, leave), reprioritise, reject
- ⏱️ **SLA policies** per priority · 4-step **automatic escalation** · background-job panel · daily summary email
- 📍 **Campus locations** tree with printable **QR stickers** · **campus map** of open problems
- 📦 **Assets** register with repair history &amp; “consider replacing” alerts · **spare-parts inventory**
- 📈 **Analytics** — trends, category chart, weekday × hour heatmap, feedback sentiment, staff leaderboard, AI weekly briefing, **Excel export**
- 👥 Users, categories (auto-assignment), roles &amp; permissions matrix, approval limits, **audit log**

---

## 🧱 How it is built

```
smart-campus-complaint/
├── backend/                 Express 5 REST API + Socket.IO
│   ├── config/              env, database, university profile (IUBAT)
│   ├── models/              Mongoose schemas (22 collections)
│   ├── controllers/         request handlers, one file per area
│   ├── routes/              URL → controller, with validation and permission checks
│   ├── middleware/          auth (JWT + sessions), uploads, validation, errors
│   ├── utils/               business logic: workflow, SLA, assignment, AI, notifications…
│   ├── jobs/                background jobs (SLA escalation, daily digest) with a MongoDB lock
│   ├── sockets/             real-time events
│   └── tests/               node:test + supertest
├── frontend/                React 19 + Vite + Tailwind CSS 4
│   └── src/
│       ├── pages/           one folder per role (student, staff, dept, admin, shared, auth)
│       ├── components/      reusable UI (complaint table, chat, SLA badge, QR, charts…)
│       ├── context/         auth, live socket connection, language
│       ├── services/api.js  every API call in one place (auto token refresh)
│       └── locales/bn.js    Bangla translations
├── Dockerfile, docker-compose.yml
└── .github/workflows/ci.yml  tests + build on every push
```

### Key ideas worth explaining in a viva

| Topic | Where |
|---|---|
| Complaint status workflow (state machine) | `backend/utils/workflow.js` |
| Transactions so a complaint and its history never disagree | `backend/utils/complaintService.js` |
| Permission-based access control (RBAC) | `backend/utils/permissions.js` |
| Refresh-token rotation &amp; theft detection | `backend/controllers/authController.js` |
| SLA deadlines and escalation ladder | `backend/utils/sla.js`, `backend/jobs/slaJob.js` |
| Job scheduler without Redis (MongoDB lock) | `backend/jobs/scheduler.js` |
| Smart staff ranking | `backend/utils/assignment.js` |
| Work-order approval chain | `backend/controllers/workOrderController.js` |
| Atomic stock deduction | `backend/controllers/inventoryController.js` |
| AI: rules offline, Claude when a key is set | `backend/utils/ai.js` |
| Real-time rooms (user / role / complaint) | `backend/sockets/index.js`, `frontend/src/context/SocketContext.jsx` |

---

## 🚀 Deployment

The production image **builds the React app and serves it from the Express API in one container**
(see `Dockerfile`), so you only need to host **one web service + one MongoDB**.

### Option A — Render + MongoDB Atlas (free, recommended)

1. **Database:** create a free **MongoDB Atlas** M0 cluster → *Database Access* add a user →
   *Network Access* allow `0.0.0.0/0` → copy the connection string
   (`mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/smart_campus_complaint_db`).
   _Atlas M0 is a replica set, so MongoDB transactions work._
2. **App:** on [Render](https://render.com) → **New → Blueprint**, point it at this repo.
   The included [`render.yaml`](render.yaml) creates a Docker web service and generates `JWT_SECRET` for you.
3. Set these environment variables in the Render dashboard:

   | Variable | Value |
   |---|---|
   | `MONGO_URI` | your Atlas connection string |
   | `CLIENT_ORIGIN` | your Render URL, e.g. `https://iubat-smart-campus.onrender.com` |
   | `APP_URL` | the same Render URL |
   | `SEED_DEMO` | `true` (loads demo data on first boot — set to `false` afterwards) |

4. Deploy. Open the Render URL and sign in with a demo account above. 🎉

### Option B — Docker anywhere

```bash
JWT_SECRET="$(openssl rand -hex 48)" docker compose up --build   # → http://localhost:5000
```

Point it at any MongoDB **replica set** (needed for transactions) via `MONGO_URI`.

---

## 🧪 Tests

```bash
cd backend && npm test          # 82 API tests on a throw-away in-memory database
cd frontend && npm run lint && npm run build
```

Every push also runs tests + build in CI — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## ⚙️ Optional settings (`backend/.env`)

| Setting | What it does |
|---|---|
| `MONGO_URI` | `memory` (default, no install) or a real MongoDB / Atlas connection string |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Send real emails (e.g. Gmail App Password). Without them, emails print to the server console and links show on screen in development |
| `ANTHROPIC_API_KEY` | Use Claude for suggestions, the chatbot and the weekly briefing. Without it, built-in rules are used |
| `JWT_SECRET` | Must be a long random value in production |
| `SEED_DEMO=true` | Put demo data into an empty real database |

---

## 📝 Notes

- Building names, rooms and map positions are **sample data** around the IUBAT campus centre
  (Uttara Sector-10); edit them under **Locations &amp; QR**. Departments come from iubat.edu
  (CSE, EEE, Civil, Mechanical).
- The IUBAT logo belongs to IUBAT and is used here for an internal academic project.

<div align="center">

<br />

**Built with the MERN stack** · Made for IUBAT Engineering Faculty

</div>

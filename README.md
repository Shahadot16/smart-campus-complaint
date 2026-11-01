# IUBAT Smart Campus — Complaint & Maintenance Platform

A full MERN-stack (MongoDB, Express, React, Node.js) system for the engineering faculty of the
**International University of Business Agriculture and Technology (IUBAT)**. Students report
campus problems, maintenance staff fix them, department heads approve costs, and administrators
see everything — live, with deadlines, QR codes, analytics and smart (AI) assistance.

---

## কীভাবে চালাবেন (Quick start)

**লাগবে:** Node.js 18+ (24 recommended). MongoDB install করার দরকার নেই — একটি embedded database নিজে থেকেই চলে।

```bash
# 1) Backend (API + database) — প্রথম টার্মিনাল
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm start                   # http://localhost:5000/api

# 2) Frontend (React) — দ্বিতীয় টার্মিনাল
cd frontend
npm install
npm run dev                 # http://localhost:5173  ← ব্রাউজারে এটা খুলুন
```

প্রথমবার চালালে demo data (IUBAT-এর building, room, user, complaint) নিজে থেকে তৈরি হয়।
সব data মুছে নতুন করে শুরু করতে: `cd backend && npm run seed -- --reset`

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Student | `student@iubat.edu` | `Student@123` |
| Student 2 | `student2@iubat.edu` | `Student@123` |
| Maintenance Staff | `staff@iubat.edu` | `Staff@123` |
| Maintenance Staff 2 | `staff2@iubat.edu` | `Staff@123` |
| Department Head (CSE) | `cse.head@iubat.edu` | `Head@123` |
| Department Head (EEE) | `eee.head@iubat.edu` | `Head@123` |
| Administrator | `admin@iubat.edu` | `Admin@123` |

On the login page pick the role card, then **“Fill demo account”**.

### Run the tests

```bash
cd backend && npm test          # 82 API tests on a throw-away in-memory database
cd frontend && npm run lint && npm run build
```

### Run with Docker (optional)

```bash
docker compose up --build       # app + MongoDB replica set → http://localhost:5000
```

---

## What it can do

### Everyone
- **Role-based login** (Student / Staff / Department Head / Administrator) with IUBAT branding
- **Live updates** over WebSockets: notifications, status changes and chat appear instantly
- **Chat** inside every complaint between the student, assigned staff and admins
- **Campus assistant** chatbot (bottom-right): “status of CMP-2026-0001”, “my complaints”, “how long do fixes take?”
- **Bangla / English** switch, installable as an app (PWA)
- **Security:** short-lived access tokens + rotating refresh tokens, account lock after 5 wrong
  passwords, email verification, password reset, two-step verification (authenticator app),
  list of signed-in devices with remote sign-out

### Students
- Report an issue with photos; choose **building → floor → room** or **scan the QR sticker** in the room
  or on the equipment and the form fills itself
- **Smart suggestions**: category and priority suggested from the text; warns about similar open
  complaints (“has someone already reported this?”)
- **Public issue board** with **“Me too”** votes — 5 votes raise the priority automatically
- **Anonymous reporting** for sensitive issues; private complaints
- Track by tracking ID, rate the fix, ask to reopen; drafts are saved automatically

### Maintenance staff
- Task list sorted by priority with **SLA countdowns**
- Record **spare parts used** (stock is deducted, cost is added to the complaint)
- Raise **costed work orders** for approval

### Department heads
- Dashboard and complaint list for their own department only
- **Approve or reject work orders** above the department limit

### Administrators
- Review, assign (with **smart staff ranking**: skills, building, workload, rating, SLA record, leave),
  reprioritise, reject
- **SLA policies** per priority, 4-step **automatic escalation** (warning → breach → priority raise →
  final), background job panel, daily summary email
- **Campus locations** tree with printable **QR stickers**; **campus map** of open problems
- **Assets** register with repair history and “consider replacing” alerts; **spare-parts inventory**
- **Analytics**: trends, category chart, weekday × hour heatmap, feedback sentiment, staff
  leaderboard, AI weekly briefing, **Excel export**
- Users, categories (with auto-assignment), roles & permissions matrix, approval limits, **audit log**

---

## How it is built

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

**Key ideas worth explaining in a viva**

| Topic | Where |
|---|---|
| Complaint status workflow (state machine) | `backend/utils/workflow.js` |
| Transactions so a complaint and its history never disagree | `backend/utils/complaintService.js` |
| Permission-based access control (RBAC) | `backend/utils/permissions.js` |
| Refresh-token rotation & theft detection | `backend/controllers/authController.js` |
| SLA deadlines and escalation ladder | `backend/utils/sla.js`, `backend/jobs/slaJob.js` |
| Job scheduler without Redis (MongoDB lock) | `backend/jobs/scheduler.js` |
| Smart staff ranking | `backend/utils/assignment.js` |
| Work-order approval chain | `backend/controllers/workOrderController.js` |
| Atomic stock deduction | `backend/controllers/inventoryController.js` |
| AI: rules offline, Claude when a key is set | `backend/utils/ai.js` |
| Real-time rooms (user / role / complaint) | `backend/sockets/index.js`, `frontend/src/context/SocketContext.jsx` |

---

## Optional settings (`backend/.env`)

| Setting | What it does |
|---|---|
| `MONGO_URI` | `memory` (default, no install) or a real MongoDB / Atlas connection string |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Send real emails (e.g. Gmail with an App Password). Without them, emails are printed in the server console and links are shown on screen in development |
| `ANTHROPIC_API_KEY` | Use Claude for suggestions, the chatbot and the weekly briefing. Without it, built-in rules are used |
| `JWT_SECRET` | Must be a long random value in production |
| `SEED_DEMO=true` | Put demo data into an empty real database |

---

## Notes

- Building names, rooms and map positions are **sample data** around the IUBAT campus centre
  (Uttara Sector-10); edit them under **Locations & QR**. Departments come from iubat.edu
  (CSE, EEE, Civil, Mechanical).
- The IUBAT logo belongs to IUBAT and is used here for an internal academic project.

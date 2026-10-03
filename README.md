# TutWithUs — Sales & Trial Operations Dashboard

A full-stack replacement for the `TutWithUs_Master_Pipeline_Google_Sheets` workbook.
Every tab of the sheet became a live screen, and every formula became a server-side
computation so the numbers can never drift from the data.

**Stack:** React 18 + Vite + Tailwind (flexbox layouts, mobile-first) · Node.js + Express · MongoDB + Mongoose · JWT auth.

---

## Quick start

```bash
cd /Users/es/Tutwithus-dashboard

# 1. install both apps
npm run install:all

# 2. make sure MongoDB is running (any local instance is fine)
#    the connection string lives in backend/.env

# 3. seed the admin account (+ the three Lead Owner accounts)
npm run seed
#    …or seed with a realistic demo pipeline to explore the UI:
npm run seed:demo

# 4. run the API and the web app together
npm run dev
```

| Service  | URL                             |
| -------- | ------------------------------- |
| Web app  | http://localhost:5173           |
| API      | http://localhost:5055/api       |
| Health   | http://localhost:5055/api/health |

**Seeded login:** `admin@tutwithus.com` / `TutWithUs2026!` (change it in `backend/.env` before seeding, or from the Profile page after).
The seed also creates `thiago@`, `silvana@` and `gabriel@tutwithus.com` with the same password, matching the sheet's Lead Owner list.

> The API runs on **5055** because port 5050 is already used by another app on this machine.
> Change `PORT` in `backend/.env` and the `proxy` target in `frontend/vite.config.js` if you want a different one.

---

## How the sheet maps to the app

| Workbook tab | Screen | Route | Backing model |
| --- | --- | --- | --- |
| Dashboard | Sales & Trial Operations Dashboard | `/` | aggregations (nothing stored) |
| Master Pipeline | Master Pipeline | `/pipeline`, `/pipeline/:id` | `Lead` |
| Trial Sessions | Trial Session Operations | `/trials` | `Trial` |
| Follow-ups | Follow-up Action Board | `/followups` | `Followup` |
| Active Students | Active Students & Retention | `/students` | `Student` |
| Weekly Investor Report | Weekly Investor Pipeline Report | `/report` | `WeeklyReport` (commentary only) |
| Instructions & Lists | Pipeline Controls & Instructions | `/instructions` | `config/constants.js` |

Two sheet columns were **formulas**, so they are virtuals — computed on read, never stored:

- `Days Since Contact` → `Lead.daysSinceContact`
- `Follow-up Status` → `Lead.followUpStatus` (`Missing Date` / `Overdue` / `Due Today` / `Due Soon` / `Scheduled`) —
  this is the column that shows "Missing Date" on every row of the empty workbook.

---

## The 7 daily operating rules, enforced in code

The rules from the Instructions tab are not documentation here — the API enforces them:

1. **Inquiry logged same day** — `dateReceived` defaults to now; the dashboard surfaces the day's new leads.
2. **Every open lead has an owner, next action and follow-up date** — leads with no date are flagged `Missing Date`
   and counted in *Management Attention → Leads without a follow-up date*. Creating a follow-up action pushes its
   due date onto the lead automatically.
3. **Trials logged when booked, updated after delivery** — creating a trial moves the lead to *Trial Scheduled*;
   completing one moves it to *Trial Completed* and sets conversion to *Pending Decision*.
4. **Feedback + commercial follow-up within 24h** — the trial *Review* action saves feedback and creates the
   follow-up action due the next day in a single step. Overdue reviews surface via `feedbackOverdue`.
5. **Converted students move to Active Students only after payment** — `POST /leads/:id/convert` returns **400**
   unless payment is `Paid` or `Partially Paid`.
6. **Lost opportunities require a Loss Reason** — a schema-level guard returns a **400** field error otherwise.
7. **Investor reporting generated from the live pipeline** — the weekly snapshot is recomputed on every read;
   only the five commentary boxes are stored.

---

## Feature summary

**Dashboard** — the 8 Live Pipeline KPIs, Pipeline by Stage (count + value bars), the 7 Management Attention
counters (each one a link into a pre-filtered list), today's calls and today's trials, leads-by-source,
open-work-by-owner, loss-reason breakdown, period comparison (7/30/90 days) and a live activity feed.

**Master Pipeline** — all 22 sheet columns, search, 7 quick views (Open, Due today, Overdue, Missing date,
Trials today, Payment pending), 7 dropdown filters, bulk stage moves, CSV export, and a detail page per lead
with its trials, actions, audit trail, one-tap call/WhatsApp, stage mover and convert flow.

**Trial Sessions** — scheduling, delivery, quality review (tutor/client feedback, strong points, areas to improve,
1–5 rating), outcome, and the post-trial review modal that opens the commercial follow-up.

**Follow-up Action Board** — due/overdue views, per-owner filtering, *Log attempt* (increments attempts, records
the result, reschedules) and *Complete* (which rolls the lead's next follow-up to the next open action).

**Active Students** — package usage bars, log a delivered session, renew a package (resets usage, adds revenue),
renewal and payment views, churn handling that reflects back onto the lead.

**Weekly Investor Report** — live Friday snapshot, week-by-week navigation, the five commentary fields,
Draft/Sent status and a plain-text export ready to paste into an email.

**Instructions & Lists** — the operating rules, every dropdown list, tutors/subjects actually in use, audit trail.

**Cross-cutting** — JWT auth with 5 roles (`admin`, `manager`, `agent`, `tutor`, `viewer`), rate limiting,
helmet, zod validation, an audit log on every mutation, human-readable IDs (`LEAD-0001`, `TRL-0001`,
`FU-0001`, `STU-0001`), CSV exports on all four data screens, and URL-encoded list state so any filtered
view can be bookmarked or shared.

---

## Mobile

Mobile-first throughout, using flexbox for layout:

- **Navigation** — a 5-item bottom tab bar plus a slide-in drawer for the rest; a fixed sidebar from `lg` up.
- **Tables → cards** — `DataView` renders one column definition two ways: the wide banded table on desktop,
  stacked cards with title/subtitle/badges/meta-grid below `lg`. No horizontal scrolling on a phone.
- **Modals → sheets** — dialogs slide up from the bottom, fill the screen and scroll internally.
- **Touch targets** — full-width action buttons on cards, `tel:` and `wa.me` links wired to the phone dialer.
- **Safe areas** — `env(safe-area-inset-*)` on the tab bar, top bar and modal footers for notched iPhones.
- **No iOS zoom** — inputs render at 16px below `sm`.

---

## Project layout

```
backend/
  src/
    config/       constants.js (every dropdown + the 7 rules), db.js
    models/       User, Lead, Trial, Followup, Student, WeeklyReport, ActivityLog
    controllers/  auth, lead, trial, followup, student, dashboard, report, list, activity
    routes/       one router per resource, mounted in routes/index.js
    middleware/   auth (protect/restrict), validate (zod), error
    utils/        dates, sequence (atomic IDs), query (filter/sort/paginate), csv, ApiError
    seed/         seed.js  (--demo for sample data, --wipe to clear)
frontend/
  src/
    api/          axios client + typed endpoint helpers
    components/   Layout, DataView, FilterBar, Modal, StatCard, BarList, forms…
    context/      Auth, Toast, Lists
    hooks/        useListParams (URL state), useDebounce, useMediaQuery
    pages/        Login, Dashboard, Pipeline, LeadDetail, Trials, Followups,
                  Students, WeeklyReport, Instructions, Profile, NotFound
    lib/          format.js (dates/currency), constants.js (badge colour maps)
```

---

## API reference

All routes are prefixed with `/api` and need `Authorization: Bearer <token>` except `/health` and `/auth/login`.

```
POST   /auth/login                      GET    /dashboard?days=30
GET    /auth/me                         GET    /dashboard/today
PATCH  /auth/me
POST   /auth/change-password            GET    /reports/weekly?week=2026-W40
GET    /auth/users            (manager) PUT    /reports/weekly/:weekKey     (manager)
POST   /auth/register         (admin)   GET    /reports/weekly/history
PATCH  /auth/users/:id        (admin)   GET    /reports/weekly/:weekKey/export
DELETE /auth/users/:id        (admin)
                                        GET    /lists
GET    /leads                           GET    /activity
GET    /leads/export  (CSV)
POST   /leads                           GET    /trials        POST /trials
GET    /leads/:id                       PATCH  /trials/:id    POST /trials/:id/review
PATCH  /leads/:id                       GET    /trials/export (CSV)
PATCH  /leads/:id/stage
POST   /leads/:id/convert               GET    /followups     POST /followups
PATCH  /leads/bulk                      PATCH  /followups/:id
DELETE /leads/:id           (manager)   POST   /followups/:id/attempt
                                        POST   /followups/:id/complete
GET    /students      POST /students    GET    /followups/export (CSV)
PATCH  /students/:id
POST   /students/:id/log-session
POST   /students/:id/renew
GET    /students/export (CSV)
```

List endpoints accept `?page=&limit=&sort=&search=&view=&from=&to=` plus their own filter fields,
and return `{ success, data, meta: { total, page, pages, hasNext, hasPrev } }`.

---

## Deploying

1. `npm run build` → static bundle in `frontend/dist` (host on Netlify/Vercel/S3, or serve it from Express).
2. Set `VITE_API_URL` to the deployed API origin before building.
3. On the API set `NODE_ENV=production`, a strong `JWT_SECRET`, `CLIENT_ORIGIN` (comma-separated origins allowed),
   and a `MONGODB_URI` pointing at MongoDB Atlas.
4. Run `npm run seed` once against production to create the admin account, then change the password.

# TokTickIT

IT service desk application. React UI → Express REST API → Prisma ORM → PostgreSQL DB, with JWT authentication and role-based access (Requester, IT Staff, Administrator).

## Tech Stack

- Frontend: React + TypeScript + Vite + Bootstrap
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Auth: JWT (jsonwebtoken) + bcryptjs
- Testing: Vitest (frontend/backend) + Supertest (API)

## Prerequisites

- Node.js 20+
- PostgreSQL running locally, with a database and user created for this project

## Setup

### 1. Database

Create a database and a role for the app (adjust name/password as needed), then set `DATABASE_URL` in `server/.env` (copy from `server/.env.example`).

```sql
CREATE ROLE toktickit_app LOGIN PASSWORD 'your_password';
CREATE DATABASE toktickit OWNER toktickit_app;
```

### 2. Backend (`server/`)

```bash
cd server
npm install
cp .env.example .env   # then fill in DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN
npx prisma generate
npx prisma migrate deploy   # apply all migrations (Labs 1-4) - additive, keeps existing data
npm run prisma:seed         # idempotent: safe to run again, never duplicates
npm run dev             # starts the API on http://localhost:4000
```

> **Shell `DATABASE_URL` wins over `server/.env`.** Prisma and `dotenv` do not override an
> environment variable that is already set. If your machine has a global `DATABASE_URL` for
> another project, every command above silently targets *that* database. Check with
> `npx prisma migrate status` (it prints the database name) and, if needed, prefix commands with
> the right URL, e.g. `DATABASE_URL="postgresql://…/toktickit?schema=public" npm run dev`.

**Before migrating a database that holds data you care about**, back it up
(`pg_dump -Fc toktickit > backup.dump`). Lab 4 migrations are additive; each has a manual
rollback script next to it (`server/prisma/migrations/2026100*/down.sql`) — run them newest first,
delete the two Lab 4 rows from `_prisma_migrations`, and `prisma migrate deploy` re-applies them
(procedure in `docs/lab-04/specification.md` §10.3, verified by `tests/lab-04/migration-rollback.test.ts`).

Backend scripts:

- `npm run dev` — start the API in watch mode
- `npm run build` / `npm start` — compile and run the production build
- `npm test` — run Vitest + Supertest (test files run one at a time: they share the `.env.test` DB)
- `npm run test:prepare` — apply migrations and seed the `.env.test` database
- `npm run prisma:generate` — regenerate the Prisma client
- `npm run prisma:migrate` — run Prisma migrations
- `npm run prisma:seed` — seed reference data, demo users, and a sample ticket

### 3. Frontend (`client/`)

```bash
cd client
npm install
npm run dev              # starts the UI on http://localhost:5173
```

Frontend scripts:

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run lint` — run oxlint
- `npm run preview` — preview the production build locally
- `npm test` — run Vitest UI tests

## API overview

All routes are mounted under `/api`. Routes other than `/health`, `/auth/login`, and the public `GET` list endpoints require a valid JWT (`Authorization: Bearer <token>`); role restrictions are noted where they apply.

| Method | Path | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | Service health check | Public |
| POST | `/api/auth/login` | Log in, receive a JWT | Public |
| POST | `/api/auth/change-password` | Change the current user's password | Authenticated |
| GET | `/api/auth/me` | Get the current user's profile | Authenticated |
| GET | `/api/categories` | Active ticket categories | Public |
| GET | `/api/categories/manage` | All ticket categories, including inactive | Administrator |
| POST | `/api/categories` | Create a ticket category | Administrator |
| PATCH | `/api/categories/:id` | Update a ticket category | Administrator |
| GET | `/api/related-systems` | Active related systems | Public |
| GET | `/api/related-systems/manage` | All related systems, including inactive | Administrator |
| POST | `/api/related-systems` | Create a related system | Administrator |
| PATCH | `/api/related-systems/:id` | Update a related system | Administrator |
| GET | `/api/users` | List users (filters: `q`, `role`, `isActive`) | Administrator |
| POST | `/api/users` | Create a user | Administrator |
| GET | `/api/users/:id` | Get one user | Administrator |
| PATCH | `/api/users/:id` | Update a user | Administrator |
| PATCH | `/api/users/:id/status` | Activate/deactivate a user | Administrator |
| POST | `/api/users/:id/reset-password` | Reset a user's password | Administrator |
| POST | `/api/tickets` | Create a ticket | Requester |
| GET | `/api/tickets/mine` | List the current requester's tickets (`status`, `statusGroup=open`, `search`, `sort`, `order`, `page`, `pageSize`) | Requester |
| GET | `/api/tickets` | List tickets / queue (`status`, `statusGroup=open`, `itPriority`, `ownerId`, `categoryId`, `q`, `sort`, `order`, `page`, `pageSize`) | IT Staff / Administrator |
| GET | `/api/tickets/:id` | Get one ticket (incl. `version`, Actions Taken, `statusHistory`) | Authenticated (owner or staff) |
| PATCH | `/api/tickets/:id/priority` | Update requester-set priority | Requester |
| PATCH | `/api/tickets/:id/requester-appears-resolved` | Flag/unflag "problem appears resolved" (own ticket) | Requester |
| POST | `/api/tickets/:id/confirm-resolution` | Confirm a proposed resolution | Requester |
| POST | `/api/tickets/:id/reject-resolution` | Reject a proposed resolution | Requester |
| POST | `/api/tickets/:id/request-reopen` | Request a closed ticket be reopened | Requester |
| PATCH | `/api/tickets/:id/owner` | Assign/reassign the ticket owner | IT Staff / Administrator |
| PATCH | `/api/tickets/:id/it-priority` | Update IT-set priority | IT Staff / Administrator |
| PATCH | `/api/tickets/:id/status` | Update ticket status (see `docs/lab-04/specification.md` §7 for the final transition matrix; optional `version` → `409 STALE_UPDATE`) | IT Staff / Administrator |
| POST | `/api/tickets/:id/resolve` | Resolve — needs ≥1 Completed and no open Action Taken (`409 RESOLUTION_GATE`) | IT Staff / Administrator |
| POST | `/api/tickets/:id/close` | Close a ticket | IT Staff / Administrator |
| POST | `/api/tickets/:id/cancel` | Cancel a ticket (only from New/Open; open actions are cancelled too) | IT Staff / Administrator |
| POST | `/api/tickets/:id/notes` | Add an internal note | IT Staff / Administrator |
| GET | `/api/tickets/:id/actions` | List a ticket's Actions Taken | Authenticated (owner or staff) |
| POST | `/api/tickets/:id/actions` | Create an Action Taken (`clientRequestId` makes retries safe) | IT Staff / Administrator |
| PATCH | `/api/tickets/:id/actions/:actionId` | Edit / assign / start / complete / cancel an Action Taken (requires `version`) | IT Staff / Administrator |
| GET | `/api/dashboard/requester` | Requester Dashboard metrics and lists (own tickets only) | Requester |
| GET | `/api/dashboard/staff` | IT Staff Dashboard (Administrators also get user counts) | IT Staff / Administrator |
| POST | `/api/tickets/:id/comments` | Add a public comment | Authenticated (owner or staff) |
| POST | `/api/tickets/:id/attachments` | Upload an attachment | Authenticated (owner or staff) |
| GET | `/api/attachments/:id` | Get one attachment's metadata | Authenticated (owner or staff) |
| GET | `/api/attachments/:id/download` | Download an attachment's file | Authenticated (owner or staff) |
| DELETE | `/api/attachments/:id` | Soft-remove an attachment (reason required) | Authenticated (owner or staff) |
| GET | `/api/requesters` | List active Requesters | Public (dev/test-only selector, see below) |
| POST | `/api/requesters/dev-select` | Issue a session for a Requester without a password | Public (dev/test-only selector, see below) |

## Demo accounts (seed data)

`npm run prisma:seed` (server) creates these accounts. All passwords are seed-only fixtures for
local development, never real secrets — see `server/prisma/seed.ts` for the full, current list.

| Email | Password | Role | Notes |
|---|---|---|---|
| `admin@toktickit.dev` | `Admin123!` | Administrator | |
| `itstaff@toktickit.dev` | `ItStaff123!` | IT Staff | |
| `marcus.tan@toktickit.dev` | `MarcusTan123!` | IT Staff | |
| `sofia.rivera@toktickit.dev` | `SofiaRivera123!` | IT Staff | |
| `inactive-itstaff@toktickit.dev` | `InactiveItStaff123!` | IT Staff | deactivated |
| `requester@toktickit.dev` | `Requester123!` | Requester | |
| `newuser@toktickit.dev` | `TempPass123!` | Requester | must change password at login |
| `jennifer.anderson@toktickit.dev` | `Jennifer123!` | Requester | |
| `david.lee@toktickit.dev` | `DavidLee123!` | Requester | |
| `inactive-requester@toktickit.dev` | `InactiveRequester123!` | Requester | deactivated |

The Login screen also links to `/dev-requester-select`, a password-free Requester selector kept
for local testing only (`POST /api/requesters/dev-select`) — see `docs/lab-02/specification.md`
§11 for why it's intentionally decoupled from the real login flow.

## Demo walkthrough (Lab 4)

1. Sign in as `itstaff@toktickit.dev` → **IT Staff Dashboard**. Click any card's *View all* to
   open the Ticket Queue filtered to exactly those tickets.
2. Open `TKT-SAMPLE-000001` → **Actions Taken** tab: three actions by different staff (Completed,
   In Progress, Planned). *Resolve Ticket* is disabled ("2 actions are still open").
3. Complete or cancel the open actions (*View / Edit* → *Mark Completed* needs a Result), then
   resolve. The **Status History** tab records each change.
4. Sign in as `requester@toktickit.dev` → **Requester Dashboard** → the same ticket appears under
   *Needs Your Attention*; open it, read the Actions Taken (read-only), *Confirm Resolution*.

Full scope and rules: `docs/lab-04/specification.md`.

## End-to-end tests

```bash
cd e2e
npm install
npx playwright install chromium   # first time only
npm test                           # starts the API + client dev servers, runs Playwright
```

Runs against the real dev-mode app and the same Postgres database `server/.env` points at (not a
mock) — see `e2e/playwright.config.ts`. The specs log in with the **seed passwords** above, so run
them against a database where those are unchanged (e.g. start the API with the `.env.test`
`DATABASE_URL`). `lab-03/visual-inspection` and `lab-04/visual-inspection` rewrite the committed
screenshots under `artifacts/`; restore them with `git checkout -- artifacts` if you don't mean
to update them.

## Project Structure

```
toktickit/
├── client/                 # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── api/             # API client modules
│   │   ├── auth/             # Auth context, hooks, route guard
│   │   ├── components/       # Shared UI components
│   │   └── pages/             # Route-level pages
│   └── tests/
│       ├── full-app/         # Full-app RTL/Vitest tests
│       ├── lab-02/            # Lab 2 UI/component tests
│       ├── lab-03/            # Lab 3 UI/component tests
│       └── lab-04/            # Lab 4 UI/component tests (dashboards, Actions Taken, workflow)
├── server/
│   ├── prisma/               # Prisma schema, migrations, and seed script
│   ├── src/
│   │   ├── controllers/       # Route handlers
│   │   ├── middleware/         # Auth, role, and password-change guards
│   │   ├── routes/              # Express routers
│   │   └── lib/                  # Shared helpers (JWT, ticket numbers, access)
│   └── tests/
│       ├── lab-01/            # Lab 1 Supertest API tests
│       ├── lab-02/            # Lab 2 Supertest API tests
│       ├── lab-03/            # Lab 3 Supertest API tests
│       ├── lab-04/            # Lab 4 unit, API, workflow, dashboard, migration/seed tests
│       ├── helpers/           # Shared test helpers
│       └── full-app/           # Full-app Supertest API tests
├── e2e/                     # Playwright end-to-end suite (real dev servers + DB)
│   ├── lab-02/                # Lab 2 E2E specs
│   ├── lab-03/                # Lab 3 E2E specs + visual-inspection screenshots capture
│   └── lab-04/                # Lab 4 E2E specs (actions, resolution, dashboards) + screenshots
├── artifacts/
│   ├── lab-02/screenshots/    # Lab 2 submission screenshot evidence
│   ├── lab-03/screenshots/    # Lab 3 submission screenshot evidence
│   └── lab-04/screenshots/    # Lab 4: staff-dashboard/, requester-dashboard/, actions-taken/
├── docs/
│   ├── lab-01/                # Lab 1 documentation
│   ├── lab-02/                # Lab 2 documentation (spec, ui-spec, api-spec, tests, reviewer)
│   ├── lab-03/                # Lab 3 documentation (spec, ui-spec, api-spec, tests, reviewer)
│   └── lab-04/                # Lab 4 documentation (spec, ui-spec, api-spec, tests, reviewer, ai-use)
├── .gitignore
└── README.md
```

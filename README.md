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
npm run dev             # starts the API on http://localhost:4000
```

Backend scripts:

- `npm run dev` — start the API in watch mode
- `npm run build` / `npm start` — compile and run the production build
- `npm test` — run Vitest + Supertest
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
| GET | `/api/users` | List users | Administrator |
| POST | `/api/users` | Create a user | Administrator |
| GET | `/api/users/:id` | Get one user | Administrator |
| PATCH | `/api/users/:id` | Update a user | Administrator |
| PATCH | `/api/users/:id/status` | Activate/deactivate a user | Administrator |
| POST | `/api/users/:id/reset-password` | Reset a user's password | Administrator |
| POST | `/api/tickets` | Create a ticket | Requester |
| GET | `/api/tickets/mine` | List the current requester's tickets | Requester |
| GET | `/api/tickets` | List tickets (queue) | IT Staff / Administrator |
| GET | `/api/tickets/:id` | Get one ticket | Authenticated (owner or staff) |
| PATCH | `/api/tickets/:id/priority` | Update requester-set priority | Requester |
| POST | `/api/tickets/:id/confirm-resolution` | Confirm a proposed resolution | Requester |
| POST | `/api/tickets/:id/reject-resolution` | Reject a proposed resolution | Requester |
| POST | `/api/tickets/:id/request-reopen` | Request a closed ticket be reopened | Requester |
| PATCH | `/api/tickets/:id/owner` | Assign/reassign the ticket owner | IT Staff / Administrator |
| PATCH | `/api/tickets/:id/it-priority` | Update IT-set priority | IT Staff / Administrator |
| PATCH | `/api/tickets/:id/status` | Update ticket status | IT Staff / Administrator |
| POST | `/api/tickets/:id/resolve` | Propose a resolution | IT Staff / Administrator |
| POST | `/api/tickets/:id/close` | Close a ticket | IT Staff / Administrator |
| POST | `/api/tickets/:id/notes` | Add an internal note | IT Staff / Administrator |
| POST | `/api/tickets/:id/actions` | Log an action taken | IT Staff / Administrator |
| PATCH | `/api/tickets/:id/actions/:actionId` | Update a logged action | IT Staff / Administrator |
| POST | `/api/tickets/:id/comments` | Add a public comment | Authenticated (owner or staff) |
| POST | `/api/tickets/:id/attachments` | Upload an attachment | Authenticated (owner or staff) |

## Project Structure

```
toktickit/
├── client/                 # React + TypeScript + Vite frontend
│   └── src/
│       ├── api/             # API client modules
│       ├── auth/             # Auth context, hooks, route guard
│       ├── components/       # Shared UI components
│       └── pages/             # Route-level pages
├── server/
│   ├── prisma/               # Prisma schema, migrations, and seed script
│   ├── src/
│   │   ├── controllers/       # Route handlers
│   │   ├── middleware/         # Auth, role, and password-change guards
│   │   ├── routes/              # Express routers
│   │   └── lib/                  # Shared helpers (JWT, ticket numbers, access)
│   └── tests/
│       ├── lab-01/            # Lab 1 Supertest API tests
│       └── full-app/           # Full-app Supertest API tests
├── docs/
│   └── lab-01/                # Lab 1 documentation
├── .gitignore
└── README.md
```

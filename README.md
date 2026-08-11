# TokTickIT

IT service desk application. Sprint 1 vertical slice: React UI → Express REST API → Prisma ORM → PostgreSQL DB.

## Tech Stack

- Frontend: React + TypeScript + Vite + Bootstrap
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
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
cp .env.example .env   # then fill in DATABASE_URL
npx prisma generate
npm run dev             # starts the API on http://localhost:4000
```

Backend scripts:

- `npm run dev` — start the API in watch mode
- `npm run build` / `npm start` — compile and run the production build
- `npm test` — run Vitest + Supertest
- `npm run prisma:generate` — regenerate the Prisma client
- `npm run prisma:migrate` — run Prisma migrations

### 3. Frontend (`client/`)

```bash
cd client
npm install
npm run dev              # starts the UI on http://localhost:5173
```

Frontend scripts:

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm test` — run Vitest UI tests

## Project Structure

```
toktickit/
├── client/            # React + TypeScript + Vite frontend
├── server/
│   ├── prisma/        # Prisma schema and migrations
│   ├── src/           # Express + TypeScript source
│   └── tests/lab-01/  # Supertest API tests
├── docs/lab-01/        # Lab 1 documentation
├── .gitignore
└── README.md
```

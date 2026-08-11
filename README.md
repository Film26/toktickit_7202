# toktickit_7202
# TokTickIT

IT service desk application — CPE 334 Lab 1 vertical slice.

## Tech Stack
- Frontend: React + TypeScript + Vite + Bootstrap
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Testing: Vitest (UI) + Supertest (API)

## Prerequisites
Node.js 20+, PostgreSQL 16+

## Setup

1. Clone และติดตั้ง dependencies
```bash
   cd client && npm install
   cd ../server && npm install
```

2. สร้าง database
```bash
   psql -U postgres -c "CREATE DATABASE toktickit;"
```

3. ตั้งค่า environment — คัดลอก `server/.env.example` เป็น `server/.env` แล้วแก้รหัสผ่านให้ตรงกับเครื่องตัวเอง

4. ซิงค์ schema
```bash
   cd server && npx prisma db push
```

## Running

| คำสั่ง | ที่อยู่ | ผลลัพธ์ |
|---|---|---|
| `npm run dev` | `server/` | API ที่ http://localhost:3000 |
| `npm run dev` | `client/` | UI ที่ http://localhost:5173 |

## Testing
```bash
cd server && npm test   # Supertest
cd client && npm test   # Vitest
```

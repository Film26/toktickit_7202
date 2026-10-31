import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

// MIG-03 (docs/lab-04/tests.md, Issue #78; handout 5.2 "rollback or recovery
// approach must be documented and tested"). Replays the real migration files
// in a throwaway Postgres schema of the test database -- never the dev DB:
// Labs 1-3 -> insert Lab 3-era data (incl. a pre-Lab-4 Action Taken) -> Lab 4
// (check backfill) -> both down.sql (check Lab 1-3 data intact, Lab 4 objects
// gone) -> Lab 4 again (clean re-apply).

const MIGRATIONS_DIR = path.join(__dirname, '../../prisma/migrations')
const SCHEMA = 'lab4_rollback_check'
const LAB4 = ['20261006000000_lab4_actions_taken', '20261007000000_lab4_ticket_workflow']

const baseUrl = process.env.DATABASE_URL!
const isolatedUrl = baseUrl.replace(/schema=[^&]+/, `schema=${SCHEMA}`)
const admin = new PrismaClient({ datasourceUrl: baseUrl })
let db: PrismaClient

function statements(file: string) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
}

async function runSqlFile(file: string) {
  for (const statement of statements(file)) await db.$executeRawUnsafe(statement)
}

const migrationDirs = () =>
  fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => fs.statSync(path.join(MIGRATIONS_DIR, name)).isDirectory())
    .sort()

async function columnsOf(table: string) {
  const rows = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = '${SCHEMA}' AND table_name = '${table}'`,
  )
  return rows.map((r) => r.column_name).sort()
}

async function tableExists(table: string) {
  const rows = await db.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = '${SCHEMA}' AND table_name = '${table}'`,
  )
  return rows[0].n === 1
}

// Lab 1-3 data written with plain SQL against the pre-Lab-4 shape.
async function insertLab3Data() {
  await db.$executeRawUnsafe(`INSERT INTO "User" (id, email, "passwordHash", "fullName", role, "updatedAt") VALUES
    (1, 'req@x.dev', 'h', 'Req One', 'REQUESTER', now()), (2, 'staff@x.dev', 'h', 'Staff One', 'IT_STAFF', now())`)
  await db.$executeRawUnsafe(`INSERT INTO "Category" (id, name) VALUES (1, 'Hardware')`)
  await db.$executeRawUnsafe(`INSERT INTO "Ticket" (id, "ticketNumber", "requesterId", "ownerId", "categoryId", summary, description, status, "updatedAt", "createdAt")
    VALUES (1, 'TKT-OLD-1', 1, 2, 1, 'Old ticket', 'Before Lab 4', 'IN_PROGRESS', now(), '2026-09-01T00:00:00Z')`)
  await db.$executeRawUnsafe(`INSERT INTO "PublicComment" ("ticketId", "authorId", body) VALUES (1, 1, 'still broken')`)
  await db.$executeRawUnsafe(`INSERT INTO "InternalNote" ("ticketId", "authorId", body) VALUES (1, 2, 'check driver')`)
  await db.$executeRawUnsafe(`INSERT INTO "Attachment" ("ticketId", "uploaderId", filename, "storedFilename", "mimeType", "sizeBytes")
    VALUES (1, 1, 'shot.png', 'abc.png', 'image/png', 1234)`)
  await db.$executeRawUnsafe(`INSERT INTO "ActionTaken" ("ticketId", "authorId", description, "updatedAt", "createdAt")
    VALUES (1, 2, 'Reinstalled driver', '2026-09-02T00:00:00Z', '2026-09-02T00:00:00Z')`)
}

async function lab3Snapshot() {
  return db.$queryRawUnsafe(`SELECT
    (SELECT json_agg(t ORDER BY id) FROM (SELECT id, email, role FROM "User") t) AS users,
    (SELECT json_agg(t ORDER BY id) FROM (SELECT id, "ticketNumber", status, "ownerId", summary FROM "Ticket") t) AS tickets,
    (SELECT json_agg(t) FROM (SELECT "ticketId", body FROM "PublicComment") t) AS comments,
    (SELECT json_agg(t) FROM (SELECT "ticketId", body FROM "InternalNote") t) AS notes,
    (SELECT json_agg(t) FROM (SELECT "ticketId", filename, "sizeBytes" FROM "Attachment") t) AS attachments,
    (SELECT json_agg(t) FROM (SELECT "ticketId", "authorId", description, "createdAt" FROM "ActionTaken") t) AS actions`)
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`)
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${SCHEMA}"`)
  db = new PrismaClient({ datasourceUrl: isolatedUrl })
})

afterAll(async () => {
  await db?.$disconnect()
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`)
  await admin.$disconnect()
})

describe('MIG-03 Lab 4 migrations: forward, rollback, re-apply', () => {
  let before: unknown

  it('applies the Lab 1-3 migrations and stores Lab 3-era data', async () => {
    for (const dir of migrationDirs().filter((d) => !LAB4.includes(d))) {
      await runSqlFile(path.join(MIGRATIONS_DIR, dir, 'migration.sql'))
    }
    await insertLab3Data()
    before = await lab3Snapshot()
    expect(await columnsOf('ActionTaken')).not.toContain('status')
  })

  it('applies the Lab 4 migrations without losing data and backfills the legacy action', async () => {
    for (const dir of LAB4) await runSqlFile(path.join(MIGRATIONS_DIR, dir, 'migration.sql'))

    expect(await lab3Snapshot()).toEqual(before)
    const [action] = await db.$queryRawUnsafe<
      Array<{ status: string; assigneeId: number; actionAt: Date; createdAt: Date; result: string }>
    >(`SELECT status::text, "assigneeId", "actionAt", "createdAt", result FROM "ActionTaken"`)
    expect(action.status).toBe('COMPLETED')
    expect(action.assigneeId).toBe(2)
    expect(action.actionAt.toISOString()).toBe(action.createdAt.toISOString())
    expect(action.result).toMatch(/before Lab 4/)
    expect(await tableExists('TicketStatusChange')).toBe(true)
    expect(await columnsOf('Ticket')).toContain('version')
  })

  it('rolls back with both down.sql files (newest first): Lab 4 objects gone, Lab 1-3 data intact', async () => {
    for (const dir of [...LAB4].reverse()) await runSqlFile(path.join(MIGRATIONS_DIR, dir, 'down.sql'))

    expect(await tableExists('TicketStatusChange')).toBe(false)
    expect(await columnsOf('Ticket')).not.toContain('version')
    expect(await columnsOf('ActionTaken')).toEqual(['authorId', 'createdAt', 'description', 'id', 'ticketId', 'updatedAt'])
    const types = await db.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = '${SCHEMA}' AND t.typname = 'ActionStatus'`,
    )
    expect(types[0].n).toBe(0)
    expect(await lab3Snapshot()).toEqual(before)
  })

  it('re-applies the Lab 4 migrations cleanly after a rollback (recovery path)', async () => {
    for (const dir of LAB4) await runSqlFile(path.join(MIGRATIONS_DIR, dir, 'migration.sql'))
    expect(await lab3Snapshot()).toEqual(before)
    expect(await columnsOf('ActionTaken')).toContain('status')
    expect(await tableExists('TicketStatusChange')).toBe(true)
  })
})

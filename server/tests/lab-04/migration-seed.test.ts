import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import prisma from '../../src/db'
import { main as runSeed } from '../../prisma/seed'

// MIG-01, MIG-02 (docs/lab-04/tests.md) -- Lab 4 migration backfill and seed.

const MIGRATION_DIR = path.join(__dirname, '../../prisma/migrations/20261006000000_lab4_actions_taken')

describe('MIG-01 Lab 4 Actions Taken migration (BR-24, AC-21)', () => {
  it('is additive: no DROP / destructive ALTER in the forward migration, and a documented down.sql exists', () => {
    const forward = fs.readFileSync(path.join(MIGRATION_DIR, 'migration.sql'), 'utf8')
    expect(forward).not.toMatch(/DROP\s+(TABLE|COLUMN)/i)
    expect(fs.existsSync(path.join(MIGRATION_DIR, 'down.sql'))).toBe(true)
  })

  it('backfill rule turns a legacy action into Completed, assigned to its author, dated at creation', async () => {
    // Recreate a pre-Lab-4 row (only the old columns set, Lab 4 defaults
    // applied), run the migration's own UPDATE statement on it, and check it.
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { ticketNumber: 'TKT-SAMPLE-000002' } })
    const author = await prisma.user.findUniqueOrThrow({ where: { email: 'itstaff@toktickit.dev' } })
    const legacy = await prisma.actionTaken.create({
      data: { ticketId: ticket.id, authorId: author.id, description: 'Legacy action', createdAt: new Date('2026-08-20T03:00:00Z') },
    })

    const forward = fs.readFileSync(path.join(MIGRATION_DIR, 'migration.sql'), 'utf8')
    const backfill = forward.slice(forward.indexOf('UPDATE "ActionTaken"')).replace(/;\s*$/, '')
    await prisma.$executeRawUnsafe(`${backfill} WHERE "id" = ${legacy.id}`)

    const migrated = await prisma.actionTaken.findUniqueOrThrow({ where: { id: legacy.id } })
    expect(migrated.status).toBe('COMPLETED')
    expect(migrated.assigneeId).toBe(author.id)
    expect(migrated.actionAt.toISOString()).toBe('2026-08-20T03:00:00.000Z')
    expect(migrated.result).toMatch(/before Lab 4/)
    expect(migrated.completedAt).not.toBeNull()

    await prisma.actionTaken.delete({ where: { id: legacy.id } })
  })

  it('earlier tables stay queryable with their relations after migration', async () => {
    const ticket = await prisma.ticket.findFirstOrThrow({
      where: { ticketNumber: 'TKT-SAMPLE-000001' },
      include: { publicComments: true, internalNotes: true, attachments: true, actionsTaken: true, requester: true },
    })
    expect(ticket.publicComments.length).toBeGreaterThan(0)
    expect(ticket.internalNotes.length).toBeGreaterThan(0)
    expect(ticket.requester.email).toBe('requester@toktickit.dev')
  })
})

describe('MIG-02 Lab 4 seed (labsheet 5.3)', () => {
  async function seededActionCounts() {
    const tickets = await prisma.ticket.findMany({
      where: { ticketNumber: { startsWith: 'TKT-SAMPLE-' } },
      select: { ticketNumber: true, status: true, _count: { select: { actionsTaken: { where: { clientRequestId: { startsWith: 'seed-' } } } } } },
      orderBy: { ticketNumber: 'asc' },
    })
    return tickets
  }

  it('is idempotent for actions and covers zero, one and many actions plus all 8 statuses', async () => {
    await runSeed()
    const first = await seededActionCounts()
    await runSeed()
    const second = await seededActionCounts()
    expect(second).toEqual(first)

    const counts = first.map((t) => t._count.actionsTaken)
    expect(counts).toContain(0)
    expect(counts).toContain(1)
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(3)
    expect(new Set(first.map((t) => t.status)).size).toBe(8)
  }, 30_000)

  it('seeds actions performed by and assigned to more than one IT Staff member, and one with follow-up', async () => {
    const actions = await prisma.actionTaken.findMany({ where: { clientRequestId: { startsWith: 'seed-' } } })
    expect(new Set(actions.map((a) => a.authorId)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(actions.map((a) => a.assigneeId)).size).toBeGreaterThanOrEqual(2)
    expect(actions.some((a) => a.followUpRequired && a.followUpNote)).toBe(true)
    expect(new Set(actions.map((a) => a.status)).size).toBe(4)
  })
})

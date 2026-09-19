import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/db'
import { main as runSeed, SEED_USERS, CATEGORY_NAMES, RELATED_SYSTEM_NAMES } from '../../prisma/seed'

// Covers Issue #48: idempotent seed behavior (safe to run repeatedly) and a
// migration-regression check that seeding never touches pre-existing
// Ticket/Attachment/Category data, per docs/lab-03/specification.md
// section 9 and the handout's section 5.3.
//
// Counts below are scoped to rows the seed itself owns (by the seed's own
// known emails/names/ticket-number prefix) rather than whole-table counts,
// because this suite's other test files run in the same shared local
// database and legitimately create their own users/tickets/comments with
// unrelated Date.now()-suffixed identifiers -- a global count would flag
// that unrelated activity as "the seed duplicated something."

const SEED_EMAILS = SEED_USERS.map((u) => u.email)

async function countSeedOwnedRows() {
  const [users, categories, relatedSystems, tickets, comments, notes] = await Promise.all([
    prisma.user.count({ where: { email: { in: SEED_EMAILS } } }),
    prisma.category.count({ where: { name: { in: CATEGORY_NAMES } } }),
    prisma.relatedSystem.count({ where: { name: { in: RELATED_SYSTEM_NAMES } } }),
    prisma.ticket.count({ where: { ticketNumber: { startsWith: 'TKT-SAMPLE-' } } }),
    prisma.publicComment.count({ where: { ticket: { ticketNumber: { startsWith: 'TKT-SAMPLE-' } } } }),
    prisma.internalNote.count({ where: { ticket: { ticketNumber: { startsWith: 'TKT-SAMPLE-' } } } }),
  ])
  return { users, categories, relatedSystems, tickets, comments, notes }
}

describe('seed idempotency and migration regression (Issue #48)', () => {
  // Running the full seed twice (10 bcrypt hashes at cost 10 plus category/
  // related-system/ticket/comment upserts, twice) is inherently slower than
  // a typical test and flakes against the 5s default when the rest of the
  // suite is competing for the same DB connections/CPU - found while
  // verifying the full suite from a clean checkout (Issue #51).
  it('running the seed twice in a row produces identical row counts (no duplication, no error)', async () => {
    await runSeed()
    const afterFirstRun = await countSeedOwnedRows()

    await expect(runSeed()).resolves.not.toThrow()
    const afterSecondRun = await countSeedOwnedRows()

    expect(afterSecondRun).toEqual(afterFirstRun)
  }, 20_000)

  it('seeds at least 3 active + 1 inactive IT Staff, and at least 4 active + 1 inactive Requester (labsheet section 5.3)', async () => {
    const [activeStaff, inactiveStaff, activeRequesters, inactiveRequesters] = await Promise.all([
      prisma.user.count({ where: { role: 'IT_STAFF', isActive: true } }),
      prisma.user.count({ where: { role: 'IT_STAFF', isActive: false } }),
      prisma.user.count({ where: { role: 'REQUESTER', isActive: true } }),
      prisma.user.count({ where: { role: 'REQUESTER', isActive: false } }),
    ])
    expect(activeStaff).toBeGreaterThanOrEqual(3)
    expect(inactiveStaff).toBeGreaterThanOrEqual(1)
    expect(activeRequesters).toBeGreaterThanOrEqual(4)
    expect(inactiveRequesters).toBeGreaterThanOrEqual(1)
  })

  it('seed tickets are distributed across both assigned and unassigned ownership', async () => {
    const [assigned, unassigned] = await Promise.all([
      prisma.ticket.count({ where: { ticketNumber: { startsWith: 'TKT-SAMPLE-' }, ownerId: { not: null } } }),
      prisma.ticket.count({ where: { ticketNumber: { startsWith: 'TKT-SAMPLE-' }, ownerId: null } }),
    ])
    expect(assigned).toBeGreaterThan(0)
    expect(unassigned).toBeGreaterThan(0)
  })

  it('seed includes at least one Public Comment and one Internal Note', async () => {
    const [comments, notes] = await Promise.all([prisma.publicComment.count(), prisma.internalNote.count()])
    expect(comments).toBeGreaterThan(0)
    expect(notes).toBeGreaterThan(0)
  })

  describe('migration regression: pre-existing data survives a re-seed', () => {
    let requesterToken: string
    let ownTicketId: number
    const marker = `pre-existing-regression-${Date.now()}`

    beforeAll(async () => {
      const login = await request(app).post('/api/auth/login').send({ email: 'requester@toktickit.dev', password: 'Requester123!' })
      requesterToken = login.body.token

      const categories = await request(app).get('/api/categories')
      const categoryId = categories.body[0].id

      const created = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ categoryId, summary: marker, description: 'Created before re-seeding to prove seed never deletes real data.' })
      ownTicketId = created.body.id
    })

    it('a ticket created outside the seed still exists, unchanged, after re-running the seed', async () => {
      await runSeed()

      const reloaded = await prisma.ticket.findUnique({ where: { id: ownTicketId } })
      expect(reloaded).not.toBeNull()
      expect(reloaded?.summary).toBe(marker)
    })

    it('existing Categories are not duplicated by a re-seed (upsert by unique name)', async () => {
      const beforeCount = await prisma.category.count({ where: { name: { in: CATEGORY_NAMES } } })
      await runSeed()
      const afterCount = await prisma.category.count({ where: { name: { in: CATEGORY_NAMES } } })
      expect(afterCount).toBe(beforeCount)
    })
  })
})

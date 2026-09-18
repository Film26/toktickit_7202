import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

// Covers Issue #44 (IT Staff Ticket Queue: sort + pagination parity) against
// docs/lab-03/api-spec.md section 10 "Sort/pagination contract".

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

describe('IT Staff Ticket Queue - sort and pagination (Issue #44)', () => {
  let requesterToken: string
  let itStaffToken: string
  let categoryId: number
  const marker = `queue-sort-${Date.now()}`

  beforeAll(async () => {
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
    itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')

    const categories = await request(app).get('/api/categories')
    categoryId = categories.body[0].id

    // Three tickets with distinct requestedPriority so ordering is unambiguous,
    // all tagged with a unique marker so this test never sees another test
    // file's leftover tickets in the same shared local database.
    for (const requestedPriority of ['LOW', 'HIGH', 'MEDIUM']) {
      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ categoryId, summary: `${marker} ${requestedPriority}`, description: 'queue sort fixture', requestedPriority })
    }
  })

  it('returns the { tickets, pagination } shape, matching /api/tickets/mine', async () => {
    const response = await request(app)
      .get(`/api/tickets?q=${marker}`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    expect(response.status).toBe(200)
    expect(Array.isArray(response.body.tickets)).toBe(true)
    expect(response.body.pagination).toMatchObject({ page: 1, pageSize: 10, totalCount: 3, totalPages: 1 })
  })

  it('sorts by requestedPriority using the Priority enum\'s declared order (LOW < MEDIUM < HIGH < URGENT), not alphabetically', async () => {
    const response = await request(app)
      .get(`/api/tickets?q=${marker}&sort=requestedPriority&order=asc`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    expect(response.status).toBe(200)
    // fixture created LOW, HIGH, MEDIUM (in that order) -- ascending must come
    // back LOW, MEDIUM, HIGH per the enum's declaration order in schema.prisma,
    // which is NOT the same as alphabetical (HIGH, LOW, MEDIUM)
    const priorities = response.body.tickets.map((t: { requestedPriority: string }) => t.requestedPriority)
    expect(priorities).toEqual(['LOW', 'MEDIUM', 'HIGH'])
  })

  it('sorts by ticketNumber descending when order=desc', async () => {
    const asc = await request(app)
      .get(`/api/tickets?q=${marker}&sort=ticketNumber&order=asc`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    const desc = await request(app)
      .get(`/api/tickets?q=${marker}&sort=ticketNumber&order=desc`)
      .set('Authorization', `Bearer ${itStaffToken}`)

    const ascNumbers = asc.body.tickets.map((t: { ticketNumber: string }) => t.ticketNumber)
    const descNumbers = desc.body.tickets.map((t: { ticketNumber: string }) => t.ticketNumber)
    expect(descNumbers).toEqual([...ascNumbers].reverse())
  })

  it('accepts itPriority and updatedAt as sort fields (queue-specific additions)', async () => {
    const byItPriority = await request(app)
      .get(`/api/tickets?q=${marker}&sort=itPriority&order=desc`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    expect(byItPriority.status).toBe(200)

    const byUpdatedAt = await request(app)
      .get(`/api/tickets?q=${marker}&sort=updatedAt&order=desc`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    expect(byUpdatedAt.status).toBe(200)
  })

  it('paginates: pageSize=2 returns 2 tickets on page 1 and 1 on page 2, both with correct totals', async () => {
    const page1 = await request(app)
      .get(`/api/tickets?q=${marker}&page=1&pageSize=2`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    expect(page1.body.tickets).toHaveLength(2)
    expect(page1.body.pagination).toMatchObject({ page: 1, pageSize: 2, totalCount: 3, totalPages: 2 })

    const page2 = await request(app)
      .get(`/api/tickets?q=${marker}&page=2&pageSize=2`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    expect(page2.body.tickets).toHaveLength(1)
    expect(page2.body.pagination).toMatchObject({ page: 2, pageSize: 2, totalCount: 3, totalPages: 2 })
  })

  it('a page past the last page returns an empty tickets array, not an error', async () => {
    const response = await request(app)
      .get(`/api/tickets?q=${marker}&page=99&pageSize=10`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    expect(response.status).toBe(200)
    expect(response.body.tickets).toHaveLength(0)
    expect(response.body.pagination.page).toBe(99)
  })

  it('clamps pageSize to the documented maximum instead of erroring', async () => {
    const response = await request(app)
      .get(`/api/tickets?q=${marker}&pageSize=9999`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    expect(response.status).toBe(200)
    expect(response.body.pagination.pageSize).toBeLessThanOrEqual(50)
  })

  it('an invalid sort field falls back to the default (createdAt) instead of erroring', async () => {
    const response = await request(app)
      .get(`/api/tickets?q=${marker}&sort=not-a-real-field`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    expect(response.status).toBe(200)
    expect(response.body.tickets).toHaveLength(3)
  })

  it('an invalid page/pageSize value falls back to the default instead of erroring', async () => {
    const response = await request(app)
      .get(`/api/tickets?q=${marker}&page=not-a-number&pageSize=not-a-number`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    expect(response.status).toBe(200)
    expect(response.body.pagination).toMatchObject({ page: 1, pageSize: 10 })
  })

  it('existing filters (status/owner/category/search) still combine correctly with sort+pagination', async () => {
    const response = await request(app)
      .get(`/api/tickets?q=${marker}&status=NEW&ownerId=unassigned&categoryId=${categoryId}&sort=createdAt&order=desc&page=1&pageSize=10`)
      .set('Authorization', `Bearer ${itStaffToken}`)
    expect(response.status).toBe(200)
    expect(response.body.tickets).toHaveLength(3)
  })
})

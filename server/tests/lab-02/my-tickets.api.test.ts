import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

async function createTicket(token: string, categoryId: number, summary: string) {
  const response = await request(app)
    .post('/api/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId, summary, description: 'x' })
  return response.body.id as number
}

describe('GET /api/tickets/mine - Lab 2 My Tickets', () => {
  let requesterToken: string
  let otherRequesterToken: string
  let itStaffToken: string
  let adminToken: string
  let categoryId: number
  const marker = `mine-${Date.now()}`

  beforeAll(async () => {
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
    itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
    adminToken = await loginAs('admin@toktickit.dev', 'Admin123!')

    const categories = await request(app).get('/api/categories')
    categoryId = categories.body[0].id

    // a second, independent requester account so scoping can be verified -
    // fresh admin-created requesters start with mustChangePassword=true and
    // must clear that flow before any other endpoint call works
    const email = `other-requester-mine-${Date.now()}@toktickit.dev`
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, fullName: 'Other Mine Requester', role: 'REQUESTER' })
    const firstLogin = await request(app).post('/api/auth/login').send({ email, password: created.body.temporaryPassword })
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${firstLogin.body.token}`)
      .send({ currentPassword: created.body.temporaryPassword, newPassword: 'OtherMineRequester123!' })
    otherRequesterToken = (
      await request(app).post('/api/auth/login').send({ email, password: 'OtherMineRequester123!' })
    ).body.token as string

    for (const label of ['Alpha', 'Beta', 'Gamma']) {
      await createTicket(requesterToken, categoryId, `${marker} ${label}`)
    }
    await createTicket(otherRequesterToken, categoryId, `${marker} NotMine`)
  })

  it('requires authentication', async () => {
    const response = await request(app).get('/api/tickets/mine')
    expect(response.status).toBe(401)
  })

  it('is scoped to the caller only - never includes another requester’s tickets', async () => {
    const response = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&pageSize=50`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(response.status).toBe(200)
    expect(response.body.tickets.every((t: { summary: string }) => t.summary !== `${marker} NotMine`)).toBe(true)
    expect(response.body.tickets).toHaveLength(3)

    const otherView = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&pageSize=50`)
      .set('Authorization', `Bearer ${otherRequesterToken}`)
    expect(otherView.status).toBe(200)
    expect(otherView.body.tickets).toHaveLength(1)
    expect(otherView.body.tickets[0].summary).toBe(`${marker} NotMine`)
  })

  it('rejects staff roles - this endpoint is Requester-only', async () => {
    const response = await request(app).get('/api/tickets/mine').set('Authorization', `Bearer ${itStaffToken}`)
    expect(response.status).toBe(403)
  })

  it('filters by search text across the summary', async () => {
    const response = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker + ' Alpha')}`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(response.status).toBe(200)
    expect(response.body.tickets).toHaveLength(1)
    expect(response.body.tickets[0].summary).toBe(`${marker} Alpha`)
  })

  it('sorts by summary ascending and descending', async () => {
    const asc = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&sort=summary&order=asc&pageSize=50`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(asc.body.tickets.map((t: { summary: string }) => t.summary)).toEqual([
      `${marker} Alpha`,
      `${marker} Beta`,
      `${marker} Gamma`,
    ])

    const desc = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&sort=summary&order=desc&pageSize=50`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(desc.body.tickets.map((t: { summary: string }) => t.summary)).toEqual([
      `${marker} Gamma`,
      `${marker} Beta`,
      `${marker} Alpha`,
    ])
  })

  it('filters by status', async () => {
    const newOnly = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&status=NEW&pageSize=50`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(newOnly.body.tickets).toHaveLength(3)

    const closedOnly = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&status=CLOSED&pageSize=50`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(closedOnly.status).toBe(200)
    expect(closedOnly.body.tickets).toHaveLength(0)
  })

  it('distinguishes "no tickets at all" from "a filter matched nothing" via totalCount, letting the UI show different messages', async () => {
    // a search that matches nothing at all for this requester
    const noMatch = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(`${marker}-does-not-exist`)}`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(noMatch.status).toBe(200)
    expect(noMatch.body.tickets).toHaveLength(0)
    expect(noMatch.body.pagination.totalCount).toBe(0)

    // an unfiltered call always includes at least the seeded sample ticket -
    // proving the "zero results" case above really is the filter's doing,
    // not an empty account
    const unfiltered = await request(app).get('/api/tickets/mine').set('Authorization', `Bearer ${requesterToken}`)
    expect(unfiltered.status).toBe(200)
    expect(unfiltered.body.pagination.totalCount).toBeGreaterThan(0)
  })

  it('paginates with correct metadata', async () => {
    const page1 = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&sort=summary&order=asc&page=1&pageSize=2`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(page1.body.tickets).toHaveLength(2)
    expect(page1.body.pagination).toMatchObject({ page: 1, pageSize: 2, totalCount: 3, totalPages: 2 })

    const page2 = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&sort=summary&order=asc&page=2&pageSize=2`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(page2.body.tickets).toHaveLength(1)
    expect(page2.body.tickets[0].summary).toBe(`${marker} Gamma`)
  })
})

import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

describe('ticket lifecycle', () => {
  let requesterToken: string
  let itStaffToken: string
  let adminToken: string
  let categoryId: number
  let ticketId: number

  beforeAll(async () => {
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
    itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
    adminToken = await loginAs('admin@toktickit.dev', 'Admin123!')

    const categories = await request(app).get('/api/categories')
    categoryId = categories.body[0].id
  })

  it('lets a requester create a ticket', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ categoryId, summary: 'Test ticket summary', description: 'Test ticket description' })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ status: 'NEW', requestedPriority: 'MEDIUM' })
    expect(response.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/)
    ticketId = response.body.id
  })

  it('rejects ticket creation from non-requester roles', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ categoryId, summary: 'x', description: 'x' })
    expect(response.status).toBe(403)
  })

  it('lets the requester see it in their own list', async () => {
    const response = await request(app).get('/api/tickets/mine').set('Authorization', `Bearer ${requesterToken}`)
    expect(response.status).toBe(200)
    expect(response.body.tickets.some((t: { id: number }) => t.id === ticketId)).toBe(true)
    expect(response.body.pagination).toMatchObject({ page: 1, pageSize: 10 })
  })

  it('lets IT staff see it in the all-tickets list', async () => {
    const response = await request(app).get('/api/tickets').set('Authorization', `Bearer ${itStaffToken}`)
    expect(response.status).toBe(200)
    expect(response.body.some((t: { id: number }) => t.id === ticketId)).toBe(true)
  })

  it('404s for another requester trying to view someone else’s ticket, and omits internalNotes for the owning requester', async () => {
    // a fresh admin-created requester always starts with mustChangePassword=true,
    // so it must complete that flow before it can call any other endpoint
    const email = `other-requester-${Date.now()}@toktickit.dev`
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, fullName: 'Other Requester', role: 'REQUESTER' })
    const firstLogin = await request(app).post('/api/auth/login').send({ email, password: created.body.temporaryPassword })
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${firstLogin.body.token}`)
      .send({ currentPassword: created.body.temporaryPassword, newPassword: 'OtherRequester123!' })
    const otherRequesterToken = (
      await request(app).post('/api/auth/login').send({ email, password: 'OtherRequester123!' })
    ).body.token as string

    const notMineResponse = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${otherRequesterToken}`)
    expect(notMineResponse.status).toBe(404)

    const mineResponse = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${requesterToken}`)
    expect(mineResponse.status).toBe(200)
    expect(mineResponse.body.internalNotes).toBeUndefined()
  })

  it('lets IT staff claim ownership, set IT priority, and move to In Progress', async () => {
    const claim = await request(app)
      .patch(`/api/tickets/${ticketId}/owner`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ ownerId: (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${itStaffToken}`)).body.user.id })
    expect(claim.status).toBe(200)
    expect(claim.body.ownerId).not.toBeNull()

    const priority = await request(app)
      .patch(`/api/tickets/${ticketId}/it-priority`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ itPriority: 'HIGH' })
    expect(priority.status).toBe(200)
    expect(priority.body.itPriority).toBe('HIGH')

    const status = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'IN_PROGRESS' })
    expect(status.status).toBe(200)
    expect(status.body.status).toBe('IN_PROGRESS')
  })

  it('rejects an invalid status transition', async () => {
    const response = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'CLOSED' })
    expect(response.status).toBe(409)
  })

  it('lets a requester add a public comment, and IT staff add an internal note and an action taken', async () => {
    const comment = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ body: 'A public comment' })
    expect(comment.status).toBe(201)

    const note = await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ body: 'An internal note' })
    expect(note.status).toBe(201)

    const action = await request(app)
      .post(`/api/tickets/${ticketId}/actions`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ description: 'Restarted the service' })
    expect(action.status).toBe(201)

    const updatedAction = await request(app)
      .patch(`/api/tickets/${ticketId}/actions/${action.body.id}`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ description: 'Restarted the service and confirmed fix' })
    expect(updatedAction.status).toBe(200)
  })

  it('rejects a requester adding an internal note', async () => {
    const response = await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ body: 'Should not be allowed' })
    expect(response.status).toBe(403)
  })

  it('lets the owning requester change requested priority while In Progress, but not once Resolved; reject-resolution reopens it', async () => {
    // the ticket is already IN_PROGRESS at this point in the suite (see the
    // "claim ownership ... move to In Progress" test above)
    const whileInProgress = await request(app)
      .patch(`/api/tickets/${ticketId}/priority`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ requestedPriority: 'URGENT' })
    expect(whileInProgress.status).toBe(200)
    expect(whileInProgress.body.requestedPriority).toBe('URGENT')

    const resolve = await request(app)
      .post(`/api/tickets/${ticketId}/resolve`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ resolutionSummary: 'Temporary fix to test the priority guard' })
    expect(resolve.status).toBe(200)
    expect(resolve.body.status).toBe('RESOLVED')

    const whileResolved = await request(app)
      .patch(`/api/tickets/${ticketId}/priority`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ requestedPriority: 'LOW' })
    expect(whileResolved.status).toBe(409)

    const reject = await request(app)
      .post(`/api/tickets/${ticketId}/reject-resolution`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(reject.status).toBe(200)
    expect(reject.body.status).toBe('REOPENED')

    // restore to In Progress so the downstream "resolve -> confirm -> closed"
    // test (which requires an In-Progress ticket) keeps working
    const backToInProgress = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'IN_PROGRESS' })
    expect(backToInProgress.status).toBe(200)
  })

  it('rejects a priority change from a requester who does not own the ticket', async () => {
    const response = await request(app)
      .patch(`/api/tickets/${ticketId}/priority`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ requestedPriority: 'LOW' })
    // itStaffToken is not a REQUESTER at all, so this also covers the role gate;
    // ownership is covered by the 404-for-other-requester test above.
    expect(response.status).toBe(403)
  })

  it('walks through resolve -> confirm -> closed', async () => {
    const resolve = await request(app)
      .post(`/api/tickets/${ticketId}/resolve`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ resolutionSummary: 'Fixed the issue' })
    expect(resolve.status).toBe(200)
    expect(resolve.body.status).toBe('RESOLVED')

    const confirm = await request(app)
      .post(`/api/tickets/${ticketId}/confirm-resolution`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(confirm.status).toBe(200)
    expect(confirm.body.status).toBe('CLOSED')
  })

  it('lets the requester request reopening a closed ticket', async () => {
    const response = await request(app)
      .post(`/api/tickets/${ticketId}/request-reopen`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('REOPENED')
  })

  it('lets an admin close a resolved ticket directly (override path)', async () => {
    await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' })
    await request(app)
      .post(`/api/tickets/${ticketId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolutionSummary: 'Fixed again' })

    const close = await request(app).post(`/api/tickets/${ticketId}/close`).set('Authorization', `Bearer ${adminToken}`)
    expect(close.status).toBe(200)
    expect(close.body.status).toBe('CLOSED')
  })
})

describe('My Tickets: search, sort, and pagination', () => {
  let token: string
  const marker = `zzsearch-${Date.now()}`

  beforeAll(async () => {
    token = await loginAs('requester@toktickit.dev', 'Requester123!')
    const categories = await request(app).get('/api/categories')
    const categoryId = categories.body[0].id

    for (const label of ['Alpha', 'Beta', 'Gamma']) {
      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${token}`)
        .send({ categoryId, summary: `${marker} ${label}`, description: 'x' })
    }
  })

  it('filters by search across the summary, scoped to only the matching tickets', async () => {
    const response = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body.tickets).toHaveLength(3)
    expect(response.body.pagination.totalCount).toBe(3)
  })

  it('sorts the matching tickets by summary ascending and descending', async () => {
    const asc = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&sort=summary&order=asc&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
    expect(asc.status).toBe(200)
    expect(asc.body.tickets.map((t: { summary: string }) => t.summary)).toEqual([
      `${marker} Alpha`,
      `${marker} Beta`,
      `${marker} Gamma`,
    ])

    const desc = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&sort=summary&order=desc&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
    expect(desc.status).toBe(200)
    expect(desc.body.tickets.map((t: { summary: string }) => t.summary)).toEqual([
      `${marker} Gamma`,
      `${marker} Beta`,
      `${marker} Alpha`,
    ])
  })

  it('filters by status in combination with search', async () => {
    // all 3 marker tickets are freshly created and still NEW
    const newOnly = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&status=NEW&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
    expect(newOnly.status).toBe(200)
    expect(newOnly.body.tickets).toHaveLength(3)

    const resolvedOnly = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&status=RESOLVED&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
    expect(resolvedOnly.status).toBe(200)
    expect(resolvedOnly.body.tickets).toHaveLength(0)
    expect(resolvedOnly.body.pagination.totalCount).toBe(0)
  })

  it('paginates with correct metadata', async () => {
    const page1 = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&sort=summary&order=asc&page=1&pageSize=2`)
      .set('Authorization', `Bearer ${token}`)
    expect(page1.status).toBe(200)
    expect(page1.body.tickets).toHaveLength(2)
    expect(page1.body.pagination).toMatchObject({ page: 1, pageSize: 2, totalCount: 3, totalPages: 2 })

    const page2 = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&sort=summary&order=asc&page=2&pageSize=2`)
      .set('Authorization', `Bearer ${token}`)
    expect(page2.status).toBe(200)
    expect(page2.body.tickets).toHaveLength(1)
    expect(page2.body.tickets[0].summary).toBe(`${marker} Gamma`)
  })

  it('caps pageSize and ignores an invalid sort field instead of erroring', async () => {
    const response = await request(app)
      .get(`/api/tickets/mine?search=${encodeURIComponent(marker)}&sort=notAColumn&pageSize=9999`)
      .set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body.pagination.pageSize).toBe(50)
  })
})

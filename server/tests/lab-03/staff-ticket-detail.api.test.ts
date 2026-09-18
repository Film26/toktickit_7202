import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

// Covers Issue #42 (Ticket Status Workflow) against docs/lab-03/specification.md section 7
// (transition matrix) and section 11 (Acceptance Criteria AC-09, AC-10, AC-11).

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

async function createTicket(token: string, categoryId: number, requestedPriority?: string) {
  const response = await request(app)
    .post('/api/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({
      categoryId,
      summary: 'Lab 3 status workflow test ticket',
      description: 'Created for automated status-transition coverage.',
      ...(requestedPriority ? { requestedPriority } : {}),
    })
  return response.body as { id: number; status: string; requestedPriority: string; itPriority: string | null }
}

describe('ticket status workflow (Issue #42)', () => {
  let requesterToken: string
  let itStaffToken: string
  let categoryId: number

  beforeAll(async () => {
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
    itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')

    const categories = await request(app).get('/api/categories')
    categoryId = categories.body[0].id
  })

  it('AC-11: IT Priority defaults to the submitted Requested Priority at creation', async () => {
    const ticket = await createTicket(requesterToken, categoryId, 'HIGH')
    expect(ticket.requestedPriority).toBe('HIGH')
    expect(ticket.itPriority).toBe('HIGH')
  })

  it('New -> Open via Acknowledge, then Open -> In Progress via Start Progress', async () => {
    const ticket = await createTicket(requesterToken, categoryId)

    const acknowledge = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'OPEN' })
    expect(acknowledge.status).toBe(200)
    expect(acknowledge.body.status).toBe('OPEN')

    const startProgress = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'IN_PROGRESS' })
    expect(startProgress.status).toBe(200)
    expect(startProgress.body.status).toBe('IN_PROGRESS')
  })

  it('New -> In Progress is still allowed directly (existing shortcut preserved)', async () => {
    const ticket = await createTicket(requesterToken, categoryId)
    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'IN_PROGRESS' })
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('IN_PROGRESS')
  })

  it('AC-09: In Progress -> Waiting for Requester -> In Progress (Mark Waiting / Resume Progress)', async () => {
    const ticket = await createTicket(requesterToken, categoryId)
    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'IN_PROGRESS' })

    const waiting = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'WAITING_FOR_REQUESTER' })
    expect(waiting.status).toBe(200)
    expect(waiting.body.status).toBe('WAITING_FOR_REQUESTER')

    const resumed = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'IN_PROGRESS' })
    expect(resumed.status).toBe(200)
    expect(resumed.body.status).toBe('IN_PROGRESS')
  })

  it('resolves directly from Waiting for Requester (not just In Progress)', async () => {
    const ticket = await createTicket(requesterToken, categoryId)
    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'IN_PROGRESS' })
    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'WAITING_FOR_REQUESTER' })

    const resolve = await request(app)
      .post(`/api/tickets/${ticket.id}/resolve`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ resolutionSummary: 'Fixed while waiting on requester confirmation.' })
    expect(resolve.status).toBe(200)
    expect(resolve.body.status).toBe('RESOLVED')
  })

  it('Reopened -> Open via Acknowledge', async () => {
    const ticket = await createTicket(requesterToken, categoryId)
    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'IN_PROGRESS' })
    await request(app)
      .post(`/api/tickets/${ticket.id}/resolve`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ resolutionSummary: 'Resolved.' })
    await request(app)
      .post(`/api/tickets/${ticket.id}/reject-resolution`)
      .set('Authorization', `Bearer ${requesterToken}`)
    // ticket is now REOPENED

    const acknowledge = await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'OPEN' })
    expect(acknowledge.status).toBe(200)
    expect(acknowledge.body.status).toBe('OPEN')
  })

  describe('cancel (New/Open -> Cancelled)', () => {
    it('cancels a New ticket', async () => {
      const ticket = await createTicket(requesterToken, categoryId)
      const response = await request(app)
        .post(`/api/tickets/${ticket.id}/cancel`)
        .set('Authorization', `Bearer ${itStaffToken}`)
      expect(response.status).toBe(200)
      expect(response.body.status).toBe('CANCELLED')
    })

    it('cancels an Open ticket', async () => {
      const ticket = await createTicket(requesterToken, categoryId)
      await request(app)
        .patch(`/api/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${itStaffToken}`)
        .send({ status: 'OPEN' })

      const response = await request(app)
        .post(`/api/tickets/${ticket.id}/cancel`)
        .set('Authorization', `Bearer ${itStaffToken}`)
      expect(response.status).toBe(200)
      expect(response.body.status).toBe('CANCELLED')
    })

    it('rejects cancelling an In Progress ticket', async () => {
      const ticket = await createTicket(requesterToken, categoryId)
      await request(app)
        .patch(`/api/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${itStaffToken}`)
        .send({ status: 'IN_PROGRESS' })

      const response = await request(app)
        .post(`/api/tickets/${ticket.id}/cancel`)
        .set('Authorization', `Bearer ${itStaffToken}`)
      expect(response.status).toBe(409)
    })

    it('rejects cancel from a Requester (role-restricted)', async () => {
      const ticket = await createTicket(requesterToken, categoryId)
      const response = await request(app)
        .post(`/api/tickets/${ticket.id}/cancel`)
        .set('Authorization', `Bearer ${requesterToken}`)
      expect(response.status).toBe(403)
    })

    it('Cancelled is terminal: no further status transition is allowed', async () => {
      const ticket = await createTicket(requesterToken, categoryId)
      await request(app)
        .post(`/api/tickets/${ticket.id}/cancel`)
        .set('Authorization', `Bearer ${itStaffToken}`)

      const response = await request(app)
        .patch(`/api/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${itStaffToken}`)
        .send({ status: 'IN_PROGRESS' })
      expect(response.status).toBe(409)
    })
  })

  describe('AC-10: disallowed transitions are rejected and leave status unchanged', () => {
    it('New -> Closed is rejected directly', async () => {
      const ticket = await createTicket(requesterToken, categoryId)
      const response = await request(app)
        .patch(`/api/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${itStaffToken}`)
        .send({ status: 'CLOSED' })
      expect(response.status).toBe(409)

      const reloaded = await request(app).get(`/api/tickets/${ticket.id}`).set('Authorization', `Bearer ${itStaffToken}`)
      expect(reloaded.body.status).toBe('NEW')
    })

    it('Open -> Waiting for Requester is rejected (must go through In Progress first)', async () => {
      const ticket = await createTicket(requesterToken, categoryId)
      await request(app)
        .patch(`/api/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${itStaffToken}`)
        .send({ status: 'OPEN' })

      const response = await request(app)
        .patch(`/api/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${itStaffToken}`)
        .send({ status: 'WAITING_FOR_REQUESTER' })
      expect(response.status).toBe(409)
    })
  })
})

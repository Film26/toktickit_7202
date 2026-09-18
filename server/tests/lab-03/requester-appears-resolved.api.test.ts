import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

// Covers Issue #43 ("Problem Appears Resolved") against
// docs/lab-03/specification.md BR-05 / FR-20 and AC-07 / AC-08.

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

async function createTicket(token: string, categoryId: number) {
  const response = await request(app)
    .post('/api/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({
      categoryId,
      summary: 'Appears-resolved test ticket',
      description: 'Created for automated appears-resolved coverage.',
    })
  return response.body as { id: number; status: string }
}

describe('requester appears-resolved signal (Issue #43)', () => {
  let requesterToken: string
  let itStaffToken: string
  let adminToken: string
  let categoryId: number

  beforeAll(async () => {
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
    itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
    adminToken = await loginAs('admin@toktickit.dev', 'Admin123!')

    const categories = await request(app).get('/api/categories')
    categoryId = categories.body[0].id
  })

  it('AC-07: sets the flag on a New ticket without changing status', async () => {
    const ticket = await createTicket(requesterToken, categoryId)

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/requester-appears-resolved`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ appearsResolved: true })
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('NEW')
    expect(response.body.requesterAppearsResolvedAt).not.toBeNull()
  })

  it('works while In Progress, and can be toggled back off', async () => {
    const ticket = await createTicket(requesterToken, categoryId)
    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'IN_PROGRESS' })

    const on = await request(app)
      .patch(`/api/tickets/${ticket.id}/requester-appears-resolved`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ appearsResolved: true })
    expect(on.status).toBe(200)
    expect(on.body.status).toBe('IN_PROGRESS')
    expect(on.body.requesterAppearsResolvedAt).not.toBeNull()

    const off = await request(app)
      .patch(`/api/tickets/${ticket.id}/requester-appears-resolved`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ appearsResolved: false })
    expect(off.status).toBe(200)
    expect(off.body.requesterAppearsResolvedAt).toBeNull()
  })

  it('AC-08: is rejected once the ticket is Resolved', async () => {
    const ticket = await createTicket(requesterToken, categoryId)
    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'IN_PROGRESS' })
    await request(app)
      .post(`/api/tickets/${ticket.id}/resolve`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ resolutionSummary: 'Fixed.' })

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/requester-appears-resolved`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ appearsResolved: true })
    expect(response.status).toBe(409)
  })

  it('is rejected once the ticket is Closed', async () => {
    const ticket = await createTicket(requesterToken, categoryId)
    await request(app)
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ status: 'IN_PROGRESS' })
    await request(app)
      .post(`/api/tickets/${ticket.id}/resolve`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ resolutionSummary: 'Fixed.' })
    await request(app)
      .post(`/api/tickets/${ticket.id}/confirm-resolution`)
      .set('Authorization', `Bearer ${requesterToken}`)

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/requester-appears-resolved`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ appearsResolved: true })
    expect(response.status).toBe(409)
  })

  it('never lets the flag itself change status (distinct from Confirm/Reject Resolution)', async () => {
    const ticket = await createTicket(requesterToken, categoryId)
    await request(app)
      .patch(`/api/tickets/${ticket.id}/requester-appears-resolved`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ appearsResolved: true })

    const reloaded = await request(app).get(`/api/tickets/${ticket.id}`).set('Authorization', `Bearer ${requesterToken}`)
    expect(reloaded.body.status).toBe('NEW')
  })

  it('AC-03/BR-03 style: 404s for a Requester acting on another Requester\'s ticket', async () => {
    const ticket = await createTicket(requesterToken, categoryId)

    const email = `other-requester-appears-resolved-${Date.now()}@toktickit.dev`
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

    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/requester-appears-resolved`)
      .set('Authorization', `Bearer ${otherRequesterToken}`)
      .send({ appearsResolved: true })
    expect(response.status).toBe(404)
  })

  it('rejects the endpoint for IT Staff (Requester-only action)', async () => {
    const ticket = await createTicket(requesterToken, categoryId)
    const response = await request(app)
      .patch(`/api/tickets/${ticket.id}/requester-appears-resolved`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ appearsResolved: true })
    expect(response.status).toBe(403)
  })
})

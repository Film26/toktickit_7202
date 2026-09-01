import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

describe('GET /api/tickets/:id - Lab 2 Ticket Detail (Requester view)', () => {
  let requesterToken: string
  let otherRequesterToken: string
  let adminToken: string
  let categoryId: number
  let ticketId: number

  beforeAll(async () => {
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
    adminToken = await loginAs('admin@toktickit.dev', 'Admin123!')

    const categories = await request(app).get('/api/categories')
    categoryId = categories.body[0].id

    const created = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ categoryId, summary: `Lab2 detail ticket ${Date.now()}`, description: 'Detail view test ticket' })
    ticketId = created.body.id

    const email = `other-requester-detail-${Date.now()}@toktickit.dev`
    const otherCreated = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, fullName: 'Other Detail Requester', role: 'REQUESTER' })
    const firstLogin = await request(app).post('/api/auth/login').send({ email, password: otherCreated.body.temporaryPassword })
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${firstLogin.body.token}`)
      .send({ currentPassword: otherCreated.body.temporaryPassword, newPassword: 'OtherDetailRequester123!' })
    otherRequesterToken = (
      await request(app).post('/api/auth/login').send({ email, password: 'OtherDetailRequester123!' })
    ).body.token as string
  })

  it('requires authentication', async () => {
    const response = await request(app).get(`/api/tickets/${ticketId}`)
    expect(response.status).toBe(401)
  })

  it('returns 200 with the full ticket payload for the owning requester', async () => {
    const response = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${requesterToken}`)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ id: ticketId, status: 'NEW' })
    expect(response.body.summary).toMatch(/^Lab2 detail ticket \d+$/)
    expect(response.body.category).toMatchObject({ id: categoryId })
    // requester-facing responses must never carry internal (staff-only) notes
    expect(response.body.internalNotes).toBeUndefined()
  })

  it('404s for a different requester requesting someone else’s ticket (never a 403 that would leak existence)', async () => {
    const response = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${otherRequesterToken}`)
    expect(response.status).toBe(404)
  })

  it('404s for a non-existent ticket id', async () => {
    const response = await request(app).get('/api/tickets/999999999').set('Authorization', `Bearer ${requesterToken}`)
    expect(response.status).toBe(404)
  })

  it('400s for a malformed (non-numeric) ticket id', async () => {
    const response = await request(app).get('/api/tickets/not-a-number').set('Authorization', `Bearer ${requesterToken}`)
    expect(response.status).toBe(400)
  })
})

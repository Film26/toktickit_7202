import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/db'

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

describe('POST /api/tickets - Lab 2 Requester ticket creation', () => {
  let requesterToken: string
  let itStaffToken: string
  let categoryId: number

  beforeAll(async () => {
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
    itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')

    const categories = await request(app).get('/api/categories')
    categoryId = categories.body[0].id
  })

  it('creates a ticket with a unique ticketNumber and NEW status', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ categoryId, summary: `Lab2 create ${Date.now()}`, description: 'Something is broken' })

    expect(response.status).toBe(201)
    expect(response.body.status).toBe('NEW')
    expect(response.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/)

    // a second creation must yield a different ticketNumber
    const second = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ categoryId, summary: `Lab2 create ${Date.now()}`, description: 'Something else is broken' })
    expect(second.status).toBe(201)
    expect(second.body.ticketNumber).not.toBe(response.body.ticketNumber)
  })

  it('defaults requestedPriority to MEDIUM when omitted', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ categoryId, summary: `Lab2 default priority ${Date.now()}`, description: 'x' })

    expect(response.status).toBe(201)
    expect(response.body.requestedPriority).toBe('MEDIUM')
  })

  it('rejects a ticket missing categoryId, summary, or description with 400', async () => {
    const missingCategory = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ summary: 'x', description: 'x' })
    expect(missingCategory.status).toBe(400)

    const missingSummary = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ categoryId, description: 'x' })
    expect(missingSummary.status).toBe(400)

    const missingDescription = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ categoryId, summary: 'x' })
    expect(missingDescription.status).toBe(400)
  })

  it('rejects ticket creation from a non-Requester role', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ categoryId, summary: 'x', description: 'x' })
    expect(response.status).toBe(403)
  })

  it('requires authentication', async () => {
    const response = await request(app).post('/api/tickets').send({ categoryId, summary: 'x', description: 'x' })
    expect(response.status).toBe(401)
  })
})

describe('POST /api/requesters/dev-select - Lab 2 Development Requester Selector', () => {
  it('mints a session for an active Requester, in the same shape as a real login', async () => {
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.dev' } })

    const response = await request(app).post('/api/requesters/dev-select').send({ requesterId: requester.id })

    expect(response.status).toBe(200)
    expect(typeof response.body.token).toBe('string')
    expect(response.body.user).toMatchObject({
      id: requester.id,
      email: 'requester@toktickit.dev',
      fullName: 'Rachel Requester',
      role: 'REQUESTER',
      mustChangePassword: false,
    })

    // the minted token must actually work against a protected route
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${response.body.token}`)
    expect(me.status).toBe(200)
    expect(me.body.user.id).toBe(requester.id)
  })

  it('never returns a password or passwordHash field anywhere in the response (mustChangePassword, a legitimate boolean, is fine)', () =>
    prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.dev' } }).then(async (requester) => {
      const response = await request(app).post('/api/requesters/dev-select').send({ requesterId: requester.id })
      expect(response.body.user).not.toHaveProperty('password')
      expect(response.body.user).not.toHaveProperty('passwordHash')
      expect(Object.keys(response.body.user).sort()).toEqual(['email', 'fullName', 'id', 'mustChangePassword', 'role'])
    }))

  it('404s for an inactive Requester', async () => {
    const inactive = await prisma.user.findUniqueOrThrow({ where: { email: 'inactive-requester@toktickit.dev' } })

    const response = await request(app).post('/api/requesters/dev-select').send({ requesterId: inactive.id })
    expect(response.status).toBe(404)
  })

  it('404s for a requesterId that does not exist', async () => {
    const response = await request(app).post('/api/requesters/dev-select').send({ requesterId: 999_999_999 })
    expect(response.status).toBe(404)
  })

  it('404s for a valid user id that is not a Requester (e.g. IT Staff)', async () => {
    const itStaff = await prisma.user.findUniqueOrThrow({ where: { email: 'itstaff@toktickit.dev' } })

    const response = await request(app).post('/api/requesters/dev-select').send({ requesterId: itStaff.id })
    expect(response.status).toBe(404)
  })

  it('400s for a missing or invalid requesterId', async () => {
    const missing = await request(app).post('/api/requesters/dev-select').send({})
    expect(missing.status).toBe(400)

    const wrongType = await request(app).post('/api/requesters/dev-select').send({ requesterId: 'not-a-number' })
    expect(wrongType.status).toBe(400)

    const negative = await request(app).post('/api/requesters/dev-select').send({ requesterId: -1 })
    expect(negative.status).toBe(400)
  })

  it('requires no Authorization header - this is the pre-login entry point', async () => {
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.dev' } })
    const response = await request(app).post('/api/requesters/dev-select').send({ requesterId: requester.id })
    expect(response.status).toBe(200)
  })
})

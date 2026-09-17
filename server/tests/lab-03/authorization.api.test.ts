import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/app'

// Systematic authorization sweep for Issue #47, against
// docs/lab-03/specification.md section 6.2 / 4.3 and api-spec.md's safe-error
// table. Covers AC-03, AC-04, AC-15, AC-16, AC-18. Endpoint-specific business
// logic (ownership rules for a given action, status guards, etc.) is tested
// alongside that feature elsewhere -- this file is only about the
// authentication/authorization boundary itself: who is let in, who is
// turned away, and what they're told.

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

async function createTicket(token: string, categoryId: number) {
  const response = await request(app)
    .post('/api/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId, summary: 'Authorization sweep ticket', description: 'Created for AuthZ coverage.' })
  return response.body.id as number
}

describe('authorization boundary (Issue #47)', () => {
  let requesterToken: string
  let itStaffToken: string
  let adminToken: string
  let categoryId: number
  let ownTicketId: number

  beforeAll(async () => {
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
    itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
    adminToken = await loginAs('admin@toktickit.dev', 'Admin123!')

    const categories = await request(app).get('/api/categories')
    categoryId = categories.body[0].id
    ownTicketId = await createTicket(requesterToken, categoryId)
  })

  describe('no token', () => {
    const protectedRequests: Array<[string, string]> = [
      ['GET', '/api/tickets/mine'],
      ['GET', '/api/tickets'],
      ['POST', '/api/tickets'],
      ['GET', '/api/tickets/1'],
      ['PATCH', '/api/tickets/1/owner'],
      ['POST', '/api/tickets/1/notes'],
      ['POST', '/api/tickets/1/comments'],
      ['GET', '/api/users'],
      ['POST', '/api/users'],
    ]

    it.each(protectedRequests)('%s %s -> 401 without a token', async (method, path) => {
      const response = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[
        method.toLowerCase()
      ](path)
      expect(response.status).toBe(401)
    })
  })

  it('rejects a malformed/garbage token with 401', async () => {
    const response = await request(app).get('/api/tickets/mine').set('Authorization', 'Bearer not-a-real-token')
    expect(response.status).toBe(401)
  })

  it('AC-18: rejects a syntactically valid but expired token with 401', async () => {
    const expired = jwt.sign({ userId: 1 }, process.env.JWT_SECRET as string, { expiresIn: -10 })
    const response = await request(app).get('/api/tickets/mine').set('Authorization', `Bearer ${expired}`)
    expect(response.status).toBe(401)
  })

  it('AC-18: rejects a still-valid (unexpired) token once the account is deactivated', async () => {
    const email = `deactivate-midsession-${Date.now()}@toktickit.dev`
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, fullName: 'Deactivate Midsession', role: 'REQUESTER' })
    const firstLogin = await request(app).post('/api/auth/login').send({ email, password: created.body.temporaryPassword })
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${firstLogin.body.token}`)
      .send({ currentPassword: created.body.temporaryPassword, newPassword: 'DeactivateMe123!' })
    const validToken = (await request(app).post('/api/auth/login').send({ email, password: 'DeactivateMe123!' })).body
      .token as string

    // token still cryptographically valid and unexpired at this point
    const beforeDeactivation = await request(app).get('/api/tickets/mine').set('Authorization', `Bearer ${validToken}`)
    expect(beforeDeactivation.status).toBe(200)

    await request(app)
      .patch(`/api/users/${created.body.user.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })

    const afterDeactivation = await request(app).get('/api/tickets/mine').set('Authorization', `Bearer ${validToken}`)
    expect(afterDeactivation.status).toBe(401)
  })

  describe('wrong role (403), by endpoint', () => {
    const cases: Array<[string, string, string, () => string]> = [
      ['Requester', 'GET', '/api/tickets', () => requesterToken],
      ['Requester', 'PATCH', '/api/tickets/1/owner', () => requesterToken],
      ['Requester', 'PATCH', '/api/tickets/1/it-priority', () => requesterToken],
      ['Requester', 'PATCH', '/api/tickets/1/status', () => requesterToken],
      ['Requester', 'POST', '/api/tickets/1/resolve', () => requesterToken],
      ['Requester', 'POST', '/api/tickets/1/close', () => requesterToken],
      ['Requester', 'POST', '/api/tickets/1/notes', () => requesterToken],
      ['Requester', 'GET', '/api/users', () => requesterToken],
      ['IT Staff', 'POST', '/api/tickets', () => itStaffToken],
      ['IT Staff', 'PATCH', '/api/tickets/1/priority', () => itStaffToken],
      ['IT Staff', 'POST', '/api/tickets/1/confirm-resolution', () => itStaffToken],
      ['IT Staff', 'POST', '/api/tickets/1/reject-resolution', () => itStaffToken],
      ['IT Staff', 'POST', '/api/tickets/1/request-reopen', () => itStaffToken],
      ['IT Staff', 'GET', '/api/users', () => itStaffToken],
      ['IT Staff', 'POST', '/api/users', () => itStaffToken],
    ]

    it.each(cases)('%s -> %s %s is forbidden', async (_role, method, path, getToken) => {
      const response = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[
        method.toLowerCase()
      ](path).set('Authorization', `Bearer ${getToken()}`)
      expect(response.status).toBe(403)
    })
  })

  describe('AC-15: non-Administrator hitting /api/users/*', () => {
    it('IT Staff cannot list, create, edit, or reset-password on users', async () => {
      const list = await request(app).get('/api/users').set('Authorization', `Bearer ${itStaffToken}`)
      expect(list.status).toBe(403)

      const create = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itStaffToken}`)
        .send({ email: 'irrelevant@toktickit.dev', fullName: 'Irrelevant', role: 'REQUESTER' })
      expect(create.status).toBe(403)

      const edit = await request(app)
        .patch('/api/users/1')
        .set('Authorization', `Bearer ${itStaffToken}`)
        .send({ fullName: 'Should Not Apply' })
      expect(edit.status).toBe(403)

      const resetPassword = await request(app)
        .post('/api/users/1/reset-password')
        .set('Authorization', `Bearer ${itStaffToken}`)
      expect(resetPassword.status).toBe(403)
    })

    it('Requester cannot access /api/users/* either', async () => {
      const response = await request(app).get('/api/users').set('Authorization', `Bearer ${requesterToken}`)
      expect(response.status).toBe(403)
    })
  })

  describe('AC-04: Requester cannot reach Internal Notes, and no note content leaks', () => {
    it('rejects POST notes with 403 and no note body echoed back', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ownTicketId}/notes`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ body: 'a private note the requester should never see' })
      expect(response.status).toBe(403)
      expect(JSON.stringify(response.body)).not.toContain('a private note')
    })

    it('the ticket payload served to the owning Requester has no internalNotes key at all', async () => {
      const response = await request(app)
        .get(`/api/tickets/${ownTicketId}`)
        .set('Authorization', `Bearer ${requesterToken}`)
      expect(response.status).toBe(200)
      expect(response.body.internalNotes).toBeUndefined()
    })
  })

  describe('AC-03/AC-16: ownership boundary uses the authenticated identity, not client input', () => {
    let otherRequesterToken: string

    beforeAll(async () => {
      const email = `authz-other-requester-${Date.now()}@toktickit.dev`
      const created = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, fullName: 'AuthZ Other Requester', role: 'REQUESTER' })
      const firstLogin = await request(app).post('/api/auth/login').send({ email, password: created.body.temporaryPassword })
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${firstLogin.body.token}`)
        .send({ currentPassword: created.body.temporaryPassword, newPassword: 'AuthzOther123!' })
      otherRequesterToken = (await request(app).post('/api/auth/login').send({ email, password: 'AuthzOther123!' })).body
        .token as string
    })

    it('a different Requester gets 404 (not 403, not 200) for GET /:id', async () => {
      const response = await request(app)
        .get(`/api/tickets/${ownTicketId}`)
        .set('Authorization', `Bearer ${otherRequesterToken}`)
      expect(response.status).toBe(404)
    })

    it('a different Requester gets 404 for a Requester-only action on someone else\'s ticket', async () => {
      const response = await request(app)
        .patch(`/api/tickets/${ownTicketId}/priority`)
        .set('Authorization', `Bearer ${otherRequesterToken}`)
        .send({ requestedPriority: 'HIGH' })
      expect(response.status).toBe(404)
    })

    it('the 404 body for "not yours" is identical in shape to the 404 for "does not exist"', async () => {
      const notMineResponse = await request(app)
        .get(`/api/tickets/${ownTicketId}`)
        .set('Authorization', `Bearer ${otherRequesterToken}`)
      const doesNotExistResponse = await request(app)
        .get('/api/tickets/999999999')
        .set('Authorization', `Bearer ${otherRequesterToken}`)

      expect(notMineResponse.status).toBe(404)
      expect(doesNotExistResponse.status).toBe(404)
      expect(Object.keys(notMineResponse.body)).toEqual(Object.keys(doesNotExistResponse.body))
    })
  })

  describe('IT Staff / Administrator authorization matrix (deliberate decision, spec section 11.1)', () => {
    it('Administrator has full IT Staff ticket capability, not just user management', async () => {
      const queue = await request(app).get('/api/tickets').set('Authorization', `Bearer ${adminToken}`)
      expect(queue.status).toBe(200)

      const claim = await request(app)
        .patch(`/api/tickets/${ownTicketId}/owner`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ownerId: null })
      expect(claim.status).toBe(200)
    })
  })
})

import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

// GET /api/tickets/assignable-owners (bug found via Lab 3 E2E testing, Issue
// #49): the Owner-reassignment dropdown in TicketDetailView.tsx used to call
// GET /api/users, which is Administrator-only (AC-15) - so a plain IT Staff
// session could never populate it, even though FR-12/BR-10 require IT Staff
// to be able to claim/reassign ownership. This is the staff-accessible
// replacement.

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

describe('GET /api/tickets/assignable-owners', () => {
  it('an IT Staff session (not just Administrator) can list assignable owners', async () => {
    const itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
    const response = await request(app)
      .get('/api/tickets/assignable-owners')
      .set('Authorization', `Bearer ${itStaffToken}`)

    expect(response.status).toBe(200)
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body.length).toBeGreaterThan(0)
    for (const owner of response.body) {
      expect(owner).toHaveProperty('id')
      expect(owner).toHaveProperty('fullName')
      expect(owner).not.toHaveProperty('email')
      expect(owner).not.toHaveProperty('role')
    }
  })

  it('only returns active IT_STAFF/ADMINISTRATOR users, never Requesters or inactive staff', async () => {
    const itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
    const response = await request(app)
      .get('/api/tickets/assignable-owners')
      .set('Authorization', `Bearer ${itStaffToken}`)

    const names = response.body.map((owner: { fullName: string }) => owner.fullName)
    expect(names).not.toContain('Rachel Requester')
    expect(names).not.toContain('Ian Inactive')
  })

  it('a Requester is rejected', async () => {
    const requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
    const response = await request(app)
      .get('/api/tickets/assignable-owners')
      .set('Authorization', `Bearer ${requesterToken}`)

    expect(response.status).toBe(403)
  })

  it('an unauthenticated request is rejected', async () => {
    const response = await request(app).get('/api/tickets/assignable-owners')
    expect(response.status).toBe(401)
  })
})

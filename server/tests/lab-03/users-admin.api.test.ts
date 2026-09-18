import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

// Covers Issue #45 (Administrator safety rules) against docs/lab-03/specification.md
// section 6 (BR-16, BR-17, BR-18) and section 11 (AC-12, AC-13).

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

describe('administrator safety rules (Issue #45)', () => {
  let adminToken: string
  let adminId: number
  let itStaffToken: string
  let requesterToken: string

  beforeAll(async () => {
    adminToken = await loginAs('admin@toktickit.dev', 'Admin123!')
    itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`)
    adminId = me.body.user.id
  })

  // Runs first, deliberately, while the seeded admin is still the only active
  // Administrator in the test database -- later tests in this file create and
  // demote a second admin, which would invalidate this assumption if it ran later.
  it('AC-13/BR-17: blocks self role-change away from Administrator while sole active Administrator', async () => {
    const response = await request(app)
      .patch(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'IT_STAFF' })
    expect(response.status).toBe(409)
    expect(response.body.error).toMatch(/last active administrator/i)

    const reloaded = await request(app).get(`/api/users/${adminId}`).set('Authorization', `Bearer ${adminToken}`)
    expect(reloaded.body.role).toBe('ADMINISTRATOR')
  })

  it('AC-12/BR-16: blocks an Administrator from deactivating their own account', async () => {
    const response = await request(app)
      .patch(`/api/users/${adminId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
    expect(response.status).toBe(403)
    expect(response.body.error).toMatch(/own account/i)

    const reloaded = await request(app).get(`/api/users/${adminId}`).set('Authorization', `Bearer ${adminToken}`)
    expect(reloaded.body.isActive).toBe(true)
  })

  it('allows demoting a different Administrator when another active Administrator remains', async () => {
    const email = `second-admin-${Date.now()}@toktickit.dev`
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, fullName: 'Second Admin', role: 'ADMINISTRATOR' })
    expect(created.status).toBe(201)
    const secondAdminId = created.body.user.id as number

    // demoting the second admin is fine -- the seeded admin is still active
    const demote = await request(app)
      .patch(`/api/users/${secondAdminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'IT_STAFF' })
    expect(demote.status).toBe(200)
    expect(demote.body.role).toBe('IT_STAFF')
  })

  it('BR-18: rejects a duplicate email on edit, not just on create', async () => {
    const emailA = `dup-a-${Date.now()}@toktickit.dev`
    const emailB = `dup-b-${Date.now()}@toktickit.dev`
    const userA = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: emailA, fullName: 'Dup A', role: 'REQUESTER' })
    const userB = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: emailB, fullName: 'Dup B', role: 'REQUESTER' })

    const response = await request(app)
      .patch(`/api/users/${userB.body.user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: userA.body.user.email })
    expect(response.status).toBe(409)
  })

  it('FR-24: creates a user with an explicit inactive activation state', async () => {
    const email = `inactive-on-create-${Date.now()}@toktickit.dev`
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, fullName: 'Inactive On Create', role: 'REQUESTER', isActive: false })
    expect(created.status).toBe(201)
    expect(created.body.user.isActive).toBe(false)

    const loginAttempt = await request(app)
      .post('/api/auth/login')
      .send({ email, password: created.body.temporaryPassword })
    expect(loginAttempt.status).toBe(401)
  })

  it('defaults to active when isActive is omitted on create', async () => {
    const email = `active-default-${Date.now()}@toktickit.dev`
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, fullName: 'Active Default', role: 'REQUESTER' })
    expect(created.status).toBe(201)
    expect(created.body.user.isActive).toBe(true)
  })

  it('filters the user list by role', async () => {
    const response = await request(app)
      .get('/api/users?role=ADMINISTRATOR')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(response.status).toBe(200)
    expect(response.body.length).toBeGreaterThan(0)
    expect(response.body.every((user: { role: string }) => user.role === 'ADMINISTRATOR')).toBe(true)
  })

  it('rejects non-Administrator access to the user management API', async () => {
    const staffAttempt = await request(app).get('/api/users').set('Authorization', `Bearer ${itStaffToken}`)
    expect(staffAttempt.status).toBe(403)

    const requesterAttempt = await request(app).get('/api/users').set('Authorization', `Bearer ${requesterToken}`)
    expect(requesterAttempt.status).toBe(403)
  })

  it('regression: a normal (non-last-admin) deactivation still works via first login', async () => {
    const email = `regression-deactivate-${Date.now()}@toktickit.dev`
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, fullName: 'Regression Target', role: 'REQUESTER' })

    const deactivate = await request(app)
      .patch(`/api/users/${created.body.user.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
    expect(deactivate.status).toBe(200)
    expect(deactivate.body.isActive).toBe(false)

    const loginAttempt = await request(app)
      .post('/api/auth/login')
      .send({ email, password: created.body.temporaryPassword })
    expect(loginAttempt.status).toBe(401)
  })
})

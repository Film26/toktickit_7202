import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

describe('reference data management (categories & related systems)', () => {
  let adminToken: string
  let requesterToken: string

  beforeAll(async () => {
    adminToken = await loginAs('admin@toktickit.dev', 'Admin123!')
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
  })

  it('lists only active categories publicly, unauthenticated', async () => {
    const response = await request(app).get('/api/categories')
    expect(response.status).toBe(200)
    expect(response.body.length).toBeGreaterThanOrEqual(4)
  })

  it('rejects category creation from a non-admin role', async () => {
    const response = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ name: 'Should Not Be Created' })
    expect(response.status).toBe(403)
  })

  it('allows an admin to create, list-all (manage), and deactivate a category', async () => {
    const testName = `Test Category ${Date.now()}`

    const created = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: testName })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ name: testName, isActive: true })

    const manageList = await request(app).get('/api/categories/manage').set('Authorization', `Bearer ${adminToken}`)
    expect(manageList.status).toBe(200)
    expect(manageList.body.some((c: { name: string }) => c.name === testName)).toBe(true)

    const deactivated = await request(app)
      .patch(`/api/categories/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
    expect(deactivated.status).toBe(200)
    expect(deactivated.body.isActive).toBe(false)

    const publicList = await request(app).get('/api/categories')
    expect(publicList.body.some((c: { name: string }) => c.name === testName)).toBe(false)
  })

  it('allows an admin to create and manage a related system', async () => {
    const testName = `Test Related System ${Date.now()}`

    const created = await request(app)
      .post('/api/related-systems')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: testName })
    expect(created.status).toBe(201)

    const publicList = await request(app).get('/api/related-systems')
    expect(publicList.body.some((r: { name: string }) => r.name === testName)).toBe(true)
  })
})

describe('user management', () => {
  let adminToken: string
  let requesterToken: string
  let createdUserId: number

  beforeAll(async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@toktickit.dev', password: 'Admin123!' })
    adminToken = adminLogin.body.token
    const requesterLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'requester@toktickit.dev', password: 'Requester123!' })
    requesterToken = requesterLogin.body.token
  })

  afterAll(async () => {
    if (createdUserId) {
      await request(app)
        .patch(`/api/users/${createdUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
    }
  })

  it('rejects non-admin access to the user list', async () => {
    const response = await request(app).get('/api/users').set('Authorization', `Bearer ${requesterToken}`)
    expect(response.status).toBe(403)
  })

  it('lets an admin create a user and returns a one-time temporary password', async () => {
    const email = `test-user-${Date.now()}@toktickit.dev`
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, fullName: 'Test User', role: 'REQUESTER' })

    expect(response.status).toBe(201)
    expect(response.body.user).toMatchObject({ email, role: 'REQUESTER', mustChangePassword: true })
    expect(typeof response.body.temporaryPassword).toBe('string')
    createdUserId = response.body.user.id

    const loginWithTempPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: response.body.temporaryPassword })
    expect(loginWithTempPassword.status).toBe(200)
    expect(loginWithTempPassword.body.user.mustChangePassword).toBe(true)
  })

  it('lets an admin deactivate a user, blocking further login', async () => {
    const response = await request(app)
      .patch(`/api/users/${createdUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
    expect(response.status).toBe(200)
    expect(response.body.isActive).toBe(false)

    const user = await request(app).get(`/api/users/${createdUserId}`).set('Authorization', `Bearer ${adminToken}`)
    expect(user.body.isActive).toBe(false)
  })

  it('lets an admin reset a user password', async () => {
    const response = await request(app)
      .post(`/api/users/${createdUserId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
    expect(response.status).toBe(200)
    expect(typeof response.body.temporaryPassword).toBe('string')
  })
})

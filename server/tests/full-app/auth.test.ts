import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/db'

describe('POST /api/auth/login', () => {
  it('returns a token and user profile for valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@toktickit.dev', password: 'Admin123!' })

    expect(response.status).toBe(200)
    expect(typeof response.body.token).toBe('string')
    expect(response.body.user).toMatchObject({
      email: 'admin@toktickit.dev',
      role: 'ADMINISTRATOR',
      mustChangePassword: false,
    })
  })

  it('rejects an incorrect password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@toktickit.dev', password: 'wrong-password' })

    expect(response.status).toBe(401)
  })

  it('rejects an unknown email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@toktickit.dev', password: 'Admin123!' })

    expect(response.status).toBe(401)
  })

  it('rejects a correct password for a deactivated (inactive) user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive-requester@toktickit.dev', password: 'InactiveRequester123!' })

    expect(response.status).toBe(401)
  })

  it('rejects a malformed request body', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'not-an-email' })

    expect(response.status).toBe(400)
  })
})

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'itstaff@toktickit.dev', password: 'ItStaff123!' })

    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`)

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({ email: 'itstaff@toktickit.dev', role: 'IT_STAFF' })
  })

  it('rejects a request with no Authorization header', async () => {
    const response = await request(app).get('/api/auth/me')
    expect(response.status).toBe(401)
  })

  it('rejects an invalid token', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token')
    expect(response.status).toBe(401)
  })
})

describe('POST /api/auth/change-password', () => {
  // this suite mutates newuser@toktickit.dev; always restore its seeded
  // state (password + mustChangePassword) so the suite is repeatable
  afterAll(async () => {
    await prisma.user.update({
      where: { email: 'newuser@toktickit.dev' },
      data: { mustChangePassword: true },
    })
  })

  it('changes the password and clears mustChangePassword', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'newuser@toktickit.dev', password: 'TempPass123!' })
    expect(login.body.user.mustChangePassword).toBe(true)

    const changeResponse = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ currentPassword: 'TempPass123!', newPassword: 'NewPassword456!' })

    expect(changeResponse.status).toBe(200)

    const reLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'newuser@toktickit.dev', password: 'NewPassword456!' })

    expect(reLogin.status).toBe(200)
    expect(reLogin.body.user.mustChangePassword).toBe(false)

    // restore original password so this test is repeatable across runs
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${reLogin.body.token}`)
      .send({ currentPassword: 'NewPassword456!', newPassword: 'TempPass123!' })
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'newuser@toktickit.dev', password: 'TempPass123!' })
  })

  it('rejects an incorrect current password', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'requester@toktickit.dev', password: 'Requester123!' })

    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ currentPassword: 'wrong', newPassword: 'SomethingNew123!' })

    expect(response.status).toBe(401)
  })
})

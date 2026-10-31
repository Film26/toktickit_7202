import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

// REG-05 (docs/lab-04/tests.md, Issue #79). The Lab 2 Development Requester
// Selector endpoints are testing tools: they must not exist in production,
// where one lists every Requester's name/email without signing in and the
// other issues a session without a password.

const originalEnv = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = originalEnv
})

describe('Development Requester Selector endpoints in production', () => {
  it('GET /api/requesters returns 404 and no data', async () => {
    process.env.NODE_ENV = 'production'
    const response = await request(app).get('/api/requesters')
    expect(response.status).toBe(404)
    expect(JSON.stringify(response.body)).not.toContain('@')
  })

  it('POST /api/requesters/dev-select does not issue a token', async () => {
    process.env.NODE_ENV = 'production'
    const response = await request(app).post('/api/requesters/dev-select').send({ requesterId: 1 })
    expect(response.status).toBe(404)
    expect(response.body).not.toHaveProperty('token')
  })

  it('both still work in development/test (Lab 2 regression)', async () => {
    const response = await request(app).get('/api/requesters')
    expect(response.status).toBe(200)
    expect(response.body.length).toBeGreaterThan(0)
  })
})

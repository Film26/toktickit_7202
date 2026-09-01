import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

describe('GET /api/requesters', () => {
  it('is public - no Authorization header required', async () => {
    const response = await request(app).get('/api/requesters')
    expect(response.status).toBe(200)
  })

  it('returns only active Requester accounts, excluding the seeded inactive one', async () => {
    const response = await request(app).get('/api/requesters')
    expect(response.status).toBe(200)
    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body.some((r: { email: string }) => r.email === 'requester@toktickit.dev')).toBe(true)
    expect(response.body.every((r: { email: string }) => r.email !== 'inactive-requester@toktickit.dev')).toBe(true)
  })

  it('never exposes a password or passwordHash field', async () => {
    const response = await request(app).get('/api/requesters')
    for (const requester of response.body) {
      expect(requester).not.toHaveProperty('password')
      expect(requester).not.toHaveProperty('passwordHash')
      expect(Object.keys(requester).sort()).toEqual(['email', 'fullName', 'id'])
    }
  })

  it('excludes IT Staff and Administrator accounts', async () => {
    const response = await request(app).get('/api/requesters')
    expect(response.body.some((r: { email: string }) => r.email === 'itstaff@toktickit.dev')).toBe(false)
    expect(response.body.some((r: { email: string }) => r.email === 'admin@toktickit.dev')).toBe(false)
  })
})

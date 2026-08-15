import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

describe('GET /api/health', () => {
  it('returns 200 with status ok and the service name', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok', service: 'TokTickIT API' })
  })
})
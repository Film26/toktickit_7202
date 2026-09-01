import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

describe('app foundation', () => {
  it('boots and responds to requests', async () => {
    const response = await request(app).get('/')
    expect(response.status).toBe(404)
  })
})
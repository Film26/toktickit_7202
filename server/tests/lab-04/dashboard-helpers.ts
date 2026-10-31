import request from 'supertest'
import bcrypt from 'bcryptjs'
import app from '../../src/app'
import prisma from '../../src/db'

export async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

// A brand-new account with no tickets, for the empty-dashboard checks (AC-17).
export async function createFreshUser(role: 'REQUESTER' | 'IT_STAFF') {
  const email = `lab4-empty-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@toktickit.dev`
  const password = 'FreshUser123!'
  await prisma.user.create({
    data: { email, fullName: 'Empty Dashboard User', role, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: false },
  })
  return loginAs(email, password)
}

// Converts a drill-down link like "/queue?status=NEW&ownerId=me" into the
// list API call it stands for and returns that list's totalCount (AC-18).
export async function drillDownCount(drillDown: string, token: string) {
  const [path, query = ''] = drillDown.split('?')
  const endpoint = path === '/tickets' ? '/api/tickets/mine' : '/api/tickets'
  const response = await request(app).get(`${endpoint}?${query}&pageSize=1`).set(auth(token))
  if (response.status !== 200) throw new Error(`drill-down ${drillDown} -> ${response.status}`)
  return response.body.pagination.totalCount as number
}

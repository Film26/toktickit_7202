import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/db'
import { OPEN_STATUS_GROUP } from '../../src/lib/ticketFilters'
import { auth, createFreshUser, drillDownCount, loginAs } from './dashboard-helpers'

// Issue #68 -- Requester Dashboard API. DASH-01..DASH-04 in docs/lab-04/tests.md.

type Metric = { key: string; value: number; drillDown: string; todayDelta: number | null }
type Card = { id: number; status: string }

let rachelToken: string
let jenniferToken: string
let itStaffToken: string
let rachelId: number

beforeAll(async () => {
  rachelToken = await loginAs('requester@toktickit.dev', 'Requester123!')
  jenniferToken = await loginAs('jennifer.anderson@toktickit.dev', 'Jennifer123!')
  itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
  rachelId = (await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.dev' } })).id
})

const getDashboard = (token: string) => request(app).get('/api/dashboard/requester').set(auth(token))

describe('Requester Dashboard', () => {
  it('DASH-01 / AC-02: every metric equals the database count for this Requester only', async () => {
    const response = await getDashboard(rachelToken)
    expect(response.status).toBe(200)
    expect(response.body.timeZone).toBe('Asia/Bangkok')

    const metrics = Object.fromEntries((response.body.metrics as Metric[]).map((m) => [m.key, m.value]))
    const mine = { requesterId: rachelId }
    expect(metrics).toEqual({
      open: await prisma.ticket.count({ where: { ...mine, status: { in: OPEN_STATUS_GROUP } } }),
      inProgress: await prisma.ticket.count({ where: { ...mine, status: 'IN_PROGRESS' } }),
      waitingForMe: await prisma.ticket.count({ where: { ...mine, status: 'WAITING_FOR_REQUESTER' } }),
      resolved: await prisma.ticket.count({ where: { ...mine, status: 'RESOLVED' } }),
      closed: await prisma.ticket.count({ where: { ...mine, status: 'CLOSED' } }),
    })
    expect(metrics.waitingForMe).toBeGreaterThan(0) // seed TKT-SAMPLE-000008
  })

  it('DASH-01 / AC-02: lists hold only own tickets, at most 5, with summary fields only', async () => {
    const [rachel, jennifer] = await Promise.all([getDashboard(rachelToken), getDashboard(jenniferToken)])
    const rachelIds = new Set((await prisma.ticket.findMany({ where: { requesterId: rachelId }, select: { id: true } })).map((t) => t.id))

    for (const list of ['attentionRequired', 'recentTickets', 'recentlyResolved'] as const) {
      expect(rachel.body[list].length).toBeLessThanOrEqual(5)
      for (const card of rachel.body[list] as Card[]) expect(rachelIds.has(card.id)).toBe(true)
      for (const card of jennifer.body[list] as Card[]) expect(rachelIds.has(card.id)).toBe(false)
    }
    expect(Object.keys(rachel.body.recentTickets[0]).sort()).toEqual(
      ['id', 'itPriority', 'resolvedAt', 'status', 'summary', 'ticketNumber', 'updatedAt'].sort(),
    )
    for (const card of rachel.body.attentionRequired as Card[]) {
      expect(['WAITING_FOR_REQUESTER', 'RESOLVED']).toContain(card.status)
    }
  })

  it('DASH-04 / AC-18: each metric drill-down opens a list whose total equals the metric', async () => {
    const response = await getDashboard(rachelToken)
    for (const metric of response.body.metrics as Metric[]) {
      const count = await drillDownCount(metric.drillDown, rachelToken)
      expect({ key: metric.key, count }).toEqual({ key: metric.key, count: metric.value })
    }
  })

  it('DASH-03 / AC-17: a Requester with no tickets gets zeros and empty lists, not an error', async () => {
    const token = await createFreshUser('REQUESTER')
    const response = await getDashboard(token)
    expect(response.status).toBe(200)
    expect(response.body.metrics).toHaveLength(5)
    expect((response.body.metrics as Metric[]).every((m) => m.value === 0)).toBe(true)
    expect(response.body.attentionRequired).toEqual([])
    expect(response.body.recentTickets).toEqual([])
    expect(response.body.recentlyResolved).toEqual([])
  })

  it('DASH-02 / AC-16: IT Staff get 403 and an anonymous caller gets 401', async () => {
    expect((await getDashboard(itStaffToken)).status).toBe(403)
    expect((await request(app).get('/api/dashboard/requester')).status).toBe(401)
  })
})

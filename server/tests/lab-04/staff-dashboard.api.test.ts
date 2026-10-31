import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/db'
import { OPEN_STATUS_GROUP } from '../../src/lib/ticketFilters'
import { auth, createFreshUser, drillDownCount, loginAs } from './dashboard-helpers'

// Issue #68 -- IT Staff / Administrator Dashboard API.
// DASH-05..DASH-10 and PERF-01 in docs/lab-04/tests.md.

type Metric = { key: string; value: number; drillDown: string; todayDelta: number | null }

let itStaffToken: string
let marcusToken: string
let adminToken: string
let requesterToken: string
let itStaffId: number
let marcusId: number

beforeAll(async () => {
  itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
  marcusToken = await loginAs('marcus.tan@toktickit.dev', 'MarcusTan123!')
  adminToken = await loginAs('admin@toktickit.dev', 'Admin123!')
  requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
  itStaffId = (await prisma.user.findUniqueOrThrow({ where: { email: 'itstaff@toktickit.dev' } })).id
  marcusId = (await prisma.user.findUniqueOrThrow({ where: { email: 'marcus.tan@toktickit.dev' } })).id
})

const getDashboard = (token: string) => request(app).get('/api/dashboard/staff').set(auth(token))
const byKey = (metrics: Metric[]) => Object.fromEntries(metrics.map((m) => [m.key, m]))
const OPEN = { status: { in: OPEN_STATUS_GROUP } }

describe('IT Staff Dashboard', () => {
  it('DASH-05 / AC-15: metrics equal database counts', async () => {
    const response = await getDashboard(itStaffToken)
    expect(response.status).toBe(200)
    const m = byKey(response.body.metrics)

    expect(m.new.value).toBe(await prisma.ticket.count({ where: { status: 'NEW' } }))
    expect(m.open.value).toBe(await prisma.ticket.count({ where: { status: 'OPEN' } }))
    expect(m.inProgress.value).toBe(await prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }))
    expect(m.waitingForRequester.value).toBe(await prisma.ticket.count({ where: { status: 'WAITING_FOR_REQUESTER' } }))
    expect(m.myAssigned.value).toBe(await prisma.ticket.count({ where: { ...OPEN, ownerId: itStaffId } }))
    expect(m.unassigned.value).toBe(await prisma.ticket.count({ where: { ...OPEN, ownerId: null } }))

    const priorities = Object.fromEntries(
      (response.body.byItPriority as Array<{ priority: string; value: number }>).map((p) => [p.priority, p.value]),
    )
    expect(priorities.URGENT).toBe(await prisma.ticket.count({ where: { ...OPEN, itPriority: 'URGENT' } }))
    expect(priorities.unset).toBe(await prisma.ticket.count({ where: { ...OPEN, itPriority: null } }))
  })

  it('DASH-06 / AC-15: My Assigned, recent tickets and My Open Actions are per signed-in user', async () => {
    const [ivy, marcus] = await Promise.all([getDashboard(itStaffToken), getDashboard(marcusToken)])

    expect(byKey(marcus.body.metrics).myAssigned.value).toBe(await prisma.ticket.count({ where: { ...OPEN, ownerId: marcusId } }))

    const ivyOpenActions = await prisma.actionTaken.count({
      where: { assigneeId: itStaffId, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
    })
    expect(ivy.body.myOpenActions.total).toBe(ivyOpenActions)
    expect(ivyOpenActions).toBeGreaterThan(0) // seed: planned battery install
    expect(ivy.body.myOpenActions.items).toHaveLength(Math.min(5, ivyOpenActions))
    expect(ivy.body.myOpenActions.items[0]).toHaveProperty('ticketNumber')

    const ivyIds = new Set((await prisma.ticket.findMany({ where: { ownerId: itStaffId }, select: { id: true } })).map((t) => t.id))
    for (const card of ivy.body.recentTickets as Array<{ id: number }>) expect(ivyIds.has(card.id)).toBe(true)
  })

  it('DASH-07 / AC-18: each metric and priority drill-down opens a list whose total equals the value', async () => {
    const response = await getDashboard(itStaffToken)
    for (const item of [...response.body.metrics, ...response.body.byItPriority] as Array<{ value: number; drillDown: string }>) {
      const count = await drillDownCount(item.drillDown, itStaffToken)
      expect({ link: item.drillDown, count }).toEqual({ link: item.drillDown, count: item.value })
    }
  })

  it('DASH-08 / AC-19: Administrators get user counts; IT Staff get null', async () => {
    const [staff, admin] = await Promise.all([getDashboard(itStaffToken), getDashboard(adminToken)])
    expect(staff.body.userCounts).toBeNull()
    expect(admin.status).toBe(200)
    expect(admin.body.userCounts).toEqual({
      activeRequesters: await prisma.user.count({ where: { role: 'REQUESTER', isActive: true } }),
      activeItStaff: await prisma.user.count({ where: { role: 'IT_STAFF', isActive: true } }),
      activeAdministrators: await prisma.user.count({ where: { role: 'ADMINISTRATOR', isActive: true } }),
      inactive: await prisma.user.count({ where: { isActive: false } }),
    })
  })

  it('DASH-09 / AC-16: Requesters get 403', async () => {
    expect((await getDashboard(requesterToken)).status).toBe(403)
  })

  it('DASH-10 / BR-22: a transition made now counts toward that status "+N today"', async () => {
    const before = byKey((await getDashboard(itStaffToken)).body.metrics)
    const categoryId = (await request(app).get('/api/categories')).body[0].id
    const ticket = await request(app)
      .post('/api/tickets')
      .set(auth(requesterToken))
      .send({ categoryId, summary: 'Dashboard delta ticket', description: 'Counts toward +N today.' })
    await request(app).patch(`/api/tickets/${ticket.body.id}/status`).set(auth(itStaffToken)).send({ status: 'OPEN' })

    const after = byKey((await getDashboard(itStaffToken)).body.metrics)
    expect(after.new.todayDelta).toBe((before.new.todayDelta ?? 0) + 1)
    expect(after.open.todayDelta).toBe((before.open.todayDelta ?? 0) + 1)
    expect(after.myAssigned.todayDelta).toBeNull()
  })

  it('AC-17: an IT Staff member with nothing assigned gets zero personal values and empty lists', async () => {
    const token = await createFreshUser('IT_STAFF')
    const response = await getDashboard(token)
    expect(response.status).toBe(200)
    expect(byKey(response.body.metrics).myAssigned.value).toBe(0)
    expect(response.body.recentTickets).toEqual([])
    expect(response.body.myOpenActions).toEqual({ total: 0, items: [] })
  })

  it('PERF-01 / AC-29: both dashboards respond within 1000 ms on seed data', async () => {
    for (const [path, token] of [
      ['/api/dashboard/staff', adminToken],
      ['/api/dashboard/requester', requesterToken],
    ] as const) {
      const started = performance.now()
      const response = await request(app).get(path).set(auth(token))
      expect(response.status).toBe(200)
      expect(performance.now() - started).toBeLessThan(1000)
    }
  })
})

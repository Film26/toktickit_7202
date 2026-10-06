import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/db'
import { evaluateResolutionGate } from '../../src/lib/ticketWorkflow'

// Issue #67 -- final Ticket workflow. WF-01..WF-09 and UNIT-04 in
// docs/lab-04/tests.md; matrix in docs/lab-04/specification.md section 7.

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

let requesterToken: string
let itStaffToken: string
let marcusToken: string
let categoryId: number
let itStaffId: number
let requesterId: number

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function createTicket() {
  const response = await request(app)
    .post('/api/tickets')
    .set(auth(requesterToken))
    .send({ categoryId, summary: 'Lab 4 workflow ticket', description: 'Created for workflow coverage.' })
  return response.body as { id: number; version: number; status: string }
}

async function setStatus(id: number, status: string, token = itStaffToken, version?: number) {
  return request(app).patch(`/api/tickets/${id}/status`).set(auth(token)).send({ status, ...(version !== undefined ? { version } : {}) })
}

async function addAction(id: number, body: Record<string, unknown>) {
  return request(app).post(`/api/tickets/${id}/actions`).set(auth(itStaffToken)).send(body)
}

async function resolve(id: number, extra: Record<string, unknown> = {}) {
  return request(app).post(`/api/tickets/${id}/resolve`).set(auth(itStaffToken)).send({ resolutionSummary: 'Fixed it', ...extra })
}

async function inProgressTicketWithCompletedAction() {
  const ticket = await createTicket()
  await setStatus(ticket.id, 'IN_PROGRESS')
  await addAction(ticket.id, { description: 'Did the work', status: 'COMPLETED', result: 'Works now' })
  return ticket
}

beforeAll(async () => {
  requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
  itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
  marcusToken = await loginAs('marcus.tan@toktickit.dev', 'MarcusTan123!')
  categoryId = (await request(app).get('/api/categories')).body[0].id
  itStaffId = (await prisma.user.findUniqueOrThrow({ where: { email: 'itstaff@toktickit.dev' } })).id
  requesterId = (await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.dev' } })).id
})

describe('UNIT-04 resolution gate evaluator (BR-15)', () => {
  it.each([
    [{ open: 0, completed: 0 }, false],
    [{ open: 1, completed: 2 }, false],
    [{ open: 0, completed: 1 }, true],
  ])('%o -> allowed %s', (counts, allowed) => {
    expect(evaluateResolutionGate(counts).allowed).toBe(allowed)
  })
})

describe('Resolution gate (WF-01, WF-02, WF-03)', () => {
  it('WF-01 / AC-10: no Actions Taken -> 409 RESOLUTION_GATE, status unchanged', async () => {
    const ticket = await createTicket()
    await setStatus(ticket.id, 'IN_PROGRESS')

    const response = await resolve(ticket.id)
    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({ code: 'RESOLUTION_GATE', openActions: 0, completedActions: 0 })
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('IN_PROGRESS')
  })

  it('WF-01 / AC-10: an open (Planned or In Progress) action blocks resolution even with a Completed one', async () => {
    const ticket = await inProgressTicketWithCompletedAction()
    const open = await addAction(ticket.id, { description: 'Still to do', status: 'IN_PROGRESS' })

    const blocked = await resolve(ticket.id)
    expect(blocked.status).toBe(409)
    expect(blocked.body).toMatchObject({ code: 'RESOLUTION_GATE', openActions: 1, completedActions: 1 })

    // WF-02: cancelling the open action clears the gate.
    await request(app)
      .patch(`/api/tickets/${ticket.id}/actions/${open.body.id}`)
      .set(auth(itStaffToken))
      .send({ status: 'CANCELLED', version: open.body.version })
    const allowed = await resolve(ticket.id)
    expect(allowed.status).toBe(200)
    expect(allowed.body.status).toBe('RESOLVED')
    expect(allowed.body.resolvedAt).not.toBeNull()
  })

  it('WF-02: resolves from Waiting for Requester once the gate is met; blank summary is 400', async () => {
    const ticket = await inProgressTicketWithCompletedAction()
    await setStatus(ticket.id, 'WAITING_FOR_REQUESTER')
    expect((await resolve(ticket.id, { resolutionSummary: '   ' })).status).toBe(400)
    expect((await resolve(ticket.id)).status).toBe(200)
  })

  it('WF-03 / AC-11: a Requester signal never changes status, and a Requester cannot resolve', async () => {
    const ticket = await inProgressTicketWithCompletedAction()
    const signal = await request(app)
      .patch(`/api/tickets/${ticket.id}/requester-appears-resolved`)
      .set(auth(requesterToken))
      .send({ appearsResolved: true })
    expect(signal.status).toBe(200)
    expect(signal.body.status).toBe('IN_PROGRESS')

    const attempt = await request(app).post(`/api/tickets/${ticket.id}/resolve`).set(auth(requesterToken)).send({ resolutionSummary: 'I fixed it' })
    expect(attempt.status).toBe(403)
  })
})

describe('Status history (WF-04, WF-09)', () => {
  it('WF-04 / AC-12: one history row per step of the full lifecycle, in order, with the actor', async () => {
    const ticket = await createTicket()
    await setStatus(ticket.id, 'OPEN')
    await setStatus(ticket.id, 'IN_PROGRESS', marcusToken)
    await setStatus(ticket.id, 'WAITING_FOR_REQUESTER')
    await setStatus(ticket.id, 'IN_PROGRESS')
    await addAction(ticket.id, { description: 'Fix', status: 'COMPLETED', result: 'Fixed' })
    expect((await resolve(ticket.id)).status).toBe(200)
    expect((await request(app).post(`/api/tickets/${ticket.id}/confirm-resolution`).set(auth(requesterToken)).send({})).status).toBe(200)
    expect((await request(app).post(`/api/tickets/${ticket.id}/request-reopen`).set(auth(requesterToken)).send({})).status).toBe(200)

    const history = await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
    expect(history.map((h) => [h.fromStatus, h.toStatus])).toEqual([
      [null, 'NEW'],
      ['NEW', 'OPEN'],
      ['OPEN', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'WAITING_FOR_REQUESTER'],
      ['WAITING_FOR_REQUESTER', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'RESOLVED'],
      ['RESOLVED', 'CLOSED'],
      ['CLOSED', 'REOPENED'],
    ])
    expect(history[0].changedById).toBe(requesterId)
    expect(history[1].changedById).toBe(itStaffId)
    expect(history[2].changedById).not.toBe(itStaffId)
    expect(history[6].changedById).toBe(requesterId)
  })

  it('WF-04: a rejected transition adds no history row', async () => {
    const ticket = await createTicket()
    const before = await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } })
    expect((await setStatus(ticket.id, 'WAITING_FOR_REQUESTER')).status).toBe(409)
    expect(await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } })).toBe(before)
  })

  it('WF-09: ticket detail returns version and ordered statusHistory to staff and the owning Requester; no write route exists', async () => {
    const ticket = await createTicket()
    await setStatus(ticket.id, 'OPEN')

    for (const token of [itStaffToken, requesterToken]) {
      const detail = await request(app).get(`/api/tickets/${ticket.id}`).set(auth(token))
      expect(detail.body.version).toBe(2)
      expect(detail.body.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual(['NEW', 'OPEN'])
      expect(detail.body.statusHistory[1].changedBy).toMatchObject({ id: itStaffId, fullName: 'Ivy ITStaff' })
    }

    expect((await request(app).delete(`/api/tickets/${ticket.id}/status-history/1`).set(auth(itStaffToken))).status).toBe(404)
    expect((await request(app).patch(`/api/tickets/${ticket.id}/status-history/1`).set(auth(itStaffToken)).send({})).status).toBe(404)
  })
})

describe('Stale updates and concurrency (WF-05, WF-06)', () => {
  it('WF-05 / AC-13: a stale version is rejected on status, owner and IT Priority, and nothing changes', async () => {
    const ticket = await createTicket()
    const first = await setStatus(ticket.id, 'OPEN', itStaffToken, ticket.version)
    expect(first.status).toBe(200)
    expect(first.body.version).toBe(ticket.version + 1)

    const stale = await setStatus(ticket.id, 'IN_PROGRESS', marcusToken, ticket.version)
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({ code: 'STALE_UPDATE', currentVersion: ticket.version + 1, currentStatus: 'OPEN' })

    const owner = await request(app).patch(`/api/tickets/${ticket.id}/owner`).set(auth(itStaffToken)).send({ ownerId: itStaffId, version: ticket.version })
    expect(owner.body.code).toBe('STALE_UPDATE')
    const priority = await request(app).patch(`/api/tickets/${ticket.id}/it-priority`).set(auth(itStaffToken)).send({ itPriority: 'URGENT', version: 1 })
    expect(priority.body.code).toBe('STALE_UPDATE')

    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(stored).toMatchObject({ status: 'OPEN', ownerId: null, itPriority: 'MEDIUM' })

    const current = await request(app).patch(`/api/tickets/${ticket.id}/owner`).set(auth(itStaffToken)).send({ ownerId: itStaffId, version: stored.version })
    expect(current.status).toBe(200)
    expect(current.body.version).toBe(stored.version + 1)
  })

  it('WF-06 / AC-13: two concurrent resolves -> exactly one succeeds and one history row is written', async () => {
    const ticket = await inProgressTicketWithCompletedAction()
    const responses = await Promise.all([resolve(ticket.id), resolve(ticket.id), resolve(ticket.id)])

    expect(responses.filter((r) => r.status === 200)).toHaveLength(1)
    expect(responses.filter((r) => r.status === 409)).toHaveLength(2)
    expect(await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id, toStatus: 'RESOLVED' } })).toBe(1)
  })
})

describe('Transition matrix and cancel (WF-07, WF-08)', () => {
  it.each([
    ['NEW', 'WAITING_FOR_REQUESTER'],
    ['NEW', 'REOPENED'],
    ['OPEN', 'NEW'],
    ['IN_PROGRESS', 'OPEN'],
    ['IN_PROGRESS', 'NEW'],
  ])('WF-07 / AC-14: %s -> %s via PATCH status is 409', async (from, to) => {
    const ticket = await createTicket()
    if (from !== 'NEW') await setStatus(ticket.id, from)
    const response = await setStatus(ticket.id, to)
    expect(response.status).toBe(409)
    expect(response.body.code).toBe('INVALID_TRANSITION')
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(from)
  })

  it('WF-07: terminal and post-resolution rules still hold (close only from Resolved, cancel only New/Open)', async () => {
    const ticket = await createTicket()
    await setStatus(ticket.id, 'IN_PROGRESS')
    expect((await request(app).post(`/api/tickets/${ticket.id}/close`).set(auth(itStaffToken)).send({})).status).toBe(409)
    expect((await request(app).post(`/api/tickets/${ticket.id}/cancel`).set(auth(itStaffToken)).send({})).status).toBe(409)
    expect((await request(app).post(`/api/tickets/${ticket.id}/confirm-resolution`).set(auth(requesterToken)).send({})).status).toBe(409)
  })

  it('WF-08 / AC-22: cancelling a ticket cancels its open actions and keeps completed ones', async () => {
    const ticket = await createTicket()
    const planned = await addAction(ticket.id, { description: 'Planned work' })
    const started = await addAction(ticket.id, { description: 'Started work', status: 'IN_PROGRESS' })
    const done = await addAction(ticket.id, { description: 'Done work', status: 'COMPLETED', result: 'ok' })

    const cancel = await request(app).post(`/api/tickets/${ticket.id}/cancel`).set(auth(itStaffToken)).send({})
    expect(cancel.status).toBe(200)
    expect(cancel.body.status).toBe('CANCELLED')

    const actions = await prisma.actionTaken.findMany({ where: { ticketId: ticket.id } })
    const byId = new Map(actions.map((a) => [a.id, a]))
    expect(byId.get(planned.body.id)!.status).toBe('CANCELLED')
    expect(byId.get(started.body.id)!.status).toBe('CANCELLED')
    expect(byId.get(started.body.id)!.cancelledAt).not.toBeNull()
    expect(byId.get(done.body.id)!.status).toBe('COMPLETED')
  })

  it("a Requester cannot confirm someone else's ticket (404, not 403)", async () => {
    const ticket = await inProgressTicketWithCompletedAction()
    await resolve(ticket.id)
    const otherToken = await loginAs('jennifer.anderson@toktickit.dev', 'Jennifer123!')
    expect((await request(app).post(`/api/tickets/${ticket.id}/confirm-resolution`).set(auth(otherToken)).send({})).status).toBe(404)
  })
})

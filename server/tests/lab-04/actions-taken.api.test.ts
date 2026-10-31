import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import prisma from '../../src/db'

// Issue #65 -- Actions Taken API. Test IDs API-01..API-15 in docs/lab-04/tests.md,
// rules BR-01..BR-13 in docs/lab-04/specification.md.

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

let requesterToken: string
let otherRequesterToken: string
let itStaffToken: string
let adminToken: string
let categoryId: number
let itStaffId: number
let marcusId: number
let inactiveStaffId: number
let requesterUserId: number

async function createTicket(token = requesterToken) {
  const response = await request(app)
    .post('/api/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId, summary: 'Lab 4 actions test ticket', description: 'Created for Actions Taken API coverage.' })
  return response.body as { id: number; createdAt: string }
}

function postAction(ticketId: number, body: Record<string, unknown>, token = itStaffToken) {
  return request(app).post(`/api/tickets/${ticketId}/actions`).set('Authorization', `Bearer ${token}`).send(body)
}

function patchAction(ticketId: number, actionId: number, body: Record<string, unknown>, token = itStaffToken) {
  return request(app).patch(`/api/tickets/${ticketId}/actions/${actionId}`).set('Authorization', `Bearer ${token}`).send(body)
}

beforeAll(async () => {
  requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
  otherRequesterToken = await loginAs('jennifer.anderson@toktickit.dev', 'Jennifer123!')
  itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
  adminToken = await loginAs('admin@toktickit.dev', 'Admin123!')
  categoryId = (await request(app).get('/api/categories')).body[0].id
  itStaffId = (await prisma.user.findUniqueOrThrow({ where: { email: 'itstaff@toktickit.dev' } })).id
  marcusId = (await prisma.user.findUniqueOrThrow({ where: { email: 'marcus.tan@toktickit.dev' } })).id
  inactiveStaffId = (await prisma.user.findUniqueOrThrow({ where: { email: 'inactive-itstaff@toktickit.dev' } })).id
  requesterUserId = (await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.dev' } })).id
})

describe('Actions Taken -- create (API-03, API-04, API-14, API-15)', () => {
  it('API-03 / AC-01: creates under the correct ticket with performedBy = caller and default assignee', async () => {
    const ticket = await createTicket()
    const response = await postAction(ticket.id, { description: 'Checked the event log', attachmentNotes: 'See eventlog.pdf' })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      ticketId: ticket.id,
      description: 'Checked the event log',
      status: 'PLANNED',
      followUpRequired: false,
      attachmentNotes: 'See eventlog.pdf',
      version: 1,
      performedBy: { id: itStaffId },
      assignee: { id: itStaffId },
    })
    expect(response.body).not.toHaveProperty('clientRequestId')

    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: response.body.id } })
    expect(stored.ticketId).toBe(ticket.id)
    expect(stored.authorId).toBe(itStaffId)
  })

  it('API-04 / BR-02: can be assigned to a different IT Staff member than the ticket owner', async () => {
    const ticket = await createTicket()
    await request(app).patch(`/api/tickets/${ticket.id}/owner`).set('Authorization', `Bearer ${itStaffToken}`).send({ ownerId: itStaffId })

    const response = await postAction(ticket.id, { description: 'Swap the docking station', assigneeId: marcusId })
    expect(response.status).toBe(201)
    expect(response.body.assignee.id).toBe(marcusId)
    expect(response.body.performedBy.id).toBe(itStaffId)
  })

  it('API-03: records a completed action with result, follow-up and completedAt', async () => {
    const ticket = await createTicket()
    const response = await postAction(ticket.id, {
      description: 'Reinstalled the printer driver',
      status: 'COMPLETED',
      result: 'Test page printed',
      followUpRequired: true,
      followUpNote: 'Confirm with requester tomorrow',
    })
    expect(response.status).toBe(201)
    expect(response.body.status).toBe('COMPLETED')
    expect(response.body.completedAt).not.toBeNull()
    expect(response.body.followUpNote).toBe('Confirm with requester tomorrow')
  })

  it('API-14 / BR-03: a client-supplied performer is ignored', async () => {
    const ticket = await createTicket()
    const response = await postAction(ticket.id, { description: 'Spoof attempt', authorId: marcusId, performedBy: marcusId })
    expect(response.status).toBe(201)
    expect(response.body.performedBy.id).toBe(itStaffId)
  })

  it('API-15 / BR-25: an Administrator can create and edit actions', async () => {
    const ticket = await createTicket()
    const created = await postAction(ticket.id, { description: 'Admin check' }, adminToken)
    expect(created.status).toBe(201)
    const edited = await patchAction(ticket.id, created.body.id, { description: 'Admin check (edited)', version: 1 }, adminToken)
    expect(edited.status).toBe(200)
  })
})

describe('Actions Taken -- validation (API-05..API-08)', () => {
  it('API-05 / AC-04: follow-up required without a note is rejected on create and edit', async () => {
    const ticket = await createTicket()
    const create = await postAction(ticket.id, { description: 'Needs follow-up', followUpRequired: true })
    expect(create.status).toBe(400)
    expect(create.body.code).toBe('VALIDATION_ERROR')
    expect(create.body.fields).toHaveProperty('followUpNote')

    const ok = await postAction(ticket.id, { description: 'No follow-up yet' })
    const edit = await patchAction(ticket.id, ok.body.id, { followUpRequired: true, version: ok.body.version })
    expect(edit.status).toBe(400)
    expect(edit.body.fields).toHaveProperty('followUpNote')
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: ok.body.id } })).followUpRequired).toBe(false)
  })

  it('API-06 / AC-05: completing without a result is rejected', async () => {
    const ticket = await createTicket()
    const create = await postAction(ticket.id, { description: 'Done?', status: 'COMPLETED' })
    expect(create.status).toBe(400)
    expect(create.body.fields).toHaveProperty('result')

    const planned = await postAction(ticket.id, { description: 'Will do' })
    const complete = await patchAction(ticket.id, planned.body.id, { status: 'COMPLETED', result: '   ', version: 1 })
    expect(complete.status).toBe(400)
    expect(complete.body.fields).toHaveProperty('result')
  })

  it.each([
    ['inactive IT Staff', () => inactiveStaffId],
    ['a Requester', () => requesterUserId],
    ['an unknown user', () => 999_999],
  ])('API-07 / AC-06: rejects %s as assignee on create and edit', async (_label, assignee) => {
    const ticket = await createTicket()
    const create = await postAction(ticket.id, { description: 'Assign test', assigneeId: assignee() })
    expect(create.status).toBe(400)
    expect(create.body.fields).toHaveProperty('assigneeId')

    const ok = await postAction(ticket.id, { description: 'Assign test' })
    const edit = await patchAction(ticket.id, ok.body.id, { assigneeId: assignee(), version: 1 })
    expect(edit.status).toBe(400)
    expect(edit.body.fields).toHaveProperty('assigneeId')
  })

  it('API-08 / BR-06, BR-10: blank/too-long text and out-of-window dates are rejected', async () => {
    const ticket = await createTicket()
    expect((await postAction(ticket.id, { description: '   ' })).status).toBe(400)
    expect((await postAction(ticket.id, { description: 'x'.repeat(2001) })).status).toBe(400)
    expect((await postAction(ticket.id, { description: 'ok', attachmentNotes: 'y'.repeat(501) })).status).toBe(400)
    expect((await postAction(ticket.id, { description: 'ok', actionAt: '2000-01-01T00:00:00.000Z' })).body.fields).toHaveProperty('actionAt')

    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    expect((await postAction(ticket.id, { description: 'Done tomorrow?', status: 'COMPLETED', result: 'x', actionAt: tomorrow })).status).toBe(400)
    expect((await postAction(ticket.id, { description: 'Scheduled visit', status: 'PLANNED', actionAt: tomorrow })).status).toBe(201)
    expect((await postAction(ticket.id, { description: 'ok', status: 'CANCELLED' })).status).toBe(400)
    expect((await postAction(ticket.id, { description: 'ok', actionAt: 'not-a-date' })).status).toBe(400)
  })
})

describe('Actions Taken -- status moves, concurrency, idempotency (API-09..API-13)', () => {
  it('API-11 / BR-08: Planned -> In Progress -> Completed, version increments, completedAt set', async () => {
    const ticket = await createTicket()
    const created = await postAction(ticket.id, { description: 'Replace toner' })

    const started = await patchAction(ticket.id, created.body.id, { status: 'IN_PROGRESS', version: 1 })
    expect(started.status).toBe(200)
    expect(started.body).toMatchObject({ status: 'IN_PROGRESS', version: 2 })

    const done = await patchAction(ticket.id, created.body.id, { status: 'COMPLETED', result: 'Toner replaced', version: 2 })
    expect(done.status).toBe(200)
    expect(done.body).toMatchObject({ status: 'COMPLETED', version: 3, result: 'Toner replaced' })
    expect(done.body.completedAt).not.toBeNull()
    expect(done.body.performedBy.id).toBe(itStaffId)
  })

  it('API-11: Planned -> Cancelled sets cancelledAt', async () => {
    const ticket = await createTicket()
    const created = await postAction(ticket.id, { description: 'Not needed after all' })
    const cancelled = await patchAction(ticket.id, created.body.id, { status: 'CANCELLED', version: 1 })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.cancelledAt).not.toBeNull()
  })

  it('API-09 / AC-08: a stale version returns 409 STALE_UPDATE with the current action and changes nothing', async () => {
    const ticket = await createTicket()
    const created = await postAction(ticket.id, { description: 'Original text' })
    await patchAction(ticket.id, created.body.id, { description: 'First editor wins', version: 1 })

    const stale = await patchAction(ticket.id, created.body.id, { description: 'Second editor (stale)', version: 1 })
    expect(stale.status).toBe(409)
    expect(stale.body.code).toBe('STALE_UPDATE')
    expect(stale.body.current).toMatchObject({ description: 'First editor wins', version: 2 })

    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: created.body.id } })
    expect(stored.description).toBe('First editor wins')
  })

  it('API-09: version is required on edit', async () => {
    const ticket = await createTicket()
    const created = await postAction(ticket.id, { description: 'Needs version' })
    expect((await patchAction(ticket.id, created.body.id, { description: 'no version' })).status).toBe(400)
  })

  it('API-10 / AC-09: Completed and Cancelled actions are read-only; illegal moves rejected', async () => {
    const ticket = await createTicket()
    const done = await postAction(ticket.id, { description: 'Done', status: 'COMPLETED', result: 'ok' })
    const reopen = await patchAction(ticket.id, done.body.id, { status: 'PLANNED', version: 1 })
    expect(reopen.status).toBe(409)
    expect(reopen.body.code).toBe('INVALID_TRANSITION')
    expect((await patchAction(ticket.id, done.body.id, { description: 'rewrite history', version: 1 })).status).toBe(409)

    const started = await postAction(ticket.id, { description: 'Started', status: 'IN_PROGRESS' })
    expect((await patchAction(ticket.id, started.body.id, { status: 'PLANNED', version: 1 })).body.code).toBe('INVALID_TRANSITION')
  })

  it('API-12 / AC-20: repeating a clientRequestId returns the original action instead of a duplicate', async () => {
    const ticket = await createTicket()
    const body = { description: 'Retried request', clientRequestId: `retry-${Date.now()}` }
    const first = await postAction(ticket.id, body)
    const second = await postAction(ticket.id, body)
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(second.body.id).toBe(first.body.id)
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1)
  })

  it('API-12: concurrent duplicates still produce exactly one row', async () => {
    const ticket = await createTicket()
    const body = { description: 'Double click', clientRequestId: `dbl-${Date.now()}` }
    const responses = await Promise.all([postAction(ticket.id, body), postAction(ticket.id, body), postAction(ticket.id, body)])
    expect(responses.every((r) => r.status === 200 || r.status === 201)).toBe(true)
    expect(new Set(responses.map((r) => r.body.id)).size).toBe(1)
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1)
  })

  it('API-13 / AC-23: actions are locked on Resolved, Closed and Cancelled tickets', async () => {
    const ticket = await createTicket()
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${itStaffToken}`).send({ status: 'IN_PROGRESS' })
    const open = await postAction(ticket.id, { description: 'Still planned' })
    await patchAction(ticket.id, open.body.id, { status: 'COMPLETED', result: 'Fixed', version: 1 })
    const resolve = await request(app)
      .post(`/api/tickets/${ticket.id}/resolve`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ resolutionSummary: 'Fixed' })
    expect(resolve.status).toBe(200)

    const onResolved = await postAction(ticket.id, { description: 'Too late' })
    expect(onResolved.status).toBe(409)
    expect(onResolved.body.code).toBe('TICKET_LOCKED')

    await request(app).post(`/api/tickets/${ticket.id}/close`).set('Authorization', `Bearer ${itStaffToken}`).send({})
    expect((await postAction(ticket.id, { description: 'Closed' })).body.code).toBe('TICKET_LOCKED')

    const cancelled = await createTicket()
    await request(app).post(`/api/tickets/${cancelled.id}/cancel`).set('Authorization', `Bearer ${itStaffToken}`).send({})
    expect((await postAction(cancelled.id, { description: 'Cancelled' })).body.code).toBe('TICKET_LOCKED')
  })
})

describe('Actions Taken -- read access and roles (API-01, API-02)', () => {
  it('API-01 / FR-02: staff and the owning Requester can list in stable order; another Requester gets 404', async () => {
    const ticket = await createTicket()
    // Inserted out of order: the list must sort by Action Date/Time, not by insertion.
    const createdAt = new Date(ticket.createdAt).getTime()
    const second = await postAction(ticket.id, { description: 'Second', actionAt: new Date(createdAt + 2000).toISOString(), status: 'PLANNED' })
    const first = await postAction(ticket.id, { description: 'First', actionAt: new Date(createdAt + 1000).toISOString(), status: 'PLANNED' })

    const asStaff = await request(app).get(`/api/tickets/${ticket.id}/actions`).set('Authorization', `Bearer ${itStaffToken}`)
    expect(asStaff.status).toBe(200)
    expect(asStaff.body.map((a: { id: number }) => a.id)).toEqual([first.body.id, second.body.id])

    const asOwner = await request(app).get(`/api/tickets/${ticket.id}/actions`).set('Authorization', `Bearer ${requesterToken}`)
    expect(asOwner.status).toBe(200)
    expect(asOwner.body).toHaveLength(2)
    expect(asOwner.body[0]).toHaveProperty('result')

    const asOther = await request(app).get(`/api/tickets/${ticket.id}/actions`).set('Authorization', `Bearer ${otherRequesterToken}`)
    expect(asOther.status).toBe(404)

    const detail = await request(app).get(`/api/tickets/${ticket.id}`).set('Authorization', `Bearer ${requesterToken}`)
    expect(detail.body.actionsTaken[0]).toMatchObject({ description: 'First', performedBy: { id: itStaffId } })
  })

  it('API-02 / AC-07: a Requester cannot create or edit actions, even on their own ticket', async () => {
    const ticket = await createTicket()
    const created = await postAction(ticket.id, { description: 'Staff action' })

    expect((await postAction(ticket.id, { description: 'Requester try' }, requesterToken)).status).toBe(403)
    expect((await patchAction(ticket.id, created.body.id, { description: 'Requester edit', version: 1 }, requesterToken)).status).toBe(403)
  })

  it('returns 404 for a missing ticket or an action that belongs to another ticket', async () => {
    const a = await createTicket()
    const b = await createTicket()
    const action = await postAction(a.id, { description: 'On ticket A' })
    expect((await postAction(999_999, { description: 'x' })).status).toBe(404)
    expect((await patchAction(b.id, action.body.id, { description: 'wrong ticket', version: 1 })).status).toBe(404)
    expect((await request(app).get('/api/tickets/abc/actions').set('Authorization', `Bearer ${itStaffToken}`)).status).toBe(400)
  })

  it('no token is rejected 401', async () => {
    expect((await request(app).get('/api/tickets/1/actions')).status).toBe(401)
  })
})

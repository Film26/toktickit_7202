import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

async function loginAs(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password })
  return response.body.token as string
}

async function createTicket(token: string, categoryId: number, summary: string) {
  const response = await request(app)
    .post('/api/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({ categoryId, summary, description: 'x' })
  return response.body.id as number
}

describe('attachment upload, download, and soft removal', () => {
  let requesterToken: string
  let otherRequesterToken: string
  let itStaffToken: string
  let categoryId: number
  let ticketId: number

  beforeAll(async () => {
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
    itStaffToken = await loginAs('itstaff@toktickit.dev', 'ItStaff123!')
    const adminToken = await loginAs('admin@toktickit.dev', 'Admin123!')

    const categories = await request(app).get('/api/categories')
    categoryId = categories.body[0].id
    ticketId = await createTicket(requesterToken, categoryId, `Attachment test ticket ${Date.now()}`)

    const email = `attachment-other-${Date.now()}@toktickit.dev`
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, fullName: 'Attachment Other', role: 'REQUESTER' })
    const firstLogin = await request(app).post('/api/auth/login').send({ email, password: created.body.temporaryPassword })
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${firstLogin.body.token}`)
      .send({ currentPassword: created.body.temporaryPassword, newPassword: 'AttachmentOther123!' })
    otherRequesterToken = (
      await request(app).post('/api/auth/login').send({ email, password: 'AttachmentOther123!' })
    ).body.token as string
  })

  it('rejects an unsupported file type', async () => {
    const response = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .attach('file', Buffer.from('plain text content'), 'note.txt')
    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/unsupported file type/i)
  })

  it('rejects a file over the 5 MB limit', async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 'a')
    const response = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .attach('file', oversized, 'big.png')
    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/5 MB limit/i)
  })

  it('rejects an upload with no file', async () => {
    const response = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(response.status).toBe(400)
  })

  it('rejects an upload from a requester who does not own the ticket', async () => {
    const response = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${otherRequesterToken}`)
      .attach('file', Buffer.from('%PDF-1.4 fake pdf'), 'doc.pdf')
    expect(response.status).toBe(404)
  })

  it('accepts a valid PDF upload and stores its metadata', async () => {
    // ticket now has 1 active attachment
    const response = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .attach('file', Buffer.from('%PDF-1.4 fake pdf content'), 'evidence.pdf')

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ filename: 'evidence.pdf', mimeType: 'application/pdf', isActive: true })
    expect(response.body.sizeBytes).toBeGreaterThan(0)
    expect(response.body.storedFilename).not.toBe('evidence.pdf')
  })

  it('rejects removal from the ticket owner when a different (staff) user uploaded it', async () => {
    // ticket now has 2 active attachments
    const staffUpload = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .attach('file', Buffer.from('staff uploaded file'), 'staff-upload.png')
    expect(staffUpload.status).toBe(201)

    // the requester owns the ticket (so has access) but is neither the
    // uploader nor staff - should be rejected, not just silently allowed
    // because they can access the ticket
    const response = await request(app)
      .delete(`/api/attachments/${staffUpload.body.id}`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'requester should not be able to remove this' })
    expect(response.status).toBe(403)
  })

  it('rejects removal from a requester with no access to the ticket at all', async () => {
    const ticket = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${requesterToken}`)
    const attachmentId = ticket.body.attachments[0].id

    const response = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${otherRequesterToken}`)
      .send({ reason: 'not mine to remove' })
    expect(response.status).toBe(404)
  })

  it('enforces a maximum of 5 active attachments per ticket', async () => {
    // 2 active attachments exist already; add 3 more to reach the cap of 5
    for (let i = 0; i < 3; i++) {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .attach('file', Buffer.from(`fake image ${i}`), `photo-${i}.png`)
      expect(response.status).toBe(201)
    }

    const sixth = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .attach('file', Buffer.from('one too many'), 'photo-extra.png')
    expect(sixth.status).toBe(409)
    expect(sixth.body.error).toMatch(/at most 5/i)
  })

  it('lets the owning requester download an active attachment, but not another requester', async () => {
    const ticket = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${requesterToken}`)
    const attachmentId = ticket.body.attachments.find((a: { isActive: boolean }) => a.isActive).id

    const mine = await request(app)
      .get(`/api/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(mine.status).toBe(200)

    const notMine = await request(app)
      .get(`/api/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${otherRequesterToken}`)
    expect(notMine.status).toBe(404)
  })

  it('lets IT staff view attachment metadata on a ticket they can access', async () => {
    const ticket = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${requesterToken}`)
    const attachmentId = ticket.body.attachments[0].id

    const response = await request(app).get(`/api/attachments/${attachmentId}`).set('Authorization', `Bearer ${itStaffToken}`)
    expect(response.status).toBe(200)
    expect(response.body.id).toBe(attachmentId)
  })

  it('requires a reason to soft-remove an attachment', async () => {
    const ticket = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${requesterToken}`)
    const attachmentId = ticket.body.attachments.find((a: { isActive: boolean }) => a.isActive).id

    const response = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({})
    expect(response.status).toBe(400)
  })

  it('soft-removes an attachment: metadata stays visible, download is blocked, and the freed slot allows a new upload', async () => {
    const ticket = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${requesterToken}`)
    const attachmentId = ticket.body.attachments.find((a: { isActive: boolean }) => a.isActive).id

    const removed = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Uploaded the wrong file' })
    expect(removed.status).toBe(200)
    expect(removed.body).toMatchObject({ isActive: false, removedReason: 'Uploaded the wrong file' })
    expect(removed.body.removedBy).toMatchObject({ id: expect.any(Number) })

    // metadata still visible
    const metadata = await request(app).get(`/api/attachments/${attachmentId}`).set('Authorization', `Bearer ${requesterToken}`)
    expect(metadata.status).toBe(200)
    expect(metadata.body.isActive).toBe(false)

    // the full ticket-detail payload (what the UI actually renders from)
    // must also carry removedBy, not just the single-attachment endpoint
    const ticketAfterRemoval = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${requesterToken}`)
    const sameAttachment = ticketAfterRemoval.body.attachments.find((a: { id: number }) => a.id === attachmentId)
    expect(sameAttachment.removedBy).toMatchObject({ id: expect.any(Number), fullName: expect.any(String) })

    // download now blocked
    const download = await request(app)
      .get(`/api/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(download.status).toBe(410)

    // removing it again is rejected
    const again = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'trying again' })
    expect(again.status).toBe(409)

    // the freed slot allows a new upload even though the ticket was at the cap
    const reupload = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .attach('file', Buffer.from('replacement file'), 'replacement.png')
    expect(reupload.status).toBe(201)
  })

  it('lets IT staff remove an attachment they did not upload', async () => {
    const ticket = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${requesterToken}`)
    const activeAttachment = ticket.body.attachments.find((a: { isActive: boolean }) => a.isActive)

    const response = await request(app)
      .delete(`/api/attachments/${activeAttachment.id}`)
      .set('Authorization', `Bearer ${itStaffToken}`)
      .send({ reason: 'Staff cleanup' })
    expect(response.status).toBe(200)
    expect(response.body.isActive).toBe(false)
  })
})

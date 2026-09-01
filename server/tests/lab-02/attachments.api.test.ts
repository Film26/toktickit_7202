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

describe('Attachments - Lab 2 Requester flow', () => {
  let requesterToken: string
  let categoryId: number
  let ticketId: number

  beforeAll(async () => {
    requesterToken = await loginAs('requester@toktickit.dev', 'Requester123!')
    const categories = await request(app).get('/api/categories')
    categoryId = categories.body[0].id
    ticketId = await createTicket(requesterToken, categoryId, `Lab2 attachments ticket ${Date.now()}`)
  })

  it('accepts a valid PNG upload and returns its metadata', async () => {
    const response = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .attach('file', Buffer.from('fake png bytes'), 'screenshot.png')

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ filename: 'screenshot.png', mimeType: 'image/png', isActive: true })
    expect(response.body.sizeBytes).toBeGreaterThan(0)
  })

  it('rejects an unsupported file type', async () => {
    const response = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .attach('file', Buffer.from('plain text content'), 'note.txt')
    expect(response.status).toBe(400)
  })

  it('rejects a file over the 5 MB limit', async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 'a')
    const response = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .attach('file', oversized, 'big.png')
    expect(response.status).toBe(400)
  })

  it('enforces a maximum of 5 active attachments per ticket, then a 6th is rejected', async () => {
    // 1 active attachment already exists from the first test in this file;
    // add 4 more to reach the cap of 5
    for (let i = 0; i < 4; i++) {
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
  })

  it('lets the owning requester download an active attachment', async () => {
    const ticket = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${requesterToken}`)
    const attachmentId = ticket.body.attachments.find((a: { isActive: boolean }) => a.isActive).id

    const response = await request(app)
      .get(`/api/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(response.status).toBe(200)
  })

  it('soft-removes an attachment: retains metadata, marks inactive, and blocks further download', async () => {
    const ticket = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', `Bearer ${requesterToken}`)
    const attachmentId = ticket.body.attachments.find((a: { isActive: boolean }) => a.isActive).id

    const removed = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ reason: 'Wrong screenshot' })
    expect(removed.status).toBe(200)
    expect(removed.body).toMatchObject({ isActive: false, removedReason: 'Wrong screenshot' })
    // metadata (filename, uploader, etc.) is retained, not deleted
    expect(removed.body.filename).toBeTruthy()
    expect(removed.body.removedBy).toMatchObject({ id: expect.any(Number) })

    const metadata = await request(app).get(`/api/attachments/${attachmentId}`).set('Authorization', `Bearer ${requesterToken}`)
    expect(metadata.status).toBe(200)
    expect(metadata.body.isActive).toBe(false)
    expect(metadata.body.filename).toBe(removed.body.filename)

    // download of a removed attachment is blocked - the audit found this
    // returns 410 Gone (the resource existed but is no longer available),
    // not a 404 that would suggest it never existed
    const download = await request(app)
      .get(`/api/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${requesterToken}`)
    expect(download.status).toBe(410)
  })

  it('the freed slot from a soft-removal allows a new upload even though the ticket was previously at the cap', async () => {
    const reupload = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .attach('file', Buffer.from('replacement file'), 'replacement.png')
    expect(reupload.status).toBe(201)
  })
})

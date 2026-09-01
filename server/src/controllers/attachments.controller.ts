import type { RequestHandler } from 'express'
import { z } from 'zod'
import prisma from '../db'
import { userCanAccessTicket } from '../lib/ticketAccess'
import { storedFilePath } from '../lib/attachmentStorage'

const PARTICIPANT_SELECT = { id: true, fullName: true, role: true } as const

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') return null
  const id = Number(raw)
  return Number.isInteger(id) ? id : null
}

async function loadAccessibleAttachment(rawId: string | string[] | undefined, user: Parameters<typeof userCanAccessTicket>[1]) {
  const id = parseId(rawId)
  if (id === null) return { status: 400 as const, error: 'Invalid attachment id' }

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { uploader: { select: PARTICIPANT_SELECT }, removedBy: { select: PARTICIPANT_SELECT } },
  })
  if (!attachment) return { status: 404 as const, error: 'Attachment not found' }

  const hasAccess = await userCanAccessTicket(attachment.ticketId, user)
  if (!hasAccess) return { status: 404 as const, error: 'Attachment not found' }

  return { status: 200 as const, attachment }
}

export const getAttachment: RequestHandler = async (req, res) => {
  const result = await loadAccessibleAttachment(req.params.id, req.user!)
  if (result.status !== 200) {
    res.status(result.status).json({ error: result.error })
    return
  }
  res.status(200).json(result.attachment)
}

export const downloadAttachment: RequestHandler = async (req, res) => {
  const result = await loadAccessibleAttachment(req.params.id, req.user!)
  if (result.status !== 200) {
    res.status(result.status).json({ error: result.error })
    return
  }

  const { attachment } = result
  if (!attachment.isActive) {
    res.status(410).json({ error: 'This attachment has been removed and is no longer downloadable' })
    return
  }

  res.download(storedFilePath(attachment.storedFilename), attachment.filename, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'Attachment file not found' })
    }
  })
}

const removeSchema = z.object({ reason: z.string().min(1) })

export const removeAttachment: RequestHandler = async (req, res) => {
  const result = await loadAccessibleAttachment(req.params.id, req.user!)
  if (result.status !== 200) {
    res.status(result.status).json({ error: result.error })
    return
  }

  const { attachment } = result
  const isStaff = req.user!.role === 'IT_STAFF' || req.user!.role === 'ADMINISTRATOR'
  if (attachment.uploaderId !== req.user!.id && !isStaff) {
    res.status(403).json({ error: 'Only the uploader or IT staff can remove this attachment' })
    return
  }
  if (!attachment.isActive) {
    res.status(409).json({ error: 'This attachment has already been removed' })
    return
  }

  const parsed = removeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'A removal reason is required' })
    return
  }

  const updated = await prisma.attachment.update({
    where: { id: attachment.id },
    data: {
      isActive: false,
      removedAt: new Date(),
      removedById: req.user!.id,
      removedReason: parsed.data.reason,
    },
    include: { uploader: { select: PARTICIPANT_SELECT }, removedBy: { select: PARTICIPANT_SELECT } },
  })
  res.status(200).json(updated)
}

import type { RequestHandler } from 'express'
import { z } from 'zod'
import prisma from '../db'
import { signToken } from '../lib/jwt'

// Public (no auth) - backs the Development Requester Selector, which by
// design runs before the user has signed in. Only exposes id/fullName/email
// for active Requester accounts; never passwordHash or any other field.
export const listActiveRequesters: RequestHandler = async (_req, res) => {
  const requesters = await prisma.user.findMany({
    where: { role: 'REQUESTER', isActive: true },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, email: true },
  })
  res.status(200).json(requesters)
}

const devSelectSchema = z.object({
  requesterId: z.number().int().positive(),
})

// Lab 2 testing mechanism only - NOT authentication. No credential is
// collected or checked; the caller just names one of the ids already
// exposed by GET /api/requesters (above). This exists solely so the
// Development Requester Selector can put the app in a chosen Requester's
// context without asking anyone to know or type a password. It only ever
// mints a session for an active REQUESTER account, so it cannot be used to
// reach IT Staff or Administrator screens. Disabled outside development/test
// so it can never substitute for real sign-in in a deployed environment.
export const devSelectRequester: RequestHandler = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' })
    return
  }

  const parsed = devSelectSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'A valid requesterId is required' })
    return
  }

  const requester = await prisma.user.findUnique({ where: { id: parsed.data.requesterId } })
  if (!requester || !requester.isActive || requester.role !== 'REQUESTER') {
    res.status(404).json({ error: 'Active Development Requester not found' })
    return
  }

  const token = signToken(requester.id)
  res.status(200).json({
    token,
    user: {
      id: requester.id,
      email: requester.email,
      fullName: requester.fullName,
      role: requester.role,
      mustChangePassword: requester.mustChangePassword,
    },
  })
}

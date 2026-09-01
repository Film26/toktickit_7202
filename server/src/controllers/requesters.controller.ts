import type { RequestHandler } from 'express'
import prisma from '../db'

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

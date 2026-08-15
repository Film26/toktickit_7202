import type { RequestHandler } from 'express'
import prisma from '../db'
import { verifyToken } from '../lib/jwt'

export type AuthenticatedUser = {
  id: number
  email: string
  fullName: string
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'
  mustChangePassword: boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = header.slice('Bearer '.length)

  try {
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, mustChangePassword: true },
    })

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Account is inactive or no longer exists' })
      return
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export default requireAuth

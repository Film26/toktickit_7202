import type { RequestHandler } from 'express'
import type { AuthenticatedUser } from './requireAuth'

export function requireRole(...roles: AuthenticatedUser['role'][]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' })
      return
    }
    next()
  }
}

import type { RequestHandler } from 'express'

const enforcePasswordChange: RequestHandler = (req, res, next) => {
  if (req.user?.mustChangePassword) {
    res.status(403).json({ error: 'PASSWORD_CHANGE_REQUIRED' })
    return
  }
  next()
}

export default enforcePasswordChange

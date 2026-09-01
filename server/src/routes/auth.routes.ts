import { Router } from 'express'
import requireAuth from '../middleware/requireAuth'
import { login, changePassword, me } from '../controllers/auth.controller'

const router = Router()

router.post('/login', login)
router.post('/change-password', requireAuth, changePassword)
router.get('/me', requireAuth, me)

export default router

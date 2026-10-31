import { Router } from 'express'
import requireAuth from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'
import enforcePasswordChange from '../middleware/enforcePasswordChange'
import * as dashboard from '../controllers/dashboard.controller'

const router = Router()

router.use(requireAuth, enforcePasswordChange)

router.get('/requester', requireRole('REQUESTER'), dashboard.requesterDashboard)
router.get('/staff', requireRole('IT_STAFF', 'ADMINISTRATOR'), dashboard.staffDashboard)

export default router

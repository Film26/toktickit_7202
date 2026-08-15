import { Router } from 'express'
import requireAuth from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'
import enforcePasswordChange from '../middleware/enforcePasswordChange'
import {
  listUsers,
  createUser,
  getUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
} from '../controllers/users.controller'

const router = Router()

router.use(requireAuth, enforcePasswordChange, requireRole('ADMINISTRATOR'))

router.get('/', listUsers)
router.post('/', createUser)
router.get('/:id', getUser)
router.patch('/:id', updateUser)
router.patch('/:id/status', updateUserStatus)
router.post('/:id/reset-password', resetUserPassword)

export default router

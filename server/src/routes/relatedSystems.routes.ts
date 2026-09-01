import { Router } from 'express'
import requireAuth from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'
import enforcePasswordChange from '../middleware/enforcePasswordChange'
import {
  listRelatedSystems,
  listAllRelatedSystems,
  createRelatedSystem,
  updateRelatedSystem,
} from '../controllers/relatedSystems.controller'

const router = Router()
const adminOnly = [requireAuth, enforcePasswordChange, requireRole('ADMINISTRATOR')]

router.get('/', listRelatedSystems)
router.get('/manage', ...adminOnly, listAllRelatedSystems)
router.post('/', ...adminOnly, createRelatedSystem)
router.patch('/:id', ...adminOnly, updateRelatedSystem)

export default router

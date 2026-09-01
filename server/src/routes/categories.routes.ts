import { Router } from 'express'
import requireAuth from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'
import enforcePasswordChange from '../middleware/enforcePasswordChange'
import { listCategories, listAllCategories, createCategory, updateCategory } from '../controllers/categories.controller'

const router = Router()
const adminOnly = [requireAuth, enforcePasswordChange, requireRole('ADMINISTRATOR')]

router.get('/', listCategories)
router.get('/manage', ...adminOnly, listAllCategories)
router.post('/', ...adminOnly, createCategory)
router.patch('/:id', ...adminOnly, updateCategory)

export default router

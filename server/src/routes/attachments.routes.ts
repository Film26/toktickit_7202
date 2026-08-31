import { Router } from 'express'
import requireAuth from '../middleware/requireAuth'
import enforcePasswordChange from '../middleware/enforcePasswordChange'
import { getAttachment, downloadAttachment, removeAttachment } from '../controllers/attachments.controller'

const router = Router()

router.use(requireAuth, enforcePasswordChange)

router.get('/:id', getAttachment)
router.get('/:id/download', downloadAttachment)
router.delete('/:id', removeAttachment)

export default router

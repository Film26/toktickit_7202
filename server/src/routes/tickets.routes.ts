import { Router } from 'express'
import requireAuth from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'
import enforcePasswordChange from '../middleware/enforcePasswordChange'
import * as tickets from '../controllers/tickets.controller'

const router = Router()
const staffRoles = ['IT_STAFF', 'ADMINISTRATOR'] as const

router.use(requireAuth, enforcePasswordChange)

router.post('/', requireRole('REQUESTER'), tickets.createTicket)
router.get('/mine', requireRole('REQUESTER'), tickets.listMyTickets)
router.get('/', requireRole(...staffRoles), tickets.listTickets)
router.get('/:id', tickets.getTicket)

router.patch('/:id/priority', requireRole('REQUESTER'), tickets.updateTicketPriority)
router.post('/:id/confirm-resolution', requireRole('REQUESTER'), tickets.confirmResolution)
router.post('/:id/reject-resolution', requireRole('REQUESTER'), tickets.rejectResolution)
router.post('/:id/request-reopen', requireRole('REQUESTER'), tickets.requestReopen)

router.patch('/:id/owner', requireRole(...staffRoles), tickets.updateTicketOwner)
router.patch('/:id/it-priority', requireRole(...staffRoles), tickets.updateTicketItPriority)
router.patch('/:id/status', requireRole(...staffRoles), tickets.updateTicketStatus)
router.post('/:id/resolve', requireRole(...staffRoles), tickets.resolveTicket)
router.post('/:id/close', requireRole(...staffRoles), tickets.closeTicket)
router.post('/:id/notes', requireRole(...staffRoles), tickets.addNote)
router.post('/:id/actions', requireRole(...staffRoles), tickets.addAction)
router.patch('/:id/actions/:actionId', requireRole(...staffRoles), tickets.updateAction)

router.post('/:id/comments', tickets.addComment)
router.post('/:id/attachments', tickets.addAttachment)

export default router

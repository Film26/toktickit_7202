import { Router } from 'express'
import { listActiveRequesters, devSelectRequester } from '../controllers/requesters.controller'

const router = Router()

router.get('/', listActiveRequesters)
router.post('/dev-select', devSelectRequester)

export default router

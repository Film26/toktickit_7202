import { Router } from 'express'
import { listActiveRequesters } from '../controllers/requesters.controller'

const router = Router()

router.get('/', listActiveRequesters)

export default router

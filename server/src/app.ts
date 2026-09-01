import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.routes'
import categoriesRoutes from './routes/categories.routes'
import relatedSystemsRoutes from './routes/relatedSystems.routes'
import usersRoutes from './routes/users.routes'
import ticketsRoutes from './routes/tickets.routes'
import attachmentsRoutes from './routes/attachments.routes'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'TokTickIT API' })
})

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/related-systems', relatedSystemsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/tickets', ticketsRoutes)
app.use('/api/attachments', attachmentsRoutes)

export default app

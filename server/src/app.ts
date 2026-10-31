import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.routes'
import categoriesRoutes from './routes/categories.routes'
import relatedSystemsRoutes from './routes/relatedSystems.routes'
import usersRoutes from './routes/users.routes'
import ticketsRoutes from './routes/tickets.routes'
import attachmentsRoutes from './routes/attachments.routes'
import requestersRoutes from './routes/requesters.routes'
import dashboardRoutes from './routes/dashboard.routes'

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
app.use('/api/requesters', requestersRoutes)
app.use('/api/dashboard', dashboardRoutes)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Safe failure (handout 8.5): malformed JSON gets a 400, anything unexpected
// a generic 500 -- never a stack trace or SQL in the response body.
const jsonErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON' })
    return
  }
  console.error(error)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
}
app.use(jsonErrorHandler)

export default app

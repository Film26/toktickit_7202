import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.routes'
import categoriesRoutes from './routes/categories.routes'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'TokTickIT API' })
})

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoriesRoutes)

export default app

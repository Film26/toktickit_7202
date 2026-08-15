import type { RequestHandler } from 'express'
import { z } from 'zod'
import prisma from '../db'

export const listRelatedSystems: RequestHandler = async (_req, res) => {
  try {
    const relatedSystems = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    })
    res.status(200).json(relatedSystems)
  } catch {
    res.status(500).json({ error: 'Unable to retrieve related systems' })
  }
}

export const listAllRelatedSystems: RequestHandler = async (_req, res) => {
  const relatedSystems = await prisma.relatedSystem.findMany({ orderBy: { id: 'asc' } })
  res.status(200).json(relatedSystems)
}

const createRelatedSystemSchema = z.object({ name: z.string().min(1).max(100) })

export const createRelatedSystem: RequestHandler = async (req, res) => {
  const parsed = createRelatedSystemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  try {
    const relatedSystem = await prisma.relatedSystem.create({ data: { name: parsed.data.name } })
    res.status(201).json(relatedSystem)
  } catch {
    res.status(409).json({ error: 'A related system with that name already exists' })
  }
}

const updateRelatedSystemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
})

export const updateRelatedSystem: RequestHandler = async (req, res) => {
  const id = Number(req.params.id)
  const parsed = updateRelatedSystemSchema.safeParse(req.body)
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  try {
    const relatedSystem = await prisma.relatedSystem.update({ where: { id }, data: parsed.data })
    res.status(200).json(relatedSystem)
  } catch {
    res.status(404).json({ error: 'Related system not found' })
  }
}

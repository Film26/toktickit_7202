import type { RequestHandler } from 'express'
import { z } from 'zod'
import prisma from '../db'

export const listCategories: RequestHandler = async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    })
    res.status(200).json(categories)
  } catch {
    res.status(500).json({ error: 'Unable to retrieve categories' })
  }
}

export const listAllCategories: RequestHandler = async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { id: 'asc' } })
  res.status(200).json(categories)
}

const createCategorySchema = z.object({ name: z.string().min(1).max(100) })

export const createCategory: RequestHandler = async (req, res) => {
  const parsed = createCategorySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  try {
    const category = await prisma.category.create({ data: { name: parsed.data.name } })
    res.status(201).json(category)
  } catch {
    res.status(409).json({ error: 'A category with that name already exists' })
  }
}

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
})

export const updateCategory: RequestHandler = async (req, res) => {
  const id = Number(req.params.id)
  const parsed = updateCategorySchema.safeParse(req.body)
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  try {
    const category = await prisma.category.update({ where: { id }, data: parsed.data })
    res.status(200).json(category)
  } catch {
    res.status(404).json({ error: 'Category not found' })
  }
}

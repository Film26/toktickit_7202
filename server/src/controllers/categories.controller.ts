import type { RequestHandler } from 'express'
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

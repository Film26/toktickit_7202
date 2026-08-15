import type { RequestHandler } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import prisma from '../db'
import { generateTempPassword } from '../lib/generateTempPassword'

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const

const ROLES = ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const

export const listUsers: RequestHandler = async (req, res) => {
  const { q, role, isActive } = req.query

  const where: {
    OR?: Array<{ fullName?: { contains: string; mode: 'insensitive' }; email?: { contains: string; mode: 'insensitive' } }>
    role?: (typeof ROLES)[number]
    isActive?: boolean
  } = {}

  if (typeof q === 'string' && q.trim()) {
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (typeof role === 'string' && (ROLES as readonly string[]).includes(role)) {
    where.role = role as (typeof ROLES)[number]
  }
  if (typeof isActive === 'string') {
    where.isActive = isActive === 'true'
  }

  const users = await prisma.user.findMany({ where, orderBy: { id: 'asc' }, select: USER_SELECT })
  res.status(200).json(users)
}

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(200),
  role: z.enum(ROLES),
})

export const createUser: RequestHandler = async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'email, fullName, and a valid role are required' })
    return
  }

  const temporaryPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(temporaryPassword, 10)

  try {
    const user = await prisma.user.create({
      data: { ...parsed.data, passwordHash, mustChangePassword: true },
      select: USER_SELECT,
    })
    res.status(201).json({ user, temporaryPassword })
  } catch {
    res.status(409).json({ error: 'A user with that email already exists' })
  }
}

export const getUser: RequestHandler = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid user id' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.status(200).json(user)
}

const updateUserSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLES).optional(),
})

export const updateUser: RequestHandler = async (req, res) => {
  const id = Number(req.params.id)
  const parsed = updateUserSchema.safeParse(req.body)
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  try {
    const user = await prisma.user.update({ where: { id }, data: parsed.data, select: USER_SELECT })
    res.status(200).json(user)
  } catch {
    res.status(404).json({ error: 'User not found' })
  }
}

const updateUserStatusSchema = z.object({ isActive: z.boolean() })

export const updateUserStatus: RequestHandler = async (req, res) => {
  const id = Number(req.params.id)
  const parsed = updateUserStatusSchema.safeParse(req.body)
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ error: 'isActive (boolean) is required' })
    return
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: parsed.data.isActive },
      select: USER_SELECT,
    })
    res.status(200).json(user)
  } catch {
    res.status(404).json({ error: 'User not found' })
  }
}

export const resetUserPassword: RequestHandler = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid user id' })
    return
  }

  const temporaryPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(temporaryPassword, 10)

  try {
    await prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } })
    res.status(200).json({ temporaryPassword })
  } catch {
    res.status(404).json({ error: 'User not found' })
  }
}

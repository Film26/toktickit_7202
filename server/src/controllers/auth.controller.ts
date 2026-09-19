import type { RequestHandler } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import prisma from '../db'
import { signToken } from '../lib/jwt'
import { isPasswordValid, PASSWORD_REQUIREMENTS_MESSAGE } from '../lib/passwordPolicy'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const login: RequestHandler = async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'A valid email and password are required' })
    return
  }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatches) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = signToken(user.id)
  res.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  })
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().refine(isPasswordValid, { message: PASSWORD_REQUIREMENTS_MESSAGE }),
})

export const changePassword: RequestHandler = async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? PASSWORD_REQUIREMENTS_MESSAGE
    res.status(400).json({ error: message })
    return
  }

  const userId = req.user!.id
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

  const passwordMatches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!passwordMatches) {
    res.status(401).json({ error: 'Current password is incorrect' })
    return
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  })

  res.status(200).json({ status: 'ok' })
}

export const me: RequestHandler = (req, res) => {
  res.status(200).json({ user: req.user })
}

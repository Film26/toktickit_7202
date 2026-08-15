import { PrismaClient, Role, TicketStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const CATEGORY_NAMES = ['Account and Access', 'Hardware', 'Software', 'Network']

const RELATED_SYSTEM_NAMES = ['Corporate Laptop', 'Desktop Workstation', 'VPN', 'Email / Office 365']

type SeedUser = {
  email: string
  password: string
  fullName: string
  role: Role
  mustChangePassword: boolean
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'admin@toktickit.dev',
    password: 'Admin123!',
    fullName: 'Alex Administrator',
    role: Role.ADMINISTRATOR,
    mustChangePassword: false,
  },
  {
    email: 'itstaff@toktickit.dev',
    password: 'ItStaff123!',
    fullName: 'Ivy ITStaff',
    role: Role.IT_STAFF,
    mustChangePassword: false,
  },
  {
    email: 'requester@toktickit.dev',
    password: 'Requester123!',
    fullName: 'Rachel Requester',
    role: Role.REQUESTER,
    mustChangePassword: false,
  },
  {
    email: 'newuser@toktickit.dev',
    password: 'TempPass123!',
    fullName: 'Nolan Newuser',
    role: Role.REQUESTER,
    mustChangePassword: true,
  },
]

async function main() {
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  for (const name of RELATED_SYSTEM_NAMES) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  for (const seedUser of SEED_USERS) {
    const passwordHash = await bcrypt.hash(seedUser.password, 10)
    await prisma.user.upsert({
      where: { email: seedUser.email },
      update: {},
      create: {
        email: seedUser.email,
        passwordHash,
        fullName: seedUser.fullName,
        role: seedUser.role,
        mustChangePassword: seedUser.mustChangePassword,
      },
    })
  }

  const requester = await prisma.user.findUniqueOrThrow({ where: { email: 'requester@toktickit.dev' } })
  const itStaff = await prisma.user.findUniqueOrThrow({ where: { email: 'itstaff@toktickit.dev' } })
  const hardwareCategory = await prisma.category.findUniqueOrThrow({ where: { name: 'Hardware' } })
  const laptop = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: 'Corporate Laptop' } })

  const existingSampleTicket = await prisma.ticket.findUnique({ where: { ticketNumber: 'TKT-SAMPLE-000001' } })
  if (!existingSampleTicket) {
    await prisma.ticket.create({
      data: {
        ticketNumber: 'TKT-SAMPLE-000001',
        requesterId: requester.id,
        ownerId: itStaff.id,
        categoryId: hardwareCategory.id,
        relatedSystemId: laptop.id,
        summary: 'Laptop battery drains quickly',
        description:
          'My laptop battery is draining much faster than usual even when the system is idle. This started happening after last week’s Windows update.',
        requestedPriority: 'MEDIUM',
        itPriority: 'MEDIUM',
        status: TicketStatus.IN_PROGRESS,
      },
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })

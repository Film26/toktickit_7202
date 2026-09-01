import { PrismaClient, Role, TicketStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const CATEGORY_NAMES = ['Account and Access', 'Hardware', 'Software', 'Network']

const RELATED_SYSTEM_NAMES = [
  'Corporate Laptop',
  'Desktop Workstation',
  'VPN',
  'Email / Office 365',
  'Campus Wi-Fi',
  'Printer',
]

type SeedUser = {
  email: string
  password: string
  fullName: string
  role: Role
  mustChangePassword: boolean
  isActive?: boolean
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
  {
    // Lab 2 requires at least four active Development Requesters in the
    // Selector (labsheet Section 5.3).
    email: 'jennifer.anderson@toktickit.dev',
    password: 'Jennifer123!',
    fullName: 'Jennifer Anderson',
    role: Role.REQUESTER,
    mustChangePassword: false,
  },
  {
    email: 'david.lee@toktickit.dev',
    password: 'DavidLee123!',
    fullName: 'David Lee',
    role: Role.REQUESTER,
    mustChangePassword: false,
  },
  {
    // Lab 2 requires at least one inactive Development Requester in the seed
    // data (labsheet Section 5.3), so login/list behavior against a
    // deactivated account can be demonstrated and tested.
    email: 'inactive-requester@toktickit.dev',
    password: 'InactiveRequester123!',
    fullName: 'Ida Inactive',
    role: Role.REQUESTER,
    mustChangePassword: false,
    isActive: false,
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
        isActive: seedUser.isActive ?? true,
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

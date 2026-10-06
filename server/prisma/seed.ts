import { ActionStatus, PrismaClient, Role, TicketStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const CATEGORY_NAMES = ['Account and Access', 'Hardware', 'Software', 'Network']

export const RELATED_SYSTEM_NAMES = [
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

export const SEED_USERS: SeedUser[] = [
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
    // Lab 3 requires at least three active IT Staff accounts (labsheet
    // Section 5.3), so ownership can be demonstrated across more than one
    // staff member and the queue's owner filter has something to filter.
    email: 'marcus.tan@toktickit.dev',
    password: 'MarcusTan123!',
    fullName: 'Marcus Tan',
    role: Role.IT_STAFF,
    mustChangePassword: false,
  },
  {
    email: 'sofia.rivera@toktickit.dev',
    password: 'SofiaRivera123!',
    fullName: 'Sofia Rivera',
    role: Role.IT_STAFF,
    mustChangePassword: false,
  },
  {
    // Lab 3 requires at least one inactive IT Staff account (labsheet
    // Section 5.3), so login/list behavior against a deactivated staff
    // account can be demonstrated and tested, same as the inactive
    // Requester below.
    email: 'inactive-itstaff@toktickit.dev',
    password: 'InactiveItStaff123!',
    fullName: 'Ian Inactive',
    role: Role.IT_STAFF,
    mustChangePassword: false,
    isActive: false,
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
  const jennifer = await prisma.user.findUniqueOrThrow({ where: { email: 'jennifer.anderson@toktickit.dev' } })
  const david = await prisma.user.findUniqueOrThrow({ where: { email: 'david.lee@toktickit.dev' } })
  const itStaff = await prisma.user.findUniqueOrThrow({ where: { email: 'itstaff@toktickit.dev' } })
  const marcus = await prisma.user.findUniqueOrThrow({ where: { email: 'marcus.tan@toktickit.dev' } })
  const sofia = await prisma.user.findUniqueOrThrow({ where: { email: 'sofia.rivera@toktickit.dev' } })

  const categoryByName = async (name: string) => prisma.category.findUniqueOrThrow({ where: { name } })
  const relatedSystemByName = async (name: string) => prisma.relatedSystem.findUniqueOrThrow({ where: { name } })

  // Realistic Tickets spread across every currently-defined status, both
  // priorities and IT Priority (including still-unset, pre-triage), and
  // both assigned (across more than one IT Staff member) and unassigned
  // ownership -- labsheet Section 5.3.
  const seedTickets: Array<{
    ticketNumber: string
    requesterId: number
    ownerId: number | null
    categoryName: string
    relatedSystemName: string
    summary: string
    description: string
    requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    itPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null
    status: TicketStatus
    resolutionSummary?: string
    resolvedAt?: Date
    closedAt?: Date
  }> = [
    {
      ticketNumber: 'TKT-SAMPLE-000001',
      requesterId: requester.id,
      ownerId: itStaff.id,
      categoryName: 'Hardware',
      relatedSystemName: 'Corporate Laptop',
      summary: 'Laptop battery drains quickly',
      description:
        'My laptop battery is draining much faster than usual even when the system is idle. This started happening after last week’s Windows update.',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
      status: TicketStatus.IN_PROGRESS,
    },
    {
      ticketNumber: 'TKT-SAMPLE-000002',
      requesterId: jennifer.id,
      ownerId: null,
      categoryName: 'Software',
      relatedSystemName: 'Email / Office 365',
      summary: 'Cannot send attachments over 10MB',
      description: 'Outlook rejects any attachment larger than 10MB with a generic error. Not sure if this is a mailbox or client setting.',
      requestedPriority: 'HIGH',
      itPriority: null,
      status: TicketStatus.NEW,
    },
    {
      ticketNumber: 'TKT-SAMPLE-000003',
      requesterId: david.id,
      ownerId: marcus.id,
      categoryName: 'Network',
      relatedSystemName: 'VPN',
      summary: 'VPN disconnects after 15 minutes idle',
      description: 'The VPN client drops the connection after about 15 minutes of inactivity, requiring a full re-login.',
      requestedPriority: 'LOW',
      itPriority: 'LOW',
      status: TicketStatus.RESOLVED,
      resolutionSummary: 'Increased the idle-timeout setting on the VPN profile from 15 to 60 minutes.',
      resolvedAt: new Date(),
    },
    {
      ticketNumber: 'TKT-SAMPLE-000004',
      requesterId: requester.id,
      ownerId: itStaff.id,
      categoryName: 'Account and Access',
      relatedSystemName: 'Campus Wi-Fi',
      summary: 'Locked out of Wi-Fi after password change',
      description: 'Changed my domain password yesterday and now my laptop refuses to reconnect to the campus network.',
      requestedPriority: 'URGENT',
      itPriority: 'URGENT',
      status: TicketStatus.CLOSED,
      resolutionSummary: 'Forgot the old saved Wi-Fi profile on the device; removed and re-added the network with the new password.',
      resolvedAt: new Date(),
      closedAt: new Date(),
    },
    {
      ticketNumber: 'TKT-SAMPLE-000005',
      requesterId: jennifer.id,
      ownerId: sofia.id,
      categoryName: 'Hardware',
      relatedSystemName: 'Printer',
      summary: 'Printer still jamming after last fix',
      description: 'The 3rd floor printer is jamming again on the same tray that was serviced two weeks ago.',
      requestedPriority: 'MEDIUM',
      itPriority: 'HIGH',
      status: TicketStatus.REOPENED,
    },
    {
      ticketNumber: 'TKT-SAMPLE-000006',
      requesterId: david.id,
      ownerId: null,
      categoryName: 'Software',
      relatedSystemName: 'Desktop Workstation',
      summary: 'Request to install design software',
      description: 'Need the standard design software suite installed on my workstation for an upcoming project.',
      requestedPriority: 'LOW',
      itPriority: null,
      status: TicketStatus.NEW,
    },
    // Lab 4 (labsheet Section 5.3): make sure every one of the 8 statuses is
    // present, so each dashboard card has non-zero demo data somewhere.
    {
      ticketNumber: 'TKT-SAMPLE-000007',
      requesterId: jennifer.id,
      ownerId: marcus.id,
      categoryName: 'Account and Access',
      relatedSystemName: 'Email / Office 365',
      summary: 'Shared mailbox missing from Outlook',
      description: 'The team shared mailbox disappeared from my Outlook folder list this morning.',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
      status: TicketStatus.OPEN,
    },
    {
      ticketNumber: 'TKT-SAMPLE-000008',
      requesterId: requester.id,
      ownerId: sofia.id,
      categoryName: 'Network',
      relatedSystemName: 'Campus Wi-Fi',
      summary: 'Wi-Fi drops in meeting room 4B',
      description: 'Laptops lose the campus Wi-Fi every few minutes, but only inside meeting room 4B.',
      requestedPriority: 'HIGH',
      itPriority: 'HIGH',
      status: TicketStatus.WAITING_FOR_REQUESTER,
    },
    {
      ticketNumber: 'TKT-SAMPLE-000009',
      requesterId: david.id,
      ownerId: null,
      categoryName: 'Hardware',
      relatedSystemName: 'Desktop Workstation',
      summary: 'Duplicate request: second monitor',
      description: 'Submitted twice by mistake -- same request as an earlier ticket.',
      requestedPriority: 'LOW',
      itPriority: 'LOW',
      status: TicketStatus.CANCELLED,
    },
  ]

  const createdTickets = new Map<string, number>()
  for (const spec of seedTickets) {
    const existing = await prisma.ticket.findUnique({ where: { ticketNumber: spec.ticketNumber } })
    if (existing) {
      createdTickets.set(spec.ticketNumber, existing.id)
      continue
    }

    const category = await categoryByName(spec.categoryName)
    const relatedSystem = await relatedSystemByName(spec.relatedSystemName)
    const created = await prisma.ticket.create({
      data: {
        ticketNumber: spec.ticketNumber,
        requesterId: spec.requesterId,
        ownerId: spec.ownerId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: spec.summary,
        description: spec.description,
        requestedPriority: spec.requestedPriority,
        itPriority: spec.itPriority,
        status: spec.status,
        resolutionSummary: spec.resolutionSummary,
        resolvedAt: spec.resolvedAt,
        closedAt: spec.closedAt,
      },
    })
    createdTickets.set(spec.ticketNumber, created.id)
  }

  // Example Public Comments and Internal Notes -- deliberately generic
  // (no real names, account numbers, or other sensitive detail), and only
  // added the first time each ticket is seeded (checked via count) so
  // re-running the seed never duplicates them.
  const commentSeeds: Array<{ ticketNumber: string; authorId: number; body: string; internal?: boolean }> = [
    {
      ticketNumber: 'TKT-SAMPLE-000001',
      authorId: requester.id,
      body: 'Just adding that this happens even when I close all applications first.',
    },
    {
      ticketNumber: 'TKT-SAMPLE-000001',
      authorId: itStaff.id,
      body: 'Thanks for the detail -- checking the battery health report on the device now.',
    },
    {
      ticketNumber: 'TKT-SAMPLE-000001',
      authorId: itStaff.id,
      body: 'Battery health is at 78%. Waiting on a replacement unit before we can close this out.',
      internal: true,
    },
    {
      ticketNumber: 'TKT-SAMPLE-000003',
      authorId: david.id,
      body: 'Confirmed -- connection has been stable all day since the change. Thank you!',
    },
  ]

  for (const seedComment of commentSeeds) {
    const ticketId = createdTickets.get(seedComment.ticketNumber)
    if (!ticketId) continue

    if (seedComment.internal) {
      const existingCount = await prisma.internalNote.count({ where: { ticketId, body: seedComment.body } })
      if (existingCount === 0) {
        await prisma.internalNote.create({ data: { ticketId, authorId: seedComment.authorId, body: seedComment.body } })
      }
    } else {
      const existingCount = await prisma.publicComment.count({ where: { ticketId, body: seedComment.body } })
      if (existingCount === 0) {
        await prisma.publicComment.create({ data: { ticketId, authorId: seedComment.authorId, body: seedComment.body } })
      }
    }
  }

  // Actions Taken (Lab 4, labsheet Section 5.3): Tickets with zero (000002,
  // 000006, 000007, 000009), one (000003, 000005, 000008) and many (000001,
  // 000004) actions, performed by and assigned to different IT Staff --
  // including actions not assigned to the Ticket Owner (BR-02). Keyed by a
  // fixed clientRequestId, so re-running the seed never duplicates them.
  const actionSeeds: Array<{
    key: string
    ticketNumber: string
    authorId: number
    assigneeId: number
    status: ActionStatus
    description: string
    result?: string
    followUpNote?: string
    attachmentNotes?: string
  }> = [
    {
      key: 'seed-action-000001-a',
      ticketNumber: 'TKT-SAMPLE-000001',
      authorId: itStaff.id,
      assigneeId: itStaff.id,
      status: ActionStatus.COMPLETED,
      description: 'Ran the battery health report and checked power settings.',
      result: 'Battery health at 78%; power plan was reset to High Performance by the update.',
      followUpNote: 'Order a replacement battery if health drops below 75%.',
      attachmentNotes: 'battery-report.html attached to the ticket.',
    },
    {
      key: 'seed-action-000001-b',
      ticketNumber: 'TKT-SAMPLE-000001',
      authorId: itStaff.id,
      assigneeId: marcus.id,
      status: ActionStatus.IN_PROGRESS,
      description: 'Request a replacement battery from the hardware vendor.',
    },
    {
      key: 'seed-action-000001-c',
      ticketNumber: 'TKT-SAMPLE-000001',
      authorId: marcus.id,
      assigneeId: itStaff.id,
      status: ActionStatus.PLANNED,
      description: 'Install the replacement battery and re-test runtime.',
    },
    {
      key: 'seed-action-000003-a',
      ticketNumber: 'TKT-SAMPLE-000003',
      authorId: marcus.id,
      assigneeId: marcus.id,
      status: ActionStatus.COMPLETED,
      description: 'Raised the VPN profile idle timeout from 15 to 60 minutes.',
      result: 'Requester confirmed the connection stayed up for a full working day.',
    },
    {
      key: 'seed-action-000004-a',
      ticketNumber: 'TKT-SAMPLE-000004',
      authorId: itStaff.id,
      assigneeId: itStaff.id,
      status: ActionStatus.COMPLETED,
      description: 'Checked the account is not locked in the directory.',
      result: 'Account healthy; the problem is on the device.',
    },
    {
      key: 'seed-action-000004-b',
      ticketNumber: 'TKT-SAMPLE-000004',
      authorId: itStaff.id,
      assigneeId: itStaff.id,
      status: ActionStatus.COMPLETED,
      description: 'Removed the saved Wi-Fi profile and re-joined with the new password.',
      result: 'Laptop reconnected to the campus network.',
    },
    {
      key: 'seed-action-000005-a',
      ticketNumber: 'TKT-SAMPLE-000005',
      authorId: sofia.id,
      assigneeId: sofia.id,
      status: ActionStatus.CANCELLED,
      description: 'Replace tray 2 pickup roller (vendor visit).',
    },
    {
      key: 'seed-action-000008-a',
      ticketNumber: 'TKT-SAMPLE-000008',
      authorId: sofia.id,
      assigneeId: sofia.id,
      status: ActionStatus.COMPLETED,
      description: 'Checked access-point logs for meeting room 4B.',
      result: 'Access point reboots every few minutes; firmware update scheduled.',
      followUpNote: 'Requester to confirm whether drops continue after the overnight firmware update.',
    },
  ]

  for (const [index, seedAction] of actionSeeds.entries()) {
    const ticketId = createdTickets.get(seedAction.ticketNumber)
    if (!ticketId) continue
    const existing = await prisma.actionTaken.findUnique({
      where: { ticketId_clientRequestId: { ticketId, clientRequestId: seedAction.key } },
    })
    if (existing) continue

    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { createdAt: true } })
    // Dated just after the ticket was created (BR-10), one second apart so
    // the list order is the order above.
    const actionAt = new Date(ticket.createdAt.getTime() + (index + 1) * 1000)
    await prisma.actionTaken.create({
      data: {
        ticketId,
        clientRequestId: seedAction.key,
        authorId: seedAction.authorId,
        assigneeId: seedAction.assigneeId,
        status: seedAction.status,
        actionAt,
        description: seedAction.description,
        result: seedAction.result,
        followUpRequired: !!seedAction.followUpNote,
        followUpNote: seedAction.followUpNote,
        attachmentNotes: seedAction.attachmentNotes,
        completedAt: seedAction.status === ActionStatus.COMPLETED ? actionAt : null,
        cancelledAt: seedAction.status === ActionStatus.CANCELLED ? actionAt : null,
      },
    })
  }
}

export { main }

// Only auto-run when executed directly (`tsx prisma/seed.ts`, or via
// `prisma db seed`) -- not when imported by a test, so the idempotency
// test can call main() twice against an already-open Prisma connection
// without spawning a subprocess per call.
if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect()
    })
    .catch(async (error) => {
      console.error(error)
      await prisma.$disconnect()
      process.exit(1)
    })
}

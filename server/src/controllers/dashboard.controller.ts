import type { RequestHandler } from 'express'
import type { Prisma, TicketStatus } from '@prisma/client'
import prisma from '../db'
import { DASHBOARD_TIME_ZONE, bangkokDayStart } from '../lib/dashboardTime'
import { OPEN_STATUS_GROUP, PRIORITY_VALUES } from '../lib/ticketFilters'

// Role dashboards (docs/lab-04/specification.md section 8, api-spec
// "Dashboards"). Every number is a COUNT computed here from the database
// (BR-20); each metric carries the drill-down link whose list query uses the
// same filter, so the card and the list it opens always agree (AC-18).

const LIST_LIMIT = 5
const RECENTLY_RESOLVED_DAYS = 7

const TICKET_CARD_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  status: true,
  itPriority: true,
  updatedAt: true,
  resolvedAt: true,
} satisfies Prisma.TicketSelect

type MetricDefinition = {
  key: string
  label: string
  where: Prisma.TicketWhereInput
  drillDown: string
  // Status whose "entered today" count is shown as "+N today".
  deltaStatus?: TicketStatus
}

async function buildMetrics(definitions: MetricDefinition[], todayStart: Date | null) {
  return Promise.all(
    definitions.map(async (definition) => {
      const value = await prisma.ticket.count({ where: definition.where })
      const todayDelta =
        definition.deltaStatus && todayStart
          ? await prisma.ticketStatusChange.count({
              where: { toStatus: definition.deltaStatus, createdAt: { gte: todayStart } },
            })
          : null
      return { key: definition.key, label: definition.label, value, todayDelta, drillDown: definition.drillDown }
    }),
  )
}

export const requesterDashboard: RequestHandler = async (req, res) => {
  const mine: Prisma.TicketWhereInput = { requesterId: req.user!.id }
  const resolvedSince = new Date(Date.now() - RECENTLY_RESOLVED_DAYS * 24 * 60 * 60 * 1000)

  const [metrics, attentionRequired, recentTickets, recentlyResolved] = await Promise.all([
    buildMetrics(
      [
        { key: 'open', label: 'My Open Tickets', where: { ...mine, status: { in: OPEN_STATUS_GROUP } }, drillDown: '/tickets?statusGroup=open' },
        { key: 'inProgress', label: 'In Progress', where: { ...mine, status: 'IN_PROGRESS' }, drillDown: '/tickets?status=IN_PROGRESS' },
        {
          key: 'waitingForMe',
          label: 'Waiting for Me',
          where: { ...mine, status: 'WAITING_FOR_REQUESTER' },
          drillDown: '/tickets?status=WAITING_FOR_REQUESTER',
        },
        { key: 'resolved', label: 'Resolved', where: { ...mine, status: 'RESOLVED' }, drillDown: '/tickets?status=RESOLVED' },
        { key: 'closed', label: 'Closed', where: { ...mine, status: 'CLOSED' }, drillDown: '/tickets?status=CLOSED' },
      ],
      null,
    ),
    prisma.ticket.findMany({
      where: { ...mine, status: { in: ['WAITING_FOR_REQUESTER', 'RESOLVED'] } },
      select: TICKET_CARD_SELECT,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: LIST_LIMIT,
    }),
    prisma.ticket.findMany({ where: mine, select: TICKET_CARD_SELECT, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: LIST_LIMIT }),
    prisma.ticket.findMany({
      where: { ...mine, resolvedAt: { gte: resolvedSince } },
      select: TICKET_CARD_SELECT,
      orderBy: [{ resolvedAt: 'desc' }, { id: 'desc' }],
      take: LIST_LIMIT,
    }),
  ])

  res.status(200).json({
    generatedAt: new Date().toISOString(),
    timeZone: DASHBOARD_TIME_ZONE,
    metrics,
    attentionRequired,
    recentTickets,
    recentlyResolved,
  })
}

export const staffDashboard: RequestHandler = async (req, res) => {
  const me = req.user!.id
  const open: Prisma.TicketWhereInput = { status: { in: OPEN_STATUS_GROUP } }
  const todayStart = bangkokDayStart()

  const [metrics, byItPriority, recentTickets, openActionItems, openActionTotal, userCounts] = await Promise.all([
    buildMetrics(
      [
        { key: 'new', label: 'New', where: { status: 'NEW' }, drillDown: '/queue?status=NEW', deltaStatus: 'NEW' },
        { key: 'open', label: 'Open', where: { status: 'OPEN' }, drillDown: '/queue?status=OPEN', deltaStatus: 'OPEN' },
        {
          key: 'inProgress',
          label: 'In Progress',
          where: { status: 'IN_PROGRESS' },
          drillDown: '/queue?status=IN_PROGRESS',
          deltaStatus: 'IN_PROGRESS',
        },
        {
          key: 'waitingForRequester',
          label: 'Waiting for Requester',
          where: { status: 'WAITING_FOR_REQUESTER' },
          drillDown: '/queue?status=WAITING_FOR_REQUESTER',
          deltaStatus: 'WAITING_FOR_REQUESTER',
        },
        { key: 'myAssigned', label: 'My Assigned', where: { ...open, ownerId: me }, drillDown: '/queue?ownerId=me&statusGroup=open' },
        {
          key: 'unassigned',
          label: 'Unassigned',
          where: { ...open, ownerId: null },
          drillDown: '/queue?ownerId=unassigned&statusGroup=open',
        },
      ],
      todayStart,
    ),
    Promise.all(
      [...PRIORITY_VALUES, null].map(async (priority) => ({
        priority: priority ?? 'unset',
        value: await prisma.ticket.count({ where: { ...open, itPriority: priority } }),
        drillDown: `/queue?statusGroup=open&itPriority=${priority ?? 'unset'}`,
      })),
    ),
    prisma.ticket.findMany({
      where: { ownerId: me },
      select: TICKET_CARD_SELECT,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: LIST_LIMIT,
    }),
    prisma.actionTaken.findMany({
      where: { assigneeId: me, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
      select: {
        id: true,
        ticketId: true,
        description: true,
        status: true,
        actionAt: true,
        ticket: { select: { ticketNumber: true } },
      },
      orderBy: [{ actionAt: 'asc' }, { id: 'asc' }],
      take: LIST_LIMIT,
    }),
    prisma.actionTaken.count({ where: { assigneeId: me, status: { in: ['PLANNED', 'IN_PROGRESS'] } } }),
    req.user!.role === 'ADMINISTRATOR'
      ? Promise.all([
          prisma.user.count({ where: { role: 'REQUESTER', isActive: true } }),
          prisma.user.count({ where: { role: 'IT_STAFF', isActive: true } }),
          prisma.user.count({ where: { role: 'ADMINISTRATOR', isActive: true } }),
          prisma.user.count({ where: { isActive: false } }),
        ]).then(([activeRequesters, activeItStaff, activeAdministrators, inactive]) => ({
          activeRequesters,
          activeItStaff,
          activeAdministrators,
          inactive,
        }))
      : Promise.resolve(null),
  ])

  res.status(200).json({
    generatedAt: new Date().toISOString(),
    timeZone: DASHBOARD_TIME_ZONE,
    metrics,
    byItPriority,
    recentTickets,
    myOpenActions: {
      total: openActionTotal,
      items: openActionItems.map(({ ticket, ...action }) => ({ ...action, ticketNumber: ticket.ticketNumber })),
    },
    userCounts,
  })
}

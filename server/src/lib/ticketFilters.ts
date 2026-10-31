import type { Priority, Prisma, TicketStatus } from '@prisma/client'

// Shared list filters so a dashboard metric and its drill-down list always
// use the same definition (docs/lab-04/specification.md BR-21, section 8).

export const OPEN_STATUS_GROUP: TicketStatus[] = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED']

export const PRIORITY_VALUES: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']

// `status` (one exact value) wins over `statusGroup`; unknown values are ignored.
export function statusFilter(status: unknown, statusGroup: unknown, allStatuses: readonly string[]): Prisma.TicketWhereInput {
  if (typeof status === 'string' && allStatuses.includes(status)) return { status: status as TicketStatus }
  if (statusGroup === 'open') return { status: { in: OPEN_STATUS_GROUP } }
  return {}
}

export function itPriorityFilter(itPriority: unknown): Prisma.TicketWhereInput {
  if (itPriority === 'unset') return { itPriority: null }
  if (typeof itPriority === 'string' && (PRIORITY_VALUES as string[]).includes(itPriority)) return { itPriority: itPriority as Priority }
  return {}
}

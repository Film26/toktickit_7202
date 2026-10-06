import { apiFetch } from './client'
import type { ActionStatus, Priority, TicketStatus } from './tickets'

// Shapes from docs/lab-04/api-spec.md "Dashboards".

export type DashboardMetric = { key: string; label: string; value: number; todayDelta: number | null; drillDown: string }

export type DashboardTicketCard = {
  id: number
  ticketNumber: string
  summary: string
  status: TicketStatus
  itPriority: Priority | null
  updatedAt: string
  resolvedAt: string | null
}

export type RequesterDashboard = {
  generatedAt: string
  timeZone: string
  metrics: DashboardMetric[]
  attentionRequired: DashboardTicketCard[]
  recentTickets: DashboardTicketCard[]
  recentlyResolved: DashboardTicketCard[]
}

export type StaffDashboard = {
  generatedAt: string
  timeZone: string
  metrics: DashboardMetric[]
  byItPriority: Array<{ priority: Priority | 'unset'; value: number; drillDown: string }>
  recentTickets: DashboardTicketCard[]
  myOpenActions: {
    total: number
    items: Array<{ id: number; ticketId: number; ticketNumber: string; description: string; status: ActionStatus; actionAt: string }>
  }
  userCounts: { activeRequesters: number; activeItStaff: number; activeAdministrators: number; inactive: number } | null
}

export function fetchRequesterDashboard(token: string) {
  return apiFetch<RequesterDashboard>('/api/dashboard/requester', { token })
}

export function fetchStaffDashboard(token: string) {
  return apiFetch<StaffDashboard>('/api/dashboard/staff', { token })
}

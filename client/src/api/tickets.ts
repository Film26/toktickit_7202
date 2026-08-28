import { apiFetch, apiFetchBlob } from './client'
import type { Role } from './auth'

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED'

export type TicketSummary = {
  id: number
  ticketNumber: string
  summary: string
  status: TicketStatus
  requestedPriority: Priority
  itPriority: Priority | null
  createdAt: string
  category: { id: number; name: string }
  owner: { id: number; fullName: string } | null
  requester?: { id: number; fullName: string }
}

export type Participant = { id: number; fullName: string; role: Role }
export type TicketComment = { id: number; body: string; createdAt: string; author: Participant }
export type TicketAction = { id: number; description: string; createdAt: string; updatedAt: string; author: Participant }
export type TicketAttachment = {
  id: number
  filename: string
  mimeType: string
  sizeBytes: number
  isActive: boolean
  createdAt: string
  uploader: Participant
  removedAt: string | null
  removedReason: string | null
  removedBy: Participant | null
}

export const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_ACTIVE_ATTACHMENTS = 5

export type TicketDetail = {
  id: number
  ticketNumber: string
  summary: string
  description: string
  status: TicketStatus
  requestedPriority: Priority
  itPriority: Priority | null
  resolutionSummary: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  closedAt: string | null
  requester: { id: number; fullName: string; email: string }
  owner: { id: number; fullName: string; email: string } | null
  category: { id: number; name: string }
  relatedSystem: { id: number; name: string } | null
  publicComments: TicketComment[]
  internalNotes?: TicketComment[]
  actionsTaken: TicketAction[]
  attachments: TicketAttachment[]
}

export function fetchMyTickets(token: string, status?: TicketStatus) {
  const qs = status ? `?status=${status}` : ''
  return apiFetch<TicketSummary[]>(`/api/tickets/mine${qs}`, { token })
}

export function fetchAllTickets(
  token: string,
  params: { status?: TicketStatus; ownerId?: string; categoryId?: number; q?: string } = {},
) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.ownerId) query.set('ownerId', params.ownerId)
  if (params.categoryId) query.set('categoryId', String(params.categoryId))
  if (params.q) query.set('q', params.q)
  const qs = query.toString()
  return apiFetch<TicketSummary[]>(`/api/tickets${qs ? `?${qs}` : ''}`, { token })
}

export function fetchTicket(token: string, id: number) {
  return apiFetch<TicketDetail>(`/api/tickets/${id}`, { token })
}

export function createTicket(
  token: string,
  data: { categoryId: number; relatedSystemId?: number; summary: string; description: string; requestedPriority?: Priority },
) {
  return apiFetch<TicketDetail>('/api/tickets', { method: 'POST', token, body: data })
}

export function updateTicketPriority(token: string, id: number, requestedPriority: Priority) {
  return apiFetch<TicketDetail>(`/api/tickets/${id}/priority`, { method: 'PATCH', token, body: { requestedPriority } })
}

export function updateTicketOwner(token: string, id: number, ownerId: number | null) {
  return apiFetch<TicketDetail>(`/api/tickets/${id}/owner`, { method: 'PATCH', token, body: { ownerId } })
}

export function updateTicketItPriority(token: string, id: number, itPriority: Priority) {
  return apiFetch<TicketDetail>(`/api/tickets/${id}/it-priority`, { method: 'PATCH', token, body: { itPriority } })
}

export function updateTicketStatus(token: string, id: number, status: TicketStatus) {
  return apiFetch<TicketDetail>(`/api/tickets/${id}/status`, { method: 'PATCH', token, body: { status } })
}

export function resolveTicket(token: string, id: number, resolutionSummary: string) {
  return apiFetch<TicketDetail>(`/api/tickets/${id}/resolve`, { method: 'POST', token, body: { resolutionSummary } })
}

export function closeTicket(token: string, id: number) {
  return apiFetch<TicketDetail>(`/api/tickets/${id}/close`, { method: 'POST', token })
}

export function confirmResolution(token: string, id: number) {
  return apiFetch<TicketDetail>(`/api/tickets/${id}/confirm-resolution`, { method: 'POST', token })
}

export function rejectResolution(token: string, id: number) {
  return apiFetch<TicketDetail>(`/api/tickets/${id}/reject-resolution`, { method: 'POST', token })
}

export function requestReopen(token: string, id: number) {
  return apiFetch<TicketDetail>(`/api/tickets/${id}/request-reopen`, { method: 'POST', token })
}

export function addComment(token: string, id: number, body: string) {
  return apiFetch<TicketComment>(`/api/tickets/${id}/comments`, { method: 'POST', token, body: { body } })
}

export function addNote(token: string, id: number, body: string) {
  return apiFetch<TicketComment>(`/api/tickets/${id}/notes`, { method: 'POST', token, body: { body } })
}

export function addAction(token: string, id: number, description: string) {
  return apiFetch<TicketAction>(`/api/tickets/${id}/actions`, { method: 'POST', token, body: { description } })
}

export function updateAction(token: string, id: number, actionId: number, description: string) {
  return apiFetch<TicketAction>(`/api/tickets/${id}/actions/${actionId}`, { method: 'PATCH', token, body: { description } })
}

export function addAttachment(token: string, id: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<TicketAttachment>(`/api/tickets/${id}/attachments`, { method: 'POST', token, body: formData })
}

export async function downloadAttachment(token: string, attachmentId: number, fallbackFilename: string) {
  const { blob, filename } = await apiFetchBlob(`/api/attachments/${attachmentId}/download`, token)
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename ?? fallbackFilename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export function removeAttachment(token: string, attachmentId: number, reason: string) {
  return apiFetch<TicketAttachment>(`/api/attachments/${attachmentId}`, { method: 'DELETE', token, body: { reason } })
}

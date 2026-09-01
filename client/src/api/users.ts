import { apiFetch } from './client'
import type { Role } from './auth'

export type ManagedUser = {
  id: number
  email: string
  fullName: string
  role: Role
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
}

export function fetchUsers(token: string, params: { q?: string; role?: Role; isActive?: boolean } = {}) {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.role) query.set('role', params.role)
  if (params.isActive !== undefined) query.set('isActive', String(params.isActive))
  const qs = query.toString()
  return apiFetch<ManagedUser[]>(`/api/users${qs ? `?${qs}` : ''}`, { token })
}

export function createUser(token: string, data: { email: string; fullName: string; role: Role }) {
  return apiFetch<{ user: ManagedUser; temporaryPassword: string }>('/api/users', {
    method: 'POST',
    token,
    body: data,
  })
}

export function updateUser(token: string, id: number, data: Partial<{ fullName: string; email: string; role: Role }>) {
  return apiFetch<ManagedUser>(`/api/users/${id}`, { method: 'PATCH', token, body: data })
}

export function setUserStatus(token: string, id: number, isActive: boolean) {
  return apiFetch<ManagedUser>(`/api/users/${id}/status`, { method: 'PATCH', token, body: { isActive } })
}

export function resetUserPassword(token: string, id: number) {
  return apiFetch<{ temporaryPassword: string }>(`/api/users/${id}/reset-password`, { method: 'POST', token })
}

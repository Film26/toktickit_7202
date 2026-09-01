import { apiFetch } from './client'

export type Role = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'

export type AuthUser = {
  id: number
  email: string
  fullName: string
  role: Role
  mustChangePassword: boolean
}

export function login(email: string, password: string) {
  return apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export function fetchMe(token: string) {
  return apiFetch<{ user: AuthUser }>('/api/auth/me', { token })
}

export function changePassword(token: string, currentPassword: string, newPassword: string) {
  return apiFetch<{ status: string }>('/api/auth/change-password', {
    method: 'POST',
    token,
    body: { currentPassword, newPassword },
  })
}

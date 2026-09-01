import { apiFetch } from './client'
import type { AuthUser } from './auth'

export type ActiveRequester = { id: number; fullName: string; email: string }

export function fetchActiveRequesters() {
  return apiFetch<ActiveRequester[]>('/api/requesters')
}

// Lab 2 Development Requester Selector - picks an identity by id, not a
// login. No password is collected or sent. See requesters.controller.ts
// (devSelectRequester) for the matching backend testing-only endpoint.
export function devSelectRequester(requesterId: number) {
  return apiFetch<{ token: string; user: AuthUser }>('/api/requesters/dev-select', {
    method: 'POST',
    body: { requesterId },
  })
}

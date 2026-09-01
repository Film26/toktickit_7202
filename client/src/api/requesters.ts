import { apiFetch } from './client'

export type ActiveRequester = { id: number; fullName: string; email: string }

export function fetchActiveRequesters() {
  return apiFetch<ActiveRequester[]>('/api/requesters')
}

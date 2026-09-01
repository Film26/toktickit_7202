import { apiFetch } from './client'

export type RelatedSystem = {
  id: number
  name: string
  isActive?: boolean
  createdAt?: string
}

export function fetchRelatedSystems() {
  return apiFetch<RelatedSystem[]>('/api/related-systems')
}

export function fetchAllRelatedSystems(token: string) {
  return apiFetch<RelatedSystem[]>('/api/related-systems/manage', { token })
}

export function createRelatedSystem(token: string, name: string) {
  return apiFetch<RelatedSystem>('/api/related-systems', { method: 'POST', token, body: { name } })
}

export function updateRelatedSystem(token: string, id: number, data: { name?: string; isActive?: boolean }) {
  return apiFetch<RelatedSystem>(`/api/related-systems/${id}`, { method: 'PATCH', token, body: data })
}

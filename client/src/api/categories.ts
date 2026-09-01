import { apiFetch } from './client'

export type Category = {
  id: number
  name: string
  isActive?: boolean
  createdAt?: string
}

export function fetchCategories() {
  return apiFetch<Category[]>('/api/categories')
}

export function fetchAllCategories(token: string) {
  return apiFetch<Category[]>('/api/categories/manage', { token })
}

export function createCategory(token: string, name: string) {
  return apiFetch<Category>('/api/categories', { method: 'POST', token, body: { name } })
}

export function updateCategory(token: string, id: number, data: { name?: string; isActive?: boolean }) {
  return apiFetch<Category>(`/api/categories/${id}`, { method: 'PATCH', token, body: data })
}

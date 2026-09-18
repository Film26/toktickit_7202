import type { APIRequestContext } from '@playwright/test'

// Lab 3 E2E specs drive the UI for the behavior under test, but use these
// helpers to set up/verify state directly against the real dev API (same
// server the client talks to) - creating a throwaway Requester ticket or
// temp-password user this way is faster and more reliable than doing it
// through several extra UI steps that aren't themselves what's being tested.
const API_BASE_URL = 'http://localhost:4000'

async function asJson<T>(response: { ok(): boolean; status(): number; text(): Promise<string> }): Promise<T> {
  if (!response.ok()) {
    throw new Error(`API request failed with ${response.status()}: ${await response.text()}`)
  }
  return JSON.parse(await response.text()) as T
}

export async function apiLogin(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${API_BASE_URL}/api/auth/login`, { data: { email, password } })
  const body = await asJson<{ token: string }>(response)
  return body.token
}

export async function apiCreateUser(
  request: APIRequestContext,
  adminToken: string,
  data: { email: string; fullName: string; role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'; isActive?: boolean },
) {
  const response = await request.post(`${API_BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data,
  })
  return asJson<{ user: { id: number; email: string }; temporaryPassword: string }>(response)
}

export async function apiCreateTicket(
  request: APIRequestContext,
  requesterToken: string,
  data: { categoryId: number; summary: string; description: string; requestedPriority?: string },
) {
  const response = await request.post(`${API_BASE_URL}/api/tickets`, {
    headers: { Authorization: `Bearer ${requesterToken}` },
    data,
  })
  return asJson<{ id: number; ticketNumber: string }>(response)
}

export async function apiFetchCategories(request: APIRequestContext) {
  const response = await request.get(`${API_BASE_URL}/api/categories`)
  return asJson<Array<{ id: number; name: string }>>(response)
}

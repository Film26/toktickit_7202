const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {}
  if (!isFormData) {
    // omit Content-Type for FormData - the browser sets it (with the
    // multipart boundary) automatically, which JSON.stringify below would break
    headers['Content-Type'] = 'application/json'
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: isFormData ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const data: unknown = contentType.includes('application/json') ? await response.json() : undefined

  if (!response.ok) {
    const message = isRecord(data) && typeof data.error === 'string' ? data.error : `Request failed with status ${response.status}`
    throw new ApiError(response.status, message)
  }

  return data as T
}

// For endpoints that return a raw file (e.g. attachment download) rather
// than JSON - returns the Blob plus a best-effort filename from
// Content-Disposition, or throws ApiError on failure using whatever error
// body the server provided.
export async function apiFetchBlob(path: string, token: string): Promise<{ blob: Blob; filename: string | null }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const data: unknown = contentType.includes('application/json') ? await response.json() : undefined
    const message = isRecord(data) && typeof data.error === 'string' ? data.error : `Request failed with status ${response.status}`
    throw new ApiError(response.status, message)
  }

  const disposition = response.headers.get('content-disposition') ?? ''
  const match = /filename="?([^"]+)"?/.exec(disposition)
  return { blob: await response.blob(), filename: match ? match[1] : null }
}

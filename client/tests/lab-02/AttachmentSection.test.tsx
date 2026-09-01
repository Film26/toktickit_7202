// There is no standalone "AttachmentSection" component in this codebase -
// the attachments tab (list, upload, download, soft-remove) lives inline
// inside TicketDetailView (client/src/components/TicketDetailView.tsx). Per
// the Lab 2 test plan, when a UI concern isn't a separable component, it is
// tested through the view that owns it - that's what this file does,
// scoped to the Requester's attachment interactions only.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'
import TicketDetailView from '../../src/components/TicketDetailView'

const REQUESTER = {
  id: 3,
  email: 'requester@toktickit.dev',
  fullName: 'Rachel Requester',
  role: 'REQUESTER',
  mustChangePassword: false,
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }
}

function baseTicket(attachments: unknown[] = []) {
  return {
    id: 1,
    ticketNumber: 'TKT-2026-000001',
    summary: 'Printer will not connect',
    description: 'Cannot print from the shared office printer.',
    status: 'NEW',
    requestedPriority: 'MEDIUM',
    itPriority: null,
    resolutionSummary: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    closedAt: null,
    requester: { id: 3, fullName: 'Rachel Requester', email: 'requester@toktickit.dev' },
    owner: null,
    category: { id: 1, name: 'Hardware' },
    relatedSystem: null,
    publicComments: [],
    actionsTaken: [],
    attachments,
  }
}

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/tickets/1']}>
      <AuthProvider>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailView backTo="/dashboard" backLabel="My Tickets" />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function openAttachmentsTab() {
  await waitFor(() => {
    expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
  })
  await userEvent.click(screen.getByRole('button', { name: /Attachments/ }))
}

describe('Attachment behavior in TicketDetailView (Lab 2)', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('lists existing attachments with filename, size, and uploader', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const path = url.replace('http://localhost:4000', '')
        if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
        if (path === '/api/tickets/1') {
          return Promise.resolve(
            jsonResponse(
              baseTicket([
                {
                  id: 10,
                  filename: 'error-screenshot.png',
                  mimeType: 'image/png',
                  sizeBytes: 2048,
                  isActive: true,
                  createdAt: new Date().toISOString(),
                  uploader: { id: 3, fullName: 'Rachel Requester', role: 'REQUESTER' },
                  removedAt: null,
                  removedReason: null,
                  removedBy: null,
                },
              ]),
            ),
          )
        }
        return Promise.resolve(jsonResponse([]))
      }),
    )

    renderView()
    await openAttachmentsTab()

    expect(screen.getByText('error-screenshot.png')).toBeInTheDocument()
    expect(screen.getByText('(2.0 KB)')).toBeInTheDocument()
    expect(screen.getAllByText(/Rachel Requester/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('shows the empty-state message when there are no attachments yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const path = url.replace('http://localhost:4000', '')
        if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
        if (path === '/api/tickets/1') return Promise.resolve(jsonResponse(baseTicket([])))
        return Promise.resolve(jsonResponse([]))
      }),
    )

    renderView()
    await openAttachmentsTab()

    expect(screen.getByText('No attachments yet.')).toBeInTheDocument()
  })

  it('rejects an unsupported file type client-side, without ever calling the upload API', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = url.replace('http://localhost:4000', '')
      if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
      if (path === '/api/tickets/1') return Promise.resolve(jsonResponse(baseTicket([])))
      return Promise.resolve(jsonResponse([]))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderView()
    await openAttachmentsTab()

    // the input's accept="" attribute would otherwise make user-event
    // silently refuse to select a non-matching file, never exercising the
    // component's own (redundant, defense-in-depth) client-side type check
    const user = userEvent.setup({ applyAccept: false })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const badFile = new File(['not an image'], 'notes.txt', { type: 'text/plain' })
    await user.upload(fileInput, badFile)

    expect(await screen.findByText('Only JPG, PNG, WEBP, or PDF files are allowed.')).toBeInTheDocument()

    const uploadCalled = fetchMock.mock.calls.some(([url]) => String(url).includes('/attachments') && !String(url).includes('download'))
    expect(uploadCalled).toBe(false)
  })

  it('uploads a valid file and shows it as active once the ticket reloads', async () => {
    const newAttachment = {
      id: 11,
      filename: 'photo.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
      isActive: true,
      createdAt: new Date().toISOString(),
      uploader: { id: 3, fullName: 'Rachel Requester', role: 'REQUESTER' },
      removedAt: null,
      removedReason: null,
      removedBy: null,
    }
    let uploaded = false
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, options?: { method?: string }) => {
        const path = url.replace('http://localhost:4000', '')
        if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
        if (path === '/api/tickets/1/attachments' && options?.method === 'POST') {
          uploaded = true
          return Promise.resolve({ ok: true, status: 201, headers: { get: () => 'application/json' }, json: async () => newAttachment })
        }
        if (path === '/api/tickets/1') {
          return Promise.resolve(jsonResponse(baseTicket(uploaded ? [newAttachment] : [])))
        }
        return Promise.resolve(jsonResponse([]))
      }),
    )

    renderView()
    await openAttachmentsTab()

    expect(screen.getByText('No attachments yet.')).toBeInTheDocument()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const goodFile = new File(['fake image bytes'], 'photo.png', { type: 'image/png' })
    await userEvent.upload(fileInput, goodFile)
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }))

    await waitFor(() => {
      expect(screen.getByText('photo.png')).toBeInTheDocument()
    })
    expect(screen.queryByText('No attachments yet.')).not.toBeInTheDocument()
  })

  it('soft-removes an attachment after a reason is entered, and shows it struck through as removed', async () => {
    const attachment = {
      id: 12,
      filename: 'wrong-file.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4096,
      isActive: true,
      createdAt: new Date().toISOString(),
      uploader: { id: 3, fullName: 'Rachel Requester', role: 'REQUESTER' },
      removedAt: null,
      removedReason: null,
      removedBy: null,
    }
    let removed = false
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, options?: { method?: string }) => {
        const path = url.replace('http://localhost:4000', '')
        if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
        if (path === '/api/attachments/12' && options?.method === 'DELETE') {
          removed = true
          return Promise.resolve(jsonResponse({ ...attachment, isActive: false, removedReason: 'Wrong file' }))
        }
        if (path === '/api/tickets/1') {
          return Promise.resolve(
            jsonResponse(
              baseTicket([
                removed
                  ? {
                      ...attachment,
                      isActive: false,
                      removedReason: 'Wrong file',
                      removedAt: new Date().toISOString(),
                      removedBy: { id: 3, fullName: 'Rachel Requester', role: 'REQUESTER' },
                    }
                  : attachment,
              ]),
            ),
          )
        }
        return Promise.resolve(jsonResponse([]))
      }),
    )

    renderView()
    await openAttachmentsTab()

    expect(screen.getByText('wrong-file.pdf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))

    const reasonInput = screen.getByPlaceholderText('Reason for removal...')
    await userEvent.type(reasonInput, 'Wrong file')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm removal' }))

    await waitFor(() => {
      expect(screen.getByText(/Removed by Rachel Requester/)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })
})

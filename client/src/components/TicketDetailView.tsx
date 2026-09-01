import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import {
  fetchTicket,
  updateTicketPriority,
  updateTicketOwner,
  updateTicketItPriority,
  updateTicketStatus,
  resolveTicket,
  closeTicket,
  confirmResolution,
  rejectResolution,
  requestReopen,
  addComment,
  addNote,
  addAction,
  addAttachment,
  downloadAttachment,
  removeAttachment,
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ACTIVE_ATTACHMENTS,
  type TicketDetail,
  type Priority,
} from '../api/tickets'
import { fetchUsers, type ManagedUser } from '../api/users'
import { ApiError } from '../api/client'
import LoadingSpinner from './LoadingSpinner'
import ErrorAlert from './ErrorAlert'
import PriorityBadge from './PriorityBadge'
import StatusBadge from './StatusBadge'
import CommentList from './CommentList'
import CommentForm from './CommentForm'

const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

type TicketDetailViewProps = {
  backTo: string
  backLabel: string
}

type TabKey = 'comments' | 'notes' | 'actions' | 'attachments'

function formatDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Field({ label, value, colClass = 'col-md-3' }: { label: string; value: string; colClass?: string }) {
  return (
    <div className={colClass}>
      <label className="form-label text-muted small mb-1">{label}</label>
      <div className="form-control bg-light text-truncate">{value}</div>
    </div>
  )
}

function TicketDetailView({ backTo, backLabel }: TicketDetailViewProps) {
  const { id } = useParams<{ id: string }>()
  const { token, user } = useAuth()
  const ticketId = Number(id)

  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('comments')

  const [itStaffUsers, setItStaffUsers] = useState<ManagedUser[]>([])
  const [resolutionSummary, setResolutionSummary] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [removingAttachmentId, setRemovingAttachmentId] = useState<number | null>(null)
  const [removalReason, setRemovalReason] = useState('')

  const isStaff = user?.role === 'IT_STAFF' || user?.role === 'ADMINISTRATOR'
  const isRequester = user?.role === 'REQUESTER'

  const load = useCallback(() => {
    if (!token || !Number.isInteger(ticketId)) return
    setIsLoading(true)
    setError(null)
    fetchTicket(token, ticketId)
      .then(setTicket)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load ticket.'))
      .finally(() => setIsLoading(false))
  }, [token, ticketId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token || !isStaff) return
    fetchUsers(token, { role: 'IT_STAFF' })
      .then(setItStaffUsers)
      .catch(() => {
        // non-critical - the owner dropdown just stays empty
      })
  }, [token, isStaff])

  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      setActionError(null)
      try {
        await action()
        load()
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : 'Action failed.')
      }
    },
    [load],
  )

  if (isLoading) return <LoadingSpinner />

  if (error) {
    return (
      <div className="container py-4">
        <ErrorAlert message={error} />
        <Link to={backTo} className="btn btn-outline-primary">
          {backLabel}
        </Link>
      </div>
    )
  }

  if (!ticket || !token) return null

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <p className="text-muted mb-0">
          <Link to={backTo}>{backLabel}</Link> &gt; Ticket Details
        </p>
        <Link to={backTo} className="btn btn-outline-primary btn-sm">
          &larr; {backLabel}
        </Link>
      </div>

      {actionError && <ErrorAlert message={actionError} />}

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3">
            <Field label="Ticket No." value={ticket.ticketNumber} />
            <Field label="Ticket Date" value={formatDateTime(ticket.createdAt)} />
            <Field label="Category" value={ticket.category.name} />
            <Field label="Related System" value={ticket.relatedSystem?.name ?? '-'} />

            <Field label="Requester" value={ticket.requester.fullName} />
            <div className="col-md-3">
              <label className="form-label text-muted small mb-1">Requested Priority</label>
              <div>
                <PriorityBadge priority={ticket.requestedPriority} />
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label text-muted small mb-1">IT Priority</label>
              <div>
                <PriorityBadge priority={ticket.itPriority} />
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label text-muted small mb-1">Current Status</label>
              <div>
                <StatusBadge status={ticket.status} />
              </div>
            </div>

            <Field label="Ticket Owner" value={ticket.owner?.fullName ?? 'Unassigned'} />
            <Field label="Summary" value={ticket.summary} colClass="col-md-6" />

            <div className="col-12">
              <label className="form-label text-muted small mb-1">Description</label>
              <div className="form-control bg-light" style={{ whiteSpace: 'pre-wrap', minHeight: '4rem' }}>
                {ticket.description}
              </div>
            </div>

            <div className="col-12">
              <label className="form-label text-muted small mb-1">Resolution Summary</label>
              <div className={`form-control bg-light ${ticket.resolutionSummary ? '' : 'fst-italic text-muted'}`}>
                {ticket.resolutionSummary ?? 'No resolution summary available yet.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h2 className="h6 mb-3">Actions</h2>
          <div className="d-flex flex-wrap gap-3 align-items-center">
            {isRequester && (ticket.status === 'NEW' || ticket.status === 'IN_PROGRESS') && (
              <div className="d-flex align-items-center gap-2">
                <label className="text-muted small mb-0">Requested Priority</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={ticket.requestedPriority}
                  onChange={(event) =>
                    runAction(() => updateTicketPriority(token, ticket.id, event.target.value as Priority))
                  }
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isRequester && ticket.status === 'RESOLVED' && (
              <>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={() => runAction(() => confirmResolution(token, ticket.id))}
                >
                  Confirm Resolution
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => runAction(() => rejectResolution(token, ticket.id))}
                >
                  Reject Resolution
                </button>
              </>
            )}

            {isRequester && ticket.status === 'CLOSED' && (
              <button
                type="button"
                className="btn btn-outline-warning btn-sm"
                onClick={() => runAction(() => requestReopen(token, ticket.id))}
              >
                Request Reopening
              </button>
            )}

            {isStaff && (ticket.status === 'NEW' || ticket.status === 'REOPENED') && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => runAction(() => updateTicketStatus(token, ticket.id, 'IN_PROGRESS'))}
              >
                Start Progress
              </button>
            )}

            {isStaff && (
              <div className="d-flex align-items-center gap-2">
                <label className="text-muted small mb-0">Owner</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={ticket.owner?.id ?? ''}
                  onChange={(event) =>
                    runAction(() =>
                      updateTicketOwner(token, ticket.id, event.target.value ? Number(event.target.value) : null),
                    )
                  }
                >
                  <option value="">Unassigned</option>
                  {itStaffUsers.map((staffUser) => (
                    <option key={staffUser.id} value={staffUser.id}>
                      {staffUser.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isStaff && (
              <div className="d-flex align-items-center gap-2">
                <label className="text-muted small mb-0">IT Priority</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={ticket.itPriority ?? ''}
                  onChange={(event) =>
                    runAction(() => updateTicketItPriority(token, ticket.id, event.target.value as Priority))
                  }
                >
                  <option value="" disabled>
                    Set priority
                  </option>
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isStaff && ticket.status === 'RESOLVED' && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => runAction(() => closeTicket(token, ticket.id))}
              >
                Close Ticket
              </button>
            )}
          </div>

          {isStaff && ticket.status === 'IN_PROGRESS' && (
            <form
              className="d-flex gap-2 mt-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (!resolutionSummary.trim()) return
                runAction(() => resolveTicket(token, ticket.id, resolutionSummary.trim())).then(() =>
                  setResolutionSummary(''),
                )
              }}
            >
              <input
                type="text"
                className="form-control"
                placeholder="Resolution summary..."
                value={resolutionSummary}
                onChange={(event) => setResolutionSummary(event.target.value)}
              />
              <button type="submit" className="btn btn-success text-nowrap" disabled={!resolutionSummary.trim()}>
                Resolve Ticket
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-white">
          <ul className="nav nav-tabs card-header-tabs">
            <li className="nav-item">
              <button type="button" className={`nav-link ${tab === 'comments' ? 'active' : ''}`} onClick={() => setTab('comments')}>
                Public Comments {ticket.publicComments.length}
              </button>
            </li>
            {isStaff && ticket.internalNotes && (
              <li className="nav-item">
                <button type="button" className={`nav-link ${tab === 'notes' ? 'active' : ''}`} onClick={() => setTab('notes')}>
                  Internal Notes {ticket.internalNotes.length}
                </button>
              </li>
            )}
            <li className="nav-item">
              <button type="button" className={`nav-link ${tab === 'actions' ? 'active' : ''}`} onClick={() => setTab('actions')}>
                Service Actions {ticket.actionsTaken.length}
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${tab === 'attachments' ? 'active' : ''}`}
                onClick={() => setTab('attachments')}
              >
                Attachments {ticket.attachments.length}
              </button>
            </li>
          </ul>
        </div>
        <div className="card-body">
          {tab === 'comments' && (
            <>
              <CommentForm
                placeholder="Type your comment here..."
                buttonLabel="Post Comment"
                onSubmit={(body) => runAction(() => addComment(token, ticket.id, body))}
              />
              <CommentList comments={ticket.publicComments} emptyMessage="No public comments yet." />
            </>
          )}

          {tab === 'notes' && isStaff && ticket.internalNotes && (
            <>
              <CommentForm
                placeholder="Add an internal note (not visible to the requester)..."
                buttonLabel="Add Note"
                onSubmit={(body) => runAction(() => addNote(token, ticket.id, body))}
              />
              <CommentList comments={ticket.internalNotes} emptyMessage="No internal notes yet." />
            </>
          )}

          {tab === 'actions' && (
            <>
              {isStaff && (
                <CommentForm
                  placeholder="Describe the action taken..."
                  buttonLabel="Add Action"
                  onSubmit={(description) => runAction(() => addAction(token, ticket.id, description))}
                />
              )}
              {ticket.actionsTaken.length === 0 ? (
                <p className="text-muted text-center py-3">No actions recorded yet.</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {ticket.actionsTaken.map((action) => (
                    <li className="list-group-item px-0" key={action.id}>
                      <div className="d-flex justify-content-between">
                        <span className="fw-semibold">{action.author.fullName}</span>
                        <span className="text-muted small">{formatDateTime(action.createdAt)}</span>
                      </div>
                      <p className="mb-0">{action.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === 'attachments' && (
            <>
              {(() => {
                const activeCount = ticket.attachments.filter((attachment) => attachment.isActive).length
                const limitReached = activeCount >= MAX_ACTIVE_ATTACHMENTS

                return (
                  <form
                    className="mb-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (!attachmentFile) return
                      runAction(() => addAttachment(token, ticket.id, attachmentFile)).then(() => {
                        setAttachmentFile(null)
                        setAttachmentError(null)
                      })
                    }}
                  >
                    {limitReached ? (
                      <p className="text-muted small mb-2">
                        This ticket already has the maximum of {MAX_ACTIVE_ATTACHMENTS} active attachments. Remove one before
                        adding another.
                      </p>
                    ) : (
                      <div className="row g-2 align-items-center">
                        <div className="col-md-8">
                          <input
                            type="file"
                            className="form-control"
                            accept={ALLOWED_ATTACHMENT_TYPES.join(',')}
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null
                              setAttachmentError(null)
                              if (file && !ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
                                setAttachmentError('Only JPG, PNG, WEBP, or PDF files are allowed.')
                                setAttachmentFile(null)
                                event.target.value = ''
                                return
                              }
                              if (file && file.size > MAX_ATTACHMENT_SIZE_BYTES) {
                                setAttachmentError('File exceeds the 5 MB limit.')
                                setAttachmentFile(null)
                                event.target.value = ''
                                return
                              }
                              setAttachmentFile(file)
                            }}
                          />
                        </div>
                        <div className="col-md-4">
                          <button type="submit" className="btn btn-primary w-100" disabled={!attachmentFile}>
                            Upload
                          </button>
                        </div>
                      </div>
                    )}
                    {attachmentError && <div className="text-danger small mt-2">{attachmentError}</div>}
                  </form>
                )
              })()}

              {ticket.attachments.length === 0 ? (
                <p className="text-muted text-center py-3">No attachments yet.</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {ticket.attachments.map((attachment) => (
                    <li className="list-group-item px-0" key={attachment.id}>
                      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                        <div>
                          <span className={attachment.isActive ? '' : 'text-muted text-decoration-line-through'}>
                            {attachment.filename}
                          </span>{' '}
                          <span className="text-muted small">({formatFileSize(attachment.sizeBytes)})</span>
                          <div className="text-muted small">
                            {attachment.uploader.fullName} - {formatDateTime(attachment.createdAt)}
                          </div>
                          {!attachment.isActive && (
                            <div className="text-muted small fst-italic">
                              Removed by {attachment.removedBy?.fullName ?? 'unknown'} on {formatDateTime(attachment.removedAt)}
                              {attachment.removedReason ? `: ${attachment.removedReason}` : ''}
                            </div>
                          )}
                        </div>
                        {attachment.isActive && (
                          <div className="d-flex gap-2 text-nowrap">
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() =>
                                downloadAttachment(token, attachment.id, attachment.filename).catch((err) =>
                                  setActionError(err instanceof ApiError ? err.message : 'Download failed.'),
                                )
                              }
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => {
                                setRemovingAttachmentId(attachment.id)
                                setRemovalReason('')
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>

                      {removingAttachmentId === attachment.id && (
                        <form
                          className="d-flex gap-2 mt-2"
                          onSubmit={(event) => {
                            event.preventDefault()
                            if (!removalReason.trim()) return
                            runAction(() => removeAttachment(token, attachment.id, removalReason.trim())).then(() => {
                              setRemovingAttachmentId(null)
                              setRemovalReason('')
                            })
                          }}
                        >
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Reason for removal..."
                            value={removalReason}
                            onChange={(event) => setRemovalReason(event.target.value)}
                            autoFocus
                          />
                          <button type="submit" className="btn btn-danger btn-sm text-nowrap" disabled={!removalReason.trim()}>
                            Confirm removal
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => {
                              setRemovingAttachmentId(null)
                              setRemovalReason('')
                            }}
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default TicketDetailView

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import {
  fetchTicket,
  fetchAssignableOwners,
  updateTicketPriority,
  updateRequesterAppearsResolved,
  updateTicketOwner,
  updateTicketItPriority,
  updateTicketStatus,
  resolveTicket,
  closeTicket,
  cancelTicket,
  confirmResolution,
  rejectResolution,
  requestReopen,
  addComment,
  addNote,
  addAttachment,
  downloadAttachment,
  removeAttachment,
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ACTIVE_ATTACHMENTS,
  type TicketDetail,
  type AssignableOwner,
  type Priority,
} from '../api/tickets'
import { ApiError } from '../api/client'
import LoadingSpinner from './LoadingSpinner'
import ErrorAlert from './ErrorAlert'
import PriorityBadge from './PriorityBadge'
import StatusBadge from './StatusBadge'
import CommentList from './CommentList'
import CommentForm from './CommentForm'
import ActionsTakenPanel from './ActionsTakenPanel'
import ConflictAlert from './ConflictAlert'
import { STATUS_LABELS, allowedCommands, canResolve, resolutionGate, type WorkflowCommand } from '../lib/ticketWorkflow'

const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

type TicketDetailViewProps = {
  backTo: string
  backLabel: string
}

type TabKey = 'comments' | 'notes' | 'actions' | 'attachments' | 'history'

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
  const [isConflict, setIsConflict] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const busyRef = useRef(false)
  const [announcement, setAnnouncement] = useState('')
  const [tab, setTab] = useState<TabKey>('comments')

  const [assignableOwners, setAssignableOwners] = useState<AssignableOwner[]>([])
  const [resolutionSummary, setResolutionSummary] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [removingAttachmentId, setRemovingAttachmentId] = useState<number | null>(null)
  const [removalReason, setRemovalReason] = useState('')

  const isStaff = user?.role === 'IT_STAFF' || user?.role === 'ADMINISTRATOR'
  const isRequester = user?.role === 'REQUESTER'

  // `silent` refreshes after a change keep the page on screen (no spinner
  // flash, scroll position and open tab kept) instead of a full reload.
  const load = useCallback(
    (silent = false) => {
      if (!token || !Number.isInteger(ticketId)) return Promise.resolve()
      if (!silent) setIsLoading(true)
      setError(null)
      return fetchTicket(token, ticketId)
        .then(setTicket)
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load ticket.'))
        .finally(() => {
          if (!silent) setIsLoading(false)
        })
    },
    [token, ticketId],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token || !isStaff) return
    fetchAssignableOwners(token)
      .then(setAssignableOwners)
      .catch(() => {
        // non-critical - the owner dropdown just stays empty
      })
  }, [token, isStaff])

  // Runs one write at a time (no double submit, FR-16), refreshes the ticket
  // on success, and reports success so forms only clear their input when the
  // save actually worked (FR-17).
  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage?: string): Promise<boolean> => {
      if (busyRef.current) return false
      busyRef.current = true
      setIsBusy(true)
      setActionError(null)
      setIsConflict(false)
      try {
        await action()
        await load(true)
        if (successMessage) setAnnouncement(successMessage)
        return true
      } catch (err) {
        if (err instanceof ApiError && err.code === 'STALE_UPDATE') setIsConflict(true)
        else setActionError(err instanceof ApiError ? err.message : 'Action failed. Check your connection and try again.')
        return false
      } finally {
        busyRef.current = false
        setIsBusy(false)
      }
    },
    [load],
  )

  const runCommand = (command: WorkflowCommand) => {
    if (!ticket || !token) return Promise.resolve(false)
    const version = ticket.version
    switch (command.kind) {
      case 'status':
        return runAction(() => updateTicketStatus(token, ticket.id, command.to, version), `Status changed to ${STATUS_LABELS[command.to]}`)
      case 'cancel':
        if (!window.confirm('Cancel this ticket? Any open Actions Taken are cancelled too. This cannot be undone.')) {
          return Promise.resolve(false)
        }
        return runAction(() => cancelTicket(token, ticket.id, version), 'Status changed to Cancelled')
      case 'close':
        return runAction(() => closeTicket(token, ticket.id, version), 'Status changed to Closed')
      case 'confirm':
        return runAction(() => confirmResolution(token, ticket.id, version), 'Status changed to Closed')
      case 'reject':
        return runAction(() => rejectResolution(token, ticket.id, version), 'Status changed to Reopened')
      case 'reopen':
        return runAction(() => requestReopen(token, ticket.id, version), 'Status changed to Reopened')
    }
  }

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

  const gate = resolutionGate(ticket.actionsTaken)

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

      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
      {isConflict && (
        <ConflictAlert
          message="This ticket was changed by someone else. Reload to see the latest version before trying again."
          onReload={() => {
            setIsConflict(false)
            void load(true)
          }}
        />
      )}
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
              <div className="d-flex align-items-center gap-2">
                <StatusBadge status={ticket.status} />
                {ticket.requesterAppearsResolvedAt && (
                  <span
                    className="badge rounded-pill text-bg-success"
                    title="Requester indicated this appears resolved"
                  >
                    Appears Resolved
                  </span>
                )}
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
                <label className="text-muted small mb-0" htmlFor="requestedPriorityEdit">
                  Requested Priority
                </label>
                <select
                  id="requestedPriorityEdit"
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={ticket.requestedPriority}
                  disabled={isBusy}
                  onChange={(event) =>
                    void runAction(() => updateTicketPriority(token, ticket.id, event.target.value as Priority))
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

            {isRequester && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status) && (
              <button
                type="button"
                className={`btn btn-sm ${ticket.requesterAppearsResolvedAt ? 'btn-secondary' : 'btn-outline-success'}`}
                disabled={isBusy}
                onClick={() =>
                  void runAction(() => updateRequesterAppearsResolved(token, ticket.id, !ticket.requesterAppearsResolvedAt))
                }
              >
                {ticket.requesterAppearsResolvedAt ? 'Undo Appears Resolved' : 'Mark as Appears Resolved'}
              </button>
            )}

            {user &&
              allowedCommands(ticket.status, user.role).map((command) => (
                <button
                  key={command.label}
                  type="button"
                  className={`btn btn-sm ${command.variant}`}
                  disabled={isBusy}
                  onClick={() => void runCommand(command)}
                >
                  {command.label}
                </button>
              ))}

            {isStaff && (
              <div className="d-flex align-items-center gap-2">
                <label className="text-muted small mb-0" htmlFor="ticketOwner">
                  Owner
                </label>
                <select
                  id="ticketOwner"
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={ticket.owner?.id ?? ''}
                  disabled={isBusy}
                  onChange={(event) =>
                    void runAction(
                      () =>
                        updateTicketOwner(token, ticket.id, event.target.value ? Number(event.target.value) : null, ticket.version),
                      'Ticket owner updated',
                    )
                  }
                >
                  <option value="">Unassigned</option>
                  {assignableOwners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isStaff && (
              <div className="d-flex align-items-center gap-2">
                <label className="text-muted small mb-0" htmlFor="ticketItPriority">
                  IT Priority
                </label>
                <select
                  id="ticketItPriority"
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={ticket.itPriority ?? ''}
                  disabled={isBusy}
                  onChange={(event) =>
                    void runAction(
                      () => updateTicketItPriority(token, ticket.id, event.target.value as Priority, ticket.version),
                      'IT Priority updated',
                    )
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
          </div>

          {user && canResolve(ticket.status, user.role) && (
            <form
              className="mt-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (!resolutionSummary.trim() || !gate.allowed) return
                void runAction(
                  () => resolveTicket(token, ticket.id, resolutionSummary.trim(), ticket.version),
                  'Status changed to Resolved',
                ).then((ok) => {
                  if (ok) setResolutionSummary('')
                })
              }}
            >
              <label className="form-label small text-muted" htmlFor="resolutionSummary">
                Resolution Summary
              </label>
              <div className="d-flex flex-wrap flex-sm-nowrap gap-2">
                <input
                  id="resolutionSummary"
                  type="text"
                  className="form-control"
                  placeholder="Resolution summary..."
                  value={resolutionSummary}
                  aria-describedby={gate.allowed ? undefined : 'resolutionGateHint'}
                  onChange={(event) => setResolutionSummary(event.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-success text-nowrap"
                  disabled={isBusy || !resolutionSummary.trim() || !gate.allowed}
                >
                  Resolve Ticket
                </button>
              </div>
              {!gate.allowed && (
                <p className="small text-warning-emphasis mt-2 mb-0" id="resolutionGateHint">
                  Can't resolve yet: {gate.reasons.join(' and ')}.{' '}
                  <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setTab('actions')}>
                    Go to Actions Taken
                  </button>
                </p>
              )}
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
                Actions Taken {ticket.actionsTaken.length}
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
            <li className="nav-item">
              <button type="button" className={`nav-link ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
                Status History
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
            <div className="bg-warning-subtle border-start border-warning border-4 rounded p-3">
              <p className="fw-semibold text-warning-emphasis mb-3">
                Internal — not visible to the Requester
              </p>
              <CommentForm
                placeholder="Add an internal note (not visible to the requester)..."
                buttonLabel="Add Note"
                onSubmit={(body) => runAction(() => addNote(token, ticket.id, body))}
              />
              <CommentList comments={ticket.internalNotes} emptyMessage="No internal notes yet." />
            </div>
          )}

          {tab === 'actions' && user && (
            <ActionsTakenPanel
              token={token}
              ticketId={ticket.id}
              ticketStatus={ticket.status}
              actions={ticket.actionsTaken}
              isStaff={isStaff}
              currentUser={user}
              assignableOwners={assignableOwners}
              onChanged={() => void load(true)}
            />
          )}

          {tab === 'history' &&
            (ticket.statusHistory.length === 0 ? (
              <p className="text-muted text-center py-3 mb-0">No status history recorded before Lab 4.</p>
            ) : (
              <ol className="list-group list-group-flush list-group-numbered" aria-label="Status history, oldest first">
                {ticket.statusHistory.map((change) => (
                  <li key={change.id} className="list-group-item px-0 d-flex flex-wrap gap-2 align-items-center">
                    {change.fromStatus ? (
                      <>
                        <StatusBadge status={change.fromStatus} />
                        <span aria-label="to">→</span>
                        <StatusBadge status={change.toStatus} />
                      </>
                    ) : (
                      <>
                        <span>Created as</span>
                        <StatusBadge status={change.toStatus} />
                      </>
                    )}
                    <span className="text-muted small">
                      by {change.changedBy.fullName} · {formatDateTime(change.createdAt)}
                    </span>
                  </li>
                ))}
              </ol>
            ))}

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
                      void runAction(() => addAttachment(token, ticket.id, attachmentFile)).then((ok) => {
                        if (!ok) return
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
                            void runAction(() => removeAttachment(token, attachment.id, removalReason.trim())).then((ok) => {
                              if (!ok) return
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

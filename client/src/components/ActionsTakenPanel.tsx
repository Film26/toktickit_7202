import { useEffect, useRef, useState } from 'react'
import type { AssignableOwner, TicketAction, TicketStatus } from '../api/tickets'
import ActionStatusBadge from './ActionStatusBadge'
import ActionForm from './ActionForm'

// Actions Taken area on Ticket Detail (handout 8.3, docs/lab-04/ui-spec.md
// section 6): list (table >= lg, stacked cards on tablet and mobile), Create mode and
// View/Edit mode. Requesters get the same list read-only.

const LOCKED_TICKET_STATUSES: TicketStatus[] = ['RESOLVED', 'CLOSED', 'CANCELLED']

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'view'; actionId: number }

type ActionsTakenPanelProps = {
  token: string
  ticketId: number
  ticketStatus: TicketStatus
  actions: TicketAction[]
  isStaff: boolean
  currentUser: { id: number; fullName: string }
  assignableOwners: AssignableOwner[]
  onChanged: () => void
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function ActionsTakenPanel({
  token,
  ticketId,
  ticketStatus,
  actions,
  isStaff,
  currentUser,
  assignableOwners,
  onChanged,
}: ActionsTakenPanelProps) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const containerRef = useRef<HTMLDivElement>(null)
  // Which control opened the form: 'add' or the id of the action viewed.
  const returnFocusTo = useRef<'add' | number | null>(null)
  const ticketLocked = LOCKED_TICKET_STATUSES.includes(ticketStatus)
  const canWrite = isStaff && !ticketLocked

  const open = (next: Mode) => {
    returnFocusTo.current = next.kind === 'create' ? 'add' : next.kind === 'view' ? next.actionId : null
    setMode(next)
  }

  const close = () => setMode({ kind: 'list' })

  // Return focus to the control that opened the form once the list is back
  // (ui-spec section 9). The original element may have been unmounted while
  // the form was open, so look it up again rather than keeping a reference;
  // only the visible copy (table on desktop, card on mobile) can take focus.
  useEffect(() => {
    if (mode.kind !== 'list' || returnFocusTo.current === null) return
    const target = returnFocusTo.current
    returnFocusTo.current = null
    const selector = target === 'add' ? '[data-focus-return="add"]' : `[data-focus-return="action-${target}"]`
    const candidates = Array.from(containerRef.current?.querySelectorAll<HTMLElement>(selector) ?? [])
    candidates.find((element) => element.offsetParent !== null)?.focus()
  }, [mode, actions])

  const selected = mode.kind === 'view' ? actions.find((action) => action.id === mode.actionId) ?? null : null

  const viewButton = (action: TicketAction) => (
    <button
      type="button"
      className="btn btn-outline-primary btn-sm text-nowrap"
      data-focus-return={`action-${action.id}`}
      onClick={() => open({ kind: 'view', actionId: action.id })}
      aria-label={`${canWrite && action.status !== 'COMPLETED' && action.status !== 'CANCELLED' ? 'View or edit' : 'View'} action: ${action.description}`}
    >
      {canWrite && action.status !== 'COMPLETED' && action.status !== 'CANCELLED' ? 'View / Edit' : 'View'}
    </button>
  )

  return (
    <div ref={containerRef}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <p className="text-muted small mb-0">
          {ticketLocked
            ? 'Actions are read-only once a ticket is Resolved, Closed or Cancelled.'
            : isStaff
              ? 'Plan and record the work done on this ticket. Any IT Staff member may perform an action.'
              : 'The work IT Staff have planned and carried out on your ticket.'}
        </p>
        {canWrite && mode.kind === 'list' && (
          <button type="button" className="btn btn-primary btn-sm" data-focus-return="add" onClick={() => open({ kind: 'create' })}>
            + Add Action
          </button>
        )}
      </div>

      {mode.kind === 'create' && (
        <ActionForm
          token={token}
          ticketId={ticketId}
          action={null}
          canEdit
          currentUser={currentUser}
          assignableOwners={assignableOwners}
          onSaved={() => {
            close()
            onChanged()
          }}
          onClose={close}
        />
      )}

      {selected && (
        <ActionForm
          key={`${selected.id}-${selected.version}`}
          token={token}
          ticketId={ticketId}
          action={selected}
          canEdit={canWrite}
          currentUser={currentUser}
          assignableOwners={assignableOwners}
          onSaved={() => {
            close()
            onChanged()
          }}
          onClose={close}
        />
      )}

      {actions.length === 0 ? (
        <p className="text-muted text-center py-3 mb-0">
          No Actions Taken recorded yet.
          {canWrite && <span className="d-block small">Use Add Action to plan or record work.</span>}
        </p>
      ) : (
        <>
          <div className="table-responsive position-relative d-none d-lg-block">
            <table className="table table-sm align-middle mb-0">
              <caption className="visually-hidden">Actions Taken, oldest first</caption>
              <thead>
                <tr>
                  <th scope="col">Date/Time</th>
                  <th scope="col">Description</th>
                  <th scope="col">Result</th>
                  <th scope="col">Performed By</th>
                  <th scope="col">Assigned To</th>
                  <th scope="col">Status</th>
                  <th scope="col">Follow-Up</th>
                  <th scope="col">
                    <span className="visually-hidden">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {actions.map((action) => (
                  <tr key={action.id} className={selected?.id === action.id ? 'table-active' : undefined}>
                    <td className="text-nowrap small">{formatDateTime(action.actionAt)}</td>
                    <td style={{ minWidth: '12rem' }}>
                      <div className="text-clamp-2">{action.description}</div>
                    </td>
                    <td style={{ minWidth: '10rem' }}>
                      <div className="text-clamp-2">{action.result ?? <span className="text-muted">-</span>}</div>
                    </td>
                    <td className="small">{action.performedBy.fullName}</td>
                    <td className="small">{action.assignee?.fullName ?? <span className="text-muted">Unassigned</span>}</td>
                    <td>
                      <ActionStatusBadge status={action.status} />
                    </td>
                    <td className="small">
                      {action.followUpRequired ? (
                        <div title={action.followUpNote ?? undefined} style={{ minWidth: '8rem' }}>
                          <strong>Yes</strong>
                          <div className="text-clamp-2 text-muted">{action.followUpNote}</div>
                        </div>
                      ) : (
                        'No'
                      )}
                    </td>
                    <td className="text-end">{viewButton(action)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="list-unstyled d-lg-none mb-0">
            {actions.map((action) => (
              <li key={action.id} className="border rounded p-3 mb-2">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <span className="small text-muted">{formatDateTime(action.actionAt)}</span>
                  <ActionStatusBadge status={action.status} />
                </div>
                <p className="mb-2 text-break">{action.description}</p>
                <dl className="row small mb-2">
                  <dt className="col-5 text-muted fw-normal">Result</dt>
                  <dd className="col-7 mb-1 text-break">{action.result ?? '-'}</dd>
                  <dt className="col-5 text-muted fw-normal">Performed By</dt>
                  <dd className="col-7 mb-1">{action.performedBy.fullName}</dd>
                  <dt className="col-5 text-muted fw-normal">Assigned To</dt>
                  <dd className="col-7 mb-1">{action.assignee?.fullName ?? 'Unassigned'}</dd>
                  <dt className="col-5 text-muted fw-normal">Follow-Up</dt>
                  <dd className="col-7 mb-1 text-break">{action.followUpRequired ? `Yes — ${action.followUpNote}` : 'No'}</dd>
                  {action.attachmentNotes && (
                    <>
                      <dt className="col-5 text-muted fw-normal">Attachment Notes</dt>
                      <dd className="col-7 mb-1 text-break">{action.attachmentNotes}</dd>
                    </>
                  )}
                </dl>
                {viewButton(action)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default ActionsTakenPanel

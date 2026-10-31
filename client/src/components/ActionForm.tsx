import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  addAction,
  updateAction,
  type ActionStatus,
  type AssignableOwner,
  type TicketAction,
} from '../api/tickets'
import { ApiError } from '../api/client'
import ErrorAlert from './ErrorAlert'
import ConflictAlert from './ConflictAlert'
import ActionStatusBadge from './ActionStatusBadge'
import { ACTION_STATUS_LABELS } from '../lib/ticketWorkflow'
import {
  ATTACHMENT_NOTES_MAX,
  DESCRIPTION_MAX,
  TEXT_MAX,
  initialValues,
  validateActionForm,
  type FieldErrors,
  type FieldName,
  type FormValues,
} from '../lib/actionForm'

// Create mode and View/Edit mode for one Action Taken
// (docs/lab-04/ui-spec.md sections 6.2-6.4). Server field errors are shown in
// the same places as the client-side checks from lib/actionForm.

// BR-08, from the action's current status.
const STATUS_OPTIONS: Record<ActionStatus | 'NEW', ActionStatus[]> = {
  NEW: ['PLANNED', 'IN_PROGRESS', 'COMPLETED'],
  PLANNED: ['PLANNED', 'IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['IN_PROGRESS', 'COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

function formatDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function newRequestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

type ActionFormProps = {
  token: string
  ticketId: number
  action: TicketAction | null // null = Create mode
  canEdit: boolean
  currentUser: { id: number; fullName: string }
  assignableOwners: AssignableOwner[]
  onSaved: () => void
  onClose: () => void
}

function ActionForm({ token, ticketId, action, canEdit, currentUser, assignableOwners, onSaved, onClose }: ActionFormProps) {
  const idPrefix = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [values, setValues] = useState<FormValues>(() => initialValues(action, currentUser.id))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isConflict, setIsConflict] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // One key per opened Create form, reused on retry, so a double-click or a
  // network retry can never create the action twice (BR-13).
  const [clientRequestId] = useState(newRequestId)

  const isCreate = action === null
  const isTerminal = !!action && (action.status === 'COMPLETED' || action.status === 'CANCELLED')
  const readOnly = !canEdit || isTerminal
  const statusOptions = STATUS_OPTIONS[action ? action.status : 'NEW']

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // Make sure the current assignee shows even if they are no longer an
  // active, assignable user.
  const ownerOptions =
    action?.assignee && !assignableOwners.some((owner) => owner.id === action.assignee!.id)
      ? [...assignableOwners, { id: action.assignee.id, fullName: `${action.assignee.fullName} (inactive)` }]
      : assignableOwners

  const set = <K extends FieldName>(name: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const save = async (override?: Partial<FormValues>) => {
    if (isSaving) return
    const next = { ...values, ...override }
    if (override) setValues(next)
    const errors = validateActionForm(next)
    setFieldErrors(errors)
    setFormError(null)
    setIsConflict(false)
    if (Object.keys(errors).length > 0) return

    const payload = {
      actionAt: new Date(next.actionAt).toISOString(),
      description: next.description.trim(),
      status: next.status,
      result: next.result.trim() || null,
      assigneeId: Number(next.assigneeId),
      followUpRequired: next.followUpRequired,
      followUpNote: next.followUpRequired ? next.followUpNote.trim() : null,
      attachmentNotes: next.attachmentNotes.trim() || null,
    }

    setIsSaving(true)
    try {
      if (isCreate) await addAction(token, ticketId, { ...payload, clientRequestId })
      else await updateAction(token, ticketId, action.id, { ...payload, version: action.version })
      onSaved()
    } catch (err) {
      // Entered values are kept on every failure path (handout 8.5).
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') setIsConflict(true)
      else if (err instanceof ApiError && err.fields) {
        setFieldErrors(err.fields as FieldErrors)
        setFormError(err.message)
      } else setFormError(err instanceof ApiError ? err.message : 'Unable to save the action. Check your connection and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const cancelAction = async () => {
    if (!action || isSaving) return
    if (!window.confirm('Cancel this action? A cancelled action can no longer be edited.')) return
    setIsSaving(true)
    setFormError(null)
    try {
      await updateAction(token, ticketId, action.id, { status: 'CANCELLED', version: action.version })
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') setIsConflict(true)
      else setFormError(err instanceof ApiError ? err.message : 'Unable to cancel the action.')
    } finally {
      setIsSaving(false)
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void save()
  }

  const fieldId = (name: string) => `${idPrefix}-${name}`
  const errorProps = (name: FieldName) =>
    fieldErrors[name]
      ? { 'aria-invalid': true as const, 'aria-describedby': fieldId(`${name}-error`) }
      : {}
  const errorText = (name: FieldName) =>
    fieldErrors[name] ? (
      <div className="invalid-feedback d-block" id={fieldId(`${name}-error`)}>
        {fieldErrors[name]}
      </div>
    ) : null
  const inputClass = (base: string, name: FieldName) => `${base} ${fieldErrors[name] ? 'is-invalid' : ''}`

  const heading = isCreate ? 'Add Action Taken' : readOnly ? 'Action Taken' : 'Edit Action Taken'

  return (
    <section className="border rounded p-3 mb-3 bg-white" aria-labelledby={fieldId('heading')}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h3 className="h6 mb-0" id={fieldId('heading')} ref={headingRef} tabIndex={-1}>
          {heading}
        </h3>
        {action && <ActionStatusBadge status={action.status} />}
      </div>

      {isConflict && <ConflictAlert onReload={onSaved} />}
      {formError && <ErrorAlert message={formError} />}
      {isTerminal && (
        <p className="text-muted small">
          This action is {action.status === 'COMPLETED' ? 'Completed' : 'Cancelled'} and can no longer be edited.
        </p>
      )}

      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={readOnly || isSaving} className="row g-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor={fieldId('actionAt')}>
              Action Date/Time <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id={fieldId('actionAt')}
              type="datetime-local"
              className={inputClass('form-control', 'actionAt')}
              value={values.actionAt}
              onChange={(event) => set('actionAt', event.target.value)}
              required
              {...errorProps('actionAt')}
            />
            {errorText('actionAt')}
          </div>

          <div className="col-md-4">
            <label className="form-label" htmlFor={fieldId('status')}>
              Status
            </label>
            {readOnly ? (
              <input id={fieldId('status')} className="form-control" value={ACTION_STATUS_LABELS[values.status]} readOnly />
            ) : (
              <select
                id={fieldId('status')}
                className="form-select"
                value={values.status}
                onChange={(event) => set('status', event.target.value as ActionStatus)}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {ACTION_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="col-md-4">
            <label className="form-label" htmlFor={fieldId('assigneeId')}>
              Assigned To
            </label>
            <select
              id={fieldId('assigneeId')}
              className={inputClass('form-select', 'assigneeId')}
              value={values.assigneeId}
              onChange={(event) => set('assigneeId', event.target.value)}
              {...errorProps('assigneeId')}
            >
              <option value="">Select a staff member</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.id === currentUser.id ? `${owner.fullName} (me)` : owner.fullName}
                </option>
              ))}
            </select>
            {errorText('assigneeId')}
          </div>

          <div className="col-12">
            <label className="form-label" htmlFor={fieldId('description')}>
              Action Description <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <textarea
              id={fieldId('description')}
              className={inputClass('form-control', 'description')}
              rows={3}
              maxLength={DESCRIPTION_MAX}
              value={values.description}
              onChange={(event) => set('description', event.target.value)}
              required
              {...errorProps('description')}
            />
            {errorText('description')}
          </div>

          <div className="col-12">
            <label className="form-label" htmlFor={fieldId('result')}>
              Result {values.status === 'COMPLETED' && <span className="text-danger" aria-hidden="true">*</span>}
            </label>
            <textarea
              id={fieldId('result')}
              className={inputClass('form-control', 'result')}
              rows={2}
              maxLength={TEXT_MAX}
              placeholder={values.status === 'COMPLETED' ? 'What was the outcome?' : 'Required when the action is Completed'}
              value={values.result}
              onChange={(event) => set('result', event.target.value)}
              {...errorProps('result')}
            />
            {errorText('result')}
          </div>

          <div className="col-12">
            <div className="form-check">
              <input
                id={fieldId('followUpRequired')}
                type="checkbox"
                className="form-check-input"
                checked={values.followUpRequired}
                onChange={(event) => set('followUpRequired', event.target.checked)}
              />
              <label className="form-check-label" htmlFor={fieldId('followUpRequired')}>
                Follow-Up Required?
              </label>
            </div>
          </div>

          {values.followUpRequired && (
            <div className="col-12">
              <label className="form-label" htmlFor={fieldId('followUpNote')}>
                Follow-Up Note <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <textarea
                id={fieldId('followUpNote')}
                className={inputClass('form-control', 'followUpNote')}
                rows={2}
                maxLength={TEXT_MAX}
                value={values.followUpNote}
                onChange={(event) => set('followUpNote', event.target.value)}
                {...errorProps('followUpNote')}
              />
              {errorText('followUpNote')}
            </div>
          )}

          <div className="col-md-8">
            <label className="form-label" htmlFor={fieldId('attachmentNotes')}>
              Attachment Notes
            </label>
            <input
              id={fieldId('attachmentNotes')}
              type="text"
              className={inputClass('form-control', 'attachmentNotes')}
              maxLength={ATTACHMENT_NOTES_MAX}
              placeholder="e.g. see router-log.pdf in Attachments"
              value={values.attachmentNotes}
              onChange={(event) => set('attachmentNotes', event.target.value)}
              {...errorProps('attachmentNotes')}
            />
            {errorText('attachmentNotes')}
          </div>

          <div className="col-md-4">
            <label className="form-label" htmlFor={fieldId('performedBy')}>
              Performed By
            </label>
            <input
              id={fieldId('performedBy')}
              className="form-control bg-light"
              value={action ? action.performedBy.fullName : `You (${currentUser.fullName})`}
              readOnly
            />
          </div>
        </fieldset>

        {action && (
          <p className="text-muted small mt-2 mb-0">
            Recorded {formatDateTime(action.createdAt)} · last updated {formatDateTime(action.updatedAt)}
            {action.completedAt && ` · completed ${formatDateTime(action.completedAt)}`}
            {action.cancelledAt && ` · cancelled ${formatDateTime(action.cancelledAt)}`}
          </p>
        )}

        <div className="d-flex flex-wrap gap-2 mt-3">
          {!readOnly && (
            <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving}>
              {isSaving ? 'Saving...' : isCreate ? 'Save Action' : 'Save Changes'}
            </button>
          )}
          {!readOnly && action?.status === 'PLANNED' && (
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={isSaving} onClick={() => void save({ status: 'IN_PROGRESS' })}>
              Start
            </button>
          )}
          {!readOnly && !isCreate && (
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              disabled={isSaving}
              onClick={() => void save({ status: 'COMPLETED' })}
            >
              Mark Completed
            </button>
          )}
          {!readOnly && !isCreate && (
            <button type="button" className="btn btn-outline-danger btn-sm" disabled={isSaving} onClick={() => void cancelAction()}>
              Cancel Action
            </button>
          )}
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={isSaving}>
            {readOnly ? 'Close' : 'Discard'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default ActionForm

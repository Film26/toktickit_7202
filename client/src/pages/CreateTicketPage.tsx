import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fetchCategories, type Category } from '../api/categories'
import { fetchRelatedSystems, type RelatedSystem } from '../api/relatedSystems'
import {
  createTicket,
  addAttachment,
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ACTIVE_ATTACHMENTS,
  type Priority,
} from '../api/tickets'
import { ApiError } from '../api/client'
import ErrorAlert from '../components/ErrorAlert'
import LoadingSpinner from '../components/LoadingSpinner'

const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

type FieldErrors = { summary?: string; description?: string }

function CreateTicketPage() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [categoryId, setCategoryId] = useState('')
  const [relatedSystemId, setRelatedSystemId] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [requestedPriority, setRequestedPriority] = useState<Priority>('MEDIUM')
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [partialUploadNotice, setPartialUploadNotice] = useState<{ ticketId: number; ticketNumber: string; failedCount: number } | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchCategories(), fetchRelatedSystems()])
      .then(([categoriesData, relatedSystemsData]) => {
        if (cancelled) return
        setCategories(categoriesData)
        setRelatedSystems(relatedSystemsData)
        if (categoriesData.length > 0) setCategoryId(String(categoriesData[0].id))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Unable to load categories.')
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOptions(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleAttachmentChange = (fileList: FileList | null) => {
    setAttachmentError(null)
    if (!fileList || fileList.length === 0) return

    const incoming = Array.from(fileList)
    const remainingSlots = MAX_ACTIVE_ATTACHMENTS - attachmentFiles.length
    if (incoming.length > remainingSlots) {
      setAttachmentError(`You can attach at most ${MAX_ACTIVE_ATTACHMENTS} files. Only ${remainingSlots} more can be added.`)
      return
    }

    for (const file of incoming) {
      if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
        setAttachmentError(`"${file.name}" is not an allowed type. Only JPG, PNG, WEBP, or PDF files are allowed.`)
        return
      }
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setAttachmentError(`"${file.name}" exceeds the 5 MB limit.`)
        return
      }
    }

    setAttachmentFiles((prev) => [...prev, ...incoming])
  }

  const removeSelectedAttachment = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    if (!summary.trim()) errors.summary = 'Summary is required.'
    else if (summary.trim().length > 200) errors.summary = 'Summary must be 200 characters or fewer.'
    if (!description.trim()) errors.description = 'Description is required.'
    return errors
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    setPartialUploadNotice(null)

    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0 || !token || !categoryId) {
      if (!categoryId) setSubmitError('A category is required.')
      return
    }

    setIsSubmitting(true)
    try {
      const ticket = await createTicket(token, {
        categoryId: Number(categoryId),
        relatedSystemId: relatedSystemId ? Number(relatedSystemId) : undefined,
        summary: summary.trim(),
        description: description.trim(),
        requestedPriority,
      })

      // the ticket is created at this point regardless of what happens
      // below - attachment upload failures must not make it look like ticket
      // creation itself failed
      let failedCount = 0
      for (const file of attachmentFiles) {
        try {
          await addAttachment(token, ticket.id, file)
        } catch {
          failedCount += 1
        }
      }

      if (failedCount > 0) {
        setPartialUploadNotice({ ticketId: ticket.id, ticketNumber: ticket.ticketNumber, failedCount })
        setIsSubmitting(false)
        return
      }

      navigate(`/tickets/${ticket.id}`)
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to create ticket.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      <h1 className="h3 mb-4">Create Ticket</h1>

      {loadError && <ErrorAlert message={loadError} />}

      {isLoadingOptions ? (
        <LoadingSpinner />
      ) : partialUploadNotice ? (
        <div className="card p-4 shadow-sm">
          <ErrorAlert
            message={`Ticket ${partialUploadNotice.ticketNumber} was created, but ${partialUploadNotice.failedCount} attachment(s) failed to upload. You can add them from the ticket detail page.`}
          />
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/tickets/${partialUploadNotice.ticketId}`)}>
            Go to ticket
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-4 shadow-sm">
          {submitError && <ErrorAlert message={submitError} />}

          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label htmlFor="category" className="form-label">
                Category <span className="text-danger">*</span>
              </label>
              <select
                id="category"
                className="form-select"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label htmlFor="relatedSystem" className="form-label">
                Related System <span className="text-muted">(optional)</span>
              </label>
              <select
                id="relatedSystem"
                className="form-select"
                value={relatedSystemId}
                onChange={(event) => setRelatedSystemId(event.target.value)}
              >
                <option value="">None</option>
                {relatedSystems.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="summary" className="form-label">
              Summary <span className="text-danger">*</span>
            </label>
            <input
              id="summary"
              type="text"
              className={`form-control ${fieldErrors.summary ? 'is-invalid' : ''}`}
              value={summary}
              onChange={(event) => {
                setSummary(event.target.value)
                if (fieldErrors.summary) setFieldErrors((prev) => ({ ...prev, summary: undefined }))
              }}
              maxLength={200}
            />
            {fieldErrors.summary && <div className="invalid-feedback">{fieldErrors.summary}</div>}
          </div>

          <div className="mb-3">
            <label htmlFor="description" className="form-label">
              Description <span className="text-danger">*</span>
            </label>
            <textarea
              id="description"
              className={`form-control ${fieldErrors.description ? 'is-invalid' : ''}`}
              rows={5}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value)
                if (fieldErrors.description) setFieldErrors((prev) => ({ ...prev, description: undefined }))
              }}
            />
            {fieldErrors.description && <div className="invalid-feedback">{fieldErrors.description}</div>}
          </div>

          <div className="mb-4">
            <label htmlFor="requestedPriority" className="form-label">
              Requested Priority
            </label>
            <select
              id="requestedPriority"
              className="form-select"
              value={requestedPriority}
              onChange={(event) => setRequestedPriority(event.target.value as Priority)}
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority.charAt(0) + priority.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="attachments" className="form-label">
              Attachments <span className="text-muted">(optional, up to {MAX_ACTIVE_ATTACHMENTS} files, JPG/PNG/WEBP/PDF, 5 MB each)</span>
            </label>
            <input
              id="attachments"
              type="file"
              className="form-control"
              accept={ALLOWED_ATTACHMENT_TYPES.join(',')}
              multiple
              disabled={attachmentFiles.length >= MAX_ACTIVE_ATTACHMENTS}
              onChange={(event) => {
                handleAttachmentChange(event.target.files)
                event.target.value = ''
              }}
            />
            {attachmentError && <div className="text-danger small mt-1">{attachmentError}</div>}
            {attachmentFiles.length > 0 && (
              <ul className="list-group mt-2">
                {attachmentFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="list-group-item d-flex justify-content-between align-items-center py-1">
                    <span className="text-truncate">{file.name}</span>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => removeSelectedAttachment(index)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/dashboard')}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default CreateTicketPage

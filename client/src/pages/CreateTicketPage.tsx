import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fetchCategories, type Category } from '../api/categories'
import { fetchRelatedSystems, type RelatedSystem } from '../api/relatedSystems'
import { createTicket, type Priority } from '../api/tickets'
import { ApiError } from '../api/client'
import ErrorAlert from '../components/ErrorAlert'
import LoadingSpinner from '../components/LoadingSpinner'

const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

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
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitError(null)

    if (!token || !categoryId || !summary.trim() || !description.trim()) {
      setSubmitError('Category, summary, and description are required.')
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
      navigate(`/tickets/${ticket.id}`)
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to create ticket.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      <h1 className="h3 mb-4">Create Ticket</h1>

      {loadError && <ErrorAlert message={loadError} />}

      {isLoadingOptions ? (
        <LoadingSpinner />
      ) : (
        <form onSubmit={handleSubmit} className="card p-4 shadow-sm">
          {submitError && <ErrorAlert message={submitError} />}

          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label htmlFor="category" className="form-label">
                Category
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
              Summary
            </label>
            <input
              id="summary"
              type="text"
              className="form-control"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <textarea
              id="description"
              className="form-control"
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
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

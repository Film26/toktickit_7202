import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { fetchAllCategories, createCategory, updateCategory, type Category } from '../api/categories'
import { fetchAllRelatedSystems, createRelatedSystem, updateRelatedSystem, type RelatedSystem } from '../api/relatedSystems'
import { ApiError } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'

type ReferenceItem = Category | RelatedSystem

type SectionProps = {
  title: string
  items: ReferenceItem[]
  isLoading: boolean
  error: string | null
  onCreate: (name: string) => Promise<void>
  onToggleActive: (item: ReferenceItem) => Promise<void>
}

function ReferenceDataSection({ title, items, isLoading, error, onCreate, onToggleActive }: SectionProps) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setLocalError(null)
    setIsSubmitting(true)
    try {
      await onCreate(name.trim())
      setName('')
    } catch (err) {
      setLocalError(err instanceof ApiError ? err.message : 'Unable to create item.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-body">
        <h2 className="h6 mb-3">{title}</h2>

        {(error || localError) && <ErrorAlert message={error ?? localError ?? ''} />}

        <form onSubmit={handleSubmit} className="d-flex gap-2 mb-3">
          <input
            type="text"
            className="form-control"
            placeholder={`New ${title.toLowerCase()} name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
          />
          <button type="submit" className="btn btn-primary text-nowrap" disabled={isSubmitting || !name.trim()}>
            Add
          </button>
        </form>

        {isLoading ? (
          <LoadingSpinner />
        ) : items.length === 0 ? (
          <EmptyState message="Nothing here yet." />
        ) : (
          <ul className="list-group list-group-flush">
            {items.map((item) => (
              <li key={item.id} className="list-group-item px-0 d-flex justify-content-between align-items-center">
                <span className={item.isActive ? '' : 'text-muted text-decoration-line-through'}>{item.name}</span>
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge rounded-pill ${item.isActive ? 'text-bg-success' : 'text-bg-secondary'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    type="button"
                    className={`btn btn-sm ${item.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                    onClick={() => onToggleActive(item)}
                  >
                    {item.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ReferenceDataManagementPage() {
  const { token } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    Promise.all([fetchAllCategories(token), fetchAllRelatedSystems(token)])
      .then(([categoriesData, relatedSystemsData]) => {
        setCategories(categoriesData)
        setRelatedSystems(relatedSystemsData)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load reference data.'))
      .finally(() => setIsLoading(false))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const handleCreateCategory = async (name: string) => {
    if (!token) return
    await createCategory(token, name)
    load()
  }

  const handleToggleCategory = async (item: ReferenceItem) => {
    if (!token) return
    await updateCategory(token, item.id, { isActive: !item.isActive })
    load()
  }

  const handleCreateRelatedSystem = async (name: string) => {
    if (!token) return
    await createRelatedSystem(token, name)
    load()
  }

  const handleToggleRelatedSystem = async (item: ReferenceItem) => {
    if (!token) return
    await updateRelatedSystem(token, item.id, { isActive: !item.isActive })
    load()
  }

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      <h1 className="h3 mb-4">Reference Data Management</h1>

      <ReferenceDataSection
        title="Categories"
        items={categories}
        isLoading={isLoading}
        error={error}
        onCreate={handleCreateCategory}
        onToggleActive={handleToggleCategory}
      />

      <ReferenceDataSection
        title="Related Systems"
        items={relatedSystems}
        isLoading={isLoading}
        error={error}
        onCreate={handleCreateRelatedSystem}
        onToggleActive={handleToggleRelatedSystem}
      />
    </div>
  )
}

export default ReferenceDataManagementPage

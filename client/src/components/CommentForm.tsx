import { useState, type FormEvent } from 'react'

type CommentFormProps = {
  placeholder: string
  buttonLabel: string
  onSubmit: (body: string) => Promise<void>
}

function CommentForm({ placeholder, buttonLabel, onSubmit }: CommentFormProps) {
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return
    setIsSubmitting(true)
    try {
      await onSubmit(value.trim())
      setValue('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="d-flex gap-2 mb-4">
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" className="btn btn-primary text-nowrap" disabled={isSubmitting || !value.trim()}>
        {buttonLabel}
      </button>
    </form>
  )
}

export default CommentForm

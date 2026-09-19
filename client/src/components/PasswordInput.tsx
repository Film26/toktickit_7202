import { useId, useState } from 'react'
import { EyeIcon, EyeSlashIcon } from './icons'

type PasswordInputProps = {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  required?: boolean
  id?: string
}

function PasswordInput({ label, value, onChange, autoComplete, required, id }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="mb-3">
      <label htmlFor={inputId} className="form-label">
        {label}
      </label>
      <div className="input-group">
        <input
          id={inputId}
          type={isVisible ? 'text' : 'password'}
          className="form-control"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setIsVisible((v) => !v)}
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          tabIndex={-1}
        >
          {isVisible ? <EyeSlashIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  )
}

export default PasswordInput

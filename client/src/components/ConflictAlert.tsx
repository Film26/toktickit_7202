import { ExclamationCircleIcon } from './icons'

// Shown for any 409 STALE_UPDATE (docs/lab-04/ui-spec.md section 2). The
// user's unsaved input stays on screen until they choose to reload.
function ConflictAlert({ message, onReload }: { message?: string; onReload: () => void }) {
  return (
    <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2" role="alert">
      <ExclamationCircleIcon />
      <span className="flex-grow-1">
        {message ?? 'This item was changed by someone else. Reload to see the latest version.'}
      </span>
      <button type="button" className="btn btn-sm btn-warning" onClick={onReload}>
        Reload
      </button>
    </div>
  )
}

export default ConflictAlert

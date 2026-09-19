import { ExclamationCircleIcon } from './icons'

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="alert alert-danger d-flex align-items-center gap-2" role="alert">
      <ExclamationCircleIcon />
      <span>{message}</span>
    </div>
  )
}

export default ErrorAlert

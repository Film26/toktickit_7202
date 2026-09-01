import type { TicketComment } from '../api/tickets'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function CommentList({ comments, emptyMessage }: { comments: TicketComment[]; emptyMessage: string }) {
  if (comments.length === 0) {
    return <p className="text-muted text-center py-3">{emptyMessage}</p>
  }

  return (
    <div className="d-flex flex-column gap-3">
      {comments.map((comment) => (
        <div className="d-flex gap-3" key={comment.id}>
          <div
            className="rounded-circle bg-primary-subtle text-primary-emphasis d-flex align-items-center justify-content-center fw-semibold flex-shrink-0"
            style={{ width: 36, height: 36 }}
          >
            {initials(comment.author.fullName)}
          </div>
          <div className="flex-grow-1">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="fw-semibold">{comment.author.fullName}</span>
              <span className="badge text-bg-primary-subtle text-primary-emphasis">{comment.author.role}</span>
              <span className="text-muted small ms-auto">{formatDateTime(comment.createdAt)}</span>
            </div>
            <p className="mb-0">{comment.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default CommentList

// Shown on My Tickets / Ticket Queue when a dashboard drill-down applied a
// filter that has no visible control of its own (statusGroup, itPriority),
// so the user can see why the list is narrowed and clear it (ui-spec 5).
function DrillDownChip({ description, onClear }: { description: string; onClear: () => void }) {
  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-3" role="status">
      <span className="badge rounded-pill bg-white text-primary border border-primary px-3 py-2 text-wrap text-start">
        Filtered from dashboard: {description}
      </span>
      <button type="button" className="btn btn-link btn-sm p-0" onClick={onClear}>
        Clear filters
      </button>
    </div>
  )
}

export default DrillDownChip

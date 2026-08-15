export function formatTicketNumber(id: number): string {
  const year = new Date().getFullYear()
  return `TKT-${year}-${String(id).padStart(6, '0')}`
}

-- Manual rollback for 20261007000000_lab4_ticket_workflow. Run with psql,
-- then delete this migration's row from "_prisma_migrations". Loses only the
-- Lab 4 status history and Ticket.version; all Ticket data is untouched.
DROP TABLE IF EXISTS "TicketStatusChange";
DROP INDEX IF EXISTS "Ticket_updatedAt_idx";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "version";

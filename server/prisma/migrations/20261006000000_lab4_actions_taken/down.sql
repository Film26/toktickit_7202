-- Manual rollback for 20261006000000_lab4_actions_taken (Prisma has no
-- automatic down migrations). Run with psql, then delete this migration's
-- row from "_prisma_migrations". Pre-Lab-4 data (ticketId, authorId,
-- description, timestamps) is untouched; only the Lab 4 columns are lost.
ALTER TABLE "ActionTaken" DROP CONSTRAINT IF EXISTS "ActionTaken_assigneeId_fkey";
DROP INDEX IF EXISTS "ActionTaken_ticketId_clientRequestId_key";
DROP INDEX IF EXISTS "ActionTaken_assigneeId_status_idx";
DROP INDEX IF EXISTS "ActionTaken_ticketId_actionAt_idx";
ALTER TABLE "ActionTaken"
  DROP COLUMN IF EXISTS "actionAt",
  DROP COLUMN IF EXISTS "assigneeId",
  DROP COLUMN IF EXISTS "attachmentNotes",
  DROP COLUMN IF EXISTS "cancelledAt",
  DROP COLUMN IF EXISTS "clientRequestId",
  DROP COLUMN IF EXISTS "completedAt",
  DROP COLUMN IF EXISTS "followUpNote",
  DROP COLUMN IF EXISTS "followUpRequired",
  DROP COLUMN IF EXISTS "result",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "version";
DROP TYPE IF EXISTS "ActionStatus";

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "ActionTaken" ADD COLUMN     "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "assigneeId" INTEGER,
ADD COLUMN     "attachmentNotes" VARCHAR(500),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "clientRequestId" VARCHAR(100),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "followUpNote" TEXT,
ADD COLUMN     "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "result" TEXT,
ADD COLUMN     "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_actionAt_idx" ON "ActionTaken"("ticketId", "actionAt");

-- CreateIndex
CREATE INDEX "ActionTaken_assigneeId_status_idx" ON "ActionTaken"("assigneeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ActionTaken_ticketId_clientRequestId_key" ON "ActionTaken"("ticketId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill (docs/lab-04/specification.md BR-24): every Action Taken recorded
-- before Lab 4 was finished work written by its author, so it becomes a
-- Completed action assigned to that author, dated when it was recorded.
UPDATE "ActionTaken"
SET "status" = 'COMPLETED',
    "actionAt" = "createdAt",
    "assigneeId" = "authorId",
    "completedAt" = "updatedAt",
    "result" = COALESCE("result", 'Recorded before Lab 4 (no result captured).');

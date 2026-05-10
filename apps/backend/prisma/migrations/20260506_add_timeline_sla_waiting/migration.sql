-- Sprint 2: Timeline SLA & Waiting
-- Add SLA fields to claim_statuses
ALTER TABLE "claim_statuses" ADD COLUMN "max_duration_hours" INTEGER;
ALTER TABLE "claim_statuses" ADD COLUMN "is_waiting_state" BOOLEAN NOT NULL DEFAULT false;

-- Add duration/waiting fields to claim_status_history
ALTER TABLE "claim_status_history" ADD COLUMN "duration_minutes" INTEGER;
ALTER TABLE "claim_status_history" ADD COLUMN "waiting_reason" TEXT;

-- Create claim_file_waitings table
CREATE TABLE "claim_file_waitings" (
  "id" TEXT NOT NULL,
  "claim_file_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "description" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "resolved_by_user_id" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  CONSTRAINT "claim_file_waitings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "claim_file_waitings_claim_file_id_idx" ON "claim_file_waitings"("claim_file_id");

ALTER TABLE "claim_file_waitings" ADD CONSTRAINT "claim_file_waitings_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "claim_file_waitings" ADD CONSTRAINT "claim_file_waitings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "claim_file_waitings" ADD CONSTRAINT "claim_file_waitings_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "extra_work_items" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'extra_work';
ALTER TABLE "extra_work_items" ADD COLUMN IF NOT EXISTS "estimated_amount" DOUBLE PRECISION;
ALTER TABLE "extra_work_items" ADD COLUMN IF NOT EXISTS "repair_report_id" TEXT;
ALTER TABLE "extra_work_items" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3);
ALTER TABLE "extra_work_items" ADD COLUMN IF NOT EXISTS "reject_reason" TEXT;

CREATE INDEX IF NOT EXISTS "extra_work_items_kind_status_idx" ON "extra_work_items"("kind", "status");
CREATE INDEX IF NOT EXISTS "extra_work_items_repair_report_id_idx" ON "extra_work_items"("repair_report_id");

DO $$ BEGIN
  ALTER TABLE "extra_work_items"
    ADD CONSTRAINT "extra_work_items_repair_report_id_fkey"
    FOREIGN KEY ("repair_report_id") REFERENCES "repair_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

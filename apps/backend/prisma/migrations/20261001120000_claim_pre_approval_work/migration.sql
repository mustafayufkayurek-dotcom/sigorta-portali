ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "has_pre_approval_work" BOOLEAN;
ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "pre_approval_work_json" TEXT;

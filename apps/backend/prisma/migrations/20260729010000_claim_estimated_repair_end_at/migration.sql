-- AlterTable
ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "estimated_repair_end_at" TIMESTAMP(3);

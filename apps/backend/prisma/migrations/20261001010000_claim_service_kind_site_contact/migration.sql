-- AlterTable
ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "service_kind" TEXT;
ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "site_contact_name" TEXT;
ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "site_contact_phone" TEXT;

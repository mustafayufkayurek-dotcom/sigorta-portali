-- AlterTable: Add extended fields to vendors
ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "entity_type" TEXT NOT NULL DEFAULT 'corporate',
  ADD COLUMN IF NOT EXISTS "tax_office" TEXT,
  ADD COLUMN IF NOT EXISTS "trade_registry_no" TEXT,
  ADD COLUMN IF NOT EXISTS "authorized_person" TEXT,
  ADD COLUMN IF NOT EXISTS "authorized_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "authorized_email" TEXT,
  ADD COLUMN IF NOT EXISTS "identity_no" TEXT,
  ADD COLUMN IF NOT EXISTS "district" TEXT,
  ADD COLUMN IF NOT EXISTS "iban" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_name" TEXT;

-- Create unique index on identity_no
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_identity_no_key" ON "vendors"("identity_no");

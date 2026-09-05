-- Acil kesilen satış faturası Hasar dosyasına bağlanmaz.
-- Hasar ciro/kâr özeti yalnız claim_file_id üzerinden kalır.

ALTER TABLE "invoices" ALTER COLUMN "claim_file_id" DROP NOT NULL;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "emergency_case_id" TEXT;

CREATE INDEX IF NOT EXISTS "invoices_emergency_case_id_idx"
  ON "invoices"("emergency_case_id");

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_emergency_case_id_fkey";

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_emergency_case_id_fkey"
  FOREIGN KEY ("emergency_case_id") REFERENCES "emergency_cases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_claim_or_emergency_chk";

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_claim_or_emergency_chk"
  CHECK (
    ("claim_file_id" IS NOT NULL AND "emergency_case_id" IS NULL)
    OR ("claim_file_id" IS NULL AND "emergency_case_id" IS NOT NULL)
  );

-- Daha önce notta kalan Acil satış numaralarını kesilen faturaya bağla.
INSERT INTO "invoices" (
  "id",
  "claim_file_id",
  "emergency_case_id",
  "invoice_type",
  "invoice_no",
  "invoice_date",
  "due_date",
  "counterparty_type",
  "counterparty_id",
  "currency",
  "subtotal_amount",
  "vat_amount",
  "withholding_amount",
  "total_amount",
  "status",
  "notes",
  "created_by_user_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  NULL,
  ir."emergency_case_id",
  'sales',
  trim(substring(ir."notes" from 'Satış fatura no:\s*([^\n]+)')),
  COALESCE(ir."invoiced_at", ir."updated_at", CURRENT_TIMESTAMP),
  NULL,
  'customer',
  ec."customer_id",
  'TRY',
  ir."total_amount",
  0,
  0,
  ir."total_amount",
  'sent',
  'Fatura talebi ' || ir."request_no",
  ir."created_by_user_id",
  COALESCE(ir."invoiced_at", ir."created_at"),
  CURRENT_TIMESTAMP
FROM "invoice_requests" ir
JOIN "emergency_cases" ec ON ec."id" = ir."emergency_case_id"
WHERE ir."status" = 'invoiced'
  AND ir."invoice_id" IS NULL
  AND ir."emergency_case_id" IS NOT NULL
  AND ir."notes" ~* 'Satış fatura no:'
  AND trim(substring(ir."notes" from 'Satış fatura no:\s*([^\n]+)')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "invoices" i
    WHERE i."invoice_no" = trim(substring(ir."notes" from 'Satış fatura no:\s*([^\n]+)'))
  );

UPDATE "invoice_requests" ir
SET "invoice_id" = i."id"
FROM "invoices" i
WHERE ir."invoice_id" IS NULL
  AND ir."emergency_case_id" IS NOT NULL
  AND i."emergency_case_id" = ir."emergency_case_id"
  AND (
    i."invoice_no" = trim(substring(ir."notes" from 'Satış fatura no:\s*([^\n]+)'))
    OR i."notes" = 'Fatura talebi ' || ir."request_no"
  );

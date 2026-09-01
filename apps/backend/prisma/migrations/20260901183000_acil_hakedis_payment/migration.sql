-- Acil hakediş finans ödeme kuyruğuna düşer. Hasar claim_file_id zorunluluğu kalkmaz;
-- Hasar satırları aynı kalır. Acil satırında dosya emergency_case_id ile bağlanır. Vade yok.

ALTER TABLE "payments" ALTER COLUMN "claim_file_id" DROP NOT NULL;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "emergency_case_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_emergency_case_id_key"
  ON "payments"("emergency_case_id");

ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "payments_emergency_case_id_fkey";

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_emergency_case_id_fkey"
  FOREIGN KEY ("emergency_case_id") REFERENCES "emergency_cases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Hakedişi duran, damgası boş dosya ödenmedi sayılır (kuyrukta kalsın).
UPDATE "emergency_cases" c
SET "vendor_paid" = false
WHERE c."vendor_paid" IS NULL
  AND EXISTS (
    SELECT 1 FROM "emergency_vendor_entitlements" e WHERE e."case_id" = c."id"
  );

INSERT INTO "payments" (
  "id",
  "claim_file_id",
  "emergency_case_id",
  "payment_type",
  "payment_date",
  "due_date",
  "amount",
  "currency",
  "method",
  "payer_type",
  "payer_id",
  "status",
  "reference_no",
  "note",
  "created_by_user_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  NULL,
  e."case_id",
  'outgoing',
  e."granted_at",
  NULL,
  e."amount",
  'TRY',
  'eft',
  'vendor',
  e."vendor_id",
  CASE WHEN c."vendor_paid" IS TRUE THEN 'completed' ELSE 'pending' END,
  'ACIL-HAKEDIS:' || e."case_id",
  'Acil hakediş · Vade yok',
  e."granted_by_user_id",
  e."granted_at",
  CURRENT_TIMESTAMP
FROM "emergency_vendor_entitlements" e
JOIN "emergency_cases" c ON c."id" = e."case_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "payments" p WHERE p."emergency_case_id" = e."case_id"
);

-- Ödendi işlemini kim yaptı (dosya sorumlusu veya finans).
ALTER TABLE "emergency_cases" ADD COLUMN IF NOT EXISTS "vendor_paid_by_user_id" TEXT;
ALTER TABLE "emergency_cases" ADD COLUMN IF NOT EXISTS "vendor_paid_at" TIMESTAMP(3);

ALTER TABLE "emergency_cases"
  DROP CONSTRAINT IF EXISTS "emergency_cases_vendor_paid_by_user_id_fkey";

ALTER TABLE "emergency_cases"
  ADD CONSTRAINT "emergency_cases_vendor_paid_by_user_id_fkey"
  FOREIGN KEY ("vendor_paid_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

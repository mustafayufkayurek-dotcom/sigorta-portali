-- Çoklu tedarikçi ataması: claim_file_suppliers (N:M)
-- Mevcut assigned_supplier_id birincil alan olarak korunur; satırlar backfill edilir.

CREATE TABLE IF NOT EXISTS "claim_file_suppliers" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "claim_file_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "claim_file_suppliers_claim_file_id_vendor_id_key"
  ON "claim_file_suppliers"("claim_file_id", "vendor_id");

CREATE INDEX IF NOT EXISTS "claim_file_suppliers_claim_file_id_idx"
  ON "claim_file_suppliers"("claim_file_id");

CREATE INDEX IF NOT EXISTS "claim_file_suppliers_vendor_id_idx"
  ON "claim_file_suppliers"("vendor_id");

DO $$ BEGIN
  ALTER TABLE "claim_file_suppliers"
    ADD CONSTRAINT "claim_file_suppliers_claim_file_id_fkey"
    FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "claim_file_suppliers"
    ADD CONSTRAINT "claim_file_suppliers_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Geriye uyum: tek assigned_supplier_id → join satırı
INSERT INTO "claim_file_suppliers" (
  "id", "claim_file_id", "vendor_id", "assigned_at", "sort_order", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  cf."id",
  cf."assigned_supplier_id",
  COALESCE(cf."supplier_assigned_at", CURRENT_TIMESTAMP),
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "claim_files" cf
WHERE cf."assigned_supplier_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "claim_file_suppliers" s
    WHERE s."claim_file_id" = cf."id" AND s."vendor_id" = cf."assigned_supplier_id"
  );

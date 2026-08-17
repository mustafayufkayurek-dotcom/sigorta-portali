-- Yönetim gideri havuzu + KDV hariç sabit gider tutarları
ALTER TABLE "monthly_overhead_entries" ADD COLUMN IF NOT EXISTS "vat_rate" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "monthly_overhead_entries" ADD COLUMN IF NOT EXISTS "gross_amount" DOUBLE PRECISION;

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "is_overhead_pool" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "overhead_allocated_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "expenses_is_overhead_pool_idx" ON "expenses"("is_overhead_pool");

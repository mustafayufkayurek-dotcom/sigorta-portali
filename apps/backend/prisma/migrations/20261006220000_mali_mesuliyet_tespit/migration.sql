-- AlterTable
ALTER TABLE "repair_report_items" ADD COLUMN IF NOT EXISTS "mali_mesuliyet_tespit_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "mali_mesuliyet_tespit" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "lokasyon" TEXT NOT NULL,
    "daire_no" TEXT NOT NULL,
    "findings_text" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mali_mesuliyet_tespit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mali_mesuliyet_is_kalemi" (
    "id" TEXT NOT NULL,
    "tespit_id" TEXT NOT NULL,
    "job_description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "sales_unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplier_unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sales_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplier_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricing_type" TEXT NOT NULL DEFAULT 'unit',
    "lump_sum_price" DOUBLE PRECISION,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "repair_report_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mali_mesuliyet_is_kalemi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mali_mesuliyet_tespit_claim_file_id_idx" ON "mali_mesuliyet_tespit"("claim_file_id");
CREATE INDEX IF NOT EXISTS "mali_mesuliyet_tespit_lokasyon_idx" ON "mali_mesuliyet_tespit"("lokasyon");
CREATE INDEX IF NOT EXISTS "mali_mesuliyet_is_kalemi_tespit_id_idx" ON "mali_mesuliyet_is_kalemi"("tespit_id");
CREATE UNIQUE INDEX IF NOT EXISTS "mali_mesuliyet_is_kalemi_repair_report_item_id_key" ON "mali_mesuliyet_is_kalemi"("repair_report_item_id");
CREATE INDEX IF NOT EXISTS "repair_report_items_mali_mesuliyet_tespit_id_idx" ON "repair_report_items"("mali_mesuliyet_tespit_id");

ALTER TABLE "mali_mesuliyet_tespit" ADD CONSTRAINT "mali_mesuliyet_tespit_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mali_mesuliyet_is_kalemi" ADD CONSTRAINT "mali_mesuliyet_is_kalemi_tespit_id_fkey" FOREIGN KEY ("tespit_id") REFERENCES "mali_mesuliyet_tespit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mali_mesuliyet_is_kalemi" ADD CONSTRAINT "mali_mesuliyet_is_kalemi_repair_report_item_id_fkey" FOREIGN KEY ("repair_report_item_id") REFERENCES "repair_report_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "repair_report_items" ADD CONSTRAINT "repair_report_items_mali_mesuliyet_tespit_id_fkey" FOREIGN KEY ("mali_mesuliyet_tespit_id") REFERENCES "mali_mesuliyet_tespit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

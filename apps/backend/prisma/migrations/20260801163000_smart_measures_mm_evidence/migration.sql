-- Akıllı Ölçüm v2 — mm + FileAsset + status + Evidence Chain alanları
-- Önkoşul: 20260801140000 uygulandı (cm/photo_url tabloları mevcut)
-- Not: Eski width_cm / photo_url kolonları v436 uyumu için bırakıldı (0 satır; yeni kod mm/FileAsset kullanır).
-- Index planı: claim_file_id, element_id, measured_at, measured_by, source, status, ai_level

-- ─── elements ─────────────────────────────────────────────────────────────────
ALTER TABLE "smart_measure_elements"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "archived_by_user_id" TEXT;

ALTER TABLE "smart_measure_elements"
  DROP CONSTRAINT IF EXISTS "smart_measure_elements_archived_by_user_id_fkey";
ALTER TABLE "smart_measure_elements"
  ADD CONSTRAINT "smart_measure_elements_archived_by_user_id_fkey"
  FOREIGN KEY ("archived_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_sme_claim_status"
  ON "smart_measure_elements"("claim_file_id", "status");
CREATE INDEX IF NOT EXISTS "idx_sme_archived"
  ON "smart_measure_elements"("archived_at");

-- ─── versions: yeni kolonlar ──────────────────────────────────────────────────
ALTER TABLE "smart_measure_versions"
  ADD COLUMN IF NOT EXISTS "claim_file_id" TEXT,
  ADD COLUMN IF NOT EXISTS "width_mm" INTEGER,
  ADD COLUMN IF NOT EXISTS "height_mm" INTEGER,
  ADD COLUMN IF NOT EXISTS "depth_mm" INTEGER,
  ADD COLUMN IF NOT EXISTS "ai_confidence_level" TEXT,
  ADD COLUMN IF NOT EXISTS "is_ai_produced" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_user_corrected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_manual_revision" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "photo_file_asset_id" TEXT,
  ADD COLUMN IF NOT EXISTS "annotated_photo_file_asset_id" TEXT,
  ADD COLUMN IF NOT EXISTS "extension_json" JSONB;

-- claim_file_id backfill (element üzerinden)
UPDATE "smart_measure_versions" v
SET "claim_file_id" = e."claim_file_id"
FROM "smart_measure_elements" e
WHERE v."element_id" = e."id"
  AND v."claim_file_id" IS NULL;

-- mm backfill (cm × 10); boş tabloda no-op
UPDATE "smart_measure_versions"
SET
  "width_mm" = CASE WHEN "width_cm" IS NOT NULL THEN ROUND("width_cm" * 10)::INTEGER ELSE "width_mm" END,
  "height_mm" = CASE WHEN "height_cm" IS NOT NULL THEN ROUND("height_cm" * 10)::INTEGER ELSE "height_mm" END,
  "depth_mm" = CASE WHEN "depth_cm" IS NOT NULL THEN ROUND("depth_cm" * 10)::INTEGER ELSE "depth_mm" END
WHERE "width_mm" IS NULL OR "height_mm" IS NULL OR "depth_mm" IS NULL;

-- claim_file_id zorunlu (orphan kalmamalı)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "smart_measure_versions" WHERE "claim_file_id" IS NULL) THEN
    RAISE EXCEPTION 'smart_measure_versions.claim_file_id backfill incomplete';
  END IF;
END $$;

ALTER TABLE "smart_measure_versions"
  ALTER COLUMN "claim_file_id" SET NOT NULL;

ALTER TABLE "smart_measure_versions"
  DROP CONSTRAINT IF EXISTS "smart_measure_versions_claim_file_id_fkey";
ALTER TABLE "smart_measure_versions"
  ADD CONSTRAINT "smart_measure_versions_claim_file_id_fkey"
  FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "smart_measure_versions"
  DROP CONSTRAINT IF EXISTS "smart_measure_versions_photo_file_asset_id_fkey";
ALTER TABLE "smart_measure_versions"
  ADD CONSTRAINT "smart_measure_versions_photo_file_asset_id_fkey"
  FOREIGN KEY ("photo_file_asset_id") REFERENCES "file_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "smart_measure_versions"
  DROP CONSTRAINT IF EXISTS "smart_measure_versions_annotated_photo_file_asset_id_fkey";
ALTER TABLE "smart_measure_versions"
  ADD CONSTRAINT "smart_measure_versions_annotated_photo_file_asset_id_fkey"
  FOREIGN KEY ("annotated_photo_file_asset_id") REFERENCES "file_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_smv_claim_measured"
  ON "smart_measure_versions"("claim_file_id", "measured_at");
CREATE INDEX IF NOT EXISTS "idx_smv_measured_at"
  ON "smart_measure_versions"("measured_at");
CREATE INDEX IF NOT EXISTS "idx_smv_source"
  ON "smart_measure_versions"("source");
CREATE INDEX IF NOT EXISTS "idx_smv_claim_source"
  ON "smart_measure_versions"("claim_file_id", "source");
CREATE INDEX IF NOT EXISTS "idx_smv_ai_level"
  ON "smart_measure_versions"("ai_confidence_level");
CREATE INDEX IF NOT EXISTS "idx_smv_photo_asset"
  ON "smart_measure_versions"("photo_file_asset_id");
CREATE INDEX IF NOT EXISTS "idx_smv_measured_by"
  ON "smart_measure_versions"("measured_by_user_id");

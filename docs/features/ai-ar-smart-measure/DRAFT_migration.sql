-- =============================================================================
-- DRAFT ONLY — ÇALIŞTIRILMAYACAK
-- Akıllı Ölçüm nihai şema (mm + FileAsset + status + soft archive + indexes)
-- Mustafa onayı sonrası prisma/migrations altına taşınacak.
--
-- Not: Yerelde eski 20260801140000_smart_measures (cm + photo_url) varsa
-- bu taslak onun yerine geçer (greenfield) veya ALTER migration’a çevrilir.
-- Canlıda tablo varlığı onay öncesi doğrulanmalıdır.
-- =============================================================================

-- ─── smart_measure_elements ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "smart_measure_elements" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    -- draft | measured | reviewed | approved | archived
    "location_label" TEXT,
    "room_label" TEXT,
    "element_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3),
    "archived_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_measure_elements_pkey" PRIMARY KEY ("id")
);

-- Index planı (element)
CREATE INDEX IF NOT EXISTS "idx_sme_claim_created"
  ON "smart_measure_elements"("claim_file_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_sme_claim_status"
  ON "smart_measure_elements"("claim_file_id", "status");
CREATE INDEX IF NOT EXISTS "idx_sme_created_by"
  ON "smart_measure_elements"("created_by_user_id");
CREATE INDEX IF NOT EXISTS "idx_sme_element_type"
  ON "smart_measure_elements"("element_type");
CREATE INDEX IF NOT EXISTS "idx_sme_archived"
  ON "smart_measure_elements"("archived_at");

-- FK (element)
ALTER TABLE "smart_measure_elements"
  ADD CONSTRAINT "smart_measure_elements_claim_file_id_fkey"
  FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "smart_measure_elements"
  ADD CONSTRAINT "smart_measure_elements_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "smart_measure_elements"
  ADD CONSTRAINT "smart_measure_elements_archived_by_user_id_fkey"
  FOREIGN KEY ("archived_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── smart_measure_versions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "smart_measure_versions" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "element_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,

    "width_mm" INTEGER,
    "height_mm" INTEGER,
    "depth_mm" INTEGER,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,

    "ai_confidence" DOUBLE PRECISION,
    "ai_confidence_level" TEXT,
    -- very_high | high | medium | low
    "ai_detected_type" TEXT,

    "is_ai_produced" BOOLEAN NOT NULL DEFAULT false,
    "is_user_corrected" BOOLEAN NOT NULL DEFAULT false,
    "is_manual_revision" BOOLEAN NOT NULL DEFAULT false,

    "photo_file_asset_id" TEXT,
    "annotated_photo_file_asset_id" TEXT,

    "overlay_json" JSONB,
    "extension_json" JSONB,
    "gps_lat" DOUBLE PRECISION,
    "gps_lng" DOUBLE PRECISION,
    "device_info_json" JSONB,

    "measured_at" TIMESTAMP(3) NOT NULL,
    "measured_by_user_id" TEXT NOT NULL,
    -- Genişletilebilir TEXT (enum değil): mobile_ar | lidar | manual | drone | video | …
    "source" TEXT NOT NULL DEFAULT 'mobile_ar',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smart_measure_versions_pkey" PRIMARY KEY ("id")
);

-- Unique + Index planı (version)
-- İstenen: claim_file_id, element_id, measured_at, created_by≈measured_by, source
CREATE UNIQUE INDEX IF NOT EXISTS "uq_smv_element_ver"
  ON "smart_measure_versions"("element_id", "version_no");
CREATE INDEX IF NOT EXISTS "idx_smv_claim_measured"
  ON "smart_measure_versions"("claim_file_id", "measured_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_smv_element_ver"
  ON "smart_measure_versions"("element_id", "version_no");
CREATE INDEX IF NOT EXISTS "idx_smv_measured_at"
  ON "smart_measure_versions"("measured_at");
CREATE INDEX IF NOT EXISTS "idx_smv_measured_by"
  ON "smart_measure_versions"("measured_by_user_id");
CREATE INDEX IF NOT EXISTS "idx_smv_source"
  ON "smart_measure_versions"("source");
CREATE INDEX IF NOT EXISTS "idx_smv_claim_source"
  ON "smart_measure_versions"("claim_file_id", "source");
CREATE INDEX IF NOT EXISTS "idx_smv_ai_level"
  ON "smart_measure_versions"("ai_confidence_level");
CREATE INDEX IF NOT EXISTS "idx_smv_photo_asset"
  ON "smart_measure_versions"("photo_file_asset_id");

-- FK (version)
ALTER TABLE "smart_measure_versions"
  ADD CONSTRAINT "smart_measure_versions_claim_file_id_fkey"
  FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "smart_measure_versions"
  ADD CONSTRAINT "smart_measure_versions_element_id_fkey"
  FOREIGN KEY ("element_id") REFERENCES "smart_measure_elements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "smart_measure_versions"
  ADD CONSTRAINT "smart_measure_versions_measured_by_user_id_fkey"
  FOREIGN KEY ("measured_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "smart_measure_versions"
  ADD CONSTRAINT "smart_measure_versions_photo_file_asset_id_fkey"
  FOREIGN KEY ("photo_file_asset_id") REFERENCES "file_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "smart_measure_versions"
  ADD CONSTRAINT "smart_measure_versions_annotated_photo_file_asset_id_fkey"
  FOREIGN KEY ("annotated_photo_file_asset_id") REFERENCES "file_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- ClaimDocument kullanım sözleşmesi (DDL yok — uygulama katmanı):
--   document_type IN ('smart_measure_photo', 'smart_measure_annotated')
--   FileAsset.owner_type = 'claim_file', category = 'smart_measure'
-- =============================================================================

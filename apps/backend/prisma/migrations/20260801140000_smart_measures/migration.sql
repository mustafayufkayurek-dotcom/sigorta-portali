-- AI + AR Akıllı Ölçüm Dilim 0/1 — ilk canlı sürüm (cm + photo_url)
-- Bu migration production'da 2026-08-01 uygulandı; checksum korunmalı.

CREATE TABLE "smart_measure_elements" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "location_label" TEXT,
    "room_label" TEXT,
    "element_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_measure_elements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "smart_measure_versions" (
    "id" TEXT NOT NULL,
    "element_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "width_cm" DOUBLE PRECISION,
    "height_cm" DOUBLE PRECISION,
    "depth_cm" DOUBLE PRECISION,
    "area_m2" DOUBLE PRECISION,
    "perimeter_m" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "volume_m3" DOUBLE PRECISION,
    "ai_confidence" DOUBLE PRECISION,
    "ai_detected_type" TEXT,
    "photo_url" TEXT,
    "annotated_photo_url" TEXT,
    "overlay_json" JSONB,
    "gps_lat" DOUBLE PRECISION,
    "gps_lng" DOUBLE PRECISION,
    "device_info_json" JSONB,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "measured_by_user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'mobile_ar',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smart_measure_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "smart_measure_elements_claim_file_id_created_at_idx" ON "smart_measure_elements"("claim_file_id", "created_at");
CREATE INDEX "smart_measure_elements_created_by_user_id_idx" ON "smart_measure_elements"("created_by_user_id");
CREATE INDEX "smart_measure_elements_element_type_idx" ON "smart_measure_elements"("element_type");

CREATE UNIQUE INDEX "smart_measure_versions_element_id_version_no_key" ON "smart_measure_versions"("element_id", "version_no");
CREATE INDEX "smart_measure_versions_element_id_version_no_idx" ON "smart_measure_versions"("element_id", "version_no");
CREATE INDEX "smart_measure_versions_measured_by_user_id_idx" ON "smart_measure_versions"("measured_by_user_id");

ALTER TABLE "smart_measure_elements" ADD CONSTRAINT "smart_measure_elements_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "smart_measure_elements" ADD CONSTRAINT "smart_measure_elements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "smart_measure_versions" ADD CONSTRAINT "smart_measure_versions_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "smart_measure_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "smart_measure_versions" ADD CONSTRAINT "smart_measure_versions_measured_by_user_id_fkey" FOREIGN KEY ("measured_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

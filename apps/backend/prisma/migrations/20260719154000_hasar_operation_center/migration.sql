-- Hasar 1. Perde: mevcut randevu tablosunu geriye uyumlu biçimde genişletir.
ALTER TABLE "appointments"
  ADD COLUMN "location_url" TEXT,
  ADD COLUMN "estimated_duration_minutes" INTEGER,
  ADD COLUMN "is_primary_inspection" BOOLEAN NOT NULL DEFAULT false;

-- Mevcut dosyalarda iptal edilmemiş en güncel randevuyu ana randevu olarak işaretle.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "claim_file_id"
      ORDER BY "scheduled_at" DESC, "created_at" DESC
    ) AS row_no
  FROM "appointments"
  WHERE "status" <> 'cancelled'
)
UPDATE "appointments" AS appointment
SET "is_primary_inspection" = true
FROM ranked
WHERE appointment."id" = ranked."id"
  AND ranked.row_no = 1;

-- Her dosyada yalnızca bir ana tespit randevusu olabilir.
CREATE UNIQUE INDEX "appointments_one_primary_inspection_per_claim"
  ON "appointments" ("claim_file_id")
  WHERE "is_primary_inspection" = true;

CREATE INDEX "appointments_claim_file_id_is_primary_inspection_idx"
  ON "appointments" ("claim_file_id", "is_primary_inspection");

-- Kalıcı operasyon geçmişi için mevcut enum güvenli biçimde genişletilir.
ALTER TYPE "file_activity_action" ADD VALUE IF NOT EXISTS 'SUPPLIER_REMOVED';
ALTER TYPE "file_activity_action" ADD VALUE IF NOT EXISTS 'APPOINTMENT_NOTIFICATION_RECORDED';
ALTER TYPE "file_activity_action" ADD VALUE IF NOT EXISTS 'PHONE_CALL_RECORDED';
ALTER TYPE "file_activity_action" ADD VALUE IF NOT EXISTS 'WHATSAPP_STATUS_RECORDED';

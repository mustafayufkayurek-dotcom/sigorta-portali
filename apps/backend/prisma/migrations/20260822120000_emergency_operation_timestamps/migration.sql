-- Acil dosya resmi işlem saatleri: işe başlama + hizmet verilme.
-- İhbar = file_date / gelen kutu; kapanış = resolved_at (zaten var).

ALTER TABLE "emergency_cases" ADD COLUMN "work_started_at" TIMESTAMP(3);
ALTER TABLE "emergency_cases" ADD COLUMN "service_delivered_at" TIMESTAMP(3);

UPDATE "emergency_cases" AS c
SET "work_started_at" = a."created_at"
FROM (
  SELECT DISTINCT ON ("entity_id") "entity_id", "created_at"
  FROM "audit_logs"
  WHERE "entity_type" = 'emergency_case'
    AND "action" = 'EMERGENCY_WORK_START_READY'
  ORDER BY "entity_id", "created_at" ASC
) AS a
WHERE a."entity_id" = c."id"
  AND c."work_started_at" IS NULL;

UPDATE "emergency_cases" AS c
SET "service_delivered_at" = a."created_at"
FROM (
  SELECT DISTINCT ON ("entity_id") "entity_id", "created_at"
  FROM "audit_logs"
  WHERE "entity_type" = 'emergency_case'
    AND "action" = 'EMERGENCY_SERVICE_COMPLETED'
  ORDER BY "entity_id", "created_at" ASC
) AS a
WHERE a."entity_id" = c."id"
  AND c."service_delivered_at" IS NULL;

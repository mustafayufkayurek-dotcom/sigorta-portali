ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "family" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "service_types_code_key" ON "service_types"("code");
CREATE INDEX IF NOT EXISTS "service_types_family_is_active_idx" ON "service_types"("family", "is_active");

ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "consultancy_service_type_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'claim_files_consultancy_service_type_id_fkey'
  ) THEN
    ALTER TABLE "claim_files"
      ADD CONSTRAINT "claim_files_consultancy_service_type_id_fkey"
      FOREIGN KEY ("consultancy_service_type_id") REFERENCES "service_types"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "claim_files_consultancy_service_type_id_idx"
  ON "claim_files"("consultancy_service_type_id");

INSERT INTO "service_types" ("id", "name", "family", "code", "is_active", "is_system", "sort_order", "created_at", "updated_at")
SELECT gen_random_uuid(), 'Hasar Tespit', 'consultancy', 'hasar_tespit', true, true, 1, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "service_types"
  WHERE "code" = 'hasar_tespit' OR lower("name") = 'hasar tespit'
);

UPDATE "service_types"
SET "family" = 'consultancy',
    "code" = COALESCE("code", 'hasar_tespit'),
    "is_system" = true,
    "is_active" = true,
    "sort_order" = 1
WHERE lower("name") = 'hasar tespit';

ALTER TABLE "claim_subjects" ADD COLUMN IF NOT EXISTS "department_id" TEXT;
ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "code" TEXT;

UPDATE "service_types" SET "code" = 'HIZ-00001' WHERE "name" = 'Hasar Onarım' AND ("code" IS NULL OR "code" = '');
UPDATE "service_types" SET "code" = 'HIZ-00002' WHERE "name" = 'Restorasyon' AND ("code" IS NULL OR "code" = '');
UPDATE "service_types" SET "code" = 'HIZ-00003' WHERE "name" = 'Güneş Enerjisi Onarım' AND ("code" IS NULL OR "code" = '');
UPDATE "service_types" SET "code" = 'HIZ-00004' WHERE "name" = 'Sovtaj' AND ("code" IS NULL OR "code" = '');
UPDATE "service_types" SET "code" = 'HIZ-00005' WHERE "name" = 'İş Makinası İade Parça' AND ("code" IS NULL OR "code" = '');
UPDATE "service_types" SET "code" = 'HIZ-00006' WHERE "name" = 'Elektronik İade Parça' AND ("code" IS NULL OR "code" = '');
UPDATE "service_types" SET "code" = 'HIZ-00007' WHERE "name" = 'Danışmanlık' AND ("code" IS NULL OR "code" = '');

UPDATE "claim_subjects"
SET "department_id" = d."id"
FROM "departments" d
WHERE d."code" = 'hasar-onarim'
  AND "claim_subjects"."category" = 'hasar'
  AND "claim_subjects"."department_id" IS NULL;

UPDATE "claim_subjects"
SET "department_id" = d."id"
FROM "departments" d
WHERE d."code" = 'acil-yardim'
  AND "claim_subjects"."category" = 'acil_yardim'
  AND "claim_subjects"."department_id" IS NULL;

ALTER TABLE "claim_subjects"
  ADD CONSTRAINT "claim_subjects_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "service_types_code_key" ON "service_types"("code");
CREATE INDEX IF NOT EXISTS "claim_subjects_department_id_idx" ON "claim_subjects"("department_id");
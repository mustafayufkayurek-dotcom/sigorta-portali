UPDATE "claim_subjects"
SET "department_id" = d."id"
FROM "departments" d
WHERE d."code" = 'hasar-onarim'
  AND "claim_subjects"."category" = 'hasar';

UPDATE "claim_subjects"
SET "department_id" = d."id"
FROM "departments" d
WHERE d."code" = 'acil-yardim'
  AND "claim_subjects"."category" = 'acil_yardim';
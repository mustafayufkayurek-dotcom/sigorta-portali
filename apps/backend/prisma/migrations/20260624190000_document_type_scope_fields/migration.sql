-- Evrak türü kapsamı: Meridyen hizmet branşı + müşteri alt tipi
ALTER TABLE "document_types" ADD COLUMN IF NOT EXISTS "service_branch_types" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "document_types" ADD COLUMN IF NOT EXISTS "customer_sub_types" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "document_types" ADD COLUMN IF NOT EXISTS "entity_scope" TEXT NOT NULL DEFAULT 'vendor';

-- Mevcut departman atamalarını hizmet branşı tipine taşı (hasar-onarim/sovtaj → hasar, acil-yardim → acil_yardim)
UPDATE "document_types" dt
SET "service_branch_types" = COALESCE(
  (
    SELECT jsonb_agg(DISTINCT mapped.branch_type)
    FROM (
      SELECT DISTINCT
        CASE d.code
          WHEN 'hasar-onarim' THEN 'hasar'
          WHEN 'sovtaj' THEN 'hasar'
          WHEN 'acil-yardim' THEN 'acil_yardim'
          ELSE NULL
        END AS branch_type
      FROM jsonb_array_elements_text(dt."department_ids") AS dept_id
      JOIN "departments" d ON d.id = dept_id
    ) mapped
    WHERE mapped.branch_type IS NOT NULL
  ),
  '[]'::jsonb
)
WHERE jsonb_array_length(COALESCE(dt."department_ids", '[]'::jsonb)) > 0
  AND jsonb_array_length(COALESCE(dt."service_branch_types", '[]'::jsonb)) = 0;

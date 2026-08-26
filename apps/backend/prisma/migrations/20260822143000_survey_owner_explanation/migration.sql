-- AlterTable
ALTER TABLE "survey_campaigns" ADD COLUMN IF NOT EXISTS "owner_explanation" TEXT;
ALTER TABLE "survey_campaigns" ADD COLUMN IF NOT EXISTS "owner_explanation_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "survey_campaigns_emergency_case_id_idx" ON "survey_campaigns"("emergency_case_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_campaigns_emergency_case_id_fkey'
  ) THEN
    ALTER TABLE "survey_campaigns"
      ADD CONSTRAINT "survey_campaigns_emergency_case_id_fkey"
      FOREIGN KEY ("emergency_case_id") REFERENCES "emergency_cases"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

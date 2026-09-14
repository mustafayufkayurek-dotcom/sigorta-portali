-- Acil tespit raporu kalem satırı (iş grubu, mahal, tanım, açıklama)
ALTER TABLE "emergency_cases"
ADD COLUMN IF NOT EXISTS "report_work_group" TEXT,
ADD COLUMN IF NOT EXISTS "report_mahal" TEXT,
ADD COLUMN IF NOT EXISTS "report_job_description" TEXT,
ADD COLUMN IF NOT EXISTS "report_item_description" TEXT;

-- C8: Personel yasal hesap — aylık brüt + kabul özeti
ALTER TABLE "hr_employee_profiles"
  ADD COLUMN IF NOT EXISTS "monthly_gross_salary" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "yasal_kabul_json" JSONB,
  ADD COLUMN IF NOT EXISTS "yasal_kabul_at" TIMESTAMP(3);

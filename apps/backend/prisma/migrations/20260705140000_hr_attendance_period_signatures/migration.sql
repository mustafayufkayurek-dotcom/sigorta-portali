-- F5b: Aylık puantaj onayı ve ay kilidi için ad-soyad dijital imza
ALTER TABLE "hr_attendance_period_locks"
  ADD COLUMN IF NOT EXISTS "employee_signature" TEXT,
  ADD COLUMN IF NOT EXISTS "employee_signature_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "manager_signature" TEXT,
  ADD COLUMN IF NOT EXISTS "manager_signature_at" TIMESTAMP(3);

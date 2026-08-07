-- Personel özlük: T.C. Kimlik No + doğum tarihi
ALTER TABLE "hr_employee_profiles" ADD COLUMN IF NOT EXISTS "identity_no" TEXT;
ALTER TABLE "hr_employee_profiles" ADD COLUMN IF NOT EXISTS "birth_date" DATE;
CREATE UNIQUE INDEX IF NOT EXISTS "hr_employee_profiles_identity_no_key" ON "hr_employee_profiles"("identity_no");

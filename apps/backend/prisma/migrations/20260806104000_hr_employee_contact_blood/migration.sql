-- Personel özlük: kişisel/şirket GSM + kan grubu
ALTER TABLE "hr_employee_profiles" ADD COLUMN IF NOT EXISTS "personal_gsm" TEXT;
ALTER TABLE "hr_employee_profiles" ADD COLUMN IF NOT EXISTS "company_gsm" TEXT;
ALTER TABLE "hr_employee_profiles" ADD COLUMN IF NOT EXISTS "blood_type" TEXT;

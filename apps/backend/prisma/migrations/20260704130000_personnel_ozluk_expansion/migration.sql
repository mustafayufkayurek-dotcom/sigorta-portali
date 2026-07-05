-- Personel Özlük modülü genişletmesi: izin bakiyesi, puantaj alanları, izin onay akışı

ALTER TABLE "hr_attendance_entries"
  ADD COLUMN IF NOT EXISTS "attendance_status" TEXT NOT NULL DEFAULT 'present',
  ADD COLUMN IF NOT EXISTS "suggested_minutes" INTEGER;

ALTER TABLE "hr_leave_requests"
  ADD COLUMN IF NOT EXISTS "day_count" INTEGER,
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejected_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

ALTER TABLE "hr_leave_requests" ALTER COLUMN "status" SET DEFAULT 'draft';

CREATE TABLE IF NOT EXISTS "hr_leave_balances" (
    "id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "leave_type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "total_days" DECIMAL(5,1) NOT NULL DEFAULT 14,
    "used_days" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "pending_days" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_leave_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hr_leave_balances_employee_profile_id_leave_type_year_key"
  ON "hr_leave_balances"("employee_profile_id", "leave_type", "year");
CREATE INDEX IF NOT EXISTS "hr_leave_balances_year_idx" ON "hr_leave_balances"("year");

ALTER TABLE "hr_leave_balances"
  ADD CONSTRAINT "hr_leave_balances_employee_profile_id_fkey"
  FOREIGN KEY ("employee_profile_id") REFERENCES "hr_employee_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_leave_requests"
  ADD CONSTRAINT "hr_leave_requests_approved_by_user_id_fkey"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hr_leave_requests"
  ADD CONSTRAINT "hr_leave_requests_rejected_by_user_id_fkey"
  FOREIGN KEY ("rejected_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Geliştirme / demo için personel modülünü etkinleştir
UPDATE "platform_modules" SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP WHERE "code" = 'personnel';

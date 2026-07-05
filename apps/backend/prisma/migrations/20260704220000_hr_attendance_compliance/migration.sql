-- Puantaj: günlük personel onayı + aylık dönem kilidi
ALTER TABLE "hr_attendance_entries"
  ADD COLUMN IF NOT EXISTS "employee_confirmed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "employee_confirmed_by_user_id" TEXT;

ALTER TABLE "hr_attendance_entries"
  ADD CONSTRAINT "hr_attendance_entries_employee_confirmed_by_user_id_fkey"
  FOREIGN KEY ("employee_confirmed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "hr_attendance_period_locks" (
  "id" TEXT NOT NULL,
  "employee_profile_id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "employee_confirmed_at" TIMESTAMP(3),
  "manager_confirmed_at" TIMESTAMP(3),
  "locked_at" TIMESTAMP(3),
  "locked_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hr_attendance_period_locks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hr_attendance_period_locks_employee_profile_id_year_month_key"
  ON "hr_attendance_period_locks"("employee_profile_id", "year", "month");

CREATE INDEX IF NOT EXISTS "hr_attendance_period_locks_year_month_idx"
  ON "hr_attendance_period_locks"("year", "month");

ALTER TABLE "hr_attendance_period_locks"
  ADD CONSTRAINT "hr_attendance_period_locks_employee_profile_id_fkey"
  FOREIGN KEY ("employee_profile_id") REFERENCES "hr_employee_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_attendance_period_locks"
  ADD CONSTRAINT "hr_attendance_period_locks_locked_by_user_id_fkey"
  FOREIGN KEY ("locked_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

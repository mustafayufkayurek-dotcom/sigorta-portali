-- F5a: Mesai giriş/çıkış saatleri (panel referans + manuel)
ALTER TABLE "hr_attendance_entries"
  ADD COLUMN IF NOT EXISTS "clock_in_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "clock_out_at" TIMESTAMPTZ;

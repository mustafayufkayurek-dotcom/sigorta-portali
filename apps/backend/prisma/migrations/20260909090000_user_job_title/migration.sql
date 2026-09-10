-- Firma içinde yazılan görev (kod listesi değil)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" TEXT;

-- Müşteri Kısa Ad (liste gösterimi; mevcut kayıtlar boş kalabilir)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "short_name" TEXT;

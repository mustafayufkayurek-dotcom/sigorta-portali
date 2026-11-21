-- Müşteri kartı Operasyon hizmet kapsamı (Hepsi + tekil hizmetler)
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "service_scopes" JSONB DEFAULT '[]';

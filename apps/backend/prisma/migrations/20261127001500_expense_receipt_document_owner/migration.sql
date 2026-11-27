-- Masraf belge sahibi (fiş / faturadaki ünvan)
ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "receipt_document_owner" TEXT;

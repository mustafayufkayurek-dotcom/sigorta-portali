-- Masraf belge türü ve belge no ayrı sütun
ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "receipt_document_type" TEXT,
  ADD COLUMN IF NOT EXISTS "receipt_document_no" TEXT;

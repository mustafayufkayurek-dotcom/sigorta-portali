-- Harici masraf yolu + belgeli/belgesiz bayrağı
ALTER TYPE "ExpenseOperationSubject" ADD VALUE IF NOT EXISTS 'HARICI_MASRAF';

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "has_tax_document" BOOLEAN NOT NULL DEFAULT true;

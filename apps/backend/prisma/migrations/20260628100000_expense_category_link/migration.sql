-- Masraf kayıtlarını ayarlardaki masraf kategorilerine bağla + Onarım Giderleri enum değeri
ALTER TYPE "ExpenseGroup" ADD VALUE IF NOT EXISTS 'ONARIM_GIDERLERI';

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "expense_category_id" TEXT;

CREATE INDEX IF NOT EXISTS "expenses_expense_category_id_idx" ON "expenses"("expense_category_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_expense_category_id_fkey'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_expense_category_id_fkey"
      FOREIGN KEY ("expense_category_id")
      REFERENCES "expense_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

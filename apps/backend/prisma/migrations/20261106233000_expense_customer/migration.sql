-- Danışmanlık ve asistans masrafı müşteriye yazılır. Hasar dosyada kalır.
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "customer_id" TEXT;

CREATE INDEX IF NOT EXISTS "expenses_customer_id_idx" ON "expenses"("customer_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_customer_id_fkey'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

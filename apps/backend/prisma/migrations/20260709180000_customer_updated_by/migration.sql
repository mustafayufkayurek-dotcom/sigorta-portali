-- Müşteri son güncelleyen kullanıcı
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "updated_by_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "customers_updated_by_user_id_idx" ON "customers"("updated_by_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_updated_by_user_id_fkey'
  ) THEN
    ALTER TABLE "customers"
      ADD CONSTRAINT "customers_updated_by_user_id_fkey"
      FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Dış portal kullanıcısı müşteri kartına bağlanır
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "portal_customer_id" TEXT;
CREATE INDEX IF NOT EXISTS "users_portal_customer_id_idx" ON "users"("portal_customer_id");

DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_portal_customer_id_fkey"
    FOREIGN KEY ("portal_customer_id") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

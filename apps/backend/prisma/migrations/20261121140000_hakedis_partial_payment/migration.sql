-- Hakediş kısmi ödeme: aynı kaleme birden fazla Payment bağlanabilir.
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_vendor_statement_item_id_key";
CREATE INDEX IF NOT EXISTS "payments_vendor_statement_item_id_idx" ON "payments"("vendor_statement_item_id");

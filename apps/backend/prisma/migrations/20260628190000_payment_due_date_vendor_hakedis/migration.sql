-- Tahsilat/ödeme kuyruğu: vade tarihi + tedarikçi hakediş bağlantısı

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "vendor_statement_item_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_vendor_statement_item_id_key" ON "payments"("vendor_statement_item_id");
CREATE INDEX IF NOT EXISTS "payments_due_date_idx" ON "payments"("due_date");
CREATE INDEX IF NOT EXISTS "payments_payment_type_status_idx" ON "payments"("payment_type", "status");

ALTER TABLE "payments" ADD CONSTRAINT "payments_vendor_statement_item_id_fkey"
  FOREIGN KEY ("vendor_statement_item_id") REFERENCES "vendor_statement_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

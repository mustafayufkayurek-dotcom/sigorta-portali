-- Ödeme dekontu (hasar dosyası → tedarikçi ödemesi)
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receipt_storage_key" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receipt_file_name" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receipt_mime_type" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receipt_file_size" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receipt_uploaded_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "payments_payer_id_payer_type_payment_type_idx"
  ON "payments"("payer_id", "payer_type", "payment_type");

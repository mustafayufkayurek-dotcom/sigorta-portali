-- Tedarikçi banka bilgisi teyidini mevcut kayıtları bozmadan genişletir.
ALTER TABLE "vendors"
  ADD COLUMN "account_holder_name" TEXT,
  ADD COLUMN "iban_account_holder_match_status" TEXT,
  ADD COLUMN "iban_whatsapp_confirm_status" TEXT,
  ADD COLUMN "iban_whatsapp_confirm_phone" TEXT,
  ADD COLUMN "iban_whatsapp_confirm_sent_at" TIMESTAMP(3),
  ADD COLUMN "iban_whatsapp_confirm_at" TIMESTAMP(3),
  ADD COLUMN "iban_whatsapp_confirm_by_user_id" TEXT;

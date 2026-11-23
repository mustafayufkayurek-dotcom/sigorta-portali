-- Şirket carisi — banka / kasa kart alanları (Logo banka-kasa modeli)
ALTER TABLE "party_accounts" ADD COLUMN IF NOT EXISTS "bank_name" TEXT;
ALTER TABLE "party_accounts" ADD COLUMN IF NOT EXISTS "branch_name" TEXT;
ALTER TABLE "party_accounts" ADD COLUMN IF NOT EXISTS "iban" TEXT;

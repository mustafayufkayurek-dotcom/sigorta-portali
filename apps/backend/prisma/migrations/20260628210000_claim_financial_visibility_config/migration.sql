-- Dosya bazlı finans görünürlük kuralları (rol + kişi)
ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "financial_visibility_config" JSONB;

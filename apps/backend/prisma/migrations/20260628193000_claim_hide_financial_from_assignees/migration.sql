-- Dosya sorumlusuna finansal özet gizleme (ciro/kârlılık kısıtı)
ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "hide_financial_from_assignees" BOOLEAN NOT NULL DEFAULT false;

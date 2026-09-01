-- Gelir kaydı faturalı (KDV işler) / faturasız (KDV yok).
ALTER TABLE "claim_file_revenues"
  ADD COLUMN "billed" BOOLEAN NOT NULL DEFAULT true;

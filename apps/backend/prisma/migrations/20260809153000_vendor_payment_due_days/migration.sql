-- Tedarikçi hakediş ödeme vadesi (15 veya 30 gün) — banka bilgileri alanı.
ALTER TABLE "vendors"
  ADD COLUMN "payment_due_days" INTEGER;

ALTER TABLE "vendors"
  ADD CONSTRAINT "vendors_payment_due_days_check"
  CHECK ("payment_due_days" IS NULL OR "payment_due_days" IN (15, 30));

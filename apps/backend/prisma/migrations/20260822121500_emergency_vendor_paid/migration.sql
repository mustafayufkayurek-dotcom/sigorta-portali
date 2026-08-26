-- Acil dosya tedarikçi ödemesi (ödendi / ödenmedi) — liste ve dosya ortak kayıt.

ALTER TABLE "emergency_cases" ADD COLUMN "vendor_paid" BOOLEAN;

-- Acil Yardım: Hasar onarım raporundaki gibi ayrı Tespit Bulguları alanı
ALTER TABLE "emergency_cases"
ADD COLUMN "findings_text" TEXT;

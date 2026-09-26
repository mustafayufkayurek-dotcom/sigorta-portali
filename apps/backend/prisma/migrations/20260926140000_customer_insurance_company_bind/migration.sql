-- Ayarlar sigorta tanımı ile Müşteriler portal kartı: tek kayıt bağı.
ALTER TABLE "customers" ADD COLUMN "insurance_company_id" TEXT;

CREATE UNIQUE INDEX "customers_insurance_company_id_key" ON "customers"("insurance_company_id");

ALTER TABLE "customers" ADD CONSTRAINT "customers_insurance_company_id_fkey"
  FOREIGN KEY ("insurance_company_id") REFERENCES "insurance_companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Vergi no birebir aynıysa bir kerelik bağla; isim tahmini yok.
UPDATE "customers" AS c
SET "insurance_company_id" = ic.id
FROM "insurance_companies" AS ic
WHERE c.sub_type = 'sigorta_sirketi'
  AND c.insurance_company_id IS NULL
  AND c.tax_number IS NOT NULL
  AND btrim(c.tax_number) <> ''
  AND ic.tax_number IS NOT NULL
  AND btrim(c.tax_number) = btrim(ic.tax_number)
  AND NOT EXISTS (
    SELECT 1
    FROM "customers" AS other
    WHERE other.insurance_company_id = ic.id
  );

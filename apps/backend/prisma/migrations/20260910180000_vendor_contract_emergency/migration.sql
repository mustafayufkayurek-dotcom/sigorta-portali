-- Acil Yardım dosyasına tedarikçi hizmet alım sözleşmesi
ALTER TABLE "vendor_contracts" ALTER COLUMN "claim_file_id" DROP NOT NULL;
ALTER TABLE "vendor_contracts" ADD COLUMN IF NOT EXISTS "emergency_case_id" TEXT;

CREATE INDEX IF NOT EXISTS "vendor_contracts_emergency_case_id_idx" ON "vendor_contracts"("emergency_case_id");

DO $$ BEGIN
  ALTER TABLE "vendor_contracts"
    ADD CONSTRAINT "vendor_contracts_emergency_case_id_fkey"
    FOREIGN KEY ("emergency_case_id") REFERENCES "emergency_cases"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

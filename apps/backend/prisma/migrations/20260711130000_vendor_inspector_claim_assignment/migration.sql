-- Tedarikçi tespitçi bayrağı + dosya bazlı tespitçi vendor ataması
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "can_act_as_inspector" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "assigned_inspector_vendor_id" TEXT;
ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "inspector_assigned_at" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "claim_files"
    ADD CONSTRAINT "claim_files_assigned_inspector_vendor_id_fkey"
    FOREIGN KEY ("assigned_inspector_vendor_id") REFERENCES "vendors"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "claim_files_assigned_inspector_vendor_id_idx"
  ON "claim_files"("assigned_inspector_vendor_id");

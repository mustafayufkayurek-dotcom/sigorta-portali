-- Mali mesuliyet muvafakat kaydı ve 7 günlük dış token
CREATE TABLE IF NOT EXISTS "mali_mesuliyet_muvafakat" (
  "id" TEXT NOT NULL,
  "claim_file_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "public_token" TEXT,
  "public_token_expires_at" TIMESTAMP(3),
  "digitally_approved_at" TIMESTAMP(3),
  "approved_full_name" TEXT,
  "approved_ip" TEXT,
  "rejected_at" TIMESTAMP(3),
  "reject_reason" TEXT,
  "whatsapp_sent_at" TIMESTAMP(3),
  "whatsapp_phone" TEXT,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mali_mesuliyet_muvafakat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mali_mesuliyet_muvafakat_claim_file_id_key" ON "mali_mesuliyet_muvafakat"("claim_file_id");
CREATE UNIQUE INDEX IF NOT EXISTS "mali_mesuliyet_muvafakat_public_token_key" ON "mali_mesuliyet_muvafakat"("public_token");
CREATE INDEX IF NOT EXISTS "mali_mesuliyet_muvafakat_public_token_idx" ON "mali_mesuliyet_muvafakat"("public_token");

DO $$ BEGIN
  ALTER TABLE "mali_mesuliyet_muvafakat"
    ADD CONSTRAINT "mali_mesuliyet_muvafakat_claim_file_id_fkey"
    FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

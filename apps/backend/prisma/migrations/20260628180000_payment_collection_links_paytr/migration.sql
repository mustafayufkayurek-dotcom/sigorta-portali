-- Online kart tahsilat (PayTR) — PaymentCollectionLink + ilgili alanlar

ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "requires_online_card_collection" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "claim_files" ADD COLUMN IF NOT EXISTS "online_card_collection_status" TEXT;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "collection_channel" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "collection_link_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider_ref" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_collection_link_id_key" ON "payments"("collection_link_id");

CREATE TABLE IF NOT EXISTS "payment_collection_links" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "revenue_id" TEXT,
    "merchant_oid" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "public_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payer_name" TEXT,
    "payer_phone" TEXT,
    "payer_email" TEXT,
    "description" TEXT,
    "sent_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "payment_id" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'paytr',
    "provider_ref" TEXT,
    "provider_payload" JSONB,
    "fail_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_collection_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_collection_links_merchant_oid_key" ON "payment_collection_links"("merchant_oid");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_collection_links_public_token_key" ON "payment_collection_links"("public_token");
CREATE INDEX IF NOT EXISTS "payment_collection_links_claim_file_id_idx" ON "payment_collection_links"("claim_file_id");
CREATE INDEX IF NOT EXISTS "payment_collection_links_status_idx" ON "payment_collection_links"("status");
CREATE INDEX IF NOT EXISTS "payment_collection_links_token_expires_at_idx" ON "payment_collection_links"("token_expires_at");

ALTER TABLE "payment_collection_links" ADD CONSTRAINT "payment_collection_links_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_collection_links" ADD CONSTRAINT "payment_collection_links_revenue_id_fkey" FOREIGN KEY ("revenue_id") REFERENCES "claim_file_revenues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_collection_links" ADD CONSTRAINT "payment_collection_links_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_collection_link_id_fkey" FOREIGN KEY ("collection_link_id") REFERENCES "payment_collection_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

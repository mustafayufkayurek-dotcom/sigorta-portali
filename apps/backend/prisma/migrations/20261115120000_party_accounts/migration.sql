-- Şirket cari hesabı (açılış + hareket = bakiye)
CREATE TABLE IF NOT EXISTS "party_accounts" (
  "id" TEXT NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "card_last4" TEXT,
  "card_label" TEXT,
  "linked_customer_id" TEXT,
  "linked_vendor_id" TEXT,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "party_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "party_accounts_code_key" ON "party_accounts"("code");
CREATE INDEX IF NOT EXISTS "party_accounts_kind_idx" ON "party_accounts"("kind");
CREATE INDEX IF NOT EXISTS "party_accounts_is_active_idx" ON "party_accounts"("is_active");
CREATE INDEX IF NOT EXISTS "party_accounts_linked_customer_id_idx" ON "party_accounts"("linked_customer_id");
CREATE INDEX IF NOT EXISTS "party_accounts_linked_vendor_id_idx" ON "party_accounts"("linked_vendor_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'party_accounts_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE "party_accounts"
      ADD CONSTRAINT "party_accounts_created_by_user_id_fkey"
      FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'party_accounts_linked_customer_id_fkey'
  ) THEN
    ALTER TABLE "party_accounts"
      ADD CONSTRAINT "party_accounts_linked_customer_id_fkey"
      FOREIGN KEY ("linked_customer_id") REFERENCES "customers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'party_accounts_linked_vendor_id_fkey'
  ) THEN
    ALTER TABLE "party_accounts"
      ADD CONSTRAINT "party_accounts_linked_vendor_id_fkey"
      FOREIGN KEY ("linked_vendor_id") REFERENCES "vendors"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "party_account_entries" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "entry_date" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "debit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "credit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "source_kind" TEXT NOT NULL,
  "source_id" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "party_account_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "party_account_entries_account_id_entry_date_idx"
  ON "party_account_entries"("account_id", "entry_date");
CREATE INDEX IF NOT EXISTS "party_account_entries_source_kind_source_id_idx"
  ON "party_account_entries"("source_kind", "source_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'party_account_entries_account_id_fkey'
  ) THEN
    ALTER TABLE "party_account_entries"
      ADD CONSTRAINT "party_account_entries_account_id_fkey"
      FOREIGN KEY ("account_id") REFERENCES "party_accounts"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'party_account_entries_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE "party_account_entries"
      ADD CONSTRAINT "party_account_entries_created_by_user_id_fkey"
      FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "party_account_id" TEXT;
CREATE INDEX IF NOT EXISTS "expenses_party_account_id_idx" ON "expenses"("party_account_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_party_account_id_fkey'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_party_account_id_fkey"
      FOREIGN KEY ("party_account_id") REFERENCES "party_accounts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

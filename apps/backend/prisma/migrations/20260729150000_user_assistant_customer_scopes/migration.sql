-- Asistans firma portal kapsamı (Customer.subType = asistan_firmasi)
CREATE TABLE IF NOT EXISTS "user_assistant_customer_scopes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_assistant_customer_scopes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_assistant_customer_scopes_user_id_customer_id_key"
  ON "user_assistant_customer_scopes"("user_id", "customer_id");

CREATE INDEX IF NOT EXISTS "user_assistant_customer_scopes_customer_id_idx"
  ON "user_assistant_customer_scopes"("customer_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_assistant_customer_scopes_user_id_fkey'
  ) THEN
    ALTER TABLE "user_assistant_customer_scopes"
      ADD CONSTRAINT "user_assistant_customer_scopes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_assistant_customer_scopes_customer_id_fkey'
  ) THEN
    ALTER TABLE "user_assistant_customer_scopes"
      ADD CONSTRAINT "user_assistant_customer_scopes_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

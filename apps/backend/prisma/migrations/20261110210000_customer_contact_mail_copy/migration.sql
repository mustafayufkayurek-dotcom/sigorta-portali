ALTER TABLE "customer_contacts" ADD COLUMN IF NOT EXISTS "mail_copy_approval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customer_contacts" ADD COLUMN IF NOT EXISTS "mail_copy_info" BOOLEAN NOT NULL DEFAULT false;

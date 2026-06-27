-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "archived_email" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

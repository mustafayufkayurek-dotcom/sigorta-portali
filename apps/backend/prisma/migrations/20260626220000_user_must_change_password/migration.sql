-- AlterTable
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "temporary_password_issued_at" TIMESTAMP(3);

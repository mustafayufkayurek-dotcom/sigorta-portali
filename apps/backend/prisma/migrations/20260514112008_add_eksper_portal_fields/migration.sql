/*
  Warnings:

  - You are about to drop the column `after_json` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `before_json` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `performed_at` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `performed_by_user_id` on the `audit_logs` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_performed_by_user_id_fkey";

-- DropIndex
DROP INDEX "audit_logs_performed_at_idx";

-- DropIndex
DROP INDEX "claim_files_current_responsible_user_id_idx";

-- DropIndex
DROP INDEX "claim_files_last_activity_at_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "after_json",
DROP COLUMN "before_json",
DROP COLUMN "performed_at",
DROP COLUMN "performed_by_user_id",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "new_value" JSONB,
ADD COLUMN     "old_value" JSONB,
ADD COLUMN     "user_agent" TEXT,
ADD COLUMN     "user_email" TEXT,
ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "claim_files" ADD COLUMN     "commercial_title" TEXT,
ADD COLUMN     "insured_name" TEXT,
ADD COLUMN     "insured_phone" TEXT,
ADD COLUMN     "policy_type" TEXT,
ADD COLUMN     "tax_number" TEXT,
ADD COLUMN     "tax_office" TEXT;

-- AlterTable
ALTER TABLE "upload_logs" ADD COLUMN     "endpoint" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- AddForeignKey
ALTER TABLE "claim_files" ADD CONSTRAINT "claim_files_current_responsible_user_id_fkey" FOREIGN KEY ("current_responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

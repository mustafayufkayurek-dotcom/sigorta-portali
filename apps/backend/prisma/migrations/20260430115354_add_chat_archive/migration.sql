/*
  Warnings:

  - You are about to drop the column `capacity` on the `vendors` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[adjuster_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "entity_documents" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "adjuster_id" TEXT;

-- AlterTable
ALTER TABLE "vendors" DROP COLUMN "capacity";

-- CreateTable
CREATE TABLE "chat_archives" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "parsed_messages" JSONB NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_id" TEXT NOT NULL,

    CONSTRAINT "chat_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "claim_type" TEXT,
    "product_branch" TEXT,
    "target_days" INTEGER NOT NULL,
    "warning_days" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_archives_claim_file_id_idx" ON "chat_archives"("claim_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_adjuster_id_key" ON "users"("adjuster_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_adjuster_id_fkey" FOREIGN KEY ("adjuster_id") REFERENCES "adjusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_archives" ADD CONSTRAINT "chat_archives_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_archives" ADD CONSTRAINT "chat_archives_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

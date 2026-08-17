-- CreateEnum
CREATE TYPE "file_activity_action" AS ENUM ('SUPPLIER_ASSIGNED', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT_UPDATED', 'INSPECTION_DONE', 'COST_REPORT_SUBMITTED', 'ATTACHMENT_ADDED', 'STATUS_CHANGED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "attachment_visibility" AS ENUM ('PUBLIC', 'INTERNAL_ONLY');

-- AlterTable
ALTER TABLE "claim_documents" ADD COLUMN     "visibility" "attachment_visibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "claim_files" ADD COLUMN     "assigned_supplier_id" TEXT,
ADD COLUMN     "supplier_assigned_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "file_activity_logs" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "action" "file_activity_action" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_appointments" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_activity_logs_claim_file_id_idx" ON "file_activity_logs"("claim_file_id");

-- CreateIndex
CREATE INDEX "file_activity_logs_actor_id_idx" ON "file_activity_logs"("actor_id");

-- CreateIndex
CREATE INDEX "file_activity_logs_action_idx" ON "file_activity_logs"("action");

-- CreateIndex
CREATE INDEX "file_activity_logs_created_at_idx" ON "file_activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "file_appointments_claim_file_id_idx" ON "file_appointments"("claim_file_id");

-- CreateIndex
CREATE INDEX "file_appointments_scheduled_date_idx" ON "file_appointments"("scheduled_date");

-- AddForeignKey
ALTER TABLE "claim_files" ADD CONSTRAINT "claim_files_assigned_supplier_id_fkey" FOREIGN KEY ("assigned_supplier_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_activity_logs" ADD CONSTRAINT "file_activity_logs_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_activity_logs" ADD CONSTRAINT "file_activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_appointments" ADD CONSTRAINT "file_appointments_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_appointments" ADD CONSTRAINT "file_appointments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

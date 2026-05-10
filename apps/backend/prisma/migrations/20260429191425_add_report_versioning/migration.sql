-- AlterTable
ALTER TABLE "repair_reports" ADD COLUMN     "original_report_id" TEXT,
ADD COLUMN     "revised_at" TIMESTAMP(3),
ADD COLUMN     "revised_by_user_id" TEXT,
ADD COLUMN     "version_no" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "repair_reports_original_report_id_idx" ON "repair_reports"("original_report_id");

-- AddForeignKey
ALTER TABLE "repair_reports" ADD CONSTRAINT "repair_reports_revised_by_user_id_fkey" FOREIGN KEY ("revised_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_reports" ADD CONSTRAINT "repair_reports_original_report_id_fkey" FOREIGN KEY ("original_report_id") REFERENCES "repair_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ExpenseGroup" AS ENUM ('YONETIM_GIDERLERI', 'OPERASYON_GIDERLERI', 'MHY_OZEL_GIDERLER');

-- CreateEnum
CREATE TYPE "ExpensePlan" AS ENUM ('BUTCELENEN', 'EKSTRA_SATIS_MASRAFI');

-- CreateEnum
CREATE TYPE "ExpenseApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExpenseOperationSubject" AS ENUM ('HASAR_ONARIM', 'ACIL_YARDIM', 'OZEL_OPERASYON', 'DANISMANLIK', 'TEKNE_YAT');

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vat_rate" INTEGER NOT NULL DEFAULT 20,
    "vat_included" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "expense_group" "ExpenseGroup" NOT NULL,
    "expense_subgroup" TEXT NOT NULL,
    "expense_plan" "ExpensePlan",
    "approval_status" "ExpenseApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "operation_subject" "ExpenseOperationSubject",
    "file_case_id" TEXT,
    "receipt_image_url" TEXT,
    "created_by_id" TEXT NOT NULL,
    "week_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_expense_group_idx" ON "expenses"("expense_group");

-- CreateIndex
CREATE INDEX "expenses_approval_status_idx" ON "expenses"("approval_status");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_created_by_id_idx" ON "expenses"("created_by_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_file_case_id_fkey" FOREIGN KEY ("file_case_id") REFERENCES "claim_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

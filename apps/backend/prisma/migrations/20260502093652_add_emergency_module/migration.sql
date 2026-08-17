-- CreateEnum
CREATE TYPE "emergency_status" AS ENUM ('GELEN', 'ATANDI', 'SAHADA', 'COZULDU', 'FATURALANDILDI');

-- CreateEnum
CREATE TYPE "emergency_urgency" AS ENUM ('DUSUK', 'NORMAL', 'YUKSEK', 'KRITIK');

-- CreateTable
CREATE TABLE "emergency_cases" (
    "id" TEXT NOT NULL,
    "case_no" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "issue_type" TEXT NOT NULL,
    "urgency" "emergency_urgency" NOT NULL DEFAULT 'NORMAL',
    "status" "emergency_status" NOT NULL DEFAULT 'GELEN',
    "assigned_vendor_id" TEXT,
    "assigned_user_id" TEXT,
    "notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "invoiced_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_cost_entries" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "receipt_key" TEXT,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_invoice_drafts" (
    "id" TEXT NOT NULL,
    "draft_no" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "logo_ref" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_invoice_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_invoice_items" (
    "id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emergency_cases_case_no_key" ON "emergency_cases"("case_no");

-- CreateIndex
CREATE INDEX "emergency_cases_status_idx" ON "emergency_cases"("status");

-- CreateIndex
CREATE INDEX "emergency_cases_urgency_idx" ON "emergency_cases"("urgency");

-- CreateIndex
CREATE INDEX "emergency_cases_created_at_idx" ON "emergency_cases"("created_at");

-- CreateIndex
CREATE INDEX "emergency_cost_entries_case_id_idx" ON "emergency_cost_entries"("case_id");

-- CreateIndex
CREATE INDEX "emergency_cost_entries_entry_type_idx" ON "emergency_cost_entries"("entry_type");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_invoice_drafts_draft_no_key" ON "emergency_invoice_drafts"("draft_no");

-- CreateIndex
CREATE INDEX "emergency_invoice_drafts_status_idx" ON "emergency_invoice_drafts"("status");

-- CreateIndex
CREATE INDEX "emergency_invoice_items_draft_id_idx" ON "emergency_invoice_items"("draft_id");

-- CreateIndex
CREATE INDEX "emergency_invoice_items_case_id_idx" ON "emergency_invoice_items"("case_id");

-- AddForeignKey
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_assigned_vendor_id_fkey" FOREIGN KEY ("assigned_vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_cost_entries" ADD CONSTRAINT "emergency_cost_entries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "emergency_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_cost_entries" ADD CONSTRAINT "emergency_cost_entries_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_invoice_drafts" ADD CONSTRAINT "emergency_invoice_drafts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_invoice_items" ADD CONSTRAINT "emergency_invoice_items_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "emergency_invoice_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_invoice_items" ADD CONSTRAINT "emergency_invoice_items_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "emergency_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

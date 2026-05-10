-- AlterTable
ALTER TABLE "claim_financial_summaries" ADD COLUMN     "collected_from_insured" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "collected_from_insurer" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "communication_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "extra_work_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "field_expense_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "file_fee_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "material_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "net_margin_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "net_profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "other_variable_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "outstanding_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "overhead_share" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_collected" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_variable_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "vendor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "cost_entries" ADD COLUMN     "extra_work_item_id" TEXT,
ADD COLUMN     "is_overhead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "source_ref_id" TEXT;

-- AlterTable
ALTER TABLE "integration_configs" ADD COLUMN     "category_mapping" JSONB;

-- CreateTable
CREATE TABLE "extra_work_items" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "agreed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extra_work_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_file_revenues" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "revenue_type" TEXT NOT NULL,
    "collection_source" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "vat_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vat_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "invoice_id" TEXT,
    "repair_report_id" TEXT,
    "extra_work_item_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "collected_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collected_at" TIMESTAMP(3),
    "related_payment_id" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "entry_date" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_file_revenues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_overhead_entries" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "expense_category_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "logo_entry_ref" TEXT,
    "is_allocated" BOOLEAN NOT NULL DEFAULT false,
    "allocated_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_overhead_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overhead_allocations" (
    "id" TEXT NOT NULL,
    "overhead_entry_id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "allocation_method" TEXT NOT NULL,
    "allocation_weight" DOUBLE PRECISION NOT NULL,
    "allocated_amount" DOUBLE PRECISION NOT NULL,
    "cost_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overhead_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extra_work_items_claim_file_id_idx" ON "extra_work_items"("claim_file_id");

-- CreateIndex
CREATE INDEX "extra_work_items_status_idx" ON "extra_work_items"("status");

-- CreateIndex
CREATE INDEX "claim_file_revenues_claim_file_id_idx" ON "claim_file_revenues"("claim_file_id");

-- CreateIndex
CREATE INDEX "claim_file_revenues_revenue_type_idx" ON "claim_file_revenues"("revenue_type");

-- CreateIndex
CREATE INDEX "claim_file_revenues_collection_source_idx" ON "claim_file_revenues"("collection_source");

-- CreateIndex
CREATE INDEX "claim_file_revenues_status_idx" ON "claim_file_revenues"("status");

-- CreateIndex
CREATE INDEX "monthly_overhead_entries_year_month_idx" ON "monthly_overhead_entries"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_overhead_entries_year_month_expense_category_id_key" ON "monthly_overhead_entries"("year", "month", "expense_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "overhead_allocations_cost_entry_id_key" ON "overhead_allocations"("cost_entry_id");

-- CreateIndex
CREATE INDEX "overhead_allocations_overhead_entry_id_idx" ON "overhead_allocations"("overhead_entry_id");

-- CreateIndex
CREATE INDEX "overhead_allocations_claim_file_id_idx" ON "overhead_allocations"("claim_file_id");

-- CreateIndex
CREATE INDEX "cost_entries_is_overhead_idx" ON "cost_entries"("is_overhead");

-- CreateIndex
CREATE INDEX "cost_entries_extra_work_item_id_idx" ON "cost_entries"("extra_work_item_id");

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_extra_work_item_id_fkey" FOREIGN KEY ("extra_work_item_id") REFERENCES "extra_work_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_work_items" ADD CONSTRAINT "extra_work_items_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extra_work_items" ADD CONSTRAINT "extra_work_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_file_revenues" ADD CONSTRAINT "claim_file_revenues_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_file_revenues" ADD CONSTRAINT "claim_file_revenues_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_file_revenues" ADD CONSTRAINT "claim_file_revenues_repair_report_id_fkey" FOREIGN KEY ("repair_report_id") REFERENCES "repair_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_file_revenues" ADD CONSTRAINT "claim_file_revenues_extra_work_item_id_fkey" FOREIGN KEY ("extra_work_item_id") REFERENCES "extra_work_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_file_revenues" ADD CONSTRAINT "claim_file_revenues_related_payment_id_fkey" FOREIGN KEY ("related_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_file_revenues" ADD CONSTRAINT "claim_file_revenues_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_overhead_entries" ADD CONSTRAINT "monthly_overhead_entries_expense_category_id_fkey" FOREIGN KEY ("expense_category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_overhead_entries" ADD CONSTRAINT "monthly_overhead_entries_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_allocations" ADD CONSTRAINT "overhead_allocations_overhead_entry_id_fkey" FOREIGN KEY ("overhead_entry_id") REFERENCES "monthly_overhead_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_allocations" ADD CONSTRAINT "overhead_allocations_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_allocations" ADD CONSTRAINT "overhead_allocations_cost_entry_id_fkey" FOREIGN KEY ("cost_entry_id") REFERENCES "cost_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

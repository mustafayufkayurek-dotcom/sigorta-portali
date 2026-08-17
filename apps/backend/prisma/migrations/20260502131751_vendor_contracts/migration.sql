-- AlterTable
ALTER TABLE "emergency_cases" ADD COLUMN     "district" TEXT,
ADD COLUMN     "file_no" TEXT;

-- CreateTable
CREATE TABLE "vendor_contract_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Tedarikçi Onarım Sözleşmesi',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_contract_clauses" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_contract_clauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_contracts" (
    "id" TEXT NOT NULL,
    "contract_no" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "repair_report_id" TEXT,
    "template_id" TEXT NOT NULL,
    "contract_date" TIMESTAMP(3) NOT NULL,
    "start_date" TIMESTAMP(3),
    "delivery_date" TIMESTAMP(3),
    "vendor_name" TEXT NOT NULL,
    "vendor_tax_or_id_no" TEXT,
    "vendor_address" TEXT,
    "vendor_phone" TEXT,
    "insured_name" TEXT,
    "file_no" TEXT NOT NULL,
    "insurance_company_name" TEXT,
    "damage_address" TEXT,
    "work_items" JSONB NOT NULL DEFAULT '[]',
    "rendered_content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "signed_at" TIMESTAMP(3),
    "vendor_signature_data" TEXT,
    "whatsapp_sent_at" TIMESTAMP(3),
    "whatsapp_phone" TEXT,
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" TIMESTAMP(3),
    "sign_deadline_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "pdf_storage_key" TEXT,
    "public_token" TEXT,
    "public_token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_contract_clauses_template_id_sort_order_idx" ON "vendor_contract_clauses"("template_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_contracts_contract_no_key" ON "vendor_contracts"("contract_no");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_contracts_public_token_key" ON "vendor_contracts"("public_token");

-- CreateIndex
CREATE INDEX "vendor_contracts_claim_file_id_idx" ON "vendor_contracts"("claim_file_id");

-- CreateIndex
CREATE INDEX "vendor_contracts_vendor_id_idx" ON "vendor_contracts"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_contracts_status_idx" ON "vendor_contracts"("status");

-- CreateIndex
CREATE INDEX "vendor_contracts_public_token_idx" ON "vendor_contracts"("public_token");

-- AddForeignKey
ALTER TABLE "vendor_contract_clauses" ADD CONSTRAINT "vendor_contract_clauses_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "vendor_contract_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contracts" ADD CONSTRAINT "vendor_contracts_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contracts" ADD CONSTRAINT "vendor_contracts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contracts" ADD CONSTRAINT "vendor_contracts_repair_report_id_fkey" FOREIGN KEY ("repair_report_id") REFERENCES "repair_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contracts" ADD CONSTRAINT "vendor_contracts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "vendor_contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contracts" ADD CONSTRAINT "vendor_contracts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

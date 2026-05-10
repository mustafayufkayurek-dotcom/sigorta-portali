-- AlterTable
ALTER TABLE "emergency_cost_entries" ADD COLUMN     "vendor_id" TEXT;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'hasar';

-- CreateTable
CREATE TABLE "file_documents" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "document_kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rendered_content" TEXT NOT NULL,
    "public_token" TEXT,
    "public_token_expires_at" TIMESTAMP(3),
    "whatsapp_sent_at" TIMESTAMP(3),
    "whatsapp_phone" TEXT,
    "viewed_at" TIMESTAMP(3),
    "viewed_ip" TEXT,
    "digitally_approved_at" TIMESTAMP(3),
    "approved_ip" TEXT,
    "approved_full_name" TEXT,
    "signature_data" TEXT,
    "physical_upload_key" TEXT,
    "physically_uploaded_at" TIMESTAMP(3),
    "physical_uploaded_by_user_id" TEXT,
    "claim_file_id" TEXT,
    "emergency_case_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_requests" (
    "id" TEXT NOT NULL,
    "request_no" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "claim_file_id" TEXT,
    "emergency_case_id" TEXT,
    "insurance_company_id" TEXT,
    "insurance_company_name" TEXT,
    "file_no" TEXT NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "work_items_summary" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invoice_id" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "invoiced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_documents_public_token_key" ON "file_documents"("public_token");

-- CreateIndex
CREATE INDEX "file_documents_entity_type_entity_id_idx" ON "file_documents"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "file_documents_public_token_idx" ON "file_documents"("public_token");

-- CreateIndex
CREATE INDEX "file_documents_status_idx" ON "file_documents"("status");

-- CreateIndex
CREATE INDEX "file_documents_claim_file_id_idx" ON "file_documents"("claim_file_id");

-- CreateIndex
CREATE INDEX "file_documents_emergency_case_id_idx" ON "file_documents"("emergency_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_requests_request_no_key" ON "invoice_requests"("request_no");

-- CreateIndex
CREATE INDEX "invoice_requests_status_idx" ON "invoice_requests"("status");

-- CreateIndex
CREATE INDEX "invoice_requests_claim_file_id_idx" ON "invoice_requests"("claim_file_id");

-- CreateIndex
CREATE INDEX "invoice_requests_emergency_case_id_idx" ON "invoice_requests"("emergency_case_id");

-- CreateIndex
CREATE INDEX "invoice_requests_service_type_idx" ON "invoice_requests"("service_type");

-- CreateIndex
CREATE INDEX "emergency_cost_entries_vendor_id_idx" ON "emergency_cost_entries"("vendor_id");

-- CreateIndex
CREATE INDEX "vendors_category_idx" ON "vendors"("category");

-- AddForeignKey
ALTER TABLE "emergency_cost_entries" ADD CONSTRAINT "emergency_cost_entries_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_documents" ADD CONSTRAINT "file_documents_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_documents" ADD CONSTRAINT "file_documents_emergency_case_id_fkey" FOREIGN KEY ("emergency_case_id") REFERENCES "emergency_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_documents" ADD CONSTRAINT "file_documents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_documents" ADD CONSTRAINT "file_documents_physical_uploaded_by_user_id_fkey" FOREIGN KEY ("physical_uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_requests" ADD CONSTRAINT "invoice_requests_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_requests" ADD CONSTRAINT "invoice_requests_emergency_case_id_fkey" FOREIGN KEY ("emergency_case_id") REFERENCES "emergency_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_requests" ADD CONSTRAINT "invoice_requests_insurance_company_id_fkey" FOREIGN KEY ("insurance_company_id") REFERENCES "insurance_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_requests" ADD CONSTRAINT "invoice_requests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_requests" ADD CONSTRAINT "invoice_requests_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_requests" ADD CONSTRAINT "invoice_requests_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

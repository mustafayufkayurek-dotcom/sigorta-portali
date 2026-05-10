-- CreateTable
CREATE TABLE "adjusters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "license_no" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "region" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adjusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjuster_assignments" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "adjuster_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "appointment_date" TIMESTAMP(3),
    "visit_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adjuster_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjuster_reports" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "report_no" TEXT NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "recommendation" TEXT,
    "estimated_damage" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rejection_reason" TEXT,
    "file_asset_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adjuster_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "adjuster_id" TEXT,
    "type" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tax_number" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_versions" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "id" TEXT NOT NULL,
    "budget_version_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "vat_rate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_entries" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "vat_rate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "invoice_no" TEXT,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adjusters_license_no_key" ON "adjusters"("license_no");

-- CreateIndex
CREATE INDEX "adjusters_city_idx" ON "adjusters"("city");

-- CreateIndex
CREATE INDEX "adjusters_region_idx" ON "adjusters"("region");

-- CreateIndex
CREATE INDEX "adjusters_status_idx" ON "adjusters"("status");

-- CreateIndex
CREATE INDEX "adjuster_assignments_claim_file_id_idx" ON "adjuster_assignments"("claim_file_id");

-- CreateIndex
CREATE INDEX "adjuster_assignments_adjuster_id_idx" ON "adjuster_assignments"("adjuster_id");

-- CreateIndex
CREATE INDEX "adjuster_assignments_status_idx" ON "adjuster_assignments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "adjuster_reports_assignment_id_key" ON "adjuster_reports"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "adjuster_reports_report_no_key" ON "adjuster_reports"("report_no");

-- CreateIndex
CREATE INDEX "adjuster_reports_status_idx" ON "adjuster_reports"("status");

-- CreateIndex
CREATE INDEX "appointments_claim_file_id_idx" ON "appointments"("claim_file_id");

-- CreateIndex
CREATE INDEX "appointments_adjuster_id_idx" ON "appointments"("adjuster_id");

-- CreateIndex
CREATE INDEX "appointments_scheduled_at_idx" ON "appointments"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_tax_number_key" ON "vendors"("tax_number");

-- CreateIndex
CREATE INDEX "vendors_status_idx" ON "vendors"("status");

-- CreateIndex
CREATE INDEX "budget_versions_claim_file_id_idx" ON "budget_versions"("claim_file_id");

-- CreateIndex
CREATE INDEX "budget_versions_status_idx" ON "budget_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "budget_versions_claim_file_id_version_no_key" ON "budget_versions"("claim_file_id", "version_no");

-- CreateIndex
CREATE INDEX "budget_items_budget_version_id_idx" ON "budget_items"("budget_version_id");

-- CreateIndex
CREATE INDEX "cost_entries_claim_file_id_idx" ON "cost_entries"("claim_file_id");

-- AddForeignKey
ALTER TABLE "adjuster_assignments" ADD CONSTRAINT "adjuster_assignments_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuster_assignments" ADD CONSTRAINT "adjuster_assignments_adjuster_id_fkey" FOREIGN KEY ("adjuster_id") REFERENCES "adjusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuster_reports" ADD CONSTRAINT "adjuster_reports_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "adjuster_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuster_reports" ADD CONSTRAINT "adjuster_reports_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_adjuster_id_fkey" FOREIGN KEY ("adjuster_id") REFERENCES "adjusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_version_id_fkey" FOREIGN KEY ("budget_version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

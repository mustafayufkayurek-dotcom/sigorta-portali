-- AlterTable
ALTER TABLE "claim_files" ADD COLUMN     "department_file_subject_id" TEXT,
ADD COLUMN     "department_id" TEXT;

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "report_format" TEXT NOT NULL DEFAULT 'repair',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_file_subjects" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_file_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_field_configs" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "report_format" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "field_label" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_field_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_groups" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_margins" (
    "id" TEXT NOT NULL,
    "work_group_id" TEXT NOT NULL,
    "min_margin_pct" DOUBLE PRECISION NOT NULL,
    "warn_below_pct" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "target_margins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_reports" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "report_no" TEXT NOT NULL,
    "report_type" TEXT NOT NULL DEFAULT 'single',
    "report_date" TIMESTAMP(3) NOT NULL,
    "inspector_name" TEXT,
    "reporter_name" TEXT,
    "findings_text" TEXT,
    "legal_notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "building_damage_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "goods_damage_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_supplier_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_sales_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gross_profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gross_margin_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "department_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_damage_types" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "damage_type_code" TEXT NOT NULL,
    "damage_type_name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "report_damage_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_report_items" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "work_group_id" TEXT NOT NULL,
    "damage_type_id" TEXT,
    "location" TEXT,
    "job_description" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "supplier_unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sales_unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplier_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sales_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margin_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metraj_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_report_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_images" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "annotated_key" TEXT,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'damage',
    "caption" TEXT,
    "has_annotation" BOOLEAN NOT NULL DEFAULT false,
    "annotation_data" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_price_history" (
    "id" TEXT NOT NULL,
    "work_group_id" TEXT NOT NULL,
    "job_description" TEXT NOT NULL,
    "unit" TEXT,
    "supplier_unit_price" DOUBLE PRECISION NOT NULL,
    "sales_unit_price" DOUBLE PRECISION NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_status_idx" ON "departments"("status");

-- CreateIndex
CREATE INDEX "department_file_subjects_department_id_idx" ON "department_file_subjects"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_file_subjects_department_id_code_key" ON "department_file_subjects"("department_id", "code");

-- CreateIndex
CREATE INDEX "report_field_configs_department_id_idx" ON "report_field_configs"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_field_configs_department_id_report_format_field_key_key" ON "report_field_configs"("department_id", "report_format", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "work_groups_code_key" ON "work_groups"("code");

-- CreateIndex
CREATE INDEX "work_groups_status_idx" ON "work_groups"("status");

-- CreateIndex
CREATE UNIQUE INDEX "target_margins_work_group_id_key" ON "target_margins"("work_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "repair_reports_report_no_key" ON "repair_reports"("report_no");

-- CreateIndex
CREATE INDEX "repair_reports_claim_file_id_idx" ON "repair_reports"("claim_file_id");

-- CreateIndex
CREATE INDEX "repair_reports_status_idx" ON "repair_reports"("status");

-- CreateIndex
CREATE INDEX "report_damage_types_report_id_idx" ON "report_damage_types"("report_id");

-- CreateIndex
CREATE INDEX "repair_report_items_report_id_idx" ON "repair_report_items"("report_id");

-- CreateIndex
CREATE INDEX "repair_report_items_work_group_id_idx" ON "repair_report_items"("work_group_id");

-- CreateIndex
CREATE INDEX "report_images_report_id_idx" ON "report_images"("report_id");

-- CreateIndex
CREATE INDEX "supplier_price_history_work_group_id_job_description_idx" ON "supplier_price_history"("work_group_id", "job_description");

-- AddForeignKey
ALTER TABLE "claim_files" ADD CONSTRAINT "claim_files_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_files" ADD CONSTRAINT "claim_files_department_file_subject_id_fkey" FOREIGN KEY ("department_file_subject_id") REFERENCES "department_file_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_file_subjects" ADD CONSTRAINT "department_file_subjects_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_field_configs" ADD CONSTRAINT "report_field_configs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_margins" ADD CONSTRAINT "target_margins_work_group_id_fkey" FOREIGN KEY ("work_group_id") REFERENCES "work_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_reports" ADD CONSTRAINT "repair_reports_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_reports" ADD CONSTRAINT "repair_reports_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_reports" ADD CONSTRAINT "repair_reports_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_damage_types" ADD CONSTRAINT "report_damage_types_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "repair_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_report_items" ADD CONSTRAINT "repair_report_items_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "repair_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_report_items" ADD CONSTRAINT "repair_report_items_work_group_id_fkey" FOREIGN KEY ("work_group_id") REFERENCES "work_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_report_items" ADD CONSTRAINT "repair_report_items_damage_type_id_fkey" FOREIGN KEY ("damage_type_id") REFERENCES "report_damage_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_images" ADD CONSTRAINT "report_images_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "repair_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_price_history" ADD CONSTRAINT "supplier_price_history_work_group_id_fkey" FOREIGN KEY ("work_group_id") REFERENCES "work_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

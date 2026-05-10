-- CreateTable
CREATE TABLE "report_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_template_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "work_group_id" TEXT,
    "damage_category" TEXT NOT NULL DEFAULT 'bina',
    "location" TEXT,
    "job_description" TEXT NOT NULL,
    "description" TEXT,
    "default_quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "default_unit" TEXT NOT NULL DEFAULT 'adet',
    "pricing_type" TEXT NOT NULL DEFAULT 'unit',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_templates_service_type_idx" ON "report_templates"("service_type");

-- CreateIndex
CREATE INDEX "report_template_items_template_id_idx" ON "report_template_items"("template_id");

-- AddForeignKey
ALTER TABLE "report_template_items" ADD CONSTRAINT "report_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_template_items" ADD CONSTRAINT "report_template_items_work_group_id_fkey" FOREIGN KEY ("work_group_id") REFERENCES "work_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

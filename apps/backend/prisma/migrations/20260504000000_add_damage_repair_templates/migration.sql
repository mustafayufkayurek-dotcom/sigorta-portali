ALTER TABLE "repair_reports" ADD COLUMN "quick_damage_types" TEXT[] DEFAULT ARRAY[]::TEXT[], ADD COLUMN "quick_damage_size" TEXT;

CREATE TABLE "damage_type_repair_templates" (
    "id" TEXT NOT NULL,
    "damage_type" TEXT NOT NULL,
    "work_sub_group_id" TEXT NOT NULL,
    "default_quantity_small" DOUBLE PRECISION,
    "default_quantity_medium" DOUBLE PRECISION,
    "default_quantity_large" DOUBLE PRECISION,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "file_id" TEXT,
    "is_global" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "damage_type_repair_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "damage_type_repair_templates_damage_type_work_sub_group_id_file_id_key" ON "damage_type_repair_templates"("damage_type", "work_sub_group_id", "file_id");
CREATE INDEX "damage_type_repair_templates_damage_type_idx" ON "damage_type_repair_templates"("damage_type");
CREATE INDEX "damage_type_repair_templates_usage_count_idx" ON "damage_type_repair_templates"("usage_count" DESC);
CREATE INDEX "damage_type_repair_templates_file_id_idx" ON "damage_type_repair_templates"("file_id");

ALTER TABLE "damage_type_repair_templates" ADD CONSTRAINT "damage_type_repair_templates_work_sub_group_id_fkey" FOREIGN KEY ("work_sub_group_id") REFERENCES "work_sub_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
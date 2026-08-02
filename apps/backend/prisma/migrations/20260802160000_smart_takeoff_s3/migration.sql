-- Smart Quantity Takeoff S3 — persist omurgası (BUILD MODE; migrate deploy ayrı onay)

CREATE TYPE "TakeoffRunStatus" AS ENUM ('draft', 'active', 'superseded', 'archived');
CREATE TYPE "TakeoffLineItemStatus" AS ENUM ('active', 'void');

CREATE TABLE "takeoff_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "structure_element_type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "decision_spec_json" JSONB NOT NULL,
    "calculation_bind_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "takeoff_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "takeoff_rule_versions" (
    "id" TEXT NOT NULL,
    "version_tag" TEXT NOT NULL,
    "library_snapshot_hash" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "takeoff_rule_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "takeoff_rule_version_members" (
    "id" TEXT NOT NULL,
    "rule_version_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "rule_body_json" JSONB NOT NULL,

    CONSTRAINT "takeoff_rule_version_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "takeoff_runs" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "rule_version_id" TEXT NOT NULL,
    "run_number" INTEGER NOT NULL,
    "status" "TakeoffRunStatus" NOT NULL DEFAULT 'active',
    "note" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_by_run_id" TEXT,

    CONSTRAINT "takeoff_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "takeoff_line_items" (
    "id" TEXT NOT NULL,
    "takeoff_run_id" TEXT NOT NULL,
    "operation_item_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "structure_element_type" TEXT NOT NULL,
    "source_measure_element_id" TEXT,
    "unit" TEXT NOT NULL,
    "quantity_engine" DECIMAL(18,4) NOT NULL,
    "quantity_final" DECIMAL(18,4) NOT NULL,
    "has_override" BOOLEAN NOT NULL DEFAULT false,
    "rule_id" TEXT NOT NULL,
    "rule_version_id" TEXT NOT NULL,
    "metraj_snapshot_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "TakeoffLineItemStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "takeoff_line_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "takeoff_line_item_sources" (
    "id" TEXT NOT NULL,
    "takeoff_line_item_id" TEXT NOT NULL,
    "smart_measure_version_id" TEXT NOT NULL,

    CONSTRAINT "takeoff_line_item_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "takeoff_manual_overrides" (
    "id" TEXT NOT NULL,
    "takeoff_line_item_id" TEXT NOT NULL,
    "quantity_engine_preserved" DECIMAL(18,4) NOT NULL,
    "quantity_override" DECIMAL(18,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "takeoff_manual_overrides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "takeoff_calculation_explanations" (
    "id" TEXT NOT NULL,
    "takeoff_line_item_id" TEXT NOT NULL,
    "measure_summary" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "rule_version_tag" TEXT NOT NULL,
    "decision_path_json" JSONB NOT NULL,
    "calculation_steps_json" JSONB NOT NULL,
    "override_summary_json" JSONB,
    "human_readable_text" TEXT NOT NULL,

    CONSTRAINT "takeoff_calculation_explanations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "takeoff_rules_code_key" ON "takeoff_rules"("code");
CREATE UNIQUE INDEX "takeoff_rule_versions_version_tag_key" ON "takeoff_rule_versions"("version_tag");
CREATE UNIQUE INDEX "takeoff_rule_version_members_rule_version_id_rule_id_key" ON "takeoff_rule_version_members"("rule_version_id", "rule_id");
CREATE UNIQUE INDEX "takeoff_runs_claim_file_id_run_number_key" ON "takeoff_runs"("claim_file_id", "run_number");
CREATE INDEX "takeoff_runs_claim_file_id_status_idx" ON "takeoff_runs"("claim_file_id", "status");
CREATE INDEX "takeoff_line_items_takeoff_run_id_idx" ON "takeoff_line_items"("takeoff_run_id");
CREATE INDEX "takeoff_line_item_sources_smart_measure_version_id_idx" ON "takeoff_line_item_sources"("smart_measure_version_id");
CREATE INDEX "takeoff_manual_overrides_takeoff_line_item_id_active_idx" ON "takeoff_manual_overrides"("takeoff_line_item_id", "active");
CREATE UNIQUE INDEX "takeoff_calculation_explanations_takeoff_line_item_id_key" ON "takeoff_calculation_explanations"("takeoff_line_item_id");
CREATE INDEX "takeoff_rules_structure_element_type_active_idx" ON "takeoff_rules"("structure_element_type", "active");

ALTER TABLE "takeoff_rule_versions" ADD CONSTRAINT "takeoff_rule_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "takeoff_rule_version_members" ADD CONSTRAINT "takeoff_rule_version_members_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "takeoff_rule_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "takeoff_rule_version_members" ADD CONSTRAINT "takeoff_rule_version_members_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "takeoff_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "takeoff_runs" ADD CONSTRAINT "takeoff_runs_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "takeoff_runs" ADD CONSTRAINT "takeoff_runs_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "takeoff_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "takeoff_runs" ADD CONSTRAINT "takeoff_runs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "takeoff_runs" ADD CONSTRAINT "takeoff_runs_superseded_by_run_id_fkey" FOREIGN KEY ("superseded_by_run_id") REFERENCES "takeoff_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "takeoff_line_items" ADD CONSTRAINT "takeoff_line_items_takeoff_run_id_fkey" FOREIGN KEY ("takeoff_run_id") REFERENCES "takeoff_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "takeoff_line_items" ADD CONSTRAINT "takeoff_line_items_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "takeoff_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "takeoff_line_item_sources" ADD CONSTRAINT "takeoff_line_item_sources_takeoff_line_item_id_fkey" FOREIGN KEY ("takeoff_line_item_id") REFERENCES "takeoff_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "takeoff_manual_overrides" ADD CONSTRAINT "takeoff_manual_overrides_takeoff_line_item_id_fkey" FOREIGN KEY ("takeoff_line_item_id") REFERENCES "takeoff_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "takeoff_calculation_explanations" ADD CONSTRAINT "takeoff_calculation_explanations_takeoff_line_item_id_fkey" FOREIGN KEY ("takeoff_line_item_id") REFERENCES "takeoff_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

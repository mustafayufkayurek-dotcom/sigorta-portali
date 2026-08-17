-- AlterTable
ALTER TABLE "cost_entries" ADD COLUMN     "expense_category_id" TEXT;

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'logo_wing',
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "api_base_url" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firm_no" INTEGER NOT NULL,
    "company_code_prefix" TEXT,
    "last_tested_at" TIMESTAMP(3),
    "test_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'logo_wing',
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "endpoint" TEXT,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "logo_entity_id" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_entity_maps" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'logo_wing',
    "entity_type" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "logo_id" TEXT NOT NULL,
    "logo_ref" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_entity_maps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_code_key" ON "expense_categories"("code");

-- CreateIndex
CREATE INDEX "expense_categories_parent_id_idx" ON "expense_categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_provider_key" ON "integration_configs"("provider");

-- CreateIndex
CREATE INDEX "integration_logs_entity_type_entity_id_idx" ON "integration_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "integration_logs_status_idx" ON "integration_logs"("status");

-- CreateIndex
CREATE INDEX "integration_logs_created_at_idx" ON "integration_logs"("created_at");

-- CreateIndex
CREATE INDEX "integration_entity_maps_entity_type_local_id_idx" ON "integration_entity_maps"("entity_type", "local_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_entity_maps_provider_entity_type_local_id_key" ON "integration_entity_maps"("provider", "entity_type", "local_id");

-- CreateIndex
CREATE INDEX "cost_entries_expense_category_id_idx" ON "cost_entries"("expense_category_id");

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_expense_category_id_fkey" FOREIGN KEY ("expense_category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "vendor_risk_scores" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "dispute_rate_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revision_freq_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price_deviation_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delivery_compliance_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "concentration_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "risk_level" TEXT NOT NULL DEFAULT 'low',
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_risk_score_history" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "risk_level" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_risk_score_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_price_catalog" (
    "id" TEXT NOT NULL,
    "work_group_id" TEXT NOT NULL,
    "job_description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "region_type" TEXT NOT NULL DEFAULT 'national',
    "min_price" DOUBLE PRECISION NOT NULL,
    "max_price" DOUBLE PRECISION NOT NULL,
    "reference_price" DOUBLE PRECISION NOT NULL,
    "tolerance_pct" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_price_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_item_anomaly_flags" (
    "id" TEXT NOT NULL,
    "repair_report_item_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "catalog_id" TEXT,
    "flag_type" TEXT NOT NULL,
    "deviation_pct" DOUBLE PRECISION,
    "supplier_price" DOUBLE PRECISION,
    "reference_price" DOUBLE PRECISION,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "status" TEXT NOT NULL DEFAULT 'open',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_item_anomaly_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_concentration_snapshots" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "work_group_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "vendor_job_count" INTEGER NOT NULL,
    "total_job_count" INTEGER NOT NULL,
    "vendor_amount" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "concentration_pct" DOUBLE PRECISION NOT NULL,
    "is_over_threshold" BOOLEAN NOT NULL DEFAULT false,
    "threshold_pct" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_concentration_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_risk_scores_vendor_id_key" ON "vendor_risk_scores"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_risk_scores_risk_level_idx" ON "vendor_risk_scores"("risk_level");

-- CreateIndex
CREATE INDEX "vendor_risk_scores_total_score_idx" ON "vendor_risk_scores"("total_score");

-- CreateIndex
CREATE INDEX "vendor_risk_score_history_vendor_id_calculated_at_idx" ON "vendor_risk_score_history"("vendor_id", "calculated_at");

-- CreateIndex
CREATE INDEX "market_price_catalog_work_group_id_region_type_idx" ON "market_price_catalog"("work_group_id", "region_type");

-- CreateIndex
CREATE INDEX "market_price_catalog_is_active_idx" ON "market_price_catalog"("is_active");

-- CreateIndex
CREATE INDEX "repair_item_anomaly_flags_report_id_idx" ON "repair_item_anomaly_flags"("report_id");

-- CreateIndex
CREATE INDEX "repair_item_anomaly_flags_vendor_id_idx" ON "repair_item_anomaly_flags"("vendor_id");

-- CreateIndex
CREATE INDEX "repair_item_anomaly_flags_status_idx" ON "repair_item_anomaly_flags"("status");

-- CreateIndex
CREATE INDEX "repair_item_anomaly_flags_flag_type_idx" ON "repair_item_anomaly_flags"("flag_type");

-- CreateIndex
CREATE INDEX "vendor_concentration_snapshots_vendor_id_work_group_id_idx" ON "vendor_concentration_snapshots"("vendor_id", "work_group_id");

-- CreateIndex
CREATE INDEX "vendor_concentration_snapshots_period_start_idx" ON "vendor_concentration_snapshots"("period_start");

-- CreateIndex
CREATE INDEX "vendor_concentration_snapshots_is_over_threshold_idx" ON "vendor_concentration_snapshots"("is_over_threshold");

-- AddForeignKey
ALTER TABLE "vendor_risk_scores" ADD CONSTRAINT "vendor_risk_scores_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_risk_score_history" ADD CONSTRAINT "vendor_risk_score_history_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_price_catalog" ADD CONSTRAINT "market_price_catalog_work_group_id_fkey" FOREIGN KEY ("work_group_id") REFERENCES "work_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_item_anomaly_flags" ADD CONSTRAINT "repair_item_anomaly_flags_repair_report_item_id_fkey" FOREIGN KEY ("repair_report_item_id") REFERENCES "repair_report_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_item_anomaly_flags" ADD CONSTRAINT "repair_item_anomaly_flags_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "market_price_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_concentration_snapshots" ADD CONSTRAINT "vendor_concentration_snapshots_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_concentration_snapshots" ADD CONSTRAINT "vendor_concentration_snapshots_work_group_id_fkey" FOREIGN KEY ("work_group_id") REFERENCES "work_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

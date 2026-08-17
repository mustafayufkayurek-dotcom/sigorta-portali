-- CreateTable
CREATE TABLE "customer_access_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "claim_file_id" TEXT,
    "access_type" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "is_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_access_logs_user_id_idx" ON "customer_access_logs"("user_id");

-- CreateIndex
CREATE INDEX "customer_access_logs_customer_id_idx" ON "customer_access_logs"("customer_id");

-- CreateIndex
CREATE INDEX "customer_access_logs_created_at_idx" ON "customer_access_logs"("created_at");

-- CreateIndex
CREATE INDEX "customer_access_logs_is_anomaly_idx" ON "customer_access_logs"("is_anomaly");

-- AddForeignKey
ALTER TABLE "customer_access_logs" ADD CONSTRAINT "customer_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_access_logs" ADD CONSTRAINT "customer_access_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_access_logs" ADD CONSTRAINT "customer_access_logs_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

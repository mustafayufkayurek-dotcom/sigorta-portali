-- CreateTable
CREATE TABLE "emergency_vendor_entitlements" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL,
    "granted_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_vendor_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emergency_vendor_entitlements_case_id_key" ON "emergency_vendor_entitlements"("case_id");

-- CreateIndex
CREATE INDEX "emergency_vendor_entitlements_vendor_id_idx" ON "emergency_vendor_entitlements"("vendor_id");

-- CreateIndex
CREATE INDEX "emergency_vendor_entitlements_granted_at_idx" ON "emergency_vendor_entitlements"("granted_at");

-- AddForeignKey
ALTER TABLE "emergency_vendor_entitlements" ADD CONSTRAINT "emergency_vendor_entitlements_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "emergency_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_vendor_entitlements" ADD CONSTRAINT "emergency_vendor_entitlements_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- AddForeignKey
ALTER TABLE "emergency_vendor_entitlements" ADD CONSTRAINT "emergency_vendor_entitlements_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

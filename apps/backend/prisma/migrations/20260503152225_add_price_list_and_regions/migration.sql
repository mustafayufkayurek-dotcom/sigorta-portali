-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regional_price_adjustments" (
    "id" TEXT NOT NULL,
    "region_id" TEXT NOT NULL,
    "adjustment_percent" DECIMAL(5,2) NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regional_price_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_versions" (
    "id" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_code_key" ON "regions"("code");

-- CreateIndex
CREATE INDEX "regional_price_adjustments_region_id_effective_date_idx" ON "regional_price_adjustments"("region_id", "effective_date");

-- AddForeignKey
ALTER TABLE "regional_price_adjustments" ADD CONSTRAINT "regional_price_adjustments_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

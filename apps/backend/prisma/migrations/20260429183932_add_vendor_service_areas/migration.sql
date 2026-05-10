-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "provinces" (
    "id" TEXT NOT NULL,
    "plate_code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "province_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_service_areas" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "province_id" TEXT NOT NULL,
    "district_id" TEXT,

    CONSTRAINT "vendor_service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_work_groups" (
    "vendor_id" TEXT NOT NULL,
    "work_group_id" TEXT NOT NULL,

    CONSTRAINT "vendor_work_groups_pkey" PRIMARY KEY ("vendor_id","work_group_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provinces_plate_code_key" ON "provinces"("plate_code");

-- CreateIndex
CREATE UNIQUE INDEX "provinces_name_key" ON "provinces"("name");

-- CreateIndex
CREATE INDEX "districts_province_id_idx" ON "districts"("province_id");

-- CreateIndex
CREATE UNIQUE INDEX "districts_province_id_name_key" ON "districts"("province_id", "name");

-- CreateIndex
CREATE INDEX "vendor_service_areas_vendor_id_idx" ON "vendor_service_areas"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_service_areas_vendor_id_province_id_district_id_key" ON "vendor_service_areas"("vendor_id", "province_id", "district_id");

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_service_areas" ADD CONSTRAINT "vendor_service_areas_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_service_areas" ADD CONSTRAINT "vendor_service_areas_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_service_areas" ADD CONSTRAINT "vendor_service_areas_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_work_groups" ADD CONSTRAINT "vendor_work_groups_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_work_groups" ADD CONSTRAINT "vendor_work_groups_work_group_id_fkey" FOREIGN KEY ("work_group_id") REFERENCES "work_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

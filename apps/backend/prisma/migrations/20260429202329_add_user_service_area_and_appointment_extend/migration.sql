-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "assigned_user_id" TEXT,
ADD COLUMN     "notified_at" TIMESTAMP(3),
ADD COLUMN     "scheduled_end" TIMESTAMP(3),
ADD COLUMN     "vendor_id" TEXT,
ALTER COLUMN "status" SET DEFAULT 'planned';

-- CreateTable
CREATE TABLE "user_service_areas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "province_id" TEXT NOT NULL,
    "district_id" TEXT,

    CONSTRAINT "user_service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_service_areas_user_id_idx" ON "user_service_areas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_service_areas_user_id_province_id_district_id_key" ON "user_service_areas"("user_id", "province_id", "district_id");

-- CreateIndex
CREATE INDEX "appointments_assigned_user_id_idx" ON "appointments"("assigned_user_id");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_service_areas" ADD CONSTRAINT "user_service_areas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_service_areas" ADD CONSTRAINT "user_service_areas_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_service_areas" ADD CONSTRAINT "user_service_areas_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mahalle tablosu + müşteri/tedarikçi yapılandırılmış adres alanları
-- Not: production districts.id TEXT tipinde (Prisma String)
CREATE TABLE IF NOT EXISTS "neighborhoods" (
  "id" TEXT NOT NULL,
  "district_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "neighborhoods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "neighborhoods_district_id_name_key" ON "neighborhoods"("district_id", "name");
CREATE INDEX IF NOT EXISTS "neighborhoods_district_id_idx" ON "neighborhoods"("district_id");

ALTER TABLE "neighborhoods"
  ADD CONSTRAINT "neighborhoods_district_id_fkey"
  FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "street_name" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "building_no" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "door_no" TEXT;

ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "street_name" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "building_no" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "door_no" TEXT;

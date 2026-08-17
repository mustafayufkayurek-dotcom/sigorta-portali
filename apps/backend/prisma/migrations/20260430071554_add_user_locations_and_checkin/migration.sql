-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "checked_in_at" TIMESTAMP(3),
ADD COLUMN     "checked_in_latitude" DOUBLE PRECISION,
ADD COLUMN     "checked_in_longitude" DOUBLE PRECISION,
ADD COLUMN     "checked_out_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_locations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "battery_level" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_locations_user_id_timestamp_idx" ON "user_locations"("user_id", "timestamp");

-- AddForeignKey
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

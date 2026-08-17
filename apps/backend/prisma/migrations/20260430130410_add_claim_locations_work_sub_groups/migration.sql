-- AlterTable
ALTER TABLE "work_groups" ADD COLUMN     "description" TEXT,
ADD COLUMN     "unit" TEXT;

-- CreateTable
CREATE TABLE "claim_locations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_sub_groups" (
    "id" TEXT NOT NULL,
    "work_group_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit_type" TEXT NOT NULL,
    "unit_price" DECIMAL(12,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_sub_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "claim_locations_code_key" ON "claim_locations"("code");

-- CreateIndex
CREATE INDEX "claim_locations_status_idx" ON "claim_locations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "work_sub_groups_code_key" ON "work_sub_groups"("code");

-- CreateIndex
CREATE INDEX "work_sub_groups_work_group_id_idx" ON "work_sub_groups"("work_group_id");

-- CreateIndex
CREATE INDEX "work_sub_groups_status_idx" ON "work_sub_groups"("status");

-- AddForeignKey
ALTER TABLE "work_sub_groups" ADD CONSTRAINT "work_sub_groups_work_group_id_fkey" FOREIGN KEY ("work_group_id") REFERENCES "work_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

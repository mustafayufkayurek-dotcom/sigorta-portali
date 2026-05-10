-- AlterTable
ALTER TABLE "claim_locations" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "claim_locations_parent_id_idx" ON "claim_locations"("parent_id");

-- AddForeignKey
ALTER TABLE "claim_locations" ADD CONSTRAINT "claim_locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "claim_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

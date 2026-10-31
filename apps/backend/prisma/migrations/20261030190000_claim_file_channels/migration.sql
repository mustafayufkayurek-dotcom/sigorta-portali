ALTER TABLE "claim_files" ADD COLUMN "channel_agency_customer_id" TEXT;
ALTER TABLE "claim_files" ADD COLUMN "channel_broker_customer_id" TEXT;
ALTER TABLE "claim_files" ADD COLUMN "channel_expert_customer_id" TEXT;

CREATE INDEX "claim_files_channel_agency_customer_id_idx" ON "claim_files"("channel_agency_customer_id");
CREATE INDEX "claim_files_channel_broker_customer_id_idx" ON "claim_files"("channel_broker_customer_id");
CREATE INDEX "claim_files_channel_expert_customer_id_idx" ON "claim_files"("channel_expert_customer_id");

ALTER TABLE "claim_files" ADD CONSTRAINT "claim_files_channel_agency_customer_id_fkey" FOREIGN KEY ("channel_agency_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "claim_files" ADD CONSTRAINT "claim_files_channel_broker_customer_id_fkey" FOREIGN KEY ("channel_broker_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "claim_files" ADD CONSTRAINT "claim_files_channel_expert_customer_id_fkey" FOREIGN KEY ("channel_expert_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

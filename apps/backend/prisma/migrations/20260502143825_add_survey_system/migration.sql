-- CreateTable
CREATE TABLE "survey_campaigns" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT,
    "emergency_case_id" TEXT,
    "invoice_request_id" TEXT,
    "insurance_company_id" TEXT,
    "insured_name" TEXT,
    "insured_phone" TEXT,
    "public_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3),
    "whatsapp_sent_at" TIMESTAMP(3),
    "whatsapp_deep_link" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "q1_rating" INTEGER NOT NULL,
    "q2_rating" INTEGER NOT NULL,
    "q3_rating" INTEGER NOT NULL,
    "q4_rating" INTEGER NOT NULL,
    "q5_rating" INTEGER NOT NULL,
    "q6_recommend" BOOLEAN NOT NULL,
    "q7_comment" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "survey_campaigns_invoice_request_id_key" ON "survey_campaigns"("invoice_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_campaigns_public_token_key" ON "survey_campaigns"("public_token");

-- CreateIndex
CREATE INDEX "survey_campaigns_status_idx" ON "survey_campaigns"("status");

-- CreateIndex
CREATE INDEX "survey_campaigns_insurance_company_id_idx" ON "survey_campaigns"("insurance_company_id");

-- CreateIndex
CREATE INDEX "survey_campaigns_claim_file_id_idx" ON "survey_campaigns"("claim_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_campaign_id_key" ON "survey_responses"("campaign_id");

-- AddForeignKey
ALTER TABLE "survey_campaigns" ADD CONSTRAINT "survey_campaigns_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_campaigns" ADD CONSTRAINT "survey_campaigns_insurance_company_id_fkey" FOREIGN KEY ("insurance_company_id") REFERENCES "insurance_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_campaigns" ADD CONSTRAINT "survey_campaigns_invoice_request_id_fkey" FOREIGN KEY ("invoice_request_id") REFERENCES "invoice_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "survey_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

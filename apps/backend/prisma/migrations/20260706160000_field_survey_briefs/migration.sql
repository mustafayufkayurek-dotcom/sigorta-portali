-- CreateTable
CREATE TABLE "field_survey_briefs" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary_text" TEXT NOT NULL,
    "dimensions_json" JSONB NOT NULL,
    "materials_json" JSONB NOT NULL,
    "ai_confidence" DOUBLE PRECISION,
    "is_estimated" BOOLEAN NOT NULL DEFAULT true,
    "photo_url" TEXT,
    "annotated_photo_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_survey_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_survey_briefs_claim_file_id_created_at_idx" ON "field_survey_briefs"("claim_file_id", "created_at");

-- CreateIndex
CREATE INDEX "field_survey_briefs_created_by_user_id_idx" ON "field_survey_briefs"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "field_survey_briefs" ADD CONSTRAINT "field_survey_briefs_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_survey_briefs" ADD CONSTRAINT "field_survey_briefs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

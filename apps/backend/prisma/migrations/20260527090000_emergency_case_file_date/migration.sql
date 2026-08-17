ALTER TABLE "emergency_cases"
ADD COLUMN "file_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "emergency_cases"
SET "file_date" = "created_at"
WHERE "file_date" IS NULL;

CREATE INDEX "emergency_cases_file_date_idx" ON "emergency_cases"("file_date");

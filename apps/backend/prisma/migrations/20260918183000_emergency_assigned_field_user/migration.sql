ALTER TABLE "emergency_cases" ADD COLUMN "assigned_field_user_id" TEXT;

CREATE INDEX "emergency_cases_assigned_field_user_id_idx" ON "emergency_cases"("assigned_field_user_id");

ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_assigned_field_user_id_fkey" FOREIGN KEY ("assigned_field_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

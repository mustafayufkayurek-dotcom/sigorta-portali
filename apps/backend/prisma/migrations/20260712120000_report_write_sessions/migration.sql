-- Rapor yazım süresi analitiği (madde 39)
CREATE TABLE IF NOT EXISTS "report_write_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_write_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "report_write_sessions_user_id_idx" ON "report_write_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "report_write_sessions_report_id_idx" ON "report_write_sessions"("report_id");
CREATE INDEX IF NOT EXISTS "report_write_sessions_started_at_idx" ON "report_write_sessions"("started_at");

ALTER TABLE "report_write_sessions" DROP CONSTRAINT IF EXISTS "report_write_sessions_user_id_fkey";
ALTER TABLE "report_write_sessions" ADD CONSTRAINT "report_write_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_write_sessions" DROP CONSTRAINT IF EXISTS "report_write_sessions_report_id_fkey";
ALTER TABLE "report_write_sessions" ADD CONSTRAINT "report_write_sessions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "repair_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_write_sessions" DROP CONSTRAINT IF EXISTS "report_write_sessions_claim_file_id_fkey";
ALTER TABLE "report_write_sessions" ADD CONSTRAINT "report_write_sessions_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sprint 2: Danışman Ek Talepleri (5 madde)
-- 1. Operasyonel Ownership
-- 2. Son Aktivite Takibi
-- 3. Soft/Hard SLA (3 seviye)
-- 4. Bekleme Nedeni Görünürlüğü (zaten mevcut, UI tarafında)
-- 5. Operasyonel İç Not Sistemi

-- Ek Talep #1: Operasyonel Ownership alanları (ClaimFile)
ALTER TABLE "claim_files" ADD COLUMN "current_responsible_role" TEXT;
ALTER TABLE "claim_files" ADD COLUMN "current_responsible_user_id" TEXT;
ALTER TABLE "claim_files" ADD COLUMN "pending_action_owner" TEXT;

-- Ek Talep #2: Son Aktivite Takibi (ClaimFile)
ALTER TABLE "claim_files" ADD COLUMN "last_activity_at" TIMESTAMP(3);
ALTER TABLE "claim_files" ADD COLUMN "last_human_action_at" TIMESTAMP(3);

-- Ek Talep #3: 3 Seviyeli SLA (ClaimStatus)
ALTER TABLE "claim_statuses" ADD COLUMN "sla_warning_percent" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "claim_statuses" ADD COLUMN "sla_critical_percent" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "claim_statuses" ADD COLUMN "sla_escalation_percent" INTEGER NOT NULL DEFAULT 100;

-- Ek Talep #5: Operasyonel İç Not Sistemi
CREATE TABLE "timeline_notes" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "note_type" TEXT NOT NULL DEFAULT 'general',
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "timeline_notes_claim_file_id_idx" ON "timeline_notes"("claim_file_id");

ALTER TABLE "timeline_notes" ADD CONSTRAINT "timeline_notes_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timeline_notes" ADD CONSTRAINT "timeline_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- İndeksler
CREATE INDEX "claim_files_last_activity_at_idx" ON "claim_files"("last_activity_at");
CREATE INDEX "claim_files_current_responsible_user_id_idx" ON "claim_files"("current_responsible_user_id");

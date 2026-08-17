-- CreateTable
CREATE TABLE "external_approvals" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "approver_type" TEXT NOT NULL,
    "approver_id" TEXT,
    "approver_name" TEXT,
    "approver_email" TEXT,
    "approver_phone" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "comments" TEXT,
    "sent_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_approvals_token_key" ON "external_approvals"("token");

-- CreateIndex
CREATE INDEX "external_approvals_report_id_idx" ON "external_approvals"("report_id");

-- CreateIndex
CREATE INDEX "external_approvals_token_idx" ON "external_approvals"("token");

-- CreateIndex
CREATE INDEX "external_approvals_status_idx" ON "external_approvals"("status");

-- CreateIndex
CREATE INDEX "external_approvals_approver_id_idx" ON "external_approvals"("approver_id");

-- AddForeignKey
ALTER TABLE "external_approvals" ADD CONSTRAINT "external_approvals_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "repair_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_approvals" ADD CONSTRAINT "external_approvals_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_approvals" ADD CONSTRAINT "external_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

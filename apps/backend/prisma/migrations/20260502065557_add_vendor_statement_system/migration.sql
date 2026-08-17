-- CreateEnum
CREATE TYPE "task_assignment_status" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'TIMEOUT_AUTO_ASSIGNED');

-- CreateEnum
CREATE TYPE "task_assignment_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "assignment_notification_type" AS ENUM ('ASSIGNMENT', 'REMINDER', 'TIMEOUT_WARNING', 'ESCALATION', 'OVERDUE');

-- CreateEnum
CREATE TYPE "revision_status" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "revision_priority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "revision_reason" AS ENUM ('PRICE_CORRECTION', 'ITEM_ADD_REMOVE', 'MEASUREMENT_FIX', 'SCOPE_CHANGE', 'MISSING_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "vendor_statement_status" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_APPROVED', 'APPROVED', 'DISPUTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "vendor_statement_item_approval_status" AS ENUM ('PENDING', 'APPROVED', 'DISPUTED', 'AUTO_APPROVED');

-- CreateEnum
CREATE TYPE "vendor_dispute_reason" AS ENUM ('AMOUNT_MISMATCH', 'ITEM_NOT_DONE', 'WRONG_CLAIM', 'NOT_RECEIVED', 'OTHER');

-- CreateEnum
CREATE TYPE "vendor_dispute_status" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_ACCEPT', 'RESOLVED_REJECT', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "vendor_dispute_alert_type" AS ENUM ('HIGH_DISPUTE_RATE', 'REPEATED_DISPUTE_SAME_ITEM', 'BULK_DISPUTE');

-- AlterTable
ALTER TABLE "claim_files" ADD COLUMN     "file_type" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "contact_first_name" TEXT,
ADD COLUMN     "contact_last_name" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "service_branches" JSONB DEFAULT '[]',
ADD COLUMN     "service_type" TEXT;

-- AlterTable
ALTER TABLE "entity_documents" ADD COLUMN     "thumbnail_key" TEXT;

-- AlterTable
ALTER TABLE "file_assets" ADD COLUMN     "thumbnail_key" TEXT;

-- AlterTable
ALTER TABLE "repair_report_items" ADD COLUMN     "damage_category" TEXT NOT NULL DEFAULT 'bina',
ADD COLUMN     "labor_included" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lump_sum_price" DOUBLE PRECISION,
ADD COLUMN     "material_included" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pricing_type" TEXT NOT NULL DEFAULT 'unit';

-- AlterTable
ALTER TABLE "repair_reports" ADD COLUMN     "expert_office_id" TEXT,
ADD COLUMN     "revision_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "vendor_documents" ADD COLUMN     "thumbnail_key" TEXT;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "contract_end_date" TIMESTAMP(3),
ADD COLUMN     "contract_notes" TEXT,
ADD COLUMN     "contract_start_date" TIMESTAMP(3),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "referral" TEXT;

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" TEXT NOT NULL,
    "claim_file_id" TEXT NOT NULL,
    "assigned_to_id" TEXT NOT NULL,
    "assigned_by_id" TEXT,
    "status" "task_assignment_status" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "priority" "task_assignment_priority" NOT NULL DEFAULT 'MEDIUM',
    "due_date" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "timeout_hours" INTEGER NOT NULL DEFAULT 4,
    "auto_assigned" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "work_group_id" TEXT,
    "service_region_id" TEXT,
    "assign_to_user_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_notifications" (
    "id" TEXT NOT NULL,
    "task_assignment_id" TEXT NOT NULL,
    "type" "assignment_notification_type" NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_revision_requests" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "status" "revision_status" NOT NULL DEFAULT 'REQUESTED',
    "priority" "revision_priority" NOT NULL DEFAULT 'NORMAL',
    "reason" "revision_reason" NOT NULL,
    "reason_note" TEXT NOT NULL,
    "affected_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deadline_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "response_note" TEXT,
    "new_report_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_revision_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_messages" (
    "id" TEXT NOT NULL,
    "revision_request_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error_msg" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_email_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "new_claim_file" BOOLEAN NOT NULL DEFAULT true,
    "claim_assignment" BOOLEAN NOT NULL DEFAULT true,
    "report_approved" BOOLEAN NOT NULL DEFAULT true,
    "report_rejected" BOOLEAN NOT NULL DEFAULT true,
    "sla_warning" BOOLEAN NOT NULL DEFAULT true,
    "sla_violation" BOOLEAN NOT NULL DEFAULT true,
    "revision_request" BOOLEAN NOT NULL DEFAULT true,
    "manager_instruction" BOOLEAN NOT NULL DEFAULT true,
    "claim_closed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_email_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT NOT NULL DEFAULT 'console',
    "claim_file_id" TEXT,
    "error_msg" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_acceptances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agreement_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "signature" TEXT,

    CONSTRAINT "agreement_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_payment_statements" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "statement_no" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "vendor_statement_status" NOT NULL DEFAULT 'DRAFT',
    "sent_at" TIMESTAMP(3),
    "deadline_at" TIMESTAMP(3),
    "auto_approved_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_payment_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_statement_items" (
    "id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "claim_file_id" TEXT NOT NULL,
    "repair_report_item_id" TEXT,
    "work_group_id" TEXT,
    "line_description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "vat_rate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "receipt_ref" TEXT,
    "receipt_date" TIMESTAMP(3),
    "approvalStatus" "vendor_statement_item_approval_status" NOT NULL DEFAULT 'PENDING',
    "approved_at" TIMESTAMP(3),
    "disputed_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_statement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_statement_receipts" (
    "id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "bank_ref" TEXT,
    "bank_date" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_statement_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_statement_disputes" (
    "id" TEXT NOT NULL,
    "statement_item_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "reason" "vendor_dispute_reason" NOT NULL,
    "reason_note" TEXT NOT NULL,
    "evidence_storage_key" TEXT,
    "evidence_file_name" TEXT,
    "status" "vendor_dispute_status" NOT NULL DEFAULT 'OPEN',
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "resolved_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_statement_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_statement_tokens" (
    "id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accessed_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_statement_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_dispute_alerts" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "statement_id" TEXT,
    "alertType" "vendor_dispute_alert_type" NOT NULL,
    "dispute_count" INTEGER NOT NULL,
    "window_days" INTEGER NOT NULL,
    "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by_user_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_dispute_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_assignments_claim_file_id_idx" ON "task_assignments"("claim_file_id");

-- CreateIndex
CREATE INDEX "task_assignments_assigned_to_id_idx" ON "task_assignments"("assigned_to_id");

-- CreateIndex
CREATE INDEX "task_assignments_status_idx" ON "task_assignments"("status");

-- CreateIndex
CREATE INDEX "assignment_rules_is_active_idx" ON "assignment_rules"("is_active");

-- CreateIndex
CREATE INDEX "assignment_rules_priority_idx" ON "assignment_rules"("priority");

-- CreateIndex
CREATE INDEX "assignment_notifications_task_assignment_id_idx" ON "assignment_notifications"("task_assignment_id");

-- CreateIndex
CREATE INDEX "assignment_notifications_is_read_idx" ON "assignment_notifications"("is_read");

-- CreateIndex
CREATE INDEX "report_revision_requests_report_id_idx" ON "report_revision_requests"("report_id");

-- CreateIndex
CREATE INDEX "report_revision_requests_requested_by_id_idx" ON "report_revision_requests"("requested_by_id");

-- CreateIndex
CREATE INDEX "report_revision_requests_assigned_to_id_idx" ON "report_revision_requests"("assigned_to_id");

-- CreateIndex
CREATE INDEX "report_revision_requests_status_idx" ON "report_revision_requests"("status");

-- CreateIndex
CREATE INDEX "report_revision_requests_deadline_at_idx" ON "report_revision_requests"("deadline_at");

-- CreateIndex
CREATE INDEX "revision_messages_revision_request_id_idx" ON "revision_messages"("revision_request_id");

-- CreateIndex
CREATE INDEX "service_branches_type_idx" ON "service_branches"("type");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_created_at_idx" ON "email_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_preferences_user_id_key" ON "user_email_preferences"("user_id");

-- CreateIndex
CREATE INDEX "sms_logs_status_idx" ON "sms_logs"("status");

-- CreateIndex
CREATE INDEX "sms_logs_created_at_idx" ON "sms_logs"("created_at");

-- CreateIndex
CREATE INDEX "sms_logs_claim_file_id_idx" ON "sms_logs"("claim_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_type_key" ON "message_templates"("type");

-- CreateIndex
CREATE INDEX "message_templates_type_idx" ON "message_templates"("type");

-- CreateIndex
CREATE INDEX "agreements_type_idx" ON "agreements"("type");

-- CreateIndex
CREATE INDEX "agreements_is_active_idx" ON "agreements"("is_active");

-- CreateIndex
CREATE INDEX "agreement_acceptances_user_id_idx" ON "agreement_acceptances"("user_id");

-- CreateIndex
CREATE INDEX "agreement_acceptances_agreement_id_idx" ON "agreement_acceptances"("agreement_id");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_acceptances_user_id_agreement_id_key" ON "agreement_acceptances"("user_id", "agreement_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_payment_statements_statement_no_key" ON "vendor_payment_statements"("statement_no");

-- CreateIndex
CREATE INDEX "vendor_payment_statements_vendor_id_idx" ON "vendor_payment_statements"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_payment_statements_status_idx" ON "vendor_payment_statements"("status");

-- CreateIndex
CREATE INDEX "vendor_payment_statements_deadline_at_idx" ON "vendor_payment_statements"("deadline_at");

-- CreateIndex
CREATE INDEX "vendor_statement_items_statement_id_idx" ON "vendor_statement_items"("statement_id");

-- CreateIndex
CREATE INDEX "vendor_statement_items_claim_file_id_idx" ON "vendor_statement_items"("claim_file_id");

-- CreateIndex
CREATE INDEX "vendor_statement_items_approvalStatus_idx" ON "vendor_statement_items"("approvalStatus");

-- CreateIndex
CREATE INDEX "vendor_statement_receipts_statement_id_idx" ON "vendor_statement_receipts"("statement_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_statement_disputes_statement_item_id_key" ON "vendor_statement_disputes"("statement_item_id");

-- CreateIndex
CREATE INDEX "vendor_statement_disputes_vendor_id_idx" ON "vendor_statement_disputes"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_statement_disputes_status_idx" ON "vendor_statement_disputes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_statement_tokens_token_key" ON "vendor_statement_tokens"("token");

-- CreateIndex
CREATE INDEX "vendor_statement_tokens_token_idx" ON "vendor_statement_tokens"("token");

-- CreateIndex
CREATE INDEX "vendor_statement_tokens_statement_id_idx" ON "vendor_statement_tokens"("statement_id");

-- CreateIndex
CREATE INDEX "vendor_dispute_alerts_vendor_id_idx" ON "vendor_dispute_alerts"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_dispute_alerts_is_acknowledged_idx" ON "vendor_dispute_alerts"("is_acknowledged");

-- AddForeignKey
ALTER TABLE "repair_reports" ADD CONSTRAINT "repair_reports_expert_office_id_fkey" FOREIGN KEY ("expert_office_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_rules" ADD CONSTRAINT "assignment_rules_assign_to_user_id_fkey" FOREIGN KEY ("assign_to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_notifications" ADD CONSTRAINT "assignment_notifications_task_assignment_id_fkey" FOREIGN KEY ("task_assignment_id") REFERENCES "task_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_revision_requests" ADD CONSTRAINT "report_revision_requests_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "repair_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_revision_requests" ADD CONSTRAINT "report_revision_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_revision_requests" ADD CONSTRAINT "report_revision_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_revision_requests" ADD CONSTRAINT "report_revision_requests_new_report_id_fkey" FOREIGN KEY ("new_report_id") REFERENCES "repair_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_messages" ADD CONSTRAINT "revision_messages_revision_request_id_fkey" FOREIGN KEY ("revision_request_id") REFERENCES "report_revision_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_messages" ADD CONSTRAINT "revision_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_email_preferences" ADD CONSTRAINT "user_email_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payment_statements" ADD CONSTRAINT "vendor_payment_statements_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payment_statements" ADD CONSTRAINT "vendor_payment_statements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_items" ADD CONSTRAINT "vendor_statement_items_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "vendor_payment_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_items" ADD CONSTRAINT "vendor_statement_items_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_items" ADD CONSTRAINT "vendor_statement_items_claim_file_id_fkey" FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_items" ADD CONSTRAINT "vendor_statement_items_repair_report_item_id_fkey" FOREIGN KEY ("repair_report_item_id") REFERENCES "repair_report_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_items" ADD CONSTRAINT "vendor_statement_items_work_group_id_fkey" FOREIGN KEY ("work_group_id") REFERENCES "work_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_receipts" ADD CONSTRAINT "vendor_statement_receipts_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "vendor_payment_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_receipts" ADD CONSTRAINT "vendor_statement_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_receipts" ADD CONSTRAINT "vendor_statement_receipts_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_disputes" ADD CONSTRAINT "vendor_statement_disputes_statement_item_id_fkey" FOREIGN KEY ("statement_item_id") REFERENCES "vendor_statement_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_disputes" ADD CONSTRAINT "vendor_statement_disputes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_disputes" ADD CONSTRAINT "vendor_statement_disputes_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_statement_tokens" ADD CONSTRAINT "vendor_statement_tokens_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "vendor_payment_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_dispute_alerts" ADD CONSTRAINT "vendor_dispute_alerts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_dispute_alerts" ADD CONSTRAINT "vendor_dispute_alerts_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "vendor_payment_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_dispute_alerts" ADD CONSTRAINT "vendor_dispute_alerts_acknowledged_by_user_id_fkey" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

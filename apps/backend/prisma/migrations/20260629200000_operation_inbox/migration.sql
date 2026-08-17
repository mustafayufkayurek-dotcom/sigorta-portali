-- Operasyon Gelen Kutusu (Microsoft 365 shared mailbox ingest)

CREATE TYPE "InboundMailbox" AS ENUM ('IHBAR', 'HASAR');

CREATE TYPE "InboundMessageStatus" AS ENUM (
  'NEW',
  'CLASSIFYING',
  'CLASSIFIED',
  'ACTIONED',
  'ARCHIVED',
  'ERROR'
);

CREATE TYPE "InboundClassification" AS ENUM (
  'HASAR_IHBAR',
  'ACIL_YARDIM',
  'BELGE_TALEP',
  'FATURA_ODEME',
  'GENEL',
  'SPAM',
  'UNKNOWN'
);

CREATE TABLE "graph_subscriptions" (
  "id" TEXT NOT NULL,
  "mailbox" "InboundMailbox" NOT NULL,
  "subscription_id" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "change_type" TEXT NOT NULL,
  "client_state" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "delta_link" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "graph_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "graph_subscriptions_subscription_id_key" ON "graph_subscriptions"("subscription_id");

CREATE TABLE "inbound_messages" (
  "id" TEXT NOT NULL,
  "graph_message_id" TEXT NOT NULL,
  "internet_message_id" TEXT,
  "conversation_id" TEXT,
  "mailbox" "InboundMailbox" NOT NULL,
  "from_address" TEXT NOT NULL,
  "from_name" TEXT,
  "to_addresses" TEXT[],
  "subject" TEXT NOT NULL,
  "body_preview" TEXT,
  "body_html" TEXT,
  "body_text" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL,
  "status" "InboundMessageStatus" NOT NULL DEFAULT 'NEW',
  "classification" "InboundClassification",
  "confidence" DOUBLE PRECISION,
  "ai_summary" TEXT,
  "ai_extracted_json" JSONB,
  "suggested_action" TEXT,
  "manager_instruction" TEXT,
  "claim_file_id" TEXT,
  "emergency_case_id" TEXT,
  "assigned_user_id" TEXT,
  "processed_at" TIMESTAMP(3),
  "error_msg" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inbound_messages_graph_message_id_key" ON "inbound_messages"("graph_message_id");
CREATE INDEX "inbound_messages_mailbox_status_idx" ON "inbound_messages"("mailbox", "status");
CREATE INDEX "inbound_messages_received_at_idx" ON "inbound_messages"("received_at");
CREATE INDEX "inbound_messages_classification_idx" ON "inbound_messages"("classification");

ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_claim_file_id_fkey"
  FOREIGN KEY ("claim_file_id") REFERENCES "claim_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_emergency_case_id_fkey"
  FOREIGN KEY ("emergency_case_id") REFERENCES "emergency_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_assigned_user_id_fkey"
  FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "inbound_attachments" (
  "id" TEXT NOT NULL,
  "inbound_message_id" TEXT NOT NULL,
  "graph_attachment_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "storage_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inbound_attachments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "inbound_attachments" ADD CONSTRAINT "inbound_attachments_inbound_message_id_fkey"
  FOREIGN KEY ("inbound_message_id") REFERENCES "inbound_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

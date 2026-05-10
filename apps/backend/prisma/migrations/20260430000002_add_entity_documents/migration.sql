-- CreateTable: entity_documents (polymorphic for customer + insurance_company)
CREATE TABLE IF NOT EXISTS "entity_documents" (
  "id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "document_type_id" TEXT,
  "file_name" TEXT NOT NULL,
  "file_extension" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "storage_key" TEXT NOT NULL,
  "notes" TEXT,
  "uploaded_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "entity_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "entity_documents_entity_type_entity_id_idx" ON "entity_documents"("entity_type", "entity_id");

-- AddForeignKey (optional — document_type)
ALTER TABLE "entity_documents"
  ADD CONSTRAINT "entity_documents_document_type_id_fkey"
  FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (uploaded_by_user_id)
ALTER TABLE "entity_documents"
  ADD CONSTRAINT "entity_documents_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

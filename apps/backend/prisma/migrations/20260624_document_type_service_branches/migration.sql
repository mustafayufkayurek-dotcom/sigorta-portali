-- Evrak türlerini hizmet branşlarına bağla (departman yerine)
ALTER TABLE "document_types" ADD COLUMN IF NOT EXISTS "service_branch_ids" JSONB NOT NULL DEFAULT '[]';

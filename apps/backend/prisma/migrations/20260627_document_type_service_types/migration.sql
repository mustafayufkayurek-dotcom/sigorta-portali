-- Evrak türleri: hizmet branşı yerine hizmet türü (Hasar Onarım, Restorasyon, …)
ALTER TABLE "document_types" ADD COLUMN IF NOT EXISTS "service_type_ids" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "document_types" DROP COLUMN IF EXISTS "service_branch_ids";

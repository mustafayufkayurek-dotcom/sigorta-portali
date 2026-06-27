-- Evrak türleri: departman bazlı kapsam (Hasar Onarım, Acil Yardım vb.)
ALTER TABLE "document_types" ADD COLUMN IF NOT EXISTS "department_ids" JSONB NOT NULL DEFAULT '[]';

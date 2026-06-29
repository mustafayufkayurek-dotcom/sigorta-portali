-- Acil yardım hizmet kolları (elektrik, çilingir, tesisat vb.)
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "service_branches" JSONB NOT NULL DEFAULT '[]';

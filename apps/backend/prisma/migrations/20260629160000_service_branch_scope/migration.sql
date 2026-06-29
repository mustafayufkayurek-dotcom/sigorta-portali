-- Müşteri branşları ile tedarikçi hizmet kollarını ayır
ALTER TABLE "service_branches" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'customer';

CREATE INDEX IF NOT EXISTS "service_branches_type_scope_idx" ON "service_branches"("type", "scope");

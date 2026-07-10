-- Operasyonel erişim izinleri (vekalet) — Faz 1

CREATE TABLE "operational_access_grants" (
  "id" TEXT NOT NULL,
  "grantee_user_id" TEXT NOT NULL,
  "principal_user_id" TEXT,
  "scope_type" TEXT NOT NULL,
  "grant_type" TEXT NOT NULL,
  "access_level" TEXT NOT NULL DEFAULT 'manage',
  "valid_from" TIMESTAMP(3) NOT NULL,
  "valid_to" TIMESTAMP(3),
  "reason" TEXT,
  "granted_by_user_id" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "operational_access_grants_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "operational_access_grants"
  ADD CONSTRAINT "operational_access_grants_grantee_user_id_fkey"
  FOREIGN KEY ("grantee_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_access_grants"
  ADD CONSTRAINT "operational_access_grants_principal_user_id_fkey"
  FOREIGN KEY ("principal_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operational_access_grants"
  ADD CONSTRAINT "operational_access_grants_granted_by_user_id_fkey"
  FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "operational_access_grants_grantee_user_id_is_active_idx"
  ON "operational_access_grants"("grantee_user_id", "is_active");

CREATE INDEX "operational_access_grants_principal_user_id_idx"
  ON "operational_access_grants"("principal_user_id");

CREATE INDEX "operational_access_grants_grant_type_scope_type_idx"
  ON "operational_access_grants"("grant_type", "scope_type");

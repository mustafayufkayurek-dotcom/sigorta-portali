-- Tedarikçi kayıt sahibi (mevcut kayıtlar null kalır)
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendors_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE "vendors"
      ADD CONSTRAINT "vendors_created_by_user_id_fkey"
      FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "vendors_created_by_user_id_idx" ON "vendors"("created_by_user_id");

-- Finans rolü tedarikçi listesi ve kayıt için vendor izinleri
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role_records.id, permission_records.id
FROM (
  VALUES
    ('finance', 'vendor.view'),
    ('finance', 'vendor.create'),
    ('finance', 'vendor.update')
) AS role_permission_data(role_code, permission_code)
JOIN "roles" role_records
  ON role_records."code" = role_permission_data.role_code
JOIN "permissions" permission_records
  ON permission_records."code" = role_permission_data.permission_code
WHERE NOT EXISTS (
  SELECT 1
  FROM "role_permissions" existing_role_permissions
  WHERE existing_role_permissions."role_id" = role_records.id
    AND existing_role_permissions."permission_id" = permission_records.id
);

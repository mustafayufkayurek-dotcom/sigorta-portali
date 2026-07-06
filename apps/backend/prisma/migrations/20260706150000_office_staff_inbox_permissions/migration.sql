-- office_staff ve manager rollerine Gelen Kutusu görüntüleme/yönetme yetkisi
-- Idempotent: WHERE NOT EXISTS ile tekrar çalıştırılabilir

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role_records.id, permission_records.id
FROM (
  VALUES
    ('office_staff', 'operation_inbox.view'),
    ('office_staff', 'operation_inbox.manage'),
    ('manager', 'operation_inbox.view'),
    ('manager', 'operation_inbox.manage')
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

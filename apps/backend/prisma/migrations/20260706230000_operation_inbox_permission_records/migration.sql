-- Operasyon Gelen Kutusu: permission kayıtları + rol atamaları
-- Önceki migration'lar yalnızca role_permissions ekliyordu; permissions tablosunda
-- operation_inbox.* kayıtları yoksa JOIN 0 satır döndürüyordu (canlı 403 kök nedeni).

INSERT INTO "permissions" ("id", "code", "name", "module", "action", "created_at", "updated_at")
SELECT gen_random_uuid(), permission_data.code, permission_data.name, permission_data.module, permission_data.action, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('operation_inbox.view', 'Gelen Kutusunu Görüntüle', 'operation_inbox', 'view'),
    ('operation_inbox.manage', 'Gelen Kutusunu Yönet', 'operation_inbox', 'manage'),
    ('operation_inbox.settings', 'Gelen Kutusu Ayarları', 'operation_inbox', 'settings')
) AS permission_data(code, name, module, action)
WHERE NOT EXISTS (
  SELECT 1
  FROM "permissions" existing_permissions
  WHERE existing_permissions."code" = permission_data.code
);

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role_records.id, permission_records.id
FROM (
  VALUES
    ('admin', 'operation_inbox.view'),
    ('admin', 'operation_inbox.manage'),
    ('admin', 'operation_inbox.settings'),
    ('office_staff', 'operation_inbox.view'),
    ('office_staff', 'operation_inbox.manage'),
    ('manager', 'operation_inbox.view'),
    ('manager', 'operation_inbox.manage'),
    ('finance', 'operation_inbox.view'),
    ('finance', 'operation_inbox.manage'),
    ('accountant', 'operation_inbox.view')
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

-- Demo eğitim geri bildirimi: office_staff eksik yetkiler (dosya atama, evrak, rapor, tedarikçi güncelleme)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role_records.id, permission_records.id
FROM (
  VALUES
    ('office_staff', 'claim_file.assign'),
    ('office_staff', 'vendor.update'),
    ('office_staff', 'document.view'),
    ('office_staff', 'document.upload'),
    ('office_staff', 'report.view')
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

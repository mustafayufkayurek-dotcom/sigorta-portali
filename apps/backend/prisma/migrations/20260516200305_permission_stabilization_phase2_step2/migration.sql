INSERT INTO "permissions" ("id", "code", "name", "module", "action", "created_at", "updated_at")
SELECT gen_random_uuid(), permission_data.code, permission_data.name, permission_data.module, permission_data.action, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('adjuster.assign', 'Eksper Ata', 'adjuster', 'assign'),
    ('adjuster.create', 'Eksper Oluştur', 'adjuster', 'create'),
    ('adjuster.delete', 'Eksper Sil', 'adjuster', 'delete'),
    ('adjuster.report.create', 'Eksper Raporu Oluştur', 'adjuster_report', 'create'),
    ('adjuster.report.review', 'Eksper Raporu İncele', 'adjuster_report', 'review'),
    ('adjuster.update', 'Eksper Güncelle', 'adjuster', 'update'),
    ('adjuster.view', 'Eksperleri Görüntüle', 'adjuster', 'view'),
    ('audit_log.view', 'Denetim Kayıtlarını Görüntüle', 'audit_log', 'view'),
    ('budget.create', 'Bütçe Oluştur', 'budget', 'create'),
    ('budget.review', 'Bütçe İncele', 'budget', 'review'),
    ('budget.submit', 'Bütçe Gönder', 'budget', 'submit'),
    ('budget.update', 'Bütçe Güncelle', 'budget', 'update'),
    ('budget.view', 'Bütçeleri Görüntüle', 'budget', 'view'),
    ('report.create', 'Rapor Oluştur', 'report', 'create'),
    ('role.manage', 'Rolleri Yönet', 'role', 'manage'),
    ('settings.manage', 'Ayarları Yönet', 'settings', 'manage'),
    ('settings.view', 'Ayarları Görüntüle', 'settings', 'view'),
    ('system.manage', 'Sistemi Yönet', 'system', 'manage'),
    ('vendor_statement.create', 'Tedarikçi Ekstresi Oluştur', 'vendor_statement', 'create'),
    ('vendor_statement.manage', 'Tedarikçi Ekstresi Yönet', 'vendor_statement', 'manage'),
    ('vendor_statement.view', 'Tedarikçi Ekstrelerini Görüntüle', 'vendor_statement', 'view'),
    ('vendor.create', 'Tedarikçi Oluştur', 'vendor', 'create'),
    ('vendor.delete', 'Tedarikçi Sil', 'vendor', 'delete'),
    ('vendor.update', 'Tedarikçi Güncelle', 'vendor', 'update'),
    ('vendor.view', 'Tedarikçileri Görüntüle', 'vendor', 'view')
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
    ('admin', 'adjuster.assign'),
    ('admin', 'adjuster.create'),
    ('admin', 'adjuster.delete'),
    ('admin', 'adjuster.report.create'),
    ('admin', 'adjuster.report.review'),
    ('admin', 'adjuster.update'),
    ('admin', 'adjuster.view'),
    ('manager', 'adjuster.assign'),
    ('manager', 'adjuster.create'),
    ('manager', 'adjuster.delete'),
    ('manager', 'adjuster.report.create'),
    ('manager', 'adjuster.report.review'),
    ('manager', 'adjuster.update'),
    ('manager', 'adjuster.view'),
    ('office_staff', 'adjuster.assign'),
    ('office_staff', 'adjuster.view'),
    ('admin', 'budget.create'),
    ('admin', 'budget.review'),
    ('admin', 'budget.submit'),
    ('admin', 'budget.update'),
    ('admin', 'budget.view'),
    ('manager', 'budget.create'),
    ('manager', 'budget.submit'),
    ('manager', 'budget.update'),
    ('manager', 'budget.view'),
    ('finance', 'budget.create'),
    ('finance', 'budget.review'),
    ('finance', 'budget.submit'),
    ('finance', 'budget.update'),
    ('finance', 'budget.view'),
    ('office_staff', 'budget.view'),
    ('admin', 'vendor.create'),
    ('admin', 'vendor.delete'),
    ('admin', 'vendor.update'),
    ('admin', 'vendor.view'),
    ('manager', 'vendor.create'),
    ('manager', 'vendor.update'),
    ('manager', 'vendor.view'),
    ('office_staff', 'vendor.create'),
    ('office_staff', 'vendor.view'),
    ('admin', 'vendor_statement.create'),
    ('admin', 'vendor_statement.manage'),
    ('admin', 'vendor_statement.view'),
    ('manager', 'vendor_statement.create'),
    ('manager', 'vendor_statement.view'),
    ('finance', 'vendor_statement.create'),
    ('finance', 'vendor_statement.manage'),
    ('finance', 'vendor_statement.view'),
    ('admin', 'audit_log.view'),
    ('admin', 'report.create'),
    ('manager', 'report.create'),
    ('office_staff', 'report.create'),
    ('adjuster', 'report.create'),
    ('admin', 'role.manage'),
    ('admin', 'settings.manage'),
    ('admin', 'settings.view'),
    ('admin', 'system.manage')
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
-- Tek seferlik: assigned_office_user_id boş kalan hasar dosyalarını oluşturana ata.
-- Deploy öncesi/sonrası sunucuda psql ile çalıştırın. Önce SELECT ile doğrulayın.
--
-- Örnek (dry-run):
--   psql "$DATABASE_URL" -f scripts/backfill-orphan-claim-office-assignments.sql
--
-- Sadece önizleme:
SELECT cf.id, cf.file_no, cf.customer_id, h.changed_by_user_id AS proposed_assignee
FROM claim_files cf
JOIN LATERAL (
  SELECT changed_by_user_id
  FROM claim_status_history
  WHERE claim_file_id = cf.id AND note = 'Dosya oluşturuldu'
  ORDER BY changed_at ASC
  LIMIT 1
) h ON true
JOIN users u ON u.id = h.changed_by_user_id
JOIN roles r ON r.id = u.role_id
WHERE cf.assigned_office_user_id IS NULL
  AND cf.assigned_field_user_id IS NULL
  AND LOWER(r.code) = 'office_staff';

-- Güncelleme (yukarıdaki sonuçları onayladıktan sonra):
-- UPDATE claim_files cf
-- SET
--   assigned_office_user_id = h.changed_by_user_id,
--   current_responsible_user_id = COALESCE(cf.current_responsible_user_id, h.changed_by_user_id),
--   current_responsible_role = COALESCE(cf.current_responsible_role, 'operasyon_sorumlusu'),
--   updated_at = NOW()
-- FROM (
--   SELECT DISTINCT ON (claim_file_id) claim_file_id, changed_by_user_id
--   FROM claim_status_history
--   WHERE note = 'Dosya oluşturuldu'
--   ORDER BY claim_file_id, changed_at ASC
-- ) h
-- JOIN users u ON u.id = h.changed_by_user_id
-- JOIN roles r ON r.id = u.role_id
-- WHERE cf.id = h.claim_file_id
--   AND cf.assigned_office_user_id IS NULL
--   AND cf.assigned_field_user_id IS NULL
--   AND LOWER(r.code) = 'office_staff';

-- Saha «Dosyayı Kapat» ofis dosyasını kapatmış kayıtları geri açar.
-- Yalnız hâlâ closed olan + notu «Saha tespiti sonrası dosya kapatıldı.» olanlar.
-- Tespit (site_visit_done) durur. Kapanış dosya sorumlusunundur.
-- Idempotent.

BEGIN;

WITH victims AS (
  SELECT DISTINCT ON (h.claim_file_id)
    h.claim_file_id,
    h.from_status_id
  FROM claim_status_history h
  JOIN claim_files cf ON cf.id = h.claim_file_id
  JOIN claim_statuses cs ON cs.id = cf.current_status_id
  WHERE h.note = 'Saha tespiti sonrası dosya kapatıldı.'
    AND cs.code = 'closed'
    AND cs.is_closed_state = true
    AND h.from_status_id IS NOT NULL
  ORDER BY h.claim_file_id, h.changed_at DESC
),
actor AS (
  SELECT u.id
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE r.code = 'admin'
    AND concat_ws(' ', u.first_name, u.last_name) = 'Sistem Yöneticisi'
  LIMIT 1
),
closed_status AS (
  SELECT id FROM claim_statuses WHERE code = 'closed' LIMIT 1
),
upd AS (
  UPDATE claim_files cf
  SET
    current_status_id = v.from_status_id,
    closed_at = NULL,
    last_activity_at = NOW(),
    last_human_action_at = NOW(),
    updated_at = NOW()
  FROM victims v
  WHERE cf.id = v.claim_file_id
  RETURNING cf.id, v.from_status_id
),
hist AS (
  INSERT INTO claim_status_history (
    id, claim_file_id, from_status_id, to_status_id, changed_by_user_id, note
  )
  SELECT
    gen_random_uuid(),
    u.id,
    (SELECT id FROM closed_status),
    u.from_status_id,
    (SELECT id FROM actor),
    'Saha kapatması ofis dosyasını kapatmaz; tespit tamam, dosya açık.'
  FROM upd u
  WHERE (SELECT id FROM actor) IS NOT NULL
  RETURNING claim_file_id
),
act AS (
  INSERT INTO file_activity_logs (
    id, claim_file_id, action, actor_id, actor_role, description, metadata, created_at
  )
  SELECT
    gen_random_uuid(),
    u.id,
    'STATUS_CHANGED',
    (SELECT id FROM actor),
    'admin',
    'Saha kapatması ofis dosyasını kapatmaz; tespit tamam, dosya açık.',
    jsonb_build_object('repair', 'saha-field-close-reopen', 'toStatusFromHistory', true),
    NOW()
  FROM upd u
  WHERE (SELECT id FROM actor) IS NOT NULL
  RETURNING claim_file_id
)
UPDATE survey_campaigns sc
SET
  status = 'expired',
  updated_at = NOW()
FROM upd u
WHERE sc.claim_file_id = u.id
  AND sc.status IN ('pending', 'sent')
  AND sc.completed_at IS NULL;

COMMIT;

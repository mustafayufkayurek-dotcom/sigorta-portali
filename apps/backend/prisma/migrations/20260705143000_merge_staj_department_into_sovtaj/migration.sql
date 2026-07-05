-- Yanlışlıkla oluşturulmuş "Staj" departmanını kanonik "Sovtaj" ile birleştir.
-- ensureKonuTabDepartments eskiden staj kaydı oluşturuyordu; UI düzeltildi ama DB kaydı kaldı.

DO $$
DECLARE
  staj_id UUID;
  sovtaj_id UUID;
  staj_id_text TEXT;
  sovtaj_id_text TEXT;
BEGIN
  SELECT id INTO staj_id
  FROM departments
  WHERE status = 'active'
    AND (LOWER(code) = 'staj' OR LOWER(name) = 'staj')
  ORDER BY created_at ASC
  LIMIT 1;

  IF staj_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO sovtaj_id FROM departments WHERE code = 'sovtaj' LIMIT 1;

  IF sovtaj_id IS NULL THEN
    UPDATE departments
    SET
      code = 'sovtaj',
      name = 'Sovtaj',
      description = 'Sovtaj operasyon departmanı',
      color = '#10B981',
      sort_order = 3,
      is_system = true,
      status = 'active'
    WHERE id = staj_id;
    RETURN;
  END IF;

  IF staj_id = sovtaj_id THEN
    RETURN;
  END IF;

  staj_id_text := staj_id::text;
  sovtaj_id_text := sovtaj_id::text;

  UPDATE claim_files SET department_id = sovtaj_id_text WHERE department_id = staj_id_text;
  UPDATE repair_reports SET department_id = sovtaj_id_text WHERE department_id = staj_id_text;
  UPDATE hr_employee_profiles SET department_id = sovtaj_id_text WHERE department_id = staj_id_text;

  UPDATE user_department_memberships udm
  SET department_id = sovtaj_id_text
  WHERE department_id = staj_id_text
    AND NOT EXISTS (
      SELECT 1 FROM user_department_memberships x
      WHERE x.user_id = udm.user_id AND x.department_id = sovtaj_id_text
    );
  DELETE FROM user_department_memberships WHERE department_id = staj_id_text;

  UPDATE claim_responsibility_assignments SET department_id = sovtaj_id_text WHERE department_id = staj_id_text;

  UPDATE department_file_subjects dfs
  SET department_id = sovtaj_id_text
  WHERE department_id = staj_id_text
    AND NOT EXISTS (
      SELECT 1 FROM department_file_subjects x
      WHERE x.department_id = sovtaj_id_text AND x.code = dfs.code
    );
  DELETE FROM department_file_subjects WHERE department_id = staj_id_text;

  UPDATE report_field_configs rfc
  SET department_id = sovtaj_id_text
  WHERE department_id = staj_id_text
    AND NOT EXISTS (
      SELECT 1 FROM report_field_configs x
      WHERE x.department_id = sovtaj_id_text
        AND x.report_format = rfc.report_format
        AND x.field_key = rfc.field_key
    );
  DELETE FROM report_field_configs WHERE department_id = staj_id_text;

  UPDATE document_types dt
  SET department_ids = sub.next_ids
  FROM (
    SELECT
      dt2.id,
      COALESCE(
        jsonb_agg(DISTINCT CASE WHEN elem = staj_id_text THEN sovtaj_id_text ELSE elem END),
        '[]'::jsonb
      ) AS next_ids
    FROM document_types dt2
    CROSS JOIN LATERAL jsonb_array_elements_text(dt2.department_ids) elem
    WHERE dt2.department_ids @> to_jsonb(staj_id_text)
    GROUP BY dt2.id
  ) sub
  WHERE dt.id = sub.id;

  UPDATE departments
  SET
    status = 'inactive',
    code = 'staj-legacy-' || LEFT(staj_id::text, 8),
    updated_at = NOW()
  WHERE id = staj_id;

  UPDATE departments
  SET
    name = 'Sovtaj',
    description = COALESCE(description, 'Sovtaj operasyon departmanı'),
    color = '#10B981',
    sort_order = LEAST(sort_order, 3),
    is_system = true,
    status = 'active',
    updated_at = NOW()
  WHERE id = sovtaj_id;
END $$;

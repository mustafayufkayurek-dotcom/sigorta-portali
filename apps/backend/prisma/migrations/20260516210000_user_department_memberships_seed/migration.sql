-- Adım 3: user_department_memberships seed
-- Gerçek operasyon modeline göre (danışman onaylı, 16 Mayıs 2026)
-- Idempotent: WHERE NOT EXISTS ile tekrar çalıştırılabilir

-- 1. Admin (admin@meridyenassistance.com) → Tümü, birincil yok (global admin)
INSERT INTO user_department_memberships (id, user_id, department_id, role_scope, is_primary, is_active, created_at, updated_at)
SELECT gen_random_uuid(), u.id, d.id, 'all', false, true, NOW(), NOW()
FROM users u, departments d
WHERE u.email = 'admin@meridyenassistance.com'
AND NOT EXISTS (
  SELECT 1 FROM user_department_memberships m WHERE m.user_id = u.id AND m.department_id = d.id
);

-- 2. Seda Yufkayürek / Finans → Tümü, birincil: cross-department (finans bağımsız)
INSERT INTO user_department_memberships (id, user_id, department_id, role_scope, is_primary, is_active, created_at, updated_at)
SELECT gen_random_uuid(), u.id, d.id, 'finance_cross', false, true, NOW(), NOW()
FROM users u, departments d
WHERE u.email = 'seda.yufkayurek@safranbh.com'
AND NOT EXISTS (
  SELECT 1 FROM user_department_memberships m WHERE m.user_id = u.id AND m.department_id = d.id
);

-- 3. Aslı Güngör / Ofis Personeli → Hasar Onarım (birincil), Acil Yardım, Sovtaj
INSERT INTO user_department_memberships (id, user_id, department_id, role_scope, is_primary, is_active, created_at, updated_at)
SELECT gen_random_uuid(), u.id, d.id, 'operations',
  CASE WHEN d.code = 'hasar-onarim' THEN true ELSE false END,
  true, NOW(), NOW()
FROM users u, departments d
WHERE u.email = 'asli.gungor@safranbh.com'
AND NOT EXISTS (
  SELECT 1 FROM user_department_memberships m WHERE m.user_id = u.id AND m.department_id = d.id
);

-- 4. Saha Tespit / Saha Personeli → Hasar Onarım (birincil), Acil Yardım, Sovtaj
INSERT INTO user_department_memberships (id, user_id, department_id, role_scope, is_primary, is_active, created_at, updated_at)
SELECT gen_random_uuid(), u.id, d.id, 'field',
  CASE WHEN d.code = 'hasar-onarim' THEN true ELSE false END,
  true, NOW(), NOW()
FROM users u, departments d
WHERE u.email = 'hasar@safranbh.com'
AND NOT EXISTS (
  SELECT 1 FROM user_department_memberships m WHERE m.user_id = u.id AND m.department_id = d.id
);

-- 5. Ahmet Eksper / Eksper Portalı → Hasar Onarım (birincil), Sovtaj (Acil Yardım HARİÇ)
INSERT INTO user_department_memberships (id, user_id, department_id, role_scope, is_primary, is_active, created_at, updated_at)
SELECT gen_random_uuid(), u.id, d.id, 'expert',
  CASE WHEN d.code = 'hasar-onarim' THEN true ELSE false END,
  true, NOW(), NOW()
FROM users u, departments d
WHERE u.email = 'mustafayufkayurek@gmail.com'
AND d.code IN ('hasar-onarim', 'sovtaj')
AND NOT EXISTS (
  SELECT 1 FROM user_department_memberships m WHERE m.user_id = u.id AND m.department_id = d.id
);

-- 6. Mehmet Sigorta / Sigorta Şirketi → Departman bağımsız, membership OLUŞTURULMAYACAK
-- (Danışman notu: departman üyeliğine bağlanmayacaktır)

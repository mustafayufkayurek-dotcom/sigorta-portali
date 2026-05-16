-- Adım 4: claim_responsibility_assignments seed
-- Danışman onaylı: 6 kayıt, countrywide, all coverage, aktif
-- Idempotent: WHERE NOT EXISTS

-- Aslı Güngör → Hasar Onarım
INSERT INTO claim_responsibility_assignments (id, user_id, department_id, region_type, region_values, coverage_type, coverage_config, priority, is_active, created_at, updated_at)
SELECT gen_random_uuid(), u.id, d.id, 'countrywide', '[]'::jsonb, 'all', '{}'::jsonb, 50, true, NOW(), NOW()
FROM users u, departments d
WHERE u.email = 'asli.gungor@safranbh.com' AND d.code = 'hasar-onarim'
AND NOT EXISTS (SELECT 1 FROM claim_responsibility_assignments c WHERE c.user_id = u.id AND c.department_id = d.id);

-- Aslı Güngör → Acil Yardım
INSERT INTO claim_responsibility_assignments (id, user_id, department_id, region_type, region_values, coverage_type, coverage_config, priority, is_active, created_at, updated_at)
SELECT gen_random_uuid(), u.id, d.id, 'countrywide', '[]'::jsonb, 'all', '{}'::jsonb, 50, true, NOW(), NOW()
FROM users u, departments d
WHERE u.email = 'asli.gungor@safranbh.com' AND d.code = 'acil-yardim'
AND NOT EXISTS (SELECT 1 FROM claim_responsibility_assignments c WHERE c.user_id = u.id AND c.department_id = d.id);

-- Aslı Güngör → Sovtaj
INSERT INTO claim_responsibility_assignments (id, user_id, department_id, region_type, region_values, coverage_type, coverage_config, priority, is_active, created_at, updated_at)
SELECT gen_random_uuid(), u.id, d.id, 'countrywide', '[]'::jsonb, 'all', '{}'::jsonb, 50, true, NOW(), NOW()
FROM users u, departments d
WHERE u.email = 'asli.gungor@safranbh.com' AND d.code = 'sovtaj'
AND NOT EXISTS (SELECT 1 FROM claim_responsibility_assignments c WHERE c.user_id = u.id AND c.department_id = d.id);

-- Saha Tespit → Hasar Onarım
INSERT INTO claim_responsibility_assignments (id, user_id, department_id, region_type, region_values, coverage_type, coverage_config, priority, is_active, created_at, updated_at)
SELECT gen_random_uuid(), u.id, d.id, 'countrywide', '[]'::jsonb, 'all', '{}'::jsonb, 50, true, NOW(), NOW()
FROM users u, departments d
WHERE u.email = 'hasar@safranbh.com' AND d.code = 'hasar-onarim'
AND NOT EXISTS (SELECT 1 FROM claim_responsibility_assignments c WHERE c.user_id = u.id AND c.department_id = d.id);

-- Saha Tespit → Acil Yardım
INSERT INTO claim_responsibility_assignments (id, user_id, department_id, region_type, region_values, coverage_type, coverage_config, priority, is_active, created_at, updated_at)
SELECT gen_random_uuid(), u.id, d.id, 'countrywide', '[]'::jsonb, 'all', '{}'::jsonb, 50, true, NOW(), NOW()
FROM users u, departments d
WHERE u.email = 'hasar@safranbh.com' AND d.code = 'acil-yardim'
AND NOT EXISTS (SELECT 1 FROM claim_responsibility_assignments c WHERE c.user_id = u.id AND c.department_id = d.id);

-- Saha Tespit → Sovtaj
INSERT INTO claim_responsibility_assignments (id, user_id, department_id, region_type, region_values, coverage_type, coverage_config, priority, is_active, created_at, updated_at)
SELECT gen_random_uuid(), u.id, d.id, 'countrywide', '[]'::jsonb, 'all', '{}'::jsonb, 50, true, NOW(), NOW()
FROM users u, departments d
WHERE u.email = 'hasar@safranbh.com' AND d.code = 'sovtaj'
AND NOT EXISTS (SELECT 1 FROM claim_responsibility_assignments c WHERE c.user_id = u.id AND c.department_id = d.id);

UPDATE "user_department_memberships"
SET "is_primary" = false;

UPDATE "user_department_memberships" udm
SET "is_primary" = true
FROM "users" u
JOIN "departments" d ON d."code" = 'hasar-onarim'
WHERE udm."user_id" = u."id"
  AND udm."department_id" = d."id"
  AND u."email" IN (
    'admin@meridyenassistance.com',
    'seda.yufkayurek@safranbh.com',
    'asli.gungor@safranbh.com',
    'hasar@safranbh.com',
    'mustafayufkayurek@gmail.com'
  );
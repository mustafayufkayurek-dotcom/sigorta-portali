-- Hızlı Onarım kalemlerini Ayarlar İş Grubu / İş Alt Grubu hiyerarşisine taşı
-- (eski sentetik work_groups.code = hizli_onarim)

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'boya_isleri'
  AND (wsg.code LIKE 'BOYA_%' OR wsg.code LIKE 'CEPHE_%');

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'siva_isleri'
  AND wsg.code LIKE 'SIVA_%';

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'elektrik'
  AND wsg.code LIKE 'ELK_%';

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'pvc_dograma'
  AND (wsg.code LIKE 'KAPI_%' OR wsg.code LIKE 'PNC_%');

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'temizlik'
  AND (wsg.code LIKE 'TMZ_%' OR wsg.code LIKE 'KUF_%');

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'mobilya'
  AND wsg.code LIKE 'DOLAP_%';

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'cati'
  AND (wsg.code LIKE 'CATI_%' OR wsg.code LIKE 'OLUK_%');

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'diger'
  AND (wsg.code LIKE 'YAP_%' OR wsg.code LIKE 'KOLON_%' OR wsg.code LIKE 'TEM_%' OR wsg.code LIKE 'SONDURME_%' OR wsg.code LIKE 'BAHC_%');

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'teknik_temizlik'
  AND wsg.code LIKE 'NEM_%';

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'sihhi_tesisat'
  AND wsg.code LIKE 'TST_%';

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'parke'
  AND wsg.code LIKE 'ZEMIN_%';

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'duvar_isleri'
  AND wsg.code LIKE 'DUV_%';

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'demir_dograma'
  AND wsg.code LIKE 'BARI_%';

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'cam_isleri'
  AND wsg.code LIKE 'CAM_%';

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'izolasyon_yalitim'
  AND (wsg.code LIKE 'YALT_%' OR wsg.code LIKE 'IZOL_%');

UPDATE "work_sub_groups" AS wsg
SET "work_group_id" = wg.id, "updated_at" = CURRENT_TIMESTAMP
FROM "work_groups" AS wg
WHERE wg.code = 'mekanik'
  AND wsg.code LIKE 'MAK_%';

-- Sentetik Hızlı Onarım grubunu pasife al (UI / Ayarlar listesinde görünmesin)
UPDATE "work_groups"
SET "status" = 'inactive', "name" = 'Hızlı Onarım Türü (Eski)', "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'hizli_onarim';

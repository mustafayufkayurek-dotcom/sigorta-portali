INSERT INTO "document_types" ("id", "code", "name", "description", "is_required", "sort_order", "status", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'DOC-00001', 'Hasar Tespit Raporu', NULL, false, 1, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00002', 'Eksper Raporu', NULL, false, 2, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00003', 'Poliçe Fotokopisi', NULL, false, 3, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00004', 'Kimlik Fotokopisi', NULL, false, 4, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00005', 'Onarım Faturası', NULL, false, 5, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00006', 'Fotoğraflar (Hasar Öncesi)', NULL, false, 6, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00007', 'Fotoğraflar (Hasar Sonrası)', NULL, false, 7, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00008', 'Keşif Raporu', NULL, false, 8, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00009', 'Teklif/Proforma', NULL, false, 9, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00010', 'Ödeme Dekontu', NULL, false, 10, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00011', 'Tutanak', NULL, false, 11, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00012', 'Vekaletname', NULL, false, 12, 'active', NOW(), NOW()),
  (gen_random_uuid(), 'DOC-00013', 'Diğer', NULL, false, 13, 'active', NOW(), NOW())
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "sort_order" = EXCLUDED."sort_order",
    "status" = 'active',
    "updated_at" = NOW();
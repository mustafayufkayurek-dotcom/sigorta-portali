-- Rapor kalemi kategorisi (Bina, Eşya, MM) — mahal/bölge gibi ayardan eklenir
CREATE TABLE IF NOT EXISTS "repair_damage_categories" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "repair_damage_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "repair_damage_categories_code_key" ON "repair_damage_categories"("code");
CREATE INDEX IF NOT EXISTS "repair_damage_categories_status_idx" ON "repair_damage_categories"("status");

INSERT INTO "repair_damage_categories" ("id", "code", "name", "description", "sort_order", "status", "created_at", "updated_at")
VALUES
  ('rdc-bina', 'bina', 'Bina', 'Asıl bina hasarı', 0, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rdc-esya', 'esya', 'Eşya', 'Eşya hasarı', 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rdc-mm', 'mm', 'Mali Mesuliyet', 'Mali mesuliyet — raporda MM', 2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

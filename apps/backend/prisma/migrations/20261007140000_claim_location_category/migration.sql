-- Mahal, rapor kategorisine bağlanır (Bina / Eşya / MM)
ALTER TABLE "claim_locations" ADD COLUMN IF NOT EXISTS "category_id" TEXT;

CREATE INDEX IF NOT EXISTS "claim_locations_category_id_idx" ON "claim_locations"("category_id");

DO $$ BEGIN
  ALTER TABLE "claim_locations"
    ADD CONSTRAINT "claim_locations_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "repair_damage_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE "claim_locations" AS loc
SET "category_id" = cat.id
FROM "repair_damage_categories" AS cat
WHERE loc."parent_id" IS NULL
  AND loc."category_id" IS NULL
  AND cat."code" = 'bina';

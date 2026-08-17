ALTER TABLE "test_notes"
  ADD COLUMN "manager_islem_notu" TEXT,
  ADD COLUMN "islem_tarihi" TIMESTAMP(3);

ALTER TABLE "work_items"
  ADD COLUMN "manager_islem_notu" TEXT,
  ADD COLUMN "islem_tarihi" TIMESTAMP(3);

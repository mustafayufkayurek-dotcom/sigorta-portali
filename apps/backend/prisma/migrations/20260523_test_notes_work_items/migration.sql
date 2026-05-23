CREATE TYPE "WorkItemSource" AS ENUM ('TEST_NOTU', 'KULLANICI_TALEBI', 'TEKNIK', 'DANISMAN');
CREATE TYPE "WorkPriority" AS ENUM ('P0', 'P1', 'P2', 'KARAR_GEREKLI');
CREATE TYPE "WorkItemStatus" AS ENUM ('ACIK', 'DEVAM_EDIYOR', 'TAMAMLANDI', 'IPTAL');
CREATE TYPE "TestNoteStatus" AS ENUM ('YENI', 'INCELEMEDE', 'DUZELTME_BEKLIYOR', 'CANLIDA', 'KABUL', 'BACKLOG');

CREATE TABLE "work_items" (
  "id" TEXT NOT NULL,
  "sira_no" SERIAL NOT NULL,
  "konu" TEXT NOT NULL,
  "kaynak" "WorkItemSource" NOT NULL,
  "oncelik" "WorkPriority" NOT NULL,
  "sorumlu_id" TEXT,
  "hedef_tarih" TIMESTAMP(3),
  "hatirlatma_tarih" TIMESTAMP(3),
  "durum" "WorkItemStatus" NOT NULL DEFAULT 'ACIK',
  "kullanici_yorumu" TEXT,
  "kanit" TEXT,
  "kapanis_notu" TEXT,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "test_notes" (
  "id" TEXT NOT NULL,
  "test_no" TEXT NOT NULL,
  "ekran_modul" TEXT NOT NULL,
  "kullanici_gozlemi" TEXT NOT NULL,
  "beklenen_davranis" TEXT NOT NULL,
  "ekran_goruntusu" TEXT,
  "oncelik" "WorkPriority" NOT NULL,
  "durum" "TestNoteStatus" NOT NULL DEFAULT 'YENI',
  "tekrar_durumu" BOOLEAN NOT NULL DEFAULT false,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "test_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "test_note_formats" (
  "id" TEXT NOT NULL,
  "test_note_id" TEXT NOT NULL,
  "sorun_ozeti" TEXT NOT NULL,
  "beklenen_davranis" TEXT NOT NULL,
  "etki_sinifi" TEXT NOT NULL,
  "oncelik" "WorkPriority" NOT NULL,
  "muhendislik_talimati" TEXT NOT NULL,
  "kabul_kriteri" TEXT NOT NULL,
  "kanit_beklentisi" TEXT NOT NULL,
  "onayli" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "test_note_formats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_items_sira_no_key" ON "work_items"("sira_no");
CREATE INDEX "work_items_durum_idx" ON "work_items"("durum");
CREATE INDEX "work_items_oncelik_idx" ON "work_items"("oncelik");
CREATE INDEX "work_items_sorumlu_id_idx" ON "work_items"("sorumlu_id");

CREATE UNIQUE INDEX "test_notes_test_no_key" ON "test_notes"("test_no");
CREATE INDEX "test_notes_durum_idx" ON "test_notes"("durum");
CREATE INDEX "test_notes_oncelik_idx" ON "test_notes"("oncelik");
CREATE INDEX "test_notes_created_by_id_idx" ON "test_notes"("created_by_id");

CREATE UNIQUE INDEX "test_note_formats_test_note_id_key" ON "test_note_formats"("test_note_id");

ALTER TABLE "work_items"
  ADD CONSTRAINT "work_items_sorumlu_id_fkey"
  FOREIGN KEY ("sorumlu_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "test_notes"
  ADD CONSTRAINT "test_notes_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "test_note_formats"
  ADD CONSTRAINT "test_note_formats_test_note_id_fkey"
  FOREIGN KEY ("test_note_id") REFERENCES "test_notes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
-- Dönem sonu kapanış bakiyeleri (yeni dönem / aktarım yok)

CREATE TABLE "finans_donem_kapanis" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "as_of_date" DATE NOT NULL,
    "note" TEXT,
    "closed_by_user_id" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finans_donem_kapanis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finans_donem_kapanis_year_key" ON "finans_donem_kapanis"("year");
CREATE INDEX "finans_donem_kapanis_closed_at_idx" ON "finans_donem_kapanis"("closed_at");

ALTER TABLE "finans_donem_kapanis"
  ADD CONSTRAINT "finans_donem_kapanis_closed_by_user_id_fkey"
  FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "finans_donem_kapanis_satir" (
    "id" TEXT NOT NULL,
    "kapanis_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_kind" TEXT NOT NULL,
    "toplam_borc" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "toplam_alacak" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_bakiye" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "finans_donem_kapanis_satir_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finans_donem_kapanis_satir_kapanis_id_idx" ON "finans_donem_kapanis_satir"("kapanis_id");
CREATE INDEX "finans_donem_kapanis_satir_account_id_idx" ON "finans_donem_kapanis_satir"("account_id");

ALTER TABLE "finans_donem_kapanis_satir"
  ADD CONSTRAINT "finans_donem_kapanis_satir_kapanis_id_fkey"
  FOREIGN KEY ("kapanis_id") REFERENCES "finans_donem_kapanis"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

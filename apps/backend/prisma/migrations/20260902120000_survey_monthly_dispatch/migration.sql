-- Aylık anket raporu otomatik gitmez. Personel sorar; yönetici onayından sonra gider.

CREATE TABLE "survey_monthly_dispatches" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "requested_by_user_id" TEXT,
  "requested_at" TIMESTAMP(3),
  "approved_by_user_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "survey_monthly_dispatches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "survey_monthly_dispatches_year_month_key"
  ON "survey_monthly_dispatches"("year", "month");

ALTER TABLE "survey_monthly_dispatches"
  ADD CONSTRAINT "survey_monthly_dispatches_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "survey_monthly_dispatches"
  ADD CONSTRAINT "survey_monthly_dispatches_approved_by_user_id_fkey"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

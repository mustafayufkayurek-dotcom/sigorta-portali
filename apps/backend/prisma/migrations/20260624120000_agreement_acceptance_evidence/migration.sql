-- Sözleşme onay delil zinciri: versiyon, hash ve içerik anlık görüntüsü
ALTER TABLE "agreement_acceptances" ADD COLUMN "accepted_version" TEXT;
ALTER TABLE "agreement_acceptances" ADD COLUMN "title_snapshot" TEXT;
ALTER TABLE "agreement_acceptances" ADD COLUMN "content_hash" TEXT;
ALTER TABLE "agreement_acceptances" ADD COLUMN "content_snapshot" TEXT;
ALTER TABLE "agreement_acceptances" ADD COLUMN "scrolled_at" TIMESTAMP(3);
ALTER TABLE "agreement_acceptances" ADD COLUMN "checkbox_confirmed_at" TIMESTAMP(3);

CREATE INDEX "agreement_acceptances_content_hash_idx" ON "agreement_acceptances"("content_hash");

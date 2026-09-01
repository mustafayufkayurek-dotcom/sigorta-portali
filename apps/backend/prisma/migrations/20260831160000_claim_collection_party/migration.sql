-- Hasar dosyası tahsilat tarafı: sigorta şirketi (varsayılan) | sigortalı ödemeli
ALTER TABLE "claim_files"
  ADD COLUMN "collection_party" TEXT NOT NULL DEFAULT 'insurance_company';

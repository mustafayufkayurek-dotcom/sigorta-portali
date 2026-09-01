-- Tahsilat tarafı: Finansa talep sonrası kilit. Yönetici dosyada açıp kapatır.
ALTER TABLE "claim_files"
  ADD COLUMN "collection_party_locked" BOOLEAN NOT NULL DEFAULT false;

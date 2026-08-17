-- Evrak türü "Diğer" seçildiğinde kullanıcının girdiği açıklama
ALTER TABLE "vendor_documents" ADD COLUMN IF NOT EXISTS "custom_label" TEXT;

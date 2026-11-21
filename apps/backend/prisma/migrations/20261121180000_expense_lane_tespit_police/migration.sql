-- Masraf Yolu: Ek Hizmetler — Hasar Tespit (dosya) ve Poliçe Yönetimi (müşteri)
ALTER TYPE "ExpenseOperationSubject" ADD VALUE IF NOT EXISTS 'HASAR_TESPIT';
ALTER TYPE "ExpenseOperationSubject" ADD VALUE IF NOT EXISTS 'POLICE_YONETIMI';

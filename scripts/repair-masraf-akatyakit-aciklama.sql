-- Masraf açıklama yazım: Akatyakıt → Akaryakıt (canlı + lokal)
-- Çalıştır: docker exec -i sigorta-postgres psql -U meridyen -d meridyen_db -v ON_ERROR_STOP=1 < scripts/repair-masraf-akatyakit-aciklama.sql

BEGIN;

UPDATE expenses
SET
  description = regexp_replace(description, 'akatyak[ıiİI]t', 'Akaryakıt', 'gi'),
  updated_at = CURRENT_TIMESTAMP
WHERE description ~* 'akatyak[ıiİI]t';

COMMIT;

SELECT COUNT(*) AS kalan_hatali
FROM expenses
WHERE description ~* 'akatyak[ıiİI]t';

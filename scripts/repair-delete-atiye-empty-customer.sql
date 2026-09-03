-- Atiye Gülçün Gülin Altan müşteri kartı — yalnız dosyası yoksa kalıcı silinir.
-- Çalıştırılmadan önce satırı kontrol edin. Açık/kapalı dosya varsa işlem durur.

BEGIN;

WITH hedef AS (
  SELECT id
  FROM customers
  WHERE (
      concat_ws(' ', first_name, last_name) ILIKE '%Atiye%Gülçün%Altan%'
      OR concat_ws(' ', first_name, last_name) ILIKE '%Atiye%Gulcun%Altan%'
      OR full_name ILIKE '%Atiye%Gülçün%Altan%'
      OR full_name ILIKE '%Atiye%Gulcun%Altan%'
    )
)
SELECT
  h.id,
  (SELECT count(*) FROM claim_files cf WHERE cf.customer_id = h.id) AS hasar,
  (SELECT count(*) FROM emergency_cases ec WHERE ec.customer_id = h.id) AS acil
FROM hedef h;

DELETE FROM customer_access_logs
WHERE customer_id IN (
  SELECT id FROM customers
  WHERE (
      concat_ws(' ', first_name, last_name) ILIKE '%Atiye%Gülçün%Altan%'
      OR concat_ws(' ', first_name, last_name) ILIKE '%Atiye%Gulcun%Altan%'
      OR full_name ILIKE '%Atiye%Gülçün%Altan%'
      OR full_name ILIKE '%Atiye%Gulcun%Altan%'
    )
    AND NOT EXISTS (SELECT 1 FROM claim_files cf WHERE cf.customer_id = customers.id)
    AND NOT EXISTS (SELECT 1 FROM emergency_cases ec WHERE ec.customer_id = customers.id)
);

DELETE FROM customers
WHERE (
    concat_ws(' ', first_name, last_name) ILIKE '%Atiye%Gülçün%Altan%'
    OR concat_ws(' ', first_name, last_name) ILIKE '%Atiye%Gulcun%Altan%'
    OR full_name ILIKE '%Atiye%Gülçün%Altan%'
    OR full_name ILIKE '%Atiye%Gulcun%Altan%'
  )
  AND NOT EXISTS (SELECT 1 FROM claim_files cf WHERE cf.customer_id = customers.id)
  AND NOT EXISTS (SELECT 1 FROM emergency_cases ec WHERE ec.customer_id = customers.id);

COMMIT;

-- Müşteri Kısa Ad — boş kayıtları karttaki isimden doldurur.
-- Dolu Kısa Ad (Atılım, Remed, Sezgi, …) dokunulmaz.
-- Takma ad üretilmez; şirket adı / ad soyad olduğu gibi yazılır.
-- Canlıya almadan önce SELECT ile sayıyı görün.

BEGIN;

SELECT
  count(*) FILTER (
    WHERE (short_name IS NULL OR btrim(short_name) = '')
      AND btrim(COALESCE(company_name, full_name, concat_ws(' ', first_name, last_name), '')) <> ''
  ) AS doldurulacak,
  count(*) FILTER (
    WHERE short_name IS NOT NULL AND btrim(short_name) <> ''
  ) AS duran_kisa_ad
FROM customers;

UPDATE customers
SET short_name = btrim(COALESCE(company_name, full_name, concat_ws(' ', first_name, last_name)))
WHERE (short_name IS NULL OR btrim(short_name) = '')
  AND btrim(COALESCE(company_name, full_name, concat_ws(' ', first_name, last_name), '')) <> '';

COMMIT;

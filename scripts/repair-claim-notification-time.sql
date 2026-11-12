-- Hasar ihbar tarihi gün olarak kaydedilmiş (UTC gece yarısı → ekranda 03:00) dosyalar.
-- Gün, dosyanın açıldığı İstanbul günüyse ihbar anı açılış anı olur.
-- Geçmiş güne girilmiş ihbar tarihi dokunulmaz. Idempotent.

BEGIN;

UPDATE claim_files cf
SET notification_date = cf.created_at
WHERE cf.notification_date = date_trunc('day', cf.notification_date)
  AND cf.notification_date::date
    = ((cf.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul')::date;

COMMIT;

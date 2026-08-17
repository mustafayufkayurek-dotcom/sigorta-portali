# Uploads Yedek ve Bütünlük (kalıcı)

**Olay (2026-08):** Onarım raporu fotoğrafları DB’de kayıtlıydı; disk dosyaları yoktu. Gece yedeği yalnız SQL alıyordu; offsite placeholder’dı. Portal duyurusu yapılmadığı için güven kaybı sınırlı kaldı — aynı sınıf bir daha yaşanmamalı.

## Ne korunur

| Katman | İçerik | Script |
|--------|--------|--------|
| DB | PostgreSQL dump | `scripts/backup.sh` |
| Uploads | `apps/backend/uploads` (rapor fotoğrafları vb.) | `scripts/backup-uploads.sh` (backup.sh sonunda da çağrılır) |
| Bütünlük | `report_images` ↔ disk | `scripts/verify-upload-integrity.sh` |
| Sağlık | Son DB + uploads arşivi taze/sağlam mı | `scripts/verify-backup-health.sh` |
| Offsite | İkinci disk / rclone | `scripts/offsite-backup.sh` |
| Geri yükleme | Arşivden | `scripts/restore-uploads-from-backup.sh` |

## Cron (sunucu — zorunlu)

```cron
0 2 * * * /opt/app/scripts/backup.sh >> /var/log/meridyen-backup.log 2>&1
15 2 * * * /opt/app/scripts/backup-uploads.sh >> /var/log/meridyen-uploads-backup.log 2>&1
30 2 * * * /opt/app/scripts/offsite-backup.sh >> /opt/app/logs/offsite-backup.log 2>&1
30 6 * * * /opt/app/scripts/verify-backup-health.sh >> /var/log/meridyen-backup-health.log 2>&1
45 6 * * * /opt/app/scripts/verify-upload-integrity.sh >> /var/log/meridyen-upload-integrity.log 2>&1
```

`backup.sh` zaten uploads yedeğini de çağırır; 15:02 satırı ek güvenlik (çift çalışma zararsız, retention ortak).

## Offsite yapılandırma

`.env.production` içine (tercihen ikinci disk):

```bash
OFFSITE_BACKUP_DIR=/mnt/offsite/meridyen
# veya
RCLONE_REMOTE=b2:meridyen-backups
```

Tanımsızsa script WARNING üretir; yerel ayna `/var/backups/meridyen/uploads` yine de tutulur (aynı disk riski sürer — ikinci disk şart).

## Deploy kuralları

1. `pre-deploy-safety.sh` deploy öncesi **uploads yedeği alır**; alamazsa deploy durur.
2. Backend rsync: `--exclude uploads` + `protect uploads/` — asla uploads’u `--delete` ile silme.
3. `REPORT_IMAGES_DIR=/app/apps/backend/uploads/report-images` (compose) — cwd sapması yok.

## Kurtarma

```bash
bash scripts/restore-uploads-from-backup.sh /opt/app/backups/uploads/uploads_YYYYMMDD_HHMMSS.tar.gz
bash scripts/verify-upload-integrity.sh
```

# B2 Erişim Kurtarma Listesi — Meridyen

**Tarih:** 2026-08-17  
**Bu dosyadaki komutlar örnektir. FAZ E’de çalıştırılmaz.**  
B2’ye bağlanma, silme, overwrite yok.

| # | Kontrol | Durum |
|---|---------|-------|
| 1 | B2 hesabına erişim var (web panel, 2FA) | ☐ |
| 2 | Application Key oluşturuldu (kasada; git’te yok) | ☐ |
| 3 | rclone remote yeniden oluşturulabilir (`type=b2`, bölüm adı kod varsayılanı `b2-offsite`) | ☐ |
| 4 | Bucket adı biliniyor (doküman örneği: `meridyen-backups`) | ☐ |
| 5 | DB backup yolu biliniyor: `db/` | ☐ |
| 6 | Upload backup yolu biliniyor: `uploads/` | ☐ |
| 7 | İlk restore komutu hazır (aşağıdaki örnek; tatbikat VPS’te onayla çalışır) | ☐ |

Remote adı canlıda `RCLONE_REMOTE` ile aynı olmalıdır. Aşağıda sabit örnek `b2:meridyen-backups` kullanılır.

## Örnek komutlar (çalıştırma — bu faz yok)

```bash
rclone lsd b2:meridyen-backups
rclone ls b2:meridyen-backups/db
rclone ls b2:meridyen-backups/uploads
```

FAZ 2 SUCCESS örnek nesneleri (ad; içerik yok):

```bash
rclone copy b2:meridyen-backups/db/backup_2026-08-17_11-56-54.sql.gz ./restore/
rclone copy b2:meridyen-backups/uploads/uploads_20260817_115702.tar.gz ./restore/
gzip -t ./restore/backup_2026-08-17_11-56-54.sql.gz
gzip -t ./restore/uploads_20260817_115702.tar.gz
```

20 byte’lık `backup_2026-08-17_02-00-01.sql.gz` restore kaynağı değildir.

Sonraki adımlar: `B2_RECOVERY_PLAN.md` (postgres 16, migrate yok, canlı DNS yok).

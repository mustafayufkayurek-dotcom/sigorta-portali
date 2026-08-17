# B2 Recovery Plan — Meridyen

**Tarih:** 2026-08-17  
**Yazma yok:** Bu belge B2’ye dokunmaz. İndirme yalnızca onaylı tatbikat / gerçek DR’de.

Remote: `RCLONE_REMOTE` (`.env.production` / rclone). Bucket kod varsayılanı: `meridyen-backups`.  
Kimlik: `rclone.conf` → `b2_api.py` (`account` + `key`). f005 HEAD kullanılmaz.

---

## Kurtarılacak dosyalar

| Prefix | İçerik | Restore hedefi |
|--------|--------|----------------|
| `db/` | `backup_YYYY-MM-DD_HH-MM-SS.sql.gz` | PostgreSQL (`sigorta-postgres`, **16**) |
| `uploads/` | `uploads_YYYYMMDD_HHMMSS.tar.gz` | `/opt/app/apps/backend/uploads` |

**Son bilinen SUCCESS (FAZ 2, 2026-08-17 — bu fazda yeniden listelenmedi):**

- `db/backup_2026-08-17_11-56-54.sql.gz`
- `uploads/uploads_20260817_115702.tar.gz`

**Kullanma:** `db/backup_2026-08-17_02-00-01.sql.gz` (20 byte, geçersiz gzip).

Ayrıca B2’de görüldü, **birincil DR değil:**

- `monthly/` — retention 12 ay kopyası (varsa)  
- `daily/` — eski GPG; güncel SUCCESS yolu şifresiz `db/`+`uploads/`  
- **Yok:** `application/`, `config/`, `recovery/`, Docker image

Seçim kuralı: `gzip -t` geçsin, boyut DB ≥ 10240 byte, uploads ≥ 100 byte, health SUCCESS / checksum kaydı varsa onu al. En yeni isim her zaman sağlıklı değildir.

---

## Kurtarma sırası

### 1. Yeni VPS hazırlanır

Linux + Docker + Compose v2 + `rclone` + `python3` + `git`. Dizin `/opt/app`. Volume: `app_postgres_data` (boş).  
Kod henüz zorunlu değil; B2 indirme için rclone yeter. Tag checkout build’den önce tamamlanır (`DISASTER_RECOVERY_RUNBOOK.md`).

### 2. B2 erişimi sağlanır

1. Vault / operatör: yeni B2 application key (`SECRET_RECOVERY_PROCEDURE.md`)  
2. `rclone.conf` yerleştir (GitHub’a koyma)  
3. `.env.production` içinde `RCLONE_REMOTE`  
4. `rclone ls "${RCLONE_REMOTE}/db/"` ve `…/uploads/` — dosya **adları** yeter, içerik dökülmez  

Erişim yoksa sonraki adımlar durur.

### 3. DB backup indirilir

```bash
mkdir -p /opt/app/backups
rclone copy "${RCLONE_REMOTE}/db/backup_2026-08-17_11-56-54.sql.gz" /opt/app/backups/
gzip -t /opt/app/backups/backup_2026-08-17_11-56-54.sql.gz
```

Felaket günü daha yeni SUCCESS varsa **onu** indir; dosya adını rapora yaz, checksum’u secret sayma.

### 4. PostgreSQL hazırlanır

```bash
docker compose -p sigorta-hasar-sistemi -f docker-compose.prod.yml --env-file .env.production up -d postgres
```

Imaj: `postgres:16-alpine`. Health `pg_isready`.  
**Yapma:** `backup-restore-test.sh` (ayrı `postgres:15`, production’a yazmaz — test içindir).  
**Yapma:** Dolu canlı volume üzerine ikinci restore.

### 5. Restore yapılır

```bash
gzip -dc /opt/app/backups/backup_2026-08-17_11-56-54.sql.gz \
  | docker exec -i sigorta-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1
```

Sonra: tablo listesi, `claim_files` sayısı. **`prisma migrate deploy` yok.**

### 6. Upload dosyaları alınır

```bash
mkdir -p /opt/app/backups/uploads
rclone copy "${RCLONE_REMOTE}/uploads/uploads_20260817_115702.tar.gz" /opt/app/backups/uploads/
gzip -t /opt/app/backups/uploads/uploads_20260817_115702.tar.gz
bash /opt/app/scripts/restore-uploads-from-backup.sh /opt/app/backups/uploads/uploads_20260817_115702.tar.gz
bash /opt/app/scripts/verify-upload-integrity.sh
```

Integrity CRITICAL = tar anlık kopya; tarihsel eksik fotoğraf mümkün.

### 7. Uygulama build edilir

Git tag `production-v505-2026-08-17`.  
`Dockerfile.web` / `Dockerfile.backend` → tag’ler v505 / v501.  
`NEXT_PUBLIC_API_URL` build-arg. Registry yok.

```bash
docker compose -p sigorta-hasar-sistemi -f docker-compose.prod.yml --env-file .env.production up -d
```

Proje adı zorunlu.

### 8. DNS / SSL aktif edilir

A kaydı yeni IP. Certbot ile yeni Let’s Encrypt. `verify-nginx-web-routing.sh` PASS. Login operatörde.

---

## B2’ye geri yazma (kurtarma sonrası)

Yeni VPS ayakta ve cron kurulunca `offsite-backup.sh` **yeni** dump yükler.  
Tatbikatta canlı bucket’a `delete` / retention çalıştırma. Retention script `daily/` silmez; yine de tatbikat hesabı ayrı bucket tercih edilir (**ayrı bucket bu fazda yok — Eksik**).

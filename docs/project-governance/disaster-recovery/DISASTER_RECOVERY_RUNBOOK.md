# Disaster Recovery Runbook — Meridyen Production

**Durum:** Resmi kurtarma rehberi (tatbikat yapılmadı).  
**Tarih:** 2026-08-17  
**Kapsam:** Tam VPS kaybı / disk arızası / erişilemez sunucu.  
**Bu belgede:** Kod değişikliği yok. Production’a dokunulmaz. B2’ye yazılmaz. Restore uygulanmaz.

Kaynaklar (doğrulanmış):

| Kaynak | Değer |
|--------|--------|
| Kod snapshot | GitHub `release/production-v505-clean` |
| Tag | `production-v505-2026-08-17` |
| Commit | `04d52b8aa432bf739e01a47030245bdfcada6f68` |
| Canlı web image | `sigorta-web:dalga2-agreement-hr-01-v505-amd64` |
| Canlı backend image | `app-backend:dalga2-agreement-hr-01-v501-amd64` |
| Compose proje adı | `sigorta-hasar-sistemi` |
| Canlı uygulama dizini | `/opt/app` |
| Canlı host (kayıt) | `94.138.216.18` (`deploy/manifests/KNOWN_GOOD_IMAGES.json`) |
| Alan adı (nginx) | `app.meridyen-tr.com` / `www.app.meridyen-tr.com` |

**Kritik gerçek:** Canlı `/opt/app` bir git deposu değildir (rsync + Docker build). Felaketten sonra kod **GitHub tag’inden** alınır. Docker image’ları bir registry’de yoktur; yeni sunucuda **yeniden build** gerekir.

**Kritik eksik:** Secret’lar GitHub’da ve B2 `application/` / `config/` öneklerinde yoktur. Yalnızca canlı VPS’te (`.env.production`, `rclone.conf`, Let’s Encrypt). VPS tamamen kaybolursa secret’lar **operatörün elindeki kopyadan** gelir; resmi offsite secret kasası bu fazda doğrulanmamıştır.

---

## 0. Önce dur — yapma

- Eski branch `release/production-v505` kullanma (`30d5d8f` + hassas rapor).
- `scripts/deploy.sh` ile kör restore yapma: script **Prisma migration çalıştırır**. Dump canlı şemayı taşır; migrate deploy ikinci kez şema oynatabilir.
- `docker compose up` **proje adı olmadan** çalıştırma → nginx 502.
- `docker image prune -af` kullanma.
- Production Postgres’e (`sigorta-postgres`) restore testi bağlama. Test imajı `postgres:15-alpine`; canlı compose **`postgres:16-alpine`**.
- Dump restore sonrası “boş DB’ye migrate” varsayma.

---

## 1. Yeni VPS hazırlanması

**İşletim sistemi:** Bu fazda canlı OS sürümü yeniden okunmadı. **Eksik — kurulumda `uname -a` / distro doğrulanacak.** Compose ve scriptler Linux + Docker varsayar.

Kurulacak (scriptlerin ihtiyaç duyduğu, snapshot’ta görülen):

- Docker Engine + Compose v2 eklentisi
- `git`
- `rclone`
- `python3`
- `gzip` / `tar`
- `curl` / `wget`
- Certbot (compose `certbot/certbot` + host `/etc/letsencrypt`)

Disk: DB dump + uploads arşivi + image build için boş alan. **Gerekli GB ölçülmedi (Eksik).**

Dizin: `/opt/app` (manifest `remoteAppDir`).

Harici volume’lar compose’ta `external: true`:

```text
app_postgres_data
app_redis_data
app_minio_data
```

İlk kurulumda `docker volume create` ile oluşturulur. Volume’lar B2’de yoktur.

---

## 2. Kaynak kod kurulumu

```bash
cd /opt
git clone --branch release/production-v505-clean --single-branch \
  https://github.com/mustafayufkayurek-dotcom/sigorta-portali.git app
cd /opt/app
git fetch --tags
git checkout production-v505-2026-08-17
git rev-parse HEAD
# beklenen: 04d52b8aa432bf739e01a47030245bdfcada6f68
```

Laptop `fix/v483-guven-paketi` veya WIP ağacı **kullanılmaz**.

---

## 3. Environment hazırlığı

Dosya: `/opt/app/.env.production` (gitignore; GitHub’da yok).  
Compose: `docker compose -p sigorta-hasar-sistemi -f docker-compose.prod.yml --env-file .env.production`

**Değer yazılmaz.** Canlı compose + `.env.example` + scriptlerden **isimler:**

### Veritabanı
`POSTGRES_USER` · `POSTGRES_PASSWORD` · `POSTGRES_DB` · `DATABASE_URL` (compose üretir: `postgresql://…@postgres:5432/…`)

Dump restore scriptleri varsayılan: kullanıcı `meridyen`, veritabanı `meridyen_db`, container `sigorta-postgres`.

### Redis
`REDIS_PASSWORD` · `REDIS_URL`

### JWT
`JWT_SECRET` · `JWT_ACCESS_EXPIRES_IN` · `JWT_REFRESH_EXPIRES_IN`

### SMTP (uygulama env)
`SMTP_HOST` · `SMTP_PORT` · `SMTP_USER` · `SMTP_PASS` · `SMTP_FROM`  
Not: Canlıda mail ayrıca DB `mail_config` üzerinden de okunur (onay e-posta kilidi). Restore sonrası DB içindeki ayar dump ile gelir.

### Telegram
`TELEGRAM_BOT_TOKEN` · `TELEGRAM_CHAT_ID`  
`TELEGRAM_INSPECTION_REMINDER_ENABLED` · `TELEGRAM_APPROVAL_DELAY_REMINDER_ENABLED` · `TELEGRAM_INVOICE_REQUEST_NOTIFY_ENABLED`  
Ek dosya (script): `/opt/app/.env.telegram` — GitHub’da yok.

### Backblaze B2 / rclone
`RCLONE_REMOTE` (ör. dokümante edilen biçim `b2:…` — değer yazılmaz)  
`RCLONE_B2_SECTION` (varsayılan kod: `b2-offsite`)  
`B2_BUCKET` (retention script varsayılan adı kodda var; canlı değer env’den)  
`B2_DAILY_KEEP_DAYS` · `B2_MONTHLY_KEEP_DAYS`  
`OFFSITE_BACKUP_DIR` (ikinci disk; tanımlı değilse offsite rclone ister)

Dosya: `rclone.conf` — aday yollar: `/root/.config/rclone/rclone.conf`, `~/.config/rclone/rclone.conf`, `/opt/app/.config/rclone/rclone.conf`. GitHub’da yok. B2 application key burada.

### MinIO / S3 (uygulama içi depolama)
`STORAGE_PROVIDER` · `S3_REGION` · `S3_BUCKET` · `MINIO_ROOT_USER` · `MINIO_ROOT_PASSWORD` · `MINIO_PUBLIC_URL`  
Compose `S3_ENDPOINT=http://minio:9000`. Rapor fotoğrafları ayrıca bind-mount: `./apps/backend/uploads`.

### Redis dışı uygulama
`WEB_URL` · `APP_URL` · `APP_PUBLIC_URL` · `NEXT_PUBLIC_API_URL` (web **build-time**)  
Canlı API URL kalıbı: `https://app.meridyen-tr.com/api/v1`

### PayTR
`ONLINE_CARD_COLLECTION_ENABLED` · `PAYTR_MERCHANT_ID` · `PAYTR_MERCHANT_KEY` · `PAYTR_MERCHANT_SALT` · `PAYTR_TEST_MODE` · `PAYTR_DEBUG_ON` · `PAYTR_TIMEOUT_MINUTES`

### Logo
`LOGO_INTEGRATION_ENABLED` · `LOGO_API_BASE_URL` · `LOGO_API_CLIENT_ID` · `LOGO_API_CLIENT_SECRET` · `LOGO_API_USERNAME` · `LOGO_API_PASSWORD` · `LOGO_FIRM_NO` · `LOGO_COMPANY_CODE_PREFIX` · `LOGO_TOKEN_CACHE_TTL_MINUTES`

### OpenAI
`OPENAI_API_KEY` (yoksa ilgili okuma/sınıflandırma atlanır)

### Sentry
`SENTRY_DSN` · `NEXT_PUBLIC_SENTRY_DSN` (web build-time)

### Backup / sağlık
`BACKUP_DIR` · `MIN_BACKUP_SIZE_BYTES` · `BACKUP_WATCHDOG_WARNING_HOURS` · `BACKUP_WATCHDOG_CRITICAL_HOURS`

**Felaket sonrası:** Bu dosyalar VPS ile gittiyse Backblaze hesap sahibi / operatör kopyası olmadan B2 bile indirilemez. Bkz. `SECRET_AND_CONFIG_INVENTORY.md`.

---

## 4. PostgreSQL kurulumu

Compose servisi `postgres`, imaj **`postgres:16-alpine`**, container `sigorta-postgres`, port dışarı kapalı.

Sıra (dump restore için uygulama ayakta olmak zorunda değil):

1. `docker volume create app_postgres_data` (ve redis/minio volume’ları)
2. `.env.production` hazır
3. Yalnız postgres’i ayağa kaldır:

```bash
cd /opt/app
docker compose -p sigorta-hasar-sistemi -f docker-compose.prod.yml --env-file .env.production up -d postgres
```

4. `pg_isready` (compose healthcheck) yeşil olana kadar bekle.
5. **Boş volume’a dump bas** (adım 6). Backend’i dump’tan önce başlatma.

---

## 5. Backblaze B2 erişimi

Offsite yazma yolu: `scripts/offsite-backup.sh` → `rclone copy` → `RCLONE_REMOTE/db/` ve `…/uploads/`.  
Doğrulama: `scripts/backup/b2_api.py` (rclone.conf `account` + `key`; f005 HEAD kullanılmaz).

İndirme (yeni VPS, **okuma**):

```bash
# rclone.conf yerleştirildikten sonra — remote adı env’deki RCLONE_REMOTE ile aynı olmalı
rclone ls "${RCLONE_REMOTE}/db/"
rclone ls "${RCLONE_REMOTE}/uploads/"
rclone copy "${RCLONE_REMOTE}/db/backup_2026-08-17_11-56-54.sql.gz" /opt/app/backups/
rclone copy "${RCLONE_REMOTE}/uploads/uploads_20260817_115702.tar.gz" /opt/app/backups/uploads/
gzip -t /opt/app/backups/backup_2026-08-17_11-56-54.sql.gz
gzip -t /opt/app/backups/uploads/uploads_20260817_115702.tar.gz
```

**Son bilinen başarılı B2 nesneleri (FAZ 2, 2026-08-17, bu fazda yeniden listelenmedi):**

| Tür | Nesne | Not |
|-----|--------|-----|
| DB | `db/backup_2026-08-17_11-56-54.sql.gz` | ~6.96 MB, checksum/B2 OK kaydı |
| Uploads | `uploads/uploads_20260817_115702.tar.gz` | ~12.57 MB, checksum/B2 OK kaydı |

Aynı gün `db/backup_2026-08-17_02-00-01.sql.gz` **20 byte geçersiz gzip** olarak kayda geçti — restore kaynağı **değil**.

B2’de **yok** (DR audit): `application/`, `config/`, `recovery/` önekleri. Image tar’ı yok.

Eski `daily/` GPG nesneleri B2’de görüldü; **güncel SUCCESS yolu şifresiz `db/` + `uploads/` rclone kopyasıdır.** GPG anahtarı envanteri bu fazda doğrulanmadı.

---

## 6. DB restore sırası

Kaynak: `db/backup_2026-08-17_11-56-54.sql.gz` (veya felaket anındaki **daha yeni SUCCESS** dump — health `lastSuccessAt`).

Canlı restore **production container’a** yapılır (yeni boş volume). `backup-restore-test.sh` kullanma (ayrı `postgres:15-alpine`, `POSTGRES_PASSWORD=restoretestonly`).

Örnek (şifre env’den; değeri belgeye yazma):

```bash
# postgres healthy
gzip -dc /opt/app/backups/backup_2026-08-17_11-56-54.sql.gz \
  | docker exec -i sigorta-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1
```

Dump rol/DB adları canlı dump’a bağlıdır. Test scripti `meridyen` / `meridyen_db` bekler; canlı `POSTGRES_*` ile **aynı olmalı**.

Restore sonrası (uygulama kapalıyken):

- `psql` ile `claim_files` sayısı (son restore test kaydı: **19** satır, 2026-08-17 12:30 +03 — dump o anki kopya)
- Public tablo sayısı (test kaydı: **164**)
- **`prisma migrate deploy` çalıştırma** (dump zaten canlı şema)

Migration klasörü snapshot’ta `apps/backend/prisma/migrations` (**104** `migration.sql`). Dump ile klasör uyumu ancak restore sonrası `_prisma_migrations` tablosundan görülür.

---

## 7. Upload restore

Kaynak: `uploads/uploads_20260817_115702.tar.gz`  
Hedef: `/opt/app/apps/backend/uploads` (compose bind-mount)

```bash
bash /opt/app/scripts/restore-uploads-from-backup.sh \
  /opt/app/backups/uploads/uploads_20260817_115702.tar.gz
bash /opt/app/scripts/verify-upload-integrity.sh
```

**Sınır:** Arşiv anlık tar.gz’dir; tarihsel tüm fotoğrafların garantisi değildir. 2026-08 olayında DB kaydı / disk sapması (eksik fotoğraf) kayda geçti. Restore sonrası integrity script **CRITICAL** verebilir — bu, tar’ın “tam tarihçe” olmadığı anlamına gelir.

**MinIO volume** B2’de yoktur. `STORAGE_PROVIDER=s3` ise MinIO nesneleri uploads tar’ından bağımsız kaybolmuş olabilir. **Eksik — ayrı MinIO yedeği doğrulanmadı.**

---

## 8. Docker build

Registry yok. Snapshot Dockerfiles:

```bash
cd /opt/app
# web: NEXT_PUBLIC_* build-arg zorunlu (bundle)
docker build -f Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_URL=https://app.meridyen-tr.com/api/v1 \
  -t sigorta-web:dalga2-agreement-hr-01-v505-amd64 .

docker build -f Dockerfile.backend \
  -t app-backend:dalga2-agreement-hr-01-v501-amd64 .
```

Canlı override’da bu tag’ler kullanılır. Compose dosyası `build:` içerir; production’da genelde **önceden tag’lenmiş image** ile kalkılır. Yeni VPS’te override dosyası GitHub’da olmayabilir (**Eksik — compose override içeriği snapshot’ta ayrı doğrulanmadı**). Build sonrası `docker compose -p sigorta-hasar-sistemi … up` image adlarının override ile eşleşmesi gerekir.

Build context: repo kökü (`apps/` + `packages/shared`). `/opt/app/source/` kullanılmaz.

---

## 9–10. Backend ve frontend başlatma

Dump + uploads yerinde, postgres healthy:

```bash
cd /opt/app
docker compose -p sigorta-hasar-sistemi -f docker-compose.prod.yml --env-file .env.production up -d
```

502 önleme: **`-p sigorta-hasar-sistemi` zorunlu.**  
Web restart için canlı prosedür: `scripts/restart-web-production.sh`.

Health:

- Backend: `http://localhost:3000/api/v1/health` (container içi)
- Web: `http://localhost:3001`
- Nginx: `http://localhost/health`

---

## 11. Nginx

Imaj: `nginx:1.25-alpine`, container `sigorta-nginx`.  
Config: `nginx/nginx.conf` (snapshot).  
Sertifika mount: `/etc/letsencrypt` (host, GitHub’da yok).

Routing doğrulama (canlı prosedür): `scripts/verify-nginx-web-routing.sh` — PASS olmadan “ayağa kalktı” denmez.

---

## 12. SSL

Let’s Encrypt: `ssl_certificate` → `/etc/letsencrypt/live/app.meridyen-tr.com/fullchain.pem`  
`certbot` servisi 12 saatte `certbot renew --webroot`.

Yeni VPS’te eski pem **yok**. DNS A kaydı yeni IP’ye döndükten sonra **yeni sertifika** alınır. Eski IP’deki certbot hesabı/kaydı bu fazda envanterlenmedi.

HTTP-01 için 80 açık + `server_name` eşleşmesi gerekir.

---

## 13. DNS

Kayıt: `app.meridyen-tr.com` (ve `www`) → yeni VPS IPv4.  
TTL / registrar bu fazda doğrulanmadı (**Eksik**).  
SSL’den önce veya birlikte kesilir; kesinti RTO’ya girer.

Eski VPS hâlâ ayaktaysa split-brain olmasın: DNS kesmeden çift yazma yok (bu runbook tam kayıp senaryosu).

---

## 14. Login testi

Cursor production tarayıcı girişi **yapmaz**. Operatör:

1. `https://app.meridyen-tr.com/giris`
2. Bilinen iç kullanıcı (şifre DB dump’tan gelir; JWT_SECRET **eski VPS ile aynı olmalı** yoksa mevcut oturum çerezleri geçersiz — yeni login gerekir)
3. Smoke route listesi: `KNOWN_GOOD_IMAGES.json` → `mustPassSmokeRoutes`
4. Dosya fotoğrafı açma (uploads restore)

Admin yedek sağlığı: `/panel/ayarlar/yedek-sagligi`

---

## 15. Backup cron kurulumu

Canlıda FAZ 2’de doğrulanan / dokümante edilen satırlar (VPS kaybında **yeniden yazılır**):

```cron
0 2 * * * /opt/app/scripts/backup.sh >> /var/log/meridyen-backup.log 2>&1
15 2 * * * /opt/app/scripts/backup-uploads.sh >> /var/log/meridyen-uploads-backup.log 2>&1
30 2 * * * /opt/app/scripts/offsite-backup.sh >> /opt/app/logs/offsite-backup.log 2>&1
15 * * * * /opt/app/scripts/backup-watchdog.sh >> /opt/app/logs/backup-watchdog.log 2>&1
```

Dokümante ek (UPLOADS yönergesi; bu fazda canlı crontab yeniden okunmadı):

```cron
30 6 * * * /opt/app/scripts/verify-backup-health.sh >> /var/log/meridyen-backup-health.log 2>&1
45 6 * * * /opt/app/scripts/verify-upload-integrity.sh >> /var/log/meridyen-upload-integrity.log 2>&1
```

Not: Snapshot `scripts/backup-wrapper.sh` Docker volume tar alır ve volume adı `sigorta-hasar-sistemi_postgres_data` kullanır; compose volume adı **`app_postgres_data`**. Gece SQL yedeğinin asıl yolu **`backup.sh`**. Wrapper’ı DR’nin birincil restore kaynağı sayma.

---

## 16. Restore test kurulumu

Canlıya kurulu (FAZ 2):

```cron
30 4 * * 0 /opt/app/scripts/backup-restore-test.sh >> /opt/app/logs/backup-restore-test.log 2>&1
```

Bu script **asla** `sigorta-postgres` üzerine yazmaz; geçici `postgres:15-alpine` kullanır. Sonuç `backup_health.restoreTest` (DB `system_settings`).

Yeni VPS’te cron’u ancak uygulama + yerel dump sağlıklı olduktan sonra ekle.

---

## Sıra özeti

1. VPS + Docker + volume  
2. Git tag checkout (`04d52b8`)  
3. Secret / rclone / `.env.production` (offsite kasa — **şu an resmi kopya yok**)  
4. Postgres 16 up  
5. B2’den dump + uploads indir  
6. DB restore (**migrate yok**)  
7. Uploads tar restore  
8. Image build (v505 / v501 tag)  
9. Compose `-p sigorta-hasar-sistemi` up  
10. Nginx + Let’s Encrypt (DNS sonrası)  
11. Login / smoke / fotoğraf  
12. Cron: backup, uploads, offsite, watchdog, haftalık restore test  

---

## DR Hazırlığı Eksikleri

Bu runbook’un uygulanmasını **engelleyen** maddeler `BACKUP_RECOVERY_ARCHITECTURE.md` ve teslim özetindeki “DR Hazırlığı Eksikleri” bölümündedir. En ağır: **secret’ların offsite olmaması**.

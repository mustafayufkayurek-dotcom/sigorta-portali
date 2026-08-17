# Secret ve Config Envanteri — Meridyen DR

**Tarih:** 2026-08-17  
**Kural:** Değer toplanmaz, rapora yazılmaz, B2/GitHub’dan okunmaz.  
**Kaynak:** `docker-compose.prod.yml`, `.env.example`, backup/rclone scriptleri, nginx, FAZ 2 DR audit (B2’de config yok).

GitHub snapshot **secret içermez** (`.env.production` ignore). Canlı secret’lar VPS’te.

---

## Uygulama / Compose

| Adı | Kullanıldığı yer | Kaynağı (canlı) | Felaket sonrası |
|----|------------------|-----------------|-----------------|
| `POSTGRES_USER` | Postgres + dump restore | `.env.production` | Eski dump ile **aynı kullanıcı**. Yeni üretme (dump içindeki roller). |
| `POSTGRES_PASSWORD` | Postgres, backup.sh `PGPASSWORD` | `.env.production` | Dump ile uyumlu tut. Kayıpsa dump’taki rol şifresi/reset prosedürü **belgelenmedi (Eksik)**. |
| `POSTGRES_DB` | Postgres | `.env.production` | Dump hedef DB adı ile aynı (`meridyen_db` varsayılan script). |
| `DATABASE_URL` | Backend (compose üretir) | Compose şablonu | Elle uydurma; compose’un `postgres:5432` biçimi. |
| `REDIS_PASSWORD` | Redis requirepass | `.env.production` | **Yeni üretilebilir** (cache). Oturum blacklist sıfırlanır. |
| `REDIS_URL` | Backend | Compose | Redis şifresi ile uyumlu. |
| `JWT_SECRET` | Backend auth | `.env.production` | **Yeni üretilebilir**; tüm kullanıcılar yeniden login. Eski secret yoksa dump kullanıcıları yine DB’dedir. |
| `JWT_ACCESS_EXPIRES_IN` | Backend | `.env.production` | Snapshot/example: `15m`. Canlı değer VPS’te. |
| `JWT_REFRESH_EXPIRES_IN` | Backend | `.env.production` | Example: `7d`. |
| `STORAGE_PROVIDER` | Backend storage | `.env.production` | Canlı değer VPS; compose MinIO’ya bağlar. |
| `S3_REGION` `S3_BUCKET` | Backend / MinIO bucket adı | `.env.production` | MinIO volume B2’de yok; bucket boş açılabilir, **nesne kaybı**. |
| `MINIO_ROOT_USER` `MINIO_ROOT_PASSWORD` | MinIO + S3_ACCESS/SECRET | `.env.production` | Yeni üretilebilir; eski MinIO nesneleri zaten volume ile gitmiş olabilir. |
| `MINIO_PUBLIC_URL` | Backend | `.env.production` | Yeni host URL. |
| `WEB_URL` `APP_URL` `APP_PUBLIC_URL` | Backend link/CORS | `.env.production` | `https://app.meridyen-tr.com` kalıbı nginx ile uyumlu olmalı. |
| `NEXT_PUBLIC_API_URL` | Web **build-time** | build-arg / env | Image rebuild: `https://app.meridyen-tr.com/api/v1`. |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | Compose env + yedek bildirimi | `.env.production` | Sağlayıcı panelinden yeniden. DB `mail_config` dump ile gelebilir. |
| `TELEGRAM_BOT_TOKEN` `TELEGRAM_CHAT_ID` | Backend + `telegram-notify.sh` + backup-notify | `.env.production` ve/veya `.env.telegram` | BotFather / grup — operatör. Offsite kopya **doğrulanmadı**. |
| `TELEGRAM_*_ENABLED` | Hatırlatma bayrakları | `.env.production` | Ürün ayarı; dump/health’ten bağımsız. |
| `PAYTR_MERCHANT_ID` `PAYTR_MERCHANT_KEY` `PAYTR_MERCHANT_SALT` | Online tahsilat | `.env.production` | PayTR panel. Kayıpsa ödeme durur. |
| `PAYTR_TEST_MODE` `PAYTR_DEBUG_ON` `PAYTR_TIMEOUT_MINUTES` | PayTR davranış | `.env.production` | Canlı mod VPS’te; tahmin etme. |
| `ONLINE_CARD_COLLECTION_ENABLED` | Özellik | `.env.production` | |
| `LOGO_INTEGRATION_ENABLED` ve `LOGO_API_*` | Logo muhasebe | `.env.production` | Logo sunucusu / API hesabı. |
| `OPENAI_API_KEY` | STT, fiş, sınıflandırma vb. | `.env.production` | Yoksa özellik düşer; çekirdek DR’yi bloklamaz. |
| `SENTRY_DSN` | Backend | env (compose’ta açıkça yok, kod okur) | Sentry projesi. **Canlıda set mi bu fazda doğrulanmadı.** |
| `NEXT_PUBLIC_SENTRY_DSN` | Web build | env / Dockerfile | Rebuild gerekir. |

---

## Backup / B2 / host

| Adı | Kullanıldığı yer | Kaynağı | Felaket sonrası |
|----|------------------|---------|-----------------|
| `RCLONE_REMOTE` | `offsite-backup.sh` | `.env.production` | rclone remote adı. Credential **rclone.conf** içinde. |
| `rclone.conf` (`account` / `key`) | B2 Native API + rclone | Host: `/root/.config/rclone/rclone.conf` (ve aday yollar) | **B2’de yok.** Backblaze hesap sahibi yeni application key üretir. Eski key VPS ile gittiyse bucket’a bu key ile erişilemez. |
| `RCLONE_B2_SECTION` | `b2_api.py` | env, varsayılan `b2-offsite` | conf bölüm adı. |
| `B2_BUCKET` | retention | env, kod varsayılanı var | Bucket adı operatörde. |
| `OFFSITE_BACKUP_DIR` | İkinci disk | `.env.production` | Tanımsızsa offsite rclone zorunlu. |
| `BACKUP_DIR` | `backup.sh` | varsayılan `/opt/app/backups` | Yeni VPS’te oluştur. |
| Let’s Encrypt `privkey.pem` / `fullchain.pem` | nginx 443 | `/etc/letsencrypt/live/app.meridyen-tr.com/` | **Yeniden sertifika.** Eski pem yeni IP’de geçersiz/yok. |
| SSH host key / `root` erişim | VPS | sağlayıcı | Yeni sunucu anahtarı. Eski IP’ye bağlı güvenlik grubu **Eksik belgelenmedi**. |
| Docker volume `app_postgres_data` | Postgres data | Canlı disk | B2’de yok; restore **sql.gz** ile. |
| Docker volume `app_minio_data` | MinIO | Canlı disk | B2’de yok. |
| Docker volume `app_redis_data` | Redis AOF | Canlı disk | B2’de yok; boş kabul. |

---

## Bilinçli olarak GitHub’da olmayanlar

| Nesne | Neden |
|-------|--------|
| `.env` `.env.production` | gitignore |
| `rclone.conf` | gitignore |
| `*.pem` `*.key` | gitignore |
| `backups/` `uploads/` (kullanıcı) `logs/` | gitignore / runtime |
| Docker image tar | Registry yok, B2 `application/` yok |

---

## Operatör eylem özeti

1. **Mutlaka eski değer:** Postgres rol/şifre (dump uyumu), B2 erişim (yeni key ile bucket), SMTP/PayTR/Logo/Telegram (iş sürekliliği).  
2. **Yeniden üretilebilir:** JWT, Redis, MinIO root (nesne kaybı ayrı), Let’s Encrypt.  
3. **Yoksa DR durur:** `rclone.conf` veya Backblaze hesap erişimi olmadan dump indirilemez.

Offsite secret kasası (şifreli USB, ayrı vault) **bu fazda mevcut değil olarak işaretlenir.**

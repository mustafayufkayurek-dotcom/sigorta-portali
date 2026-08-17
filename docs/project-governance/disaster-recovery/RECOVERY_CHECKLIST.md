# Recovery Checklist — Meridyen Production DR

**Tarih:** 2026-08-17  
**Kod / production / B2:** bu belgede değişiklik yok.  
**Hedef tag:** `production-v505-2026-08-17` → `04d52b8aa432bf739e01a47030245bdfcada6f68`

Her madde: işlem · kontrol · beklenen sonuç.

| # | Yapılacak işlem | Kontrol yöntemi | Beklenen sonuç |
|---|-----------------|-----------------|----------------|
| 1 | Yeni VPS hazır mı? | `docker version` · `docker compose version` · disk `df -h` | Docker + Compose v2 çalışır. OS sürümü kayda geçer (bu fazda ölçülmedi). |
| 2 | Gerekli paketler | `git rclone python3 gzip tar` | Komutlar PATH’te. |
| 3 | Kod checkout | `git rev-parse HEAD` · `git describe --tags --exact-match` | HEAD = `04d52b8aa432bf739e01a47030245bdfcada6f68`. Tag = `production-v505-2026-08-17`. Branch `release/production-v505` **değil**. |
| 4 | Hassas history yok | `git log --oneline` · dosya var mı | Tek commit. `30d5d8f` yok. `reports/eksik-kanit-tamamlama/2026-05-17-eksik-kanit-tamamlama-raporu.md` yok. |
| 5 | `.env.production` var mı? | `test -f /opt/app/.env.production` — **içerik okunup rapora yazılmaz** | Dosya var. `POSTGRES_*` `JWT_SECRET` `REDIS_PASSWORD` MinIO SMTP Telegram B2/rclone isimleri dolu. |
| 6 | `rclone.conf` var mı? | `rclone lsd` (remote adı env’de) | B2 bucket listelenir. `db/` ve `uploads/` görünür. |
| 7 | Harici volume | `docker volume ls` | `app_postgres_data` `app_redis_data` `app_minio_data` |
| 8 | Postgres ayağa | `docker ps` · health | Container `sigorta-postgres`, imaj `postgres:16-alpine`, healthy. |
| 9 | B2 dump indirildi mi? | `ls -l` · `gzip -t` | `backup_2026-08-17_11-56-54.sql.gz` (veya daha yeni SUCCESS). 20 byte’lık 02:00 gzip **kullanılmaz**. |
| 10 | Database restore edildi mi? | `psql` `\dt` · `SELECT count(*) FROM claim_files` | ON_ERROR_STOP=0 hata yok. Tablo/dosya sayıları dump ile tutarlı. Son test kaydı (2026-08-17): 164 public tablo, `claim_files=19` — **yeni dump’ta değişebilir**. |
| 11 | Migration durumu | `SELECT * FROM _prisma_migrations` (özet) · **migrate deploy çalıştırılmadı** | Dump şeması duruyor. Kör `prisma migrate deploy` yok. |
| 12 | Uploads arşivi | `gzip -t` uploads tar | `uploads_20260817_115702.tar.gz` (veya daha yeni SUCCESS). |
| 13 | Upload restore | `ls /opt/app/apps/backend/uploads` · `verify-upload-integrity.sh` | Dizin dolu. Integrity **PASS veya bilinen sapma raporu** (tarihsel eksik fotoğraf mümkün). |
| 14 | MinIO | Compose healthy · **B2’de volume yok** | Servis ayakta. Nesne kaybı riski açıkça not edilir. |
| 15 | Redis | ping (şifre env) | Healthy. Boş Redis kabul (oturum blacklist sıfırlanır). |
| 16 | Image build | `docker images` | `sigorta-web:…-v505-amd64` ve `app-backend:…-v501-amd64` var. |
| 17 | Compose proje adı | `docker compose ls` | Proje **`sigorta-hasar-sistemi`**. Nginx 502 yok. |
| 18 | Backend | `wget` health `3000/api/v1/health` | HTTP 200. |
| 19 | Frontend | `wget` `3001` | HTTP 200. |
| 20 | Nginx | `wget` `/health` · `verify-nginx-web-routing.sh` | PASS. |
| 21 | SSL | tarayıcı kilit · `fullchain.pem` host’ta | `app.meridyen-tr.com` geçerli Let’s Encrypt (yeni IP’de **yeni** sertifika). |
| 22 | DNS | `dig` / registrar | A kaydı yeni VPS IP. |
| 23 | Login çalışıyor mu? | Operatör `/giris` (Cursor production login **yapmaz**) | Panel açılır. JWT_SECRET dump dönemi ile uyumlu veya kullanıcı yeniden girer. |
| 24 | Dosya yükleme / fotoğraf | Hasar dosyası rapor görseli | Eski restore edilen dosya açılır; yeni yükleme diske yazılır. |
| 25 | Portallar | Smoke: `/panel/sigorta-portal` `/panel/eksper-portal` `/giris` | 502/404 kabuk kırığı yok. |
| 26 | Yedek Sağlığı ekranı | `/panel/ayarlar/yedek-sagligi` | Sayfa açılır (cron işledikten sonra veri). |
| 27 | Backup cron | `crontab -l` | `backup.sh` 02:00, uploads 02:15, offsite 02:30, watchdog saatlik. |
| 28 | Backup çalışıyor mu? | İlk gece sonrası `backups/backup_*.sql.gz` · `gzip -t` · B2 `rclone ls` | Yeni dump boyutu ≥ 10240 byte. Offsite `db/` + `uploads/` verify. |
| 29 | Restore test cron | `30 4 * * 0 backup-restore-test.sh` | Haftalık; **sigorta-postgres’e yazmaz**. |
| 30 | Telegram / e-posta | Test bildirimi (değer rapora yazılmaz) | Operatör kanalı mesaj alır veya eksik secret raporlanır. |
| 31 | Production eski VPS | Bu tatbikat tam kayıpsa | Çift DNS yok. Bu checklist **canlıya deploy etmez**. |

**Durdur:** HEAD tag eşleşmezse, dump gzip bozuksa, compose `-p` unutulursa, secret yoksa, migrate deploy dump üzerine koşulursa.

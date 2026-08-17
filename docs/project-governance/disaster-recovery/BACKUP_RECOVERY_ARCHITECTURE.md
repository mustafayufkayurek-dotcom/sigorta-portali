# Backup / Recovery Mimarisi — Meridyen (mevcut durum)

**Tarih:** 2026-08-17  
**Bu belge varsayım değil; kod + FAZ 2 kayıtları.** Ölçülmeyenler “Eksik”.

```text
                    ┌─────────────────────────────┐
                    │ GitHub                      │
                    │ release/production-v505-clean│
                    │ tag production-v505-2026-08-17│
                    │ commit 04d52b8 (kod)        │
                    └─────────────┬───────────────┘
                                  │ felakette checkout
                                  ▼
┌──────────────┐   rsync/build    ┌──────────────────────────────┐
│ Operatör     │                 │ Canlı VPS 94.138.216.18       │
│ laptop WIP   │──KULLANILMAZ──▶ │ /opt/app  (git repo değil)    │
└──────────────┘                 │ compose -p sigorta-hasar-sistemi│
                                 │ web image v505 · backend v501 │
                                 └──────┬───────────┬────────────┘
                        sql.gz+tar.gz   │           │ health JSON
                        02:30 rclone    │           │ DB system_settings
                                        ▼           ▼
                                 ┌─────────────┐  ┌─────────────────────┐
                                 │ Backblaze B2│  │ Admin               │
                                 │ db/         │  │ /panel/ayarlar/     │
                                 │ uploads/    │  │ yedek-sagligi       │
                                 │ monthly/    │  └─────────────────────┘
                                 │ (eski daily/│
                                 │  gpg var)   │
                                 └─────────────┘
```

---

## 1. Uygulama (kod)

| Nedir | Nerede |
|-------|--------|
| Kaynak | GitHub temiz snapshot (2026-08-17 itibarıyla resmi kod kopyası) |
| Canlı çalışma kopyası | `/opt/app` rsync + Docker build |
| Image | Yerel Docker tag; **registry yok** |
| Rollback image | Manifest: web v504 / backend v500 — **yalnızca o VPS diskine bağlı** |

Felakette kod: GitHub tag. Canlı image’lar B2’de yok → rebuild.

---

## 2. Veri

| Katman | Ne | Nasıl | Offsite |
|--------|-----|--------|---------|
| DB | PostgreSQL 16 dump `backup_*.sql.gz` | `scripts/backup.sh` → `/opt/app/backups` | `rclone` → `RCLONE_REMOTE/db/` |
| Dosyalar | `apps/backend/uploads` tar.gz | `scripts/backup-uploads.sh` | `RCLONE_REMOTE/uploads/` |
| Bütünlük | `report_images` ↔ disk | `verify-upload-integrity.sh` | Rapor; dosya kopyası değil |
| MinIO volume | Nesne deposu | Docker volume `app_minio_data` | **Yok** |
| Redis | Cache / blacklist | `app_redis_data` | **Yok** (kabul) |
| Config/secret | `.env.production`, rclone, SSL | VPS disk | **Yok** |

Retention (kod): B2 `db/`+`uploads/` **90 gün**; `monthly/` **365 gün**. `daily/` önekine retention script **dokunmaz**.

SUCCESS tanımı (`offsite-backup.sh`): yerel gzip sağlıklı **ve** rclone upload **ve** B2 API verify **ve** checksum. Hepsi olmadan health SUCCESS değil.

---

## 3. İzleme

| Parça | Görev |
|-------|--------|
| `backup-health-record.py` | Health JSON + DB kayıt |
| `backup-health-merge-restore.py` | `restoreTest` alanını birleştirir |
| `backup-watchdog.sh` | 24s uyarı / 48s kritik (`lastSuccessAt`) |
| `backup-notify.py` | Telegram + e-posta (SMTP env) |
| `telegram-notify.sh` | Operasyon alarmları |
| Admin | `/panel/ayarlar/yedek-sagligi` (5 dk polling, FAZ 2) |
| `backup-scheduler-status.py` | Cron görünürlüğü; admin **genel ton** scheduler.ok yüzünden tek başına WARNING olmaz (ürün kararı FAZ 2) |

---

## 4. Restore (mevcut araç)

| Araç | Ne yapar | Ne yapmaz |
|------|----------|-----------|
| `backup-restore-test.sh` | Geçici `postgres:15-alpine`, dump içeri aktar, tablo/`claim_files` say, health’e yaz | **`sigorta-postgres` yok**; canlı kesinti yok |
| `restore-uploads-from-backup.sh` | tar’ı `apps/backend/uploads` altına açar | MinIO volume doldurmaz |
| Haftalık cron | `30 4 * * 0` restore-test | Production DB restore değil |

Canlı felaket restore: **yeni/boş** `postgres:16-alpine` + `psql` dump. Test imajı 15, production compose 16 — bilinçli fark.

---

## 5. Çalışma saatleri (canlı kayıt / yönerge)

| Saat | İş |
|------|-----|
| 02:00 | DB dump |
| 02:15 | Uploads tar |
| 02:30 | B2 offsite |
| :15 her saat | Watchdog |
| Pazar 04:30 | Restore test (FAZ 2 kurulumu) |

`backup-wrapper.sh` (snapshot): eski “Kapı 4” volume tar; volume adı compose `app_postgres_data` ile **uyumsuz görünümlü**. Birincil DR verisi **sql.gz + uploads tar**.

---

## 6. Sınırlar (bilinen)

- B2 **uygulama tar / env / SSL** tutmaz.  
- Uploads tar **anlık**; 2026-08 bütünlük sapması (eksik disk dosyası) tar’ı “tam tarihçe” yapmaz.  
- Gece 02:00 boş gzip B2’de görülebilir; SUCCESS dosyası ayrı seçilir.  
- Watchdog 24s Telegram; 48s e-posta davranışı FAZ 2’de “SUCCESS health iken force e-posta” nüansı kayda geçti — operatör beklentisi ile sapabilir (**Eksik netleştirme, kod bu fazda değişmez**).

---

## DR Hazırlığı Eksikleri

Ayrıntılı liste aşağıdaki bölümde (runbook ile ortak).

### Secret yönetimi
Secret’lar tek VPS’te. GitHub/B2 config yok. Tam disk kaybında dump’a **erişim anahtarı** da kaybolabilir.

### B2 recovery key
Application key yalnız `rclone.conf`. Master/hesap kurtarma prosedürü yazılı değil. İkinci kişi / kasada kopya **doğrulanmadı**.

### SSL
Let’s Encrypt host’ta. Yeni VPS = yeni sertifika + DNS. Eski pem yedeği B2’de yok.

### DNS
Registrar, TTL, failover IP **belgelenmedi**. RTO’nun ölçülmemiş parçası.

### Image registry
v505/v501 yalnız sunucu diskinde. Registry/B2 image yok. Kurtarma = kaynak build (süre + build host).

### Upload tamlık
Integrity script var; son bilinen sapma (eksik fotoğraflar) tar’ın DB ile %100 örtüşmediğini gösterir. DR sonrası CRITICAL beklenen olabilir.

### RTO ölçümü
Sayı yok. `RPO_RTO_TEST_PLAN.md` doldurulmadı.

### Recovery tatbikatı
Ayrı VPS’te uçtan uca restore **yapılmadı**. Restore test yalnız dump’un **okunabilir** olduğunu kanıtlar; nginx/DNS/login/MinIO kanıtlamaz.

### Compose override / image tag bağlama
Canlı override dosyası GitHub snapshot’ta ayrı doğrulanmadı. Yanlış `docker compose up` (proje adı yok) 502.

### MinIO
Volume offsite değil. S3 nesneleri uploads bind-mount’tan ayrıysa kayıp.

### OS / kapasite
Yeni VPS distro, CPU, disk GB **bu fazda ölçülmedi**.

### `scripts/deploy.sh`
İlk kurulum + **migrate**. Dump restore ile birleşince tehlikeli. DR runbook bunu kullanmama der.

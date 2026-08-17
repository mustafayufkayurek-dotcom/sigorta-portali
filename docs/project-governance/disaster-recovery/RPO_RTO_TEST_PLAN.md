# RPO / RTO Test Planı — Meridyen

**Tarih:** 2026-08-17  
**Durum:** Plan. **Gerçek RTO ölçümü yapılmadı.** RPO için canlı sürekli sayaç bu fazda yeniden okunmadı; aşağıdaki “son bilinen” FAZ 2 kayıtlarıdır.

Hedef (ürün):

| Metrik | Hedef | Ölçüm durumu |
|--------|--------|----------------|
| RPO | **24 saat altında** | Hedef tanımlı. Sürekli doğrulama = watchdog 24s / 48s + gece 02:00 yedek. |
| RTO | **Ölçülecek** | Sayı yok. Aşağıdaki kronometre ile ilk tatbikatta doldurulur. |

Bu plan **production’a restore uygulamaz**. Tatbikat ayrı onay + ayrı VPS ister.

---

## Tanımlar

- **RPO (Recovery Point Objective):** Felaket anı ile geri yüklenebilen son **doğrulanmış** yedek arasındaki veri kaybı penceresi.
- **RTO (Recovery Time Objective):** Yeni ortamda login’e kadar geçen süre.

Canlı yedek ritmi (kod/cron yönergesi):

- DB: her gece **02:00** `backup.sh`
- Uploads: **02:15** `backup-uploads.sh` (`backup.sh` sonunda da çağrı var)
- Offsite B2: **02:30** `offsite-backup.sh` (yerel sağlıklı + rclone + B2 API + checksum = SUCCESS)
- Watchdog: saatte bir, 24s WARNING / 48s CRITICAL

Dolayısıyla **tasarım RPO ≈ son SUCCESS offsite’tan felakete kadar**, normal günde **&lt; 24 saat**. 02:00–02:30 arası alınan ve henüz B2’ye gitmeyen yerel kopya VPS ile birlikte kaybolur → RPO o gece penceresine yayılır.

---

## Son bilinen nokta (yeniden ölçülmedi)

FAZ 2 (2026-08-17):

| Alan | Kayıt |
|------|--------|
| Health | `result=SUCCESS` |
| `lastSuccessAt` | `2026-08-17T12:02:15+03:00` |
| DB B2 | `backup_2026-08-17_11-56-54.sql.gz` |
| Uploads B2 | `uploads_20260817_115702.tar.gz` |
| Restore test | PASS, `testedAt=2026-08-17T12:30:00+03:00`, 164 public tablo, `claim_files=19` |
| Bozuk nesne | `backup_2026-08-17_02-00-01.sql.gz` (20 byte) — RPO hesabına **girmez** |

Tatbikat günü bu tablo **B2 listesi + health JSON** ile yenilenir. Değerler rapora secret olarak yazılmaz.

---

## RPO ölçümü (tatbikat)

**Ortam:** Okuma: B2 `ls` + health. Yazma yok.

| Adım | Ne | Nasıl | Kaydedilecek |
|------|-----|--------|----------------|
| RPO-1 | Son SUCCESS zamanı | Admin Yedek Sağlığı veya `logs/backup-health/latest.json` → `lastSuccessAt` | ISO zaman |
| RPO-2 | Felaket varsayım anı | Tatbikat T0 (duyuru saati) | ISO zaman |
| RPO-3 | Pencere | T0 − lastSuccessAt | Saat / dakika |
| RPO-4 | Hedef | Pencere &lt; 24 saat? | PASS / FAIL |
| RPO-5 | Kayıp veri niteliği | T0 sonrası oluşan dosya/evrak (varsa test kaydı) restore’da yok | Kalitatif not |
| RPO-6 | Uploads sapması | `verify-upload-integrity.sh` | CRITICAL sayısı (tarihsel eksik fotoğraf mümkün) |
| RPO-7 | Yanlış dump | 20 byte gzip gibi nesneler elenir | Kullanılan dosya adı (içerik hash’i, secret yok) |

**Hedef değer:** RPO &lt; 24 saat. FAIL ise cron/offsite/watchdog kök nedeni (ayrı iş).

---

## RTO ölçümü (ayrı VPS tatbikatı — onaylı)

Production VPS’e restore **yok**. Kronometre T0 = “yeni VPS ssh açıldı”.

| Aşama | İş | Süre alanı | Not |
|-------|-----|------------|-----|
| T1 | OS + Docker + paket | ___ dk | Distro bu fazda kilitli değil |
| T2 | Git checkout tag | ___ dk | `04d52b8` doğrula |
| T3 | Secret yerleştirme | ___ dk | Kasa yoksa **blokaj** — süre “secret bekleniyor” diye ayrı yaz |
| T4 | B2 indir (dump + tar) | ___ dk | Ağ / rclone |
| T5 | Postgres up + DB restore | ___ dk | `postgres:16-alpine`, migrate yok |
| T6 | Uploads tar restore | ___ dk | |
| T7 | Docker build web+backend | ___ dk | Registry yok; en uzun aşama olabilir |
| T8 | Compose up + health | ___ dk | `-p sigorta-hasar-sistemi` |
| T9 | DNS TTL + kesim | ___ dk | Registrar’a bağlı (**ölçülmedi**) |
| T10 | Let’s Encrypt | ___ dk | DNS sonrası |
| T11 | Login + 1 dosya + 1 fotoğraf | ___ dk | Operatör; Cursor prod login yok |
| **RTO** | T11 − T0 | ___ dk | Hedef: ilk ölçümden sonra ürün kararı |

Paralel yapılabilir: T7 build, T4 indirme (secret varsa). DNS (T9) SSL’i kilitler.

---

## Tatbikat kuralları

1. Ayrı VPS veya durdurulmuş kopya. Canlı `sigorta-postgres` hedef değil.
2. B2’ye `copy`/`sync` ile silme/overwrite yok (tatbikat **get**).
3. Süreler dakikaya yuvarlanır; tahmini yazılmaz, ölçü yazılır.
4. T3 secret yoksa RTO “sınırsız / operatör kilitli” olarak işaretlenir — bu **bilinen DR eksiği**.

---

## Çıktı şablonu (tatbikat sonrası doldurulur)

```
Tarih:
T0:
lastSuccessAt:
RPO_saat:
RPO_hedef_24h: PASS/FAIL
T1..T11 dakikaları:
RTO_dakika:
Blokajlar:
Integrity CRITICAL:
Karar (Mustafa):
```

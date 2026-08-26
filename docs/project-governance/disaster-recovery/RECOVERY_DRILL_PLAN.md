# Recovery Tatbikat Planı — Meridyen

**Senaryo:** Production VPS tamamen kayboldu (disk, sağlayıcı, erişilemez host).  
**Tarih:** 2026-08-17  
**Yapılmayan (tatbikat onayına kadar):** Canlı VPS’te restore, canlı B2 silme, DNS’i kalıcı kesme, bu fazda deploy.

---

## Amaç

Ayrı bir **tatbikat VPS** üzerinde GitHub snapshot + B2 dump ile sistemi ayağa kaldırmak; `RTO_MEASUREMENT.md` sürelerini doldurmak; secret kasasının işe yaradığını kanıtlamak.

Canlı `94.138.216.18` / `sigorta-postgres` **hedef değildir**.

---

## Ön Koşullar

Tatbikat **T0’dan önce** hepsi hazır olmadan başlatılmaz (FAZ D: B2/kasa yokken restore’a geçilmedi).

- [ ] DR VPS hazır (production IP değil, ayrı makine)
- [ ] Docker hazır (`docker` + Compose v2)
- [ ] GitHub erişimi hazır (tag `production-v505-2026-08-17`)
- [ ] B2 erişimi hazır (`B2_ACCESS_RECOVERY_CHECKLIST.md` yeşil; yalnız okuma)
- [ ] Secret Vault erişimi hazır (`SECRET_VAULT_SETUP_CHECKLIST.md` çekirdek satırlar `☑`)

Biri eksikse tatbikat **iptal**; süre “uygulama RTO” sayılmaz.

---

## Önkoşul (tatbikat günü T0 öncesi — ayrıntı)

| # | Koşul | Yoksa |
|---|--------|--------|
| 1 | Vault veya operatör elinde B2 + GitHub erişimi | Tatbikat **iptal** (ölçülecek şey “secret yok”) |
| 2 | Tag `production-v505-2026-08-17` GitHub’da | FAZ A.2.4 tamam |
| 3 | B2’de geçerli `db/` + `uploads/` | FAZ 2 SUCCESS nesneleri veya daha yenisi |
| 4 | Ayrı VPS (canlı DNS’e **bağlanmadan** IP ile test mümkün) | Canlı kesilmez |
| 5 | Mustafa onayı | Feature freeze / canlı DNS kararı |

İsteğe bağlı: tatbikat B2 bucket kopyası. Yoksa canlı bucket’tan **yalnızca `rclone copy` (get)**.

---

## Senaryo anlatımı (operatöre)

1. Canlı sunucu yok varsay.  
2. Yeni makine aç.  
3. Kasa → B2 + GitHub.  
4. Tag checkout.  
5. Dump + uploads indir, restore et, build et, compose `-p sigorta-hasar-sistemi`.  
6. Login: tatbikat IP veya hosts dosyası (`app.meridyen-tr.com` canlı DNS’e dokunma). SSL: IP ile self-signed **veya** staging hosts + geçici sertifika. Canlı Let’s Encrypt’i tatbikat IP’sine çekmek **canlı siteyi kırar** — tatbikatta yapma.  
7. Backup cron’u tatbikat makinesinde bir kez **elle** `backup.sh` (B2’ye yazmadan: `RCLONE_REMOTE` boş bırakılır veya tatbikat remote).  
8. Tatbikat VPS imha. Canlıya dokunulmadı.

---

## Kontrol listesi

| # | Madde | Kanıt | PASS |
|---|--------|--------|------|
| 1 | Yeni VPS açıldı | SSH, `hostname`, IP notu | ☐ |
| 2 | Docker kuruldu | `docker version` · `docker compose version` | ☐ |
| 3 | GitHub snapshot indirildi | `git rev-parse HEAD` = `04d52b8aa432bf739e01a47030245bdfcada6f68` | ☐ |
| 4 | B2 erişimi sağlandı | `rclone ls` `db/` + `uploads/` (ad listesi) | ☐ |
| 5 | DB restore edildi | `psql` hata yok; `claim_files` sayısı not | ☐ |
| 6 | Upload restore edildi | `uploads/` dolu; integrity çıktısı saklanır | ☐ |
| 7 | Backend ayağa kalktı | `sigorta-backend` healthy · `/api/v1/health` | ☐ |
| 8 | Web ayağa kalktı | `sigorta-web` healthy | ☐ |
| 9 | Login testi yapıldı | Operatör `/giris` (Cursor production login yok). Tatbikat URL/hosts. | ☐ |
| 10 | Backup tekrar çalıştı | `bash /opt/app/scripts/backup.sh` yerel `sql.gz` + `gzip -t`. **Canlı B2 overwrite yok** (rclone kapalı veya ayrı remote). | ☐ |

Ek (zorunlu değil, ölçülür): nginx health, bir rapor fotoğrafı, Yedek Sağlığı sayfası.

FAIL: migrate deploy, yanlış compose proje adı, `30d5d8f` checkout, canlı DNS kesimi, canlı postgres’e bağlanma.

---

## Kapanış

- Süreler `RTO_MEASUREMENT.md` şablonuna işlenir.  
- Integrity CRITICAL varsa sapma notu (ürün kararı değil, bilinen sınır).  
- Tatbikat VPS silinir; volume prune.  
- Canlı crontab / image / B2 **aynı** kalır.

İlk PASS tatbikat = RTO sayısı + “kasadan B2 açıldı” kanıtı. O olmadan DR **belgeli ama ölçülmemiş** kalır.

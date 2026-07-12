# Onarım Raporu — Bekleyen İş Kilidi (12 Temmuz 2026)

**Canlı referans (SSH doğrulandı — 12 Temmuz 2026 ~12:03 TR):** Web **v294** · Backend **v281** · Rollback web **v293** / backend **v280**  
**Deploy hedefi:** Web v294 + Backend v281 — **canlıya alındı** (full deploy, commit `db506eb`)  
**Kural:** Mustafa PASS olmadan «kabul tamam» denmez.

## Commit ve deploy durumu

| Adım | Durum | Not |
|------|--------|-----|
| Git commit | ✅ | `db506eb` — fix(v294) onarım raporu madde 1/5/26/33/39 + v293 batch |
| Pre-deploy safety | ✅ | DB yedeği `pre_v294-onarim-raporu-madde-batch_20260712_114502.sql.gz` |
| Image build | ✅ | `sigorta-web:…-v294-amd64`, `app-backend:…-v281-amd64` |
| Container swap | ✅ | override + restart tamamlandı |
| Nginx routing | ✅ | `verify-nginx-web` PASS |
| Prisma migrate | ✅ | `20260712120000_report_write_sessions` uygulandı |
| Backend health | ✅ | `/api/v1/health` ok |
| SSH canlı image | ✅ | `docker inspect` → v294 + v281 |
| Mustafa ekran PASS | ⏳ | Ctrl+Shift+R + footer **v294** / backend **v281** |

**Deploy komutu (kayıt):** `BACKEND_VERSION=v281 bash scripts/deploy-full-production.sh v294-onarim-raporu-madde-batch`  
**Migration:** `20260712120000_report_write_sessions` (ReportWriteSession tablosu)

## Madde durumu (v294 batch)

| Madde | Konu | Kod | Mustafa PASS |
|-------|------|-----|--------------|
| 1 | Üst bant (dosya no kalın, sigortalı alt satır, RPT/hasar no kaldır, rozetler sağ üst) | ✅ | ⏳ |
| 5 | Hızlı onarım FULL (Dahili Su etiketi, kalemler listesi, fallback seed) | ✅ | ⏳ |
| 26 | Tedarikçi maliyet hafızası (tolerans + confirm + VendorQuoteModal) | ✅ | ⏳ |
| 33 | Tedarikçi karşılaştır iptal + öneri + WhatsApp şablon zorunlu atama | ✅ | ⏳ |
| 39 | Personel yazım süresi analizi (write-session + personel tab) | ✅ | ⏳ |
| v293 | Foto galeri, eksper, ihbar, sticky header, tespit alanı, alt bant | ✅ (934e268 dahil) | ⏳ |

## Uygulama sırası (P0 → P2) — önceki dalgalar

| Öncelik | Madde | Risk | Kod durumu |
|---------|-------|------|------------|
| P0 | 21 İhbar tarihi (mail/oluşturma) | Veri gösterimi | ✅ |
| P0 | 14/20 Dosya Eksperi rapora yansıma | Yanlış müşteri algısı | ✅ |
| P0 | 10 Fotoğraf yükleme | Veri kaybı / sayfa yenileme | ✅ |
| P1 | 22 Tab → yeni satır; boş satır silme | Akış | ✅ |
| P1 | 15 Alt bant buton sağa | UI | ✅ |
| P1 | 19/41 Revizyon çubuk+nokta | UI | ✅ |
| P2 | 2/18/28 sticky header | UI | ✅ |
| P2 | 30 «Tespit Alanı» başlık + zorunlu | UI | ✅ |
| P2 | 38 Alt bant analiz + süre/sayaç | UI | ✅ |
| — | 16 Yasal notlar | Mustafa metni bekliyor | ⏸ |

## Madde 26 — uygulama (v294)

1. İş grubu satırı kaydedilince `readVendorPriceMemory` ile son tedarikçi fiyatını oku.
2. Girilen maliyet ±%15 tolerans içindeyse sessiz devam; dışındaysa `window.confirm` («Hafızadaki X TL — devam?»).
3. Uyumsuz onay reddinde `VendorQuoteModal` / WhatsApp pazarlık akışına yönlendir.

## Kayıp önleme (kod)

1. Rapor satırı: `load()` yerine API yanıtıyla satır güncelle; scroll koru
2. Fotoğraf: başarısız yüklemede tam sayfa reload yok
3. Boş satır: kayıtta işlenmemiş satır API'ye gitmesin / silinsin
4. Eksper: `resolveFileExpertDisplay` — dosya sorumlusu asla eksper sayılmaz
5. Full deploy: backend değişti — DB yedeği alındı (pre-deploy-safety)

## Deploy

- Dalga: `panel-build-info.ts` → **v294** / **v281** → Mustafa footer doğrular
- Rollback: `scripts/rollback-production.sh` veya override web v293 + backend v280

# Onarım Raporu — Bekleyen İş Kilidi (12 Temmuz 2026)

**Canlı referans:** Web **v292** · Backend **v279** · Rollback web **v291** / backend **v278**  
**Deploy hedefi:** Web v292 — **canlıya alındı** (12 Temmuz 2026 ~11:09 TR, web-only)  
**Kural:** Mustafa PASS olmadan «kabul tamam» denmez.

## Commit ve deploy durumu

| Adım | Durum | Not |
|------|--------|-----|
| Git commit | ✅ | `82155ca` — fix(v292) revizyon sağ üst |
| Pre-deploy safety | ✅ | DB yedeği `pre_v292-revizyon-gecmisi-sag-ust_20260712_110321.sql.gz` |
| Image'lar | ✅ | `sigorta-web:…-v292-amd64`, `app-backend:…-v279-amd64` (değişmedi) |
| Nginx routing | ✅ | `verify-nginx-web` PASS |
| Kritik path hash | ✅ | `verify-critical-paths.sh --remote` uyumlu |
| Smoke (genel rotalar) | ⚠️ | Login FAIL (yerel `LOGIN_EMAIL`/`LOGIN_PASSWORD` yok); diğer rotalar PASS |
| Mustafa ekran PASS | ⏳ | Ctrl+Shift+R + footer **v292** + madde 19/41 revizyon yerleşimi |

**Deploy komutu (kayıt):** `bash scripts/deploy-web-production.sh v292-revizyon-gecmisi-sag-ust`  
**Migration:** Yok (web-only)

## Uygulama sırası (P0 → P2)

| Öncelik | Madde | Risk | Kod durumu (12 Temmuz oturum) |
|---------|-------|------|-------------------------------|
| P0 | 21 İhbar tarihi (mail/oluşturma) | Veri gösterimi | ✅ `inboundReceivedAt` + `resolveIhbarTarihi` |
| P0 | 14/20 Dosya Eksperi rapora yansıma | Yanlış müşteri algısı | ✅ `resolveFileExpertDisplay` shared |
| P0 | 10 Fotoğraf yükleme | Veri kaybı / sayfa yenileme | ✅ state + `authAxios`, acil editör `localReport.images` |
| P1 | 1 Üst bant (dosya no, sigortalı, RPT kaldır, rozetler) | UI | ✅ `DosyaSayfaUstu` + rapor header |
| P1 | 22 Tab → yeni satır; boş satır silme | Akış | ✅ Tab son kolon → yeni satır; `discardEmptyDraft` |
| P1 | 15 Alt bant buton sağa | UI | ✅ grid `justify-end` (acil + ana) |
| P1 | 19/41 Revizyon çubuk+nokta, sağ üst (Taslak/Satış/Kâr altı) | UI | ✅ v292 `RevisionHistoryStrip` — Dosya Bilgileri'nden kaldırıldı |
| P1 | 5 Hızlı onarım kalemleri listesi | Veri/seed | ✅ fallback hasar türü şablon sorgusu |
| P2 | 2 ek, 18 ek, 28 ek sticky header | UI | ⏳ |
| P2 | 30 ek «Tespit Alanı» başlık + zorunlu | UI | ⏳ |
| P2 | 38 ek Alt bant: «Rapor Oluşturma Analizi» + sol süre/sayaç · orta finans · sağ buton | UI | ⏳ |
| P2 | 33 İPTAL satır karşılaştır + tedarikçi öneri + WhatsApp şablon ayarları | Özellik | 📋 Plan |
| — | 39 Personel sayfası yazım süresi analizi | Raporlama | 🔔 **Etap bitince Mustafa'ya hatırlat** |
| — | 16 Yasal notlar | Mustafa metni bekliyor | ⏸ |

## Madde 26 — plan notu (sonraki dalga)

1. İş grubu satırı kaydedilince `readVendorPriceMemory` ile son tedarikçi fiyatını oku.
2. Girilen maliyet ± tolerans içindeyse sessiz devam; dışındaysa inline onay («Hafızadaki X TL — devam?»).
3. Uyumsuz onay reddinde `VendorQuoteModal` / WhatsApp pazarlık akışına yönlendir.
4. Backend audit log zorunlu değil (web-only); `sessionStorage` + satır `metrajData` yeterli MVP.

## Kayıp önleme (kod)

1. Rapor satırı: `load()` yerine API yanıtıyla satır güncelle; scroll koru
2. Fotoğraf: başarısız yüklemede tam sayfa reload yok
3. Boş satır: kayıtta işlenmemiş satır API'ye gitmesin / silinsin
4. Eksper: `resolveFileExpertDisplay` — dosya sorumlusu asla eksper sayılmaz
5. Migration yok (web-only dalgalar); backend değişirse DB yedeği zorunlu

## Deploy

- Dalga sonu: `panel-build-info.ts` → **v291** → web (+ backend claim `inboundReceivedAt`) → Mustafa footer doğrular
- Tek commit mesajında madde numaraları
- Backend: `claim-files findOne` minimal ekleme — deploy öncesi DB yedeği (alındı)

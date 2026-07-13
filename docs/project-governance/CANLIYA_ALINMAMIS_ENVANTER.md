# Canlıya Alınmamış / Yarım Kalan İşler Envanteri

**Tarih:** 11 Temmuz 2026  
**Referans canlı sürüm:** Web **v248** + Backend **v249** (`deploy/manifests/KNOWN_GOOD_IMAGES.json`)  
**Rollback:** Web v247 / Backend v248  
**Etiket:** `v249-inbound-ingest-fix`  
**Deploy geçmişi / kronoloji:** `DEPLOY_GECMISI.md` ← **“son ne alındı?” tek cevap**  
**Şablon kabul kriterleri:** `canli-kabul/P1_SIDEBAR_DASHBOARD_KABUL_KRITERLERI.md`  
**Güvenlik protokolü:** `DEPLOY_GUVENLIK_PROTOKOLU.md`

---

## Önemli: Üç ayrı kategori (karıştırma)

Bu dosya **“canlıda yok”** ile **“canlıda var ama kabul/test eksik”** ve **“gelecek faz”** maddelerini ayırır.

| Kategori | Anlam | Örnek |
|----------|--------|--------|
| **D — Deploy bekleyen kod** | Repoda var, sunucu image’ında **yok** | *(şu an boş — D1 v249’da kapandı)* |
| **A — Kabul / test eksik** | Kod **canlıda**; Mustafa PASS veya smoke kanıtı eksik | Harita filtre testi, gelen kutusu T1–T7 |
| **P — Şablon / UI eksik** | Kod iskeleti canlı; **onaylı mockup birebir değil** | Admin Yönetim Merkezi mockup |
| **B — Gelecek faz / bilinçli erteleme** | Canlıdaki sürümün **sonraki** adımı veya ops işi | PayTR merchant canlı mod, CRM derinliği, e-imza |

> **Yanlış okuma:** “Envanterde geçiyor” ≠ “canlıya alınmamış”. A ve B maddelerinin çoğu **zaten canlıda**; eksik olan ürün kapanışı veya sonraki fazdır.

---

## D — Deploy bekleyen kod (repoda var, canlı image’da yok)

| # | Konu | Durum |
|---|------|--------|
| — | *(boş)* | Son gap **D1** → **10 Temmuz 2026 v249** ile canlıya alındı |

### Operasyonel (uygulama deploy’u değil)

| # | Konu | Dosya | Not |
|---|------|-------|-----|
| D2 | Yetim hasar dosyası ofis ataması backfill | `scripts/backfill-orphan-claim-office-assignments.sql` | Sunucuda SELECT → onay → UPDATE; kod deploy’u değil |

---

## A — Canlıda VAR; ürün kapanışı / Mustafa PASS eksik

| # | Konu | Canlı kanıt | Eksik olan |
|---|------|-------------|------------|
| A1 | Resmi kabul screenshot’ları | Smoke route 200 | Modül modül Mustafa PASS + `canli-kabul/ekran-goruntuleri/` |
| A2 | Mustafa test listesi (`BACKLOG.md`) | İlgili sayfalar canlı | 13 maddelik manuel test oturumu |
| A3 | Operasyon gelen kutusu T1–T7 | `/panel/operasyon/gelen-kutusu` canlı (v110+, v248/v249 delta) | Test paketi PASS değil |
| A4 | Giriş logo / kurumsal karşılama | `/giris` canlı | Eski not: canlı görsel Mustafa HAYIR — ayrı web deploy gerekebilir |
| A5 | Hoş geldin / davet maili | Davet akışı kodu canlı | Gerçek gönderim log kanıtı + Mustafa PASS |
| A6 | Harita manuel test | `/panel/harita` canlı (v125+) | Filtre/pin Cmd+Shift+R testi |

---

## P — Onaylı şablon (P1 Dashboard) — implementasyon kapandı

| # | Konu | Canlı | Durum |
|---|------|-------|-------|
| P0 | Sol menü kabuğu (240/72, logo, daralt, topbar) | **v344** | ✅ Kod · ⏳ Mustafa PASS |
| P1 | Admin Yönetim Merkezi (A0–A5 + A3/A4) | **v345** + **v348** | ✅ Kod · ⏳ Mustafa PASS |
| P2 | Dosya sorumlusu merkezi (D0) | **v346** | ✅ Kod · ⏳ Mustafa PASS |
| P3 | Saha Operasyon Merkezi (F0) | **v347** (pakette v348) | ✅ Kod · ⏳ Mustafa PASS |

> Detay: `canli-kabul/P1_SIDEBAR_DASHBOARD_KABUL_KRITERLERI.md` — **13 Tem P1 kapanış**. v349 yok. Büyük paket (PayTR) ayrı tur.

---

## B — Gelecek faz / bilinçli erteleme (canlı sürümün ötesi)

| # | Konu | Canlıda ne var | Eksik / sonraki |
|---|------|----------------|-----------------|
| B1 | D276 Finans UX | Finans rotaları + v248 dashboard | Alt sayfa ince ayar (opsiyonel paket) |
| B3 | D255 Sahip CRUD standardı | `/panel/sahiplik` canlı | Tek tip şablon standardizasyonu |
| B5 | CRM tam kapsam | `/panel/crm` route canlı | İlişki havuzu, performans metrikleri |
| B6 | Gelen kutusu F2–F3 | F1 + dosya açma + Graph delta (v248/v249) | AI sınıflandırma, M365 sihirbazı, e-posta sekmesi |
| B7 | Online kart (PayTR) | `/odeme/[token]`, backend servisi canlı | Merchant `.env`, canlı mod, uçtan uca tahsilat testi |
| B8 | Saha keşif F2–F3 | F1 iskelet canlı | Annotated foto, Bluetooth lazer, mobil offline |
| B9 | Tedarikçi canlı GPS | Harita pinleri canlı | Mobil uygulama GPS — sonraki faz |
| B10 | RFQ UAVT adres | — | Tasarım / RFQ |
| B11 | SSH sertleştirme | Plan dokümanı | Bakım penceresi uygulaması |
| B12 | E-imza (personel özlük) | `/panel/personel-ozluk` canlı | 5070 nitelikli e-imza F5d |

### Bu listeden çıkarılan (eski envanter hatası)

| Eski madde | Neden çıkarıldı |
|------------|-----------------|
| ~~B2 D278 MinIO~~ | **Canlıda çalışıyor** — `sigorta-minio` container Up (sunucu teyidi 10 Temmuz 2026) |
| ~~“Gelen kutusu canlıya alınmadı”~~ | v110+ / v248 / v249 ile canlı; eksik olan **test PASS** (A3) |
| ~~“Harita canlıya alınmadı”~~ | v125+ canlı; eksik olan **manuel test** (A6) |
| ~~“Tedarikçi dış arama canlıya alınmadı”~~ | Faz 2–3 canlı (`TEDARIKCI_DIS_ARAMA_HAZIRLIK.md`); BACKLOG ⬜ satırları güncel değil |

---

## Canlıda kapalı — tekrar deploy gereksiz

Aşağıdakiler bilinen iyi sürümde (**web v248 + backend v249**) **canlıda** kabul edilir.

### Altyapı
- PostgreSQL, Redis, Nginx, **MinIO** — container’lar healthy

### Platform
- Ayarlar anayasası (v26–v29)
- Kullanıcı davet + geçici şifre
- Sol menü (`PanelSidebar`) + rol kılavuzu (v233+)
- KVKK / sözleşme onay modalı
- Tanımlar Merkezi hub

### v248 (web) + v249 (backend) paketleri
- Dashboard **iskeleti** (şablon birebir değil — P1)
- Hasar dosyası detay — sigortalı / adres / ihbar
- HASAR Graph delta otomatik kurtarma
- Gelen kutusu inbound ingest build fix (`ef87cdb`)
- Operational access grants
- Global arama genişletmesi

### Önceki dalgalardan canlı (özet)
- Müşteri modülü UX (v76–v79, Mustafa PASS)
- Finans rolleri, mobil portal, carilerim (v223)
- Oturum güvenliği (v227–v232)
- IDOR scope, bakım modu (v225)
- Gelen kutusu çekirdek + dosya açma modal (v110+)
- Harita pinleri (v125+)
- Mobil giriş UX (v126–v127)
- Tedarikçi dış kaynak arama Faz 2–3
- Personel özlük, eksper/sigorta/broker portalları
- PayTR kod yolu (`/odeme/[token]`)

---

## Önerilen sıradaki adım (13 Temmuz 2026)

1. **Mustafa P1 canlı PASS** — admin / D0 / saha screenshot (`TEST_OTURUMU` P1-DASH)
2. **Büyük paket** — PayTR canlı (B7) **veya** Mustafa’nın seçtiği sonraki paket
3. **A paketi** (deploy yok): A3 gelen kutusu + A6 harita manuel test (ayrı işler)
4. **S7 menü gruplama** — yalnızca Mustafa kararı sonrası

---

## İlgili belgeler

| Belge | Amaç |
|-------|------|
| `DEPLOY_GECMISI.md` | Deploy kronolojisi + canlı durum özeti |
| `deploy/manifests/KNOWN_GOOD_IMAGES.json` | Bilinen iyi / rollback |
| `docs/project-governance/canli-kabul/CHECKLIST.md` | Modül kabul |
| `BACKLOG.md` | Manuel test listesi *(bazı ⬜ satırlar güncel değil)* |

---

*Deploy sonrası güncelleme: 10 Temmuz 2026 — v249 backend-only tamamlandı; envanter üç kategoriye ayrıldı.*

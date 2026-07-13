# Onaylı UI Checklist — Regresyon Kalkanı

**Güncelleme:** 14 Temmuz 2026  
**Bilinen iyi sürüm (kod):** Web **v350** (logo) + Backend **v349** (finans guard)  
**Manifest:** `deploy/manifests/KNOWN_GOOD_IMAGES.json`  
**Rollback:** Web **v348** / Backend **v348** (v350 deploy sonrası; v349 anında web v346)  
**P1 Dashboard:** implementasyon **kapandı** (v344–v348); logo kabuk **v350**

Bu dosya **canlıda onaylanmış** görünüm ve bileşenlerin tek kaynağıdır. Agent panel/layout/portal dosyalarına dokunmadan önce burayı okur. Onaylı maddeyi değiştirmek için Mustafa onayı şarttır.

Durum: `✅ Onaylı` | `⏳ Teyit bekliyor` | `❌ Bilinen regresyon`

---

## Zorunlu agent akışı

1. **Önce oku** — bu dosya + ilgili ortak bileşen (`PanelSidebarBrand`, `PortalCompactHeader`, `PortalPageHeader`)
2. **Tek kaynak kullan** — inline hero / tekrarlayan header yazma
3. **Kapsam dar tut** — istenen alan dışına dokunma
4. **Deploy öncesi** — aşağıdaki «Deploy öncesi görsel kontrol» maddelerini teyit et
5. **Onay değişirse** — Mustafa PASS sonrası bu dosyayı güncelle + `ekran-goruntuleri/` altına screenshot

---

## O — Ortak kabuk (tüm `/panel/*`)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| O1 | Masaüstünde topbar’da logo var (mockup v350); sidebar markası ayrı | `layout.tsx` Navbar + `PanelSidebarBrand` | ⏳ v350 |
| O2 | Panel metinleri **Title Case**; `uppercase` CSS yok | `turkce-yazim-kulturu.mdc`, `toTitleCaseTR()` | ✅ |
| O3 | UI'da **vaka** değil **dosya** terimi | `turkce-yazim-kulturu.mdc` | ✅ |
| O4 | Ayarlar menüsü tek kaynak `settings-nav.ts` — `layout.tsx`'e ikinci liste yok | `settings-nav.ts` | ✅ |
| O5 | Topbar: Logo → Arama → Hızlı İşlem → Bildirim → Yardım → Tema → Kullanıcı → Durum | `layout.tsx` Navbar | ⏳ v350 |

---

## S — Sidebar (Panel Shell)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| S1 | Geniş menü: stacked SVG wordmark `%80–85` — PNG UI’da yok; orijinal PNG arşiv | `PanelSidebarBrand.tsx` + `brand/meridyen-stacked.svg` | ⏳ v350 |
| S2 | Dar menü: yalnız küre SVG — chevron footer’da | `brand/meridyen-globe.svg` | ⏳ v350 |
| S3 | Viewport dock: üst logo, orta scroll nav, alt daralt (+ dar ikon yardım) | `layout.tsx` + `PanelSidebarBrand` + `PanelSidebarGuideFooter` | ⏳ v350 |
| S4 | Daralt/genişlet tercihi `localStorage panel-sidebar-collapsed` | `layout.tsx` | ✅ |
| S5 | Alt kılavuz: kalıcı sağ panel yok; topbar Yardım + dar sidebar ikon | `resolvePanelUserGuide()` | ⏳ v350 |
| S6 | Genişlik **224px açık / 70px kapalı** (mockup 220–230 / 68–72) | `panel-layout-spacing.ts` | ⏳ v350 |
| S7 | Aktif: `#EEF4FF` zemin / `#2563EB` metin + sol 4px çizgi | `globals.css` `.panel-sidebar-nav-link--active` | ⏳ v344 — Mustafa canlı teyit |

**Yasak:** Sidebar’da animasyonlu küre; orijinal PNG replace; kalıcı sağ kılavuz paneli.

---

## A — Admin Yönetim Merkezi (`/panel` admin)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| A1 | Kompakt dashboard spacing — sıkışık kartlar | `page.tsx`, `DashboardShell` | ✅ v253+ |
| A2 | Haftalık Performans **compact** mod | `WeeklyPerformanceWidget` | ✅ v258+ |
| A3 | KPI kartları **compact** prop | `KpiCard` | ✅ v253+ |
| A4 | Başlık **Operasyon Yönetim Merkezi** + Admin rozeti; CTA + Yeni Hasar / + Yeni Acil / Pazartesi | `page.tsx`, `DashboardHeader` | ⏳ v345 — Mustafa canlı teyit |
| A5 | Kalıcı sağ kılavuz **yok** (v350); yardım topbar | — | ✅ v350 |
| A6 | A3: Ekip Yoğunluğu bar + Personel Yükü; A4: Günün Akışı 4 bugün metriği + Gider Dağıtımı | `WeeklyPerformanceWidget`, `AdminDailyFlowSection`, `/dashboard/daily-flow` | ⏳ v348 — Mustafa canlı teyit |
| A7 | Alt 3’lü: Kritik Uyarılar / Finans Darboğazları / Personel Yük (progress) — aynı satır | `AdminBottomRow` | ⏳ v345+ — P1 yeterli |

---

## D — Dosya Sorumlusu Merkezi (`/panel` office_staff)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| D1 | Başlık **Dosya Sorumlusu Merkezi** + rozet; birincil CTA + Yeni Hasar; Acil kapsama göre | `page.tsx`, `DashboardHeader` `isOfficeStaff` | ⏳ v346 — Mustafa canlı teyit |
| D2 | Finans / admin bölümleri yok; Operasyon Özeti + Günün Akışı + Onay Gecikmeleri + alt 3’lü | `OfficeDailyFlowSection`, `OfficeBottomRow`, `ApprovalDelayWidget` | ⏳ v346 — Mustafa canlı teyit |
| D3 | Ofis kalıcı sağ kılavuz yok (v350) | — | ✅ v350 |

---

## F — Saha Operasyon Merkezi (`/panel` field_staff)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| F1 | Başlık **Saha Operasyon Merkezi** + Saha rozeti; CTA Dosyalarıma Git + Carilerim | `page.tsx`, `DashboardHeader` `isFieldStaff` | ⏳ v347 — Mustafa canlı teyit |
| F2 | Finans / onay / admin yok; Saha Özeti + Günün Akışı + alt 3’lü (SLA / Bekleyen / Açık) | `FieldOperationsKpiBand`, `FieldDailyFlowSection`, `FieldBottomRow` | ⏳ v347 — Mustafa canlı teyit |
| F3 | Saha kalıcı sağ kılavuz yok (v350) | — | ✅ v350 |

---

## P — Portal kabuğu (eksper + sigorta)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| P1 | **Eski mavi gradient hero yok** — kompakt beyaz kart + ince mavi üst şerit | `PortalCompactHeader.tsx` | ✅ v262 |
| P2 | Ana sayfa header: `PortalCompactHeader` | eksper + sigorta `page.tsx` | ✅ v262 |
| P3 | Alt sayfa header: `PortalPageHeader` (aynı kart dili) | portal alt sayfaları | ✅ v262 |
| P4 | Portal layout geniş — `max-w-none`, padding `px-2 sm:px-3` | `layout.tsx` (`isPortalUser`) | ✅ v262 |
| P5 | Eksper aksiyon butonları (Yeni İhbar vb.) **sağa hizalı** (lg+ aynı satır) | `PortalCompactHeader` actions slot | ✅ v262 |
| P6 | Kur/döviz + saat: `HeroExchangeRates tone="light"`, `LiveClock compact` | `portal-header-widgets.tsx` | ✅ v262 |
| P7 | İletişim şeridi (WhatsApp, tel, e-posta) header altında | `portal-header-widgets.tsx` | ✅ v261+ |

**Yasak:** Sayfa içine `-mx-3 sm:-mx-4` hack'i ekleyerek layout ile savaşmak; inline gradient hero geri yazmak.

### Portal route'ları (smoke + görsel)

| Route | Header bileşeni |
|-------|-----------------|
| `/panel/eksper-portal` | `PortalCompactHeader` |
| `/panel/eksper-portal/dosyalar` | `PortalPageHeader` |
| `/panel/eksper-portal/onaylar` | `PortalPageHeader` |
| `/panel/eksper-portal/randevular` | `PortalPageHeader` |
| `/panel/sigorta-portal` | `PortalCompactHeader` |
| `/panel/sigorta-portal/dosyalar` | `PortalPageHeader` |
| `/panel/sigorta-portal/onaylar` | `PortalPageHeader` |
| `/panel/sigorta-portal/faturalar` | `PortalPageHeader` |
| `/panel/sigorta-portal/dosya-akisi` | `PortalPageHeader` |

---

## K — Kılavuz HTML/PDF

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| K1 | Kapak ortalı; ekranda A4 `min-height` boşluk sorunu yok | `guide-shared.css` | ✅ v261 |
| K2 | `GUIDE_CONTENT_VERSION` değişince PDF yenilenir | `panel-user-guide.ts` | ✅ |

---

## Deploy öncesi görsel kontrol (web-only)

Deploy etmeden önce agent veya Mustafa şunları teyit eder:

- [ ] **S2** — Dar sidebar küre PNG (SVG değil)
- [ ] **S1** — Geniş sidebar tam logo okunur
- [ ] **P1–P2** — Eksper + sigorta ana sayfa kompakt header (mavi bant yok)
- [ ] **P5** — Eksper butonları sağda
- [ ] **P4** — Portal yan boşluk makul (aşırı gri şerit yok)
- [ ] **A1–A2** — Admin dashboard sıkışık, haftalık performans compact
- [ ] **A6–A7** — Admin A3/A4 + alt 3’lü (`AdminBottomRow`)
- [ ] **D1–D3** — Dosya Sorumlusu Merkezi (v346)
- [ ] **F1–F3** — Saha Operasyon Merkezi (v347)
- [ ] **O1** — Masaüstünde tek logo (sidebar)

Otomatik smoke (`post-deploy-smoke.sh`) route erişimini doğrular; **görsel kabul yerine geçmez**.

### P1 Dashboard dalga özeti (v344–v348)

| Etiket | Kapsam | Not |
|--------|--------|-----|
| v344 | web-only | Shell 240/72, topbar, Menüyü Daralt |
| v345 | web-only | Admin KPI + A5 alt sıra + kılavuz |
| v346 | web-only | Dosya Sorumlusu (D0) |
| v347 | web-only | Saha (F0) — v348 ile canlıya alındı |
| v348 | **full** | Admin A3/A4 + `GET /dashboard/daily-flow` |
| v349 | **backend-only** | Finans API guard + repair version_no 0–3 |
| v350 | **web-only** | Logo / sidebar / topbar SVG kabuk; kalıcı sağ kılavuz kaldırıldı |

---

## Regresyon kaydı (son 2 gün — öğrenilenler)

| Olay | Kök neden | Önlem |
|------|-----------|-------|
| SVG küre geri geldi (v255→v257) | Aynı dosyaya üst üste patch, ortak bileşen yoktu | S2 + `brand.ts` tek kaynak |
| v277 deploy S2 ihlali | Logo «düzeltmesi» checklist okunmadan MeridyenGlobeAnimated geri yazıldı | Deploy öncesi S2 zorunlu; v278 PNG geri |
| v278 ölçek regresyonu | Dar menüde beyaz kart + büyük logo kaldırıldı (ade5d73 cilası) | v279: globe h-12 kart, geniş logo 4.5rem |
| v279 koyu şerit yanıltması | Dar menüde logo alanı koyu (#0f172a) — küre yanıltıcı | v280: logo şeridi her zaman beyaz; geniş logo 5.25rem |
| Sigorta hero eski kaldı | Eksper düzeltildi, sigorta atlandı | P1–P2 ortak `PortalCompactHeader` |
| Yan boşluk / buton sola yığıldı | Layout hack + inline header | P4, P5, ortak bileşen |
| override.yml bozulması | Deploy script | `deploy-web-production.sh` printf fix |

Yeni regresyon görülürse bu tabloya satır ekle; deploy etmeden önce kök neden yaz.

---

## İlgili dosyalar

| Dosya | Rol |
|-------|-----|
| `.cursor/rules/onayli-ui-koruma.mdc` | Agent zorunlu kural |
| `.cursor/rules/deploy-guvenlik.mdc` | Deploy disiplini |
| `canli-kabul/CHECKLIST.md` | Modül modül PASS takibi |
| `canli-kabul/P1_SIDEBAR_DASHBOARD_KABUL_KRITERLERI.md` | Detaylı mockup kriterleri |
| `CANLIYA_ALINMAMIS_ENVANTER.md` | Henüz canlıya alınmamış işler |

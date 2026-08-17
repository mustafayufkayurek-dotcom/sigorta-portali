# Onaylı UI Checklist — Regresyon Kalkanı

**Güncelleme:** 14 Temmuz 2026  
**Bilinen iyi sürüm (kod):** Web **v354** (logo+sidebar nihai 220/72 + header logo) + Backend **v349** (finans guard)  
**Manifest:** `deploy/manifests/KNOWN_GOOD_IMAGES.json`  
**Rollback:** Web **v353** / Backend **v349**  
**P1 Dashboard:** implementasyon **kapandı** (v344–v348); enterprise shell **v351**; dashboard IA **v352**; logo/sidebar HARD **v353**; nihai düzeltme **v354**

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
| O1 | Topbar: ☰ + resmi logo (hamburger ile aynı hiza) + sidebar marka — aynı `meridyen-logo-original.png` | `layout.tsx` Navbar + `BrandLogoMark` + `PanelSidebarBrand` | ✅ v354 |
| O2 | Panel metinleri **Title Case**; `uppercase` CSS yok | `turkce-yazim-kulturu.mdc`, `toTitleCaseTR()` | ✅ |
| O3 | UI'da **vaka** değil **dosya** terimi | `turkce-yazim-kulturu.mdc` | ✅ |
| O4 | Ayarlar menüsü tek kaynak `settings-nav.ts` — `layout.tsx`'e ikinci liste yok | `settings-nav.ts` | ✅ |
| O5 | Topbar: ☰ Logo → Arama → Hızlı İşlem → Bildirim → Yardım → Tema → Profil → Sistem Sağlık | `layout.tsx` Navbar | ✅ v354 |
| O6 | Yardım = overlay Help Drawer (resize + localStorage); kalıcı sağ panel yok | `PanelHelpDrawer` + `PanelHelpDrawerContext` | ✅ v351 |
| O7 | 5 tema: Açık / Koyu / Kurumsal Mavi / Kurumsal Koyu / Yüksek Kontrast | `PanelThemeToggle` + `panel-time-theme.ts` | ⏳ v352 |
| O8 | Operasyon Aktif → Sistem Sağlık paneli | `PanelSystemHealth` | ⏳ v352 |

---

## S — Sidebar (Panel Shell)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| S1 | Geniş menü: resmi `meridyen-logo-original.png` **%80 / max 176px** h-auto; sabit h-6/h-8/h-11 yok | `PanelSidebarBrand.tsx` + `globals.css` | ✅ v354 |
| S2 | Dar menü: resmi `meridyen-logo-globe.png` — chevron footer’da | `PanelSidebarBrand` | ✅ v353 |
| S3 | Viewport dock: üst logo, orta scroll nav, alt daralt + Yardım | `layout.tsx` + `PanelSidebarBrand` + `PanelSidebarGuideFooter` | ✅ v351 |
| S4 | Daralt/genişlet tercihi `localStorage panel-sidebar-collapsed` | `layout.tsx` | ✅ |
| S5 | Yardım = Help Drawer (topbar + sidebar); açık/genişlik localStorage | `PanelHelpDrawer` | ✅ v351 |
| S6 | Genişlik HARD **220px açık / 72px kapalı** (`min/max` + inline style + CSS `!important`) | `panel-layout-spacing.ts` + `globals.css` + `layout.tsx` | ✅ v354 |
| S7 | Aktif: `#EEF4FF` zemin / `#2563EB` metin + sol 4px çizgi + bold | `globals.css` `.panel-sidebar-nav-link--active` | ✅ v351 |
| S8 | Operasyon badge = revizyon + gelen kutusu sayısı | `layout.tsx` | ⏳ v352 |

**Yasak:** Sidebar’da animasyonlu küre; AI SVG brand; kalıcı sağ kılavuz. Header + sidebar aynı resmi PNG asset kullanır (boyut tutarlı).

---

## A — Admin Yönetim Merkezi (`/panel` admin)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| A1 | Kompakt dashboard spacing — gap 16–20 | `page.tsx`, `DashboardShell` | ⏳ v352 |
| A2 | Haftalık Performans C4 sol hücre (Günün Akışı ile yan yana) | `WeeklyPerformanceWidget` | ⏳ v352 |
| A3 | KPI kompakt şerit (~48–56px) — hero yok | `AdminOperationsKpiBand` | ⏳ v352 |
| A4 | Başlık **Operasyon Yönetim Merkezi** + Admin rozeti; CTA + Yeni Hasar / + Yeni Acil / Pazartesi | `page.tsx`, `DashboardHeader` | ✅ |
| A5 | Kalıcı sağ kılavuz **yok**; yardım = Help Drawer | `PanelHelpDrawer` | ✅ |
| A6 | Canvas: C1 Başlık → C2 KPI → C3 Operasyon\|Kritik → C4 Haftalık\|Akış → C5 Finans ince | `page.tsx` | ✅ v354 |
| A7 | C3: Operasyon (bekleyen/SLA/atama/kritik/aktivite) \| Kritik Uyarılar | `AdminOperationsCriticalRow` | ✅ v354 |

---

## D — Dosya Sorumlusu Merkezi (`/panel` office_staff)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| D1 | Başlık **Dosya Sorumlusu Merkezi** + rozet; birincil CTA + Yeni Hasar; Acil kapsama göre | `page.tsx`, `DashboardHeader` `isOfficeStaff` | ✅ |
| D2 | Finans / admin bölümleri yok; KPI + alt paneller + akış / onay | `OfficeDailyFlowSection`, `OfficeBottomRow`, `ApprovalDelayWidget` | ⏳ v352 |
| D3 | Ofis kalıcı sağ kılavuz yok (v350) | — | ✅ |

---

## F — Saha Operasyon Merkezi (`/panel` field_staff)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| F1 | Başlık **Saha Operasyon Merkezi** + Saha rozeti; CTA Dosyalarıma Git + Carilerim | `page.tsx`, `DashboardHeader` `isFieldStaff` | ✅ |
| F2 | Finans / onay / admin yok; KPI kompakt + alt 3’lü + akış | `FieldOperationsKpiBand`, `FieldDailyFlowSection`, `FieldBottomRow` | ⏳ v352 |
| F3 | Saha kalıcı sağ kılavuz yok (v350) | — | ✅ |

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

## L — Login

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| L1 | Resmi `meridyen-logo-original.png` — AI SVG yok | `LoginBrandLogo` | ⏳ v352 |

---

## Deploy öncesi görsel kontrol (web-only)

Deploy etmeden önce agent veya Mustafa şunları teyit eder:

- [ ] **S2** — Dar sidebar resmi küre PNG
- [ ] **S1** — Geniş sidebar resmi tam logo (~176px)
- [ ] **O1/O5** — Topbar ☰ + logo + arama + aksiyon sırası
- [ ] **O6–O8** — Help Drawer + Sistem Sağlık + 5 tema
- [ ] **A3–A7** — KPI kompakt + C3 dolu operasyon + C4 stretch
- [ ] **L1** — Login resmi logo
- [ ] **P1–P2** — Eksper + sigorta ana sayfa kompakt header
- [ ] **P5** — Eksper butonları sağda
- [ ] **D1–D3** — Dosya Sorumlusu Merkezi
- [ ] **F1–F3** — Saha Operasyon Merkezi

Otomatik smoke (`post-deploy-smoke.sh`) route erişimini doğrular; **görsel kabul yerine geçmez**.

### Deploy dalga özeti

| Etiket | Kapsam | Not |
|--------|--------|-----|
| v350 | **web-only** | Logo / sidebar / topbar SVG kabuk |
| v351 | **web-only** | Enterprise shell: Help Drawer, topbar sırası |
| v352 | **web-only** | Enterprise Dashboard v3.0 nihai IA + resmi logo |
| v353 | **web-only** | Logo h-auto %82 + sidebar HARD 224/70; C3/C4 stretch |
| v354 | **web-only** | Nihai: 220/72, header logo, operasyon paneli dolu |

---

## Regresyon kaydı (son 2 gün — öğrenilenler)

| Olay | Kök neden | Önlem |
|------|-----------|-------|
| SVG küre geri geldi (v255→v257) | Aynı dosyaya üst üste patch, ortak bileşen yoktu | S2 + `brand.ts` tek kaynak |
| v277 deploy S2 ihlali | Logo «düzeltmesi» checklist okunmadan MeridyenGlobeAnimated geri yazıldı | Deploy öncesi S2 zorunlu |
| Çift logo (v351) | Topbar + sidebar aynı anda BrandLogoMark | v352: topbar logosuz |
| AI SVG brand | `brand/meridyen-*.svg` yeniden çizim | v352: yalnızca resmi PNG |
| Logo minik + sidebar geniş (v352) | `h-11` + `object-contain` 1024×682 → ~66px; brand `h-[4.5rem]` kesiyordu; width soft | v353: `width:82%` `h-auto` + 224/70 HARD |
| v353 hâlâ 224/70 + logo küçük | Üç kilit (CSS/Tailwind/inline) 224’te kaldı; topbar logosuz; operasyon 2 hücre boş | v354: 220/72 HARD + header logo + C3 5 blok |

Yeni regresyon görülürse bu tabloya satır ekle; deploy etmeden önce kök neden yaz.

---

## İlgili dosyalar

| Dosya | Rol |
|-------|-----|
| `.cursor/rules/onayli-ui-koruma.mdc` | Agent zorunlu kural |
| `.cursor/rules/deploy-guvenlik.mdc` | Deploy disiplini |
| `canli-kabul/CHECKLIST.md` | Modül modül PASS takibi |
| `canli-kabul/ekran-goruntuleri/enterprise-dashboard-v3-20260714/` | v3 mockup + ANALIZ |
| `CANLIYA_ALINMAMIS_ENVANTER.md` | Henüz canlıya alınmamış işler |

# Onaylı UI Checklist — Regresyon Kalkanı

**Güncelleme:** 15 Temmuz 2026  
**Bilinen iyi sürüm (canlı):** Web **v350** + Backend **v349** (`KNOWN_GOOD_IMAGES.json`) — RC1 henüz deploy edilmedi  
**Manifest:** `deploy/manifests/KNOWN_GOOD_IMAGES.json`  
**Rollback (canlı):** Web **v348** / Backend **v348**  
**P1 Dashboard:** implementasyon kapandı (v344–v348); local RC1 hazırlık (commit/deploy bekliyor)

> **Dashboard RC1 FREEZE — `docs/project-governance/DASHBOARD_RC1_FREEZE.md`**  
> Dashboard donduruldu — odak Hasar / Operasyon / CRM / Finans.  
> RC1 sonrası dashboard kabuğu ve canvas yerleşimi değiştirilmez; yeni işler modül sayfalarına gider.

Bu dosya **canlıda onaylanmış** görünüm ve bileşenlerin tek kaynağıdır. Agent panel/layout/portal dosyalarına dokunmadan önce burayı okur. Onaylı maddeyi değiştirmek için Mustafa onayı şarttır.

Durum: `✅ Onaylı` | `⏳ Teyit bekliyor` | `❌ Bilinen regresyon`

---

## Zorunlu agent akışı

1. **Önce oku** — bu dosya + ilgili ortak bileşen (`BrandLogo`, `DashboardHeader`, `PortalPageHeader`)
2. **Tek kaynak kullan** — inline hero / tekrarlayan header yazma
3. **Kapsam dar tut** — istenen alan dışına dokunma
4. **Deploy öncesi** — aşağıdaki «Deploy öncesi görsel kontrol» maddelerini teyit et
5. **Onay değişirse** — Mustafa PASS sonrası bu dosyayı güncelle + `ekran-goruntuleri/` altına screenshot

---

## O — Ortak kabuk (tüm `/panel/*`)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| O1 | Topbar: ☰ + resmi logo (12–16px gap, aynı hiza) — `meridyen-logo-original.png`; sidebar’da ikinci logo yok | `layout.tsx` Navbar + `BrandLogo` | ✅ RC1 kalıcı 2026-07-15 |
| O2 | Panel metinleri **Title Case**; `uppercase` CSS yok | `turkce-yazim-kulturu.mdc`, `toTitleCaseTR()` | ✅ |
| O3 | UI'da **vaka** değil **dosya** terimi | `turkce-yazim-kulturu.mdc` | ✅ |
| O4 | Ayarlar menüsü tek kaynak `settings-nav.ts` — `layout.tsx`'e ikinci liste yok | `settings-nav.ts` | ✅ |
| O5 | Topbar: ☰ Logo → Arama (Ctrl+K / ⌘K) → Hızlı İşlem → Bildirim → Yardım → Tema → Profil → Sistem Sağlık | `layout.tsx` Navbar | ✅ RC1 / v355 |
| O6 | Yardım = overlay Help Drawer (resize + localStorage); kalıcı sağ panel yok | `PanelHelpDrawer` + `PanelHelpDrawerContext` | ✅ v351 |
| O7 | 5 tema: Açık / Koyu / Kurumsal Mavi / Kurumsal Koyu / Yüksek Kontrast | `PanelThemeToggle` + `panel-time-theme.ts` + token CSS | ✅ RC1 / v355 |
| O8 | Operasyon Aktif → Sistem Sağlık paneli (API, Database, Mail, Queue, Storage, Worker) | `PanelSystemHealth` + `/health` | ✅ RC1 / v355 |
| O9 | Breadcrumb: `Dashboard > Operasyon Yönetim Merkezi` (rol başlığı) | `DashboardHeader` | ✅ RC1 / v355 |

---

## S — Sidebar (Panel Shell)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| S1 | Geniş menü: **logo yok** — marka yalnızca topbar `BrandLogo` | `layout.tsx` sidebar (logo slot kaldırıldı) | ✅ RC1 kalıcı 2026-07-15 |
| S2 | Dar menü: **logo yok** — chevron/Yardım footer’da | `PanelSidebarGuideFooter` | ✅ RC1 kalıcı 2026-07-15 |
| S3 | Viewport dock: üst logo yok, orta scroll nav, alt daralt + Yardım | `layout.tsx` + `PanelSidebarGuideFooter` | ✅ RC1 kalıcı 2026-07-15 |
| S4 | Daralt/genişlet tercihi `localStorage panel-sidebar-collapsed` | `layout.tsx` | ✅ |
| S5 | Yardım = Help Drawer (topbar + sidebar); açık/genişlik localStorage | `PanelHelpDrawer` | ✅ v351 |
| S6 | Genişlik HARD **220px açık / 72px kapalı** (`min/max` + inline style + CSS `!important`) | `panel-layout-spacing.ts` + `globals.css` + `layout.tsx` | ✅ v354 / RC1 |
| S7 | Aktif: `#EEF4FF` zemin / `#2563EB` metin + sol 4px çizgi + bold; hafif hover | `globals.css` `.panel-sidebar-nav-link` | ✅ RC1 / v355 |
| S8 | Operasyon badge = revizyon + gelen kutusu sayısı | `layout.tsx` | ✅ RC1 / v355 |

**Yasak:** Sidebar’da animasyonlu küre; AI SVG brand; kalıcı sağ kılavuz; sidebar genişletme (>220). Header + sidebar aynı resmi PNG asset kullanır.

---

## A — Admin Yönetim Merkezi (`/panel` admin)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| A1 | Kompakt dashboard spacing — gap 16–20 | `page.tsx`, `DashboardShell` | ✅ RC1 / v355 |
| A2 | Haftalık Performans C4 sol hücre (Günün Akışı ile yan yana) | `WeeklyPerformanceWidget` | ✅ v352 |
| A3 | KPI kompakt şerit (~48–56px) — hero yok; boyut büyütme yok | `AdminOperationsKpiBand` | ✅ RC1 / v355 |
| A4 | Başlık **Operasyon Yönetim Merkezi** + Admin rozeti; CTA + Yeni Hasar / + Yeni Acil / Pazartesi | `page.tsx`, `DashboardHeader` | ✅ |
| A5 | Kalıcı sağ kılavuz **yok**; yardım = Help Drawer | `PanelHelpDrawer` | ✅ |
| A6 | Canvas: C1 Başlık → C2 KPI → C3 Operasyon\|Kritik → C4 Haftalık\|Akış → C5 Finans ince | `page.tsx` | ✅ v354 / RC1 |
| A7 | C3: Operasyon (bekleyen/SLA/atama/kritik/aktivite) \| Kritik Uyarılar — iç hiza rafine | `AdminOperationsCriticalRow` | ✅ RC1 / v355 |

---

## D — Dosya Sorumlusu Merkezi (`/panel` office_staff)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| D1 | Başlık **Dosya Sorumlusu Merkezi** + rozet; birincil CTA + Yeni Hasar; Acil kapsama göre | `page.tsx`, `DashboardHeader` `isOfficeStaff` | ✅ |
| D2 | Finans / admin bölümleri yok; KPI + alt paneller + akış / onay | `OfficeDailyFlowSection`, `OfficeBottomRow`, `ApprovalDelayWidget` | ✅ v352 |
| D3 | Ofis kalıcı sağ kılavuz yok (v350) | — | ✅ |

---

## F — Saha Operasyon Merkezi (`/panel` field_staff)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| F1 | Başlık **Saha Operasyon Merkezi** + Saha rozeti; CTA Dosyalarıma Git + Carilerim | `page.tsx`, `DashboardHeader` `isFieldStaff` | ✅ |
| F2 | Finans / onay / admin yok; KPI kompakt + alt 3’lü + akış | `FieldOperationsKpiBand`, `FieldDailyFlowSection`, `FieldBottomRow` | ✅ v352 |
| F3 | Saha kalıcı sağ kılavuz yok (v350) | — | ✅ |

---

## P — Portal kabuğu (eksper + sigorta)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| P1 | **Eski mavi gradient hero yok** — RC1 DashboardHeader (gradient hero yasak) | `DashboardHeader` | ✅ RC1 2026-07-15 |
| P2 | Ana sayfa header: `DashboardShell` + `DashboardHeader` (Admin RC1 aynı chrome) | eksper + sigorta `page.tsx` | ✅ RC1 2026-07-15 |
| P3 | Alt sayfa header: `PortalPageHeader` (aynı kart dili) | portal alt sayfalar | ✅ v262 |
| P4 | Portal main padding Admin ile aynı — `max-w-screen-2xl px-3 sm:px-4` | `layout.tsx` | ✅ RC1 2026-07-15 |
| P5 | Eksper aksiyon butonları (Yeni İhbar vb.) **sağa hizalı** (lg+ aynı satır) | `DashboardHeader` actions | ✅ RC1 2026-07-15 |
| P6 | Kur/döviz + saat: `PortalExchangeRates tone="light"`, `PortalLiveClock compact` | `portal-header-widgets.tsx` | ✅ v262 / RC1 actions |
| P7 | İletişim şeridi (WhatsApp, tel, e-posta) header altında | `portal-header-widgets.tsx` | ✅ v261+ |
| P8 | Topbar: `BrandLogo` + sidebar toggle + `PanelThemeToggle` (portal dahil) | `layout.tsx` Navbar | ✅ RC1 2026-07-15 |

**Yasak:** Sayfa içine `-mx-3 sm:-mx-4` hack'i ekleyerek layout ile savaşmak; inline gradient hero geri yazmak; portal dashboard’da ayrı `PortalCompactHeader` chrome.

### Portal route'ları (smoke + görsel)

| Route | Header bileşeni |
|-------|-----------------|
| `/panel/eksper-portal` | `DashboardShell` + `DashboardHeader` |
| `/panel/eksper-portal/dosyalar` | `PortalPageHeader` |
| `/panel/eksper-portal/onaylar` | `PortalPageHeader` |
| `/panel/eksper-portal/randevular` | `PortalPageHeader` |
| `/panel/sigorta-portal` | `DashboardShell` + `DashboardHeader` |
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
| L1 | Resmi `meridyen-logo-original.png` — AI SVG yok | `BrandLogo` / `LoginBrandLogo` | ✅ RC1 kalıcı 2026-07-15 |

---

## RC1 Kabul Checklist (v355)

- [x] Logo yalnızca resmi `meridyen-logo-original` (AI logo yok)
- [x] Header: ☰ + logo aynı satır / hizalı
- [x] Sidebar 220 / 72 korunuyor; logo→menü boşluk sıkı
- [x] Dashboard yerleşim korunuyor (yeni panel / aşağı itme yok; KPI boyutu aynı)
- [x] Operasyon / Kritik / Günün Akışı iç rafine
- [x] Breadcrumb `Dashboard > …`
- [x] Global Search Ctrl+K / ⌘K gösterim + kısayol
- [x] Operasyon Aktif → Sistem Sağlık (6 servis satırı)
- [x] Menü badge + hafif hover + 5 tema token
- [x] **Dashboard donduruldu** — odak Hasar / Operasyon / CRM / Finans

---

## Deploy öncesi görsel kontrol (web-only)

Deploy etmeden önce agent veya Mustafa şunları teyit eder:

- [ ] **S1/S2** — Sidebar’da logo yok (marka yalnız topbar `BrandLogo`)
- [ ] **S6** — Sidebar HARD 220px açık / 72px kapalı
- [ ] **O1/O5/O9** — Topbar ☰ + resmi logo + arama (Ctrl+K/⌘K) + breadcrumb
- [ ] **O6–O8** — Help Drawer + Sistem Sağlık (6 satır) + 5 tema
- [ ] **A3–A7** — KPI kompakt + C3 Operasyon|Kritik + C4 stretch
- [ ] **L1** — Login resmi `meridyen-logo-original.png`
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
| **v355** | **web-only** | **RC1:** breadcrumb, Ctrl+K, sağlık 6’lı, iç rafine — dashboard donduruldu |

---

## Regresyon kaydı (son 2 gün — öğrenilenler)

| Olay | Kök neden | Önlem |
|------|-----------|-------|
| SVG küre geri geldi (v255→v257) | Aynı dosyaya üst üste patch, ortak bileşen yoktu | S2 + `brand.ts` tek kaynak |
| v277 deploy S2 ihlali | Logo «düzeltmesi» checklist okunmadan MeridyenGlobeAnimated geri yazıldı | Deploy öncesi S2 zorunlu |
| Çift logo (v351) | Topbar + sidebar aynı anda BrandLogoMark | **RC1 kalıcı 2026-07-15:** logo yalnız topbar `BrandLogo`; sidebar logo yok |
| AI SVG brand | `brand/meridyen-*.svg` yeniden çizim | yalnızca resmi PNG (SVG wrapper PNG href) |
| Logo minik + sidebar geniş (v352) | `h-11` + `object-contain` 1024×682 → ~66px; brand `h-[4.5rem]` kesiyordu; width soft | v353: `width:82%` `h-auto` + HARD |
| v353 hâlâ 224/70 + logo küçük | Üç kilit 224’te kaldı; topbar logosuz; operasyon 2 hücre boş | v354: 220/72 HARD + header logo + C3 5 blok |

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

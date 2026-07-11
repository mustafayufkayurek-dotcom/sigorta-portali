# Onaylı UI Checklist — Regresyon Kalkanı

**Güncelleme:** 11 Temmuz 2026  
**Bilinen iyi sürüm:** Web **v262** + Backend **v254**  
**Manifest:** `deploy/manifests/KNOWN_GOOD_IMAGES.json`  
**Rollback web:** v261

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
| O1 | Masaüstünde navbar'da **çift logo yok**; logo yalnızca sidebar | `layout.tsx` (`md:hidden` mobil navbar) | ✅ v260+ |
| O2 | Panel metinleri **Title Case**; `uppercase` CSS yok | `turkce-yazim-kulturu.mdc`, `toTitleCaseTR()` | ✅ |
| O3 | UI'da **vaka** değil **dosya** terimi | `turkce-yazim-kulturu.mdc` | ✅ |
| O4 | Ayarlar menüsü tek kaynak `settings-nav.ts` — `layout.tsx`'e ikinci liste yok | `settings-nav.ts` | ✅ |

---

## S — Sidebar (Panel Shell)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| S1 | Geniş menü: tam logo `meridyen-logo-original.png` | `PanelSidebarBrand.tsx` | ✅ v253+ |
| S2 | Dar menü: yalnız küre `meridyen-globe-square.png` — **SVG animasyonlu küre değil** | `constants/brand.ts` → `CORPORATE_LOGO_GLOBE` | ✅ v261+ |
| S3 | Viewport dock: üst logo+chevron, orta scroll nav, alt kılavuz | `layout.tsx` + `PanelSidebarBrand` | ✅ v253+ |
| S4 | Daralt/genişlet tercihi `localStorage panel-sidebar-collapsed` | `layout.tsx` | ✅ |
| S5 | Alt kılavuz linki rol bazlı PDF | `resolvePanelUserGuide()` | ✅ |

**Yasak:** `MeridyenGlobeAnimated` sidebar'da geri getirmek; eski worktree logo dosyası kopyalamak.

---

## A — Admin Yönetim Merkezi (`/panel` admin)

| ID | Onaylı davranış | Tek kaynak | Durum |
|----|-----------------|------------|-------|
| A1 | Kompakt dashboard spacing — sıkışık kartlar | `page.tsx`, `DashboardShell` | ✅ v253+ |
| A2 | Haftalık Performans **compact** mod | `WeeklyPerformanceWidget` | ✅ v258+ |
| A3 | KPI kartları **compact** prop | `KpiCard` | ✅ v253+ |

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
- [ ] **O1** — Masaüstünde tek logo (sidebar)

Otomatik smoke (`post-deploy-smoke.sh`) route erişimini doğrular; **görsel kabul yerine geçmez**.

---

## Regresyon kaydı (son 2 gün — öğrenilenler)

| Olay | Kök neden | Önlem |
|------|-----------|-------|
| SVG küre geri geldi (v255→v257) | Aynı dosyaya üst üste patch, ortak bileşen yoktu | S2 + `brand.ts` tek kaynak |
| v277 deploy S2 ihlali | Logo «düzeltmesi» checklist okunmadan MeridyenGlobeAnimated geri yazıldı | Deploy öncesi S2 zorunlu; v278 PNG geri |
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

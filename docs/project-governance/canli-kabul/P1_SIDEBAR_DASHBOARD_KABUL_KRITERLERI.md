# P1 — Sidebar + Admin Dashboard Kabul Kriterleri

**Tarih:** 11 Temmuz 2026  
**Kapanış (kod):** 13 Temmuz 2026 — **P1 implementasyon paketi KAPANDI** (canlı **v348**)  
**Referans:** ANA SAYFA TASARIM TALİMATI + `docs/design-mockups/`  
**Canlı:** Web **v348** + Backend **v348** (`v348-dashboard-faz6-admin-a3a4`)  
**Rollback:** Web **v346** / Backend **v342**

> **Paket durumu:** Kod dalgaları **v344→v348** tamam. Mustafa canlı screenshot **PASS** ayrı; Faz 7 / A5 ekstra deploy (**v349**) **yok** — A5 zaten `AdminBottomRow` ile v345+.  
> Rakamlar örnek veridir; kabul **layout ve bileşen** içindir.

---

## Paket kapsamı

| Paket | Route | Kod dalgası | Durum |
|-------|-------|-------------|-------|
| **S — Sol menü kabuğu** | Tüm `/panel/*` | **v344** | Kod tamam · ⏳ Mustafa teyit |
| **A — Admin dashboard** | `/panel` (admin/manager) | **v345** + A3/A4 **v348** + A5 **v345+** | Kod tamam · ⏳ Mustafa teyit |
| **D — Dosya sorumlusu** | `/panel` (`office_staff`) | **v346** | Kod tamam · ⏳ Mustafa teyit |
| **F — Saha** | `/panel` (`field_staff`) | **v347** | Kod tamam · ⏳ Mustafa teyit |

**Deploy notu:** P1 kapanış için yeni sürüm yok; canlı zaten **v348 full**. Büyük paket (PayTR vb.) bu turda **başlamaz**.

---

## S — Sol menü kabuğu (Panel Shell)

### S1 — Genişlik ve animasyon

> **Karar kilidi (13 Tem 2026):** ANA SAYFA TASARIM TALİMATI — **240px açık / 72px kapalı**. Eski 286/74–92 geçersiz.

| ID | Kriter | Canlı / kod (v344+) | Kod | PASS |
|----|--------|---------------------|-----|------|
| S1.1 | Daraltılmış **72px** | `w-[72px]` | ✅ | ⬜ Mustafa |
| S1.2 | Genişletilmiş **240px** | `w-[240px]` | ✅ | ⬜ Mustafa |
| S1.3 | Geçiş **200ms** | `duration-200` | ✅ | ⬜ Mustafa |

### S2 — Logo

| ID | Kriter | Canlı / kod | Kod | PASS |
|----|--------|-------------|-----|------|
| S2.1 | Geniş: tam logo MERİDYEN ASİSTANCE | `PanelSidebarBrand` + original PNG | ✅ | ⬜ Mustafa |
| S2.2 | Dar: yalnız küre PNG (SVG değil) | `CORPORATE_LOGO_GLOBE` | ✅ | ⬜ Mustafa |
| S2.3 | Logo → `/panel` | Link | ✅ | ⬜ Mustafa |
| S2.4 | Daralt sonrası doğru mod | Cmd+Shift+R teyit | ✅ | ⬜ Mustafa |

### S3 — Menüyü Daralt

| ID | Kriter | Canlı / kod (v344) | Kod | PASS |
|----|--------|---------------------|-----|------|
| S3.1 | Altta **Menüyü Daralt** + ikon | Viewport dock footer | ✅ | ⬜ Mustafa |
| S3.2 | Daraltıkta genişlet erişilebilir | Chevron / footer | ✅ | ⬜ Mustafa |
| S3.3 | Tercih hatırlanır | `localStorage panel-sidebar-collapsed` | ✅ | ⬜ Mustafa |

### S4 — Kullanım rehberi

| ID | Kriter | Canlı / kod | Kod | PASS |
|----|--------|-------------|-----|------|
| S4.1 | Geniş: kılavuz kartı | `PanelSidebarGuideFooter` | ✅ | ⬜ Mustafa |
| S4.2 | Dar: ikon + tooltip | ✅ | ✅ | ⬜ Mustafa |
| S4.3 | Rol bazlı PDF | `resolvePanelUserGuide` | ✅ | ⬜ Mustafa |

### S5 — Saat teması

| ID | Kriter | Canlı / kod | Kod | PASS |
|----|--------|-------------|-----|------|
| S5.1 / S5.2 | Açık/koyu panel teması | `panel-time-theme` (+ test aşaması light force olabilir) | ✅ kısmi | ⬜ Mustafa |
| S5.3 | Kurulum manuel tema ezer | `resolvePanelDarkMode` | ✅ | ⬜ Mustafa |

### S6 — Görsel dil

| ID | Kriter | Canlı / kod (v344) | Kod | PASS |
|----|--------|---------------------|-----|------|
| S6.1 | ~12px köşe | `rounded-lg` / `rounded-xl` | ✅ | ⬜ Mustafa |
| S6.2 | Kurumsal palet | Talimat diline yakın (lacivert mockup birebir değil) | ✅ P1 yeterli | ⬜ Mustafa |
| S6.3 | Aktif menü `#EEF4FF` / `#2563EB` + sol çizgi | `globals.css` | ✅ | ⬜ Mustafa |

### S7 — Menü yapısı (P1 dışı — ayrı karar)

| ID | Kriter | Durum |
|----|--------|-------|
| S7.1 | 5 gruplu shell (Dashboard, Operasyon…) | ⬜ **Backlog** — canlı uzun işletim listesi; Mustafa kararı |
| S7.2 | Dar tooltip etiket | ✅ kısmi (P1 yeterli) |

---

## A — Admin Yönetim Merkezi (`/panel`, admin/manager)

### A0 — Başlık

| ID | Kriter | Canlı / kod (v345) | Kod | PASS |
|----|--------|---------------------|-----|------|
| A0.1 | Başlık (Operasyon / Yönetim Merkezi dili) | `DashboardHeader` | ✅ | ⬜ Mustafa |
| A0.2 | **Admin** rozeti | ✅ | ✅ | ⬜ Mustafa |
| A0.3 | Alt başlık | ✅ | ✅ | ⬜ Mustafa |
| A0.4 | **+ Yeni Hasar** (mavi) | ✅ | ✅ | ⬜ Mustafa |
| A0.5 | **+ Yeni Acil** (kırmızı) | ✅ | ✅ | ⬜ Mustafa |
| A0.6 | **Pazartesi Toplantısı** | ✅ outline | ✅ | ⬜ Mustafa |

### A1 — Finans Özeti

| ID | Kriter | Canlı / kod (v345) | Kod | PASS |
|----|--------|---------------------|-----|------|
| A1.1–A1.4 | 5 kart + hiyerarşi | `AdminFinanceSummarySection` | ✅ | ⬜ Mustafa |

### A2 — Operasyon Özeti

| ID | Kriter | Canlı / kod (v345) | Kod | PASS |
|----|--------|---------------------|-----|------|
| A2.1–A2.3 | 6 kompakt kart + yüzde satırı | Operasyon bandı | ✅ | ⬜ Mustafa |

### A3 — Haftalık Performans — Pazartesi Toplantısı

| ID | Kriter | Canlı / kod (v348) | Kod | PASS |
|----|--------|---------------------|-----|------|
| A3.1 | Bölüm başlığı | ✅ | ✅ | ⬜ Mustafa |
| A3.2 | Geçen Hafta özet | `/dashboard/daily-flow` lastWeek | ✅ | ⬜ Mustafa |
| A3.3 | Ekip Yoğunluğu Pzt–Paz bar | `TeamWorkloadChart` | ✅ | ⬜ Mustafa |
| A3.4 | Bu Hafta Öncelikleri 1–3 | ✅ | ✅ | ⬜ Mustafa |
| A3.5 | Personel Yük avatar + bar | ✅ | ✅ | ⬜ Mustafa |

### A4 — Günün Akışı

| ID | Kriter | Canlı / kod (v348) | Kod | PASS |
|----|--------|---------------------|-----|------|
| A4.1 | Yatay şerit | `AdminDailyFlowSection` | ✅ | ⬜ Mustafa |
| A4.2 | 4 bugün metriği | `/dashboard/daily-flow` today | ✅ | ⬜ Mustafa |
| A4.3 | Gider Dağıtımı yeşil/amber | ✅ | ✅ | ⬜ Mustafa |

### A5 — Alt sıra (3 sütun) — P1’de zorunlu; **kod yeterli (yeni deploy yok)**

| ID | Kriter | Canlı / kod (v345+) | Kod | PASS |
|----|--------|----------------------|-----|------|
| A5.1 | Kritik Uyarılar + badge | `AdminBottomRow` | ✅ | ⬜ Mustafa |
| A5.2 | Finans Darboğazları + tutar | aynı satır | ✅ | ⬜ Mustafa |
| A5.3 | Personel Yük — progress bar | yatay bar + dosya sayısı | ✅ | ⬜ Mustafa |
| A5.4 | Üç widget aynı satır (`lg:grid-cols-3`) | ✅ | ✅ | ⬜ Mustafa |

> **Karar (13 Tem — DEVAM KAPAT):** A5 ekstra cilalama / Faz 7 **yapılmadı**. Mevcut `AdminBottomRow` P1 için yeterli. **v349 yok.**

### A6 — Üst arama

| ID | Kriter | Canlı / kod (v344) | Kod | PASS |
|----|--------|---------------------|-----|------|
| A6.1 | Global Arama (⌘K) | Topbar | ✅ | ⬜ Mustafa |
| A6.2 | Bildirim + kullanıcı | ✅ | ✅ | ⬜ Mustafa |

---

## D — Dosya Sorumlusu Merkezi (`office_staff`)

| ID | Kriter | Canlı / kod (v346) | Kod | PASS |
|----|--------|---------------------|-----|------|
| D0.1 | Başlık + **Dosya Sorumlusu** rozeti | ✅ | ✅ | ⬜ Mustafa |
| D0.2 | CTA **+ Yeni Hasar** (mavi) | ✅ | ✅ | ⬜ Mustafa |
| D0.3 | **Yeni Acil** kapsama göre | `showAcilYardim` | ✅ | ⬜ Mustafa |
| D0.4 | Onay Gecikmesi widget | `ApprovalDelayWidget` | ✅ | ⬜ Mustafa |
| D0.5 | Finans / admin yok | ayrı ofis şablon | ✅ | ⬜ Mustafa |
| D0.6 | Aynı görsel dil | Operasyon + Akış + alt 3’lü + kılavuz | ✅ | ⬜ Mustafa |

---

## F — Saha Operasyon Merkezi (`field_staff`)

| ID | Kriter | Canlı / kod (v347) | Kod | PASS |
|----|--------|---------------------|-----|------|
| F0.1 | Başlık + **Saha** rozeti | ✅ | ✅ | ⬜ Mustafa |
| F0.2 | CTA Dosyalarıma Git + Carilerim | ✅ | ✅ | ⬜ Mustafa |
| F0.3 | Saha Özeti 6 KPI | `/dashboard/my-performance` | ✅ | ⬜ Mustafa |
| F0.4 | Günün Akışı (finans/onay yok) | ✅ | ✅ | ⬜ Mustafa |
| F0.5 | Alt 3’lü | `FieldBottomRow` | ✅ | ⬜ Mustafa |
| F0.6 | Admin/ofis bölümleri yok | ✅ | ✅ | ⬜ Mustafa |
| F0.7 | >1440px saha kılavuz | `FieldGuidePanel` | ✅ | ⬜ Mustafa |

---

## Kapanış checklist

### Kod / deploy (tamam)

- [x] S shell **v344**
- [x] Admin A0–A2 + A5 **v345**
- [x] D0 **v346**
- [x] F0 **v347** (pakette v348)
- [x] Admin A3/A4 + `daily-flow` **v348 full**
- [x] `DEPLOY_GECMISI.md` + manifest **v348**
- [x] A5 için **v349 yok** (yeterli)

### Mustafa manuel PASS (bekliyor)

- [ ] Admin: A0 + A3 + A4 + A5 screenshot
- [ ] `office_staff` D0 screenshot
- [ ] `field_staff` F0 screenshot
- [ ] Sidebar S1/S2/S3 (geniş + dar)
- [ ] Smoke: `post-deploy-smoke.sh` (login env yok → auth FAIL beklenen)

---

## Bilinen gap (P1 kapanışına engel değil)

| Gap | Not |
|-----|-----|
| S7 menü gruplama | Ayrı ürün kararı — backlog |
| S5/S6 pixel-perfect mockup | P1 “talimat dili” yeterli; birebir koyu lacivert sidebar zorunlu değil |
| Mustafa canlı PASS | Kod PASS ≠ kullanıcı PASS |
| Büyük paket (PayTR / finans) | **Sonraki iş** — bu pakette başlatılmadı |

---

## Özet — P1 kapanış (13 Temmuz 2026)

| Katman | Durum |
|--------|-------|
| **Implementasyon** | ✅ KAPANDI (v344–v348) |
| **Canlı sürüm** | v348 full |
| **v349 / Faz 7** | ❌ Yok |
| **Mustafa PASS** | ⏳ Bekliyor |
| **Sonraki büyük iş** | Büyük paket (PayTR / envanter B7) — ayrı tur |

*İlgili: `DEPLOY_GECMISI.md`, `ONAYLI_UI_CHECKLIST.md`, `inbox/TEST_OTURUMU_ACIK_KONULAR.md` (P1 kapanış notu), `CANLIYA_ALINMAMIS_ENVANTER.md`*

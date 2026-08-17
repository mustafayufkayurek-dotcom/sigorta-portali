# P1 — Sidebar + Admin Dashboard Kabul Kriterleri

**Tarih:** 11 Temmuz 2026  
**Referans mockup’lar:** `docs/design-mockups/`  
**Canlı referans:** Web v248 (iskelet var; şablon sadakati **PASS değil**)  
**Kapanış:** Tüm maddeler Mustafa **PASS** + screenshot `canli-kabul/ekran-goruntuleri/p1-v250/`

> **Not:** Rakamlar mockup’taki örnek veridir; kabul **layout ve bileşen** içindir, ₺0 / dolu veri değil.

---

## Paket kapsamı

| Paket | Mockup | Route |
|-------|--------|-------|
| **S — Sol menü kabuğu** | `sidebar-logo-tema-spesifikasyon.png` | Tüm `/panel/*` |
| **A — Admin dashboard** | `admin-yonetim-merkezi-dashboard-mockup.png` | `/panel` (admin / manager) |
| **D — Dosya sorumlusu dashboard** | *(admin mockup ile aynı dil; başlık farklı)* | `/panel` (`office_staff`) |

**Deploy:** Onay sonrası tek **web-only** dalga (ör. `v250-sidebar-dashboard-sablon`).

---

## S — Sol menü kabuğu (Panel Shell)

### S1 — Genişlik ve animasyon

> **Karar kilidi (13 Tem 2026):** ANA SAYFA TASARIM TALİMATI ölçüleri geçerli — **240px açık / 72px kapalı**. Eski mockup 286/74–92 geçersiz.

| ID | Kriter | Mockup | Canlı / kod | PASS |
|----|--------|--------|-------------|------|
| S1.1 | Daraltılmış genişlik **72px** | Talimat | Kod `w-[72px]` (v344) | ⬜ |
| S1.2 | Genişletilmiş genişlik **240px** | Talimat | Kod `w-[240px]` (v344) | ⬜ |
| S1.3 | Geçiş animasyonu **200ms** ease-in-out | ✅ | Kod `duration-200` | ⬜ |

### S2 — Logo davranışı (Mustafa vurgusu)

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| S2.1 | **Geniş menü:** tam kurumsal logo — küre + **MERİDYEN ASİSTANCE** metni net okunur | ✅ | `PanelSidebarBrand` → `meridyen-logo-original.png`; canlıda beyaz kutu / farklı logo raporu | ⬜ |
| S2.2 | **Daraltılmış menü:** yalnızca **küre** ikonu (metin yok) | ✅ | Kod `CORPORATE_LOGO_GLOBE`; canlıda küre görünürlüğü Mustafa teyidi | ⬜ |
| S2.3 | Logo tıklanınca panel ana sayfa (`/panel`) | ✅ | `PanelSidebarBrand` Link | ⬜ |
| S2.4 | Daralt/genişlet sonrası logo anında doğru moda geçer (bozuk / eski logo kalmaz) | ✅ | Cmd+Shift+R sonrası teyit | ⬜ |

### S3 — Menüyü Daralt kontrolü

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| S3.1 | Geniş modda altta **「Menüyü Daralt」** metni + sol ok ikonu | ✅ | Kod: sağ üstte yalnızca chevron, **metin yok** | ⬜ |
| S3.2 | Daraltılmış modda genişletme kontrolü erişilebilir | ✅ | Chevron sağ üst | ⬜ |
| S3.3 | Daraltma tercihi oturumlar arası hatırlanır | — | `localStorage panel-sidebar-collapsed` | ⬜ |

### S4 — Kullanım rehberi (alt kart)

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| S4.1 | Geniş modda **Kullanım Rehberi** kartı (başlık + kısa açıklama + ok) | ✅ | `PanelSidebarGuideFooter` — farklı layout (mavi kutu, ExternalLink) | ⬜ |
| S4.2 | Daraltılmış modda **?** veya kitap ikonu + tooltip **Rehber** | ✅ | Daraltıkta yalnız ikon | ⬜ |
| S4.3 | Rol bazlı doğru PDF açılır | — | `resolvePanelUserGuide` | ⬜ |

### S5 — Saat teması (sidebar)

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| S5.1 | **06:00–18:00** açık tema (sidebar + içerik uyumu) | ✅ | `panel-time-theme` var; sidebar ayrı koyu lacivert **değil** | ⬜ |
| S5.2 | **18:00–06:00** koyu tema — yumuşak lacivert tonlar | ✅ | `dark:` sınıfları; mockup’taki sidebar rengi birebir değil | ⬜ |
| S5.3 | Kurulum’da manuel tema seçimi mockup’ı ezer | — | `resolvePanelDarkMode` | ⬜ |

### S6 — Görsel dil (sidebar)

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| S6.1 | Köşe yuvarlaklığı ~**12px** kart/öğelerde | ✅ | Kısmen `rounded-lg` | ⬜ |
| S6.2 | Kurumsal renk paleti (lacivert sidebar header alanı) | ✅ | Canlı: açık beyaz sidebar — **farklı** | ⬜ |
| S6.3 | Aktif menü öğesi mockup’taki vurgu (açık mavi zemin) | ✅ | Mevcut `linkClass` — görsel teyit | ⬜ |

### S7 — Menü yapısı (mockup shell — isteğe bağlı faz)

| ID | Kriter | Mockup | Canlı (11 Tem) | PASS |
|----|--------|--------|----------------|------|
| S7.1 | Ana gruplar: Dashboard, Operasyon▾, Personel▾, Finans▾, Ayarlar▾ | ✅ | Düz uzun liste (CRM, Harita, Test Notları…) | ⬜ **Mustafa kararı** |
| S7.2 | Daraltılmış modda yalnız ikonlar, tooltip etiket | ✅ | Kısmen var | ⬜ |

> **S7:** Mockup “shell” örneği 5 gruplu; canlı işletim menüsü daha geniş. **S2–S5** öncelik; S7 ayrı karar maddesi.

---

## A — Admin Yönetim Merkezi (`/panel`, admin/manager)

### A0 — Başlık alanı

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| A0.1 | Başlık **Yönetim Merkezi** | ✅ | ✅ canlı | ⬜ |
| A0.2 | Yanında **Admin** rozeti (mavi pill) | ✅ | **Yok** | ⬜ |
| A0.3 | Alt başlık: kurumsal operasyon + finans + haftalık performans | ✅ | ✅ canlı | ⬜ |
| A0.4 | Sağ üst: **+ Yeni Hasar** (mavi dolu) | ✅ | Var; stil farklı olabilir | ⬜ |
| A0.5 | **+ Yeni Acil** (**kırmızı** dolu buton) | ✅ | Kod: koyu/siyah buton | ⬜ |
| A0.6 | **Pazartesi Toplantısı** butonu (takvim ikonu, outline) | ✅ | **Yok** | ⬜ |

### A1 — Finans Özeti (5 kart, tek satır)

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| A1.1 | Bölüm başlığı **Finans Özeti** + yıl/ay seçici | ✅ | ✅ `AdminFinanceSummarySection` | ⬜ |
| A1.2 | 5 kart: Geciken Tahsilat, Bekleyen Fatura, Aylık Gelir, Operasyon Gideri, Dağıtım Durumu | ✅ | ✅ iskelet | ⬜ |
| A1.3 | Kartlar mockup ile aynı hiyerarşi (ikon sol, büyük rakam, alt açıklama) | ✅ | `KpiCard` — görsel teyit | ⬜ |
| A1.4 | Dağıtım Durumu yeşil **Tamamlandı** durumu | ✅ | Veriye bağlı | ⬜ |

### A2 — Operasyon Özeti (6 kompakt kart)

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| A2.1 | Bölüm başlığı **Operasyon Özeti** | ✅ | ✅ “Operasyon Özeti” section | ⬜ |
| A2.2 | **6** kompakt kart tek bant: Toplam, Hasar, Acil, SLA Riski, Bekleyen Aksiyon, **Açık Dosya** | ✅ | `PrimaryKpiGroup` — farklı etiketler, büyük kartlar, **Açık Dosya** yok | ⬜ |
| A2.3 | Hasar / Acil / SLA kartlarında **yüzde** alt satırı (ör. %62,8) | ✅ | **Yok** — açık/kapalı metni var | ⬜ |

### A3 — Haftalık Performans — Pazartesi Toplantısı

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| A3.1 | Bölüm başlığı mockup ile aynı | ✅ | ✅ | ⬜ |
| A3.2 | Sol: **Geçen Hafta** özet (kapanan, SLA, tahsilat, ort. kapanış) | ✅ | Kısmi dl listesi | ⬜ |
| A3.3 | **Ekip Yoğunluğu** — Pzt–Paz **bar chart** | ✅ | **Yok** | ⬜ |
| A3.4 | Orta: **Bu Hafta Öncelikleri** numaralı renkli daireler (1–3) | ✅ | Numaralı liste, daire yok | ⬜ |
| A3.5 | Sağ: mini **Personel Yük** (avatar + dosya sayısı) | ✅ | Metin listesi | ⬜ |

### A4 — Günün Akışı

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| A4.1 | **Günün Akışı** başlıklı yatay şerit | ✅ | `OperationFlowStrip` — farklı başlık/içerik | ⬜ |
| A4.2 | 4 metrik: Yeni Hasar, Yeni Acil, Planlanan Operasyon, Tamamlanan Operasyon (bugün) | ✅ | **Yok** (hasar/acil/bekleyen odaklı strip) | ⬜ |
| A4.3 | Sağda büyük yeşil **Gider Dağıtımı** kartı (tamamlandı + mutabakat metni) | ✅ | Küçük `OverheadAllocationReminderWidget` | ⬜ |

### A5 — Alt sıra (3 sütun)

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| A5.1 | **Kritik Uyarılar** — badge sayı + zaman damgalı liste | ✅ | Widget var; layout farklı | ⬜ |
| A5.2 | **Finans Darboğazları** — badge + tutarlı liste | ✅ | `FinanceBottleneckWidget` ayrı yerde | ⬜ |
| A5.3 | **Personel Yük Dağılımı** — yatay **progress bar** + dosya sayısı | ✅ | `OwnershipLoadWidget` — bar yok / farklı konum | ⬜ |
| A5.4 | Üç widget **aynı satırda** (mockup alt bant) | ✅ | Dikey dağınık grid | ⬜ |

### A6 — Üst arama çubuğu (panel header)

| ID | Kriter | Mockup | Canlı / kod (11 Tem) | PASS |
|----|--------|--------|----------------------|------|
| A6.1 | Placeholder: **Ara (Operasyon, Dosya, Müşteri, Personel...)** | ✅ | “Ara...” kısa | ⬜ |
| A6.2 | Bildirim zili + kullanıcı adı formatı | ✅ | Görsel teyit | ⬜ |

---

## D — Dosya Sorumlusu Merkezi (`/panel`, `office_staff`)

| ID | Kriter | Beklenen | Canlı / kod (13 Tem — v346) | PASS |
|----|--------|----------|-----------------------------|------|
| D0.1 | Başlık **Dosya Sorumlusu Merkezi** | ✅ | ✅ + **Dosya Sorumlusu** rozeti | ⬜ Mustafa |
| D0.2 | Tek birincil CTA **Yeni Hasar** (mavi `#2563EB`) | ✅ | ✅ admin CTA dili | ⬜ Mustafa |
| D0.3 | **Yeni Acil** gizli veya kapsama göre | Kapsam | ✅ `showAcilYardim` (hasar-only’da gizli) | ⬜ Mustafa |
| D0.4 | Onay Gecikmesi widget’ı (`ApprovalDelayWidget`) | ✅ | ✅ kompakt, Günün Akışı altında | ⬜ Mustafa |
| D0.5 | Finans / admin bölümleri **görünmez** | ✅ | ✅ ayrı `isOfficeStaff` şablon; Finans Özeti / Haftalık / Gider yok | ⬜ Mustafa |
| D0.6 | Layout admin mockup ile **aynı görsel dil** (kart, boşluk, tipografi) | Mockup | ✅ Operasyon Özeti bandı + Günün Akışı + alt 3’lü + kılavuz paneli | ⬜ Mustafa |

---

## Kapanış checklist (deploy öncesi)

- [ ] S2.1 + S2.2 Mustafa screenshot (geniş + daraltılmış menü)
- [ ] A0 + A3 + A4 mockup yan yana screenshot
- [ ] `office_staff` ile D0 screenshot
- [ ] `post-deploy-smoke.sh` PASS
- [ ] `DEPLOY_GECMISI.md` + manifest güncelle

---

## Özet — şu an FAIL olan kritik maddeler (implementasyon gerekir)

**Sidebar:** S2.1/S2.2 logo, S3.1 Menüyü Daralt konumu/metin, S5 sidebar koyu tema, S6.2 lacivert header  
**Admin dashboard:** A0.2 Admin rozeti, A0.5 kırmızı Acil, A0.6 Pazartesi Toplantısı, A2.2/A2.3 operasyon bant, A3.3 Ekip Yoğunluğu grafiği, A4.2–A4.3 Günün Akışı + Gider kartı, A5.3/A5.4 alt sıra layout  

**Tahmini paket:** web-only `v250` — `PanelSidebarBrand`, `layout.tsx` sidebar, `panel/page.tsx`, yeni `TeamWorkloadChart`, `DailyFlowStrip` bileşenleri.

---

*İlgili: `DEPLOY_GECMISI.md`, `CANLIYA_ALINMAMIS_ENVANTER.md` (P1/P2), `docs/design-mockups/OKU_BENI.md`*

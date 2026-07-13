# Logo / Sidebar / Top Bar Revizyon — Tasarım Teslimi (2026-07-13)

**Durum:** Mockup **onaylandı** (14 Tem 2026) — kod `v350-logo-sidebar-topbar`.  
**Kaynak marka PNG:** `apps/web/public/meridyen-logo-original.png` (+ küre PNG) **korunur / replace yok**.  
**UI SVG:** `apps/web/public/brand/meridyen-*.svg`

---

## Kuzey Yıldızı (bağlayıcı)

Amaç yalnızca güzel görünen bir Dashboard yapmak değildir. Amaç, kullanıcının sabah **08:00**’de sisteme girdiğinde **10 saniye içinde operasyonun durumunu** anlayabileceği, **8 saat boyunca yorulmadan** çalışabileceği, Microsoft Dynamics, Salesforce ve Linear seviyesinde kurumsal bir deneyim sunan, yüksek performanslı ve ölçeklenebilir bir yönetim ekranı oluşturmaktır. **Her tasarım kararı bu hedefe hizmet etmelidir.**

| İlke | Mockup’a yansıma |
|------|------------------|
| 08:00 / 10 sn | Logo + KPI ilk bakışta durum; sayı > başlık; gürültü yok |
| 8 saat | Spacing, kontrast, sidebar 220–230 / 68–72; yardımcı panel dikkat çalmaz |
| Enterprise yoğunluk | Dynamics / Salesforce / Linear — amatör süs, purple glow, sticky badge yok |

---

## Mockup dosyaları

| # | Dosya | İçerik | Kuzey Yıldızı gerekçesi (1 cümle) |
|---|--------|--------|-----------------------------------|
| 1 | `01-desktop-1920.png` | Desktop 1920 — tam kabuk | Geniş masaüstünde marka + KPI bandı 10 sn’de durum okumayı taşımalı; sağ kalıcı kılavuz dikkat dağıtmamalı. |
| 2 | `02-laptop-1440.png` | Laptop 1440 — aynı dil | 1440’te sidebar 220–230 ve header logosunun bozulmadan sıkışması 8 saatlik yoğun kullanımın gerçek ekranıdır. |
| 3 | `03-sidebar-acik.png` | Sidebar açık — logo %80–85 | Açık menüde wordmark genişliğin çoğunu doldurur; navigasyon Dynamics gibi aktif çizgi + bg + bold ile konumlandırır. |
| 4 | `04-sidebar-kapali.png` | Sidebar kapalı — yalnız SVG ikon | 68–72 px ikon-only küre, tooltip ile alanı kurtarır; uzun oturumda odak içeriğe kalır. |
| 5 | `05-light-theme.png` | Light theme | Gündüz mesaisi için yüksek kontrast / slate-beyaz zemin yorgunluğu düşürür. |
| 6 | `06-dark-theme.png` | Dark theme | Koyu zeminde marka (küre + açık wordmark / kırmızı vurgu) okunaklı kalır; gece/erken vardiya için Linear seviyesinde kontrast. |
| 7 | `07-header-yakin-plan.png` | Header yakın plan | Header logo 48–56 px önce tasarlanır; sıra Logo → Search → Hızlı İşlem → Bildirim → Yardım → Tema → Kullanıcı → Sistem Durumu. |

Klasör: `docs/project-governance/canli-kabul/ekran-goruntuleri/logo-sidebar-topbar-revizyon-20260713/`

---

## Nihai ölçüler (uygulama kabulü)

| Alan | Değer |
|------|--------|
| Sidebar expanded | **220–230 px** (eski 240 / 286 geçersiz) |
| Sidebar collapsed | **68–72 px** |
| Logo sidebar açık | Genişliğin **%80–85** |
| Header logo yükseklik | **48–56 px** |
| Sidebar logo yükseklik | **40–48 px** |
| Format | **SVG** (PNG UI’da yok); mevcut dosya replace edilmez — varyasyon üretilir |
| Seviye | Dynamics / Salesforce / Linear |

Top Bar sıra: **☰ Logo \| Search \| Quick Actions \| Notification \| Help \| Theme \| User \| System Status**

---

## Kabul kriterleri checklist

- [x] 08:00 / 10 sn: Logo + KPI hiyerarşisi net, gürültü yok (kod)
- [x] 8 saat: spacing / kontrast / sidebar ölçüleri (224 / 70)
- [x] Yardım: kalıcı sağ panel kaldırıldı; topbar Yardım + sidebar dar ikon
- [x] Header logo 48–56 px; sidebar açık logo ~82%; kapalı yalnız küre SVG
- [x] Light + dark wordmark (SVG); marka PNG arşivi korunuyor
- [x] Enterprise yoğunluk; purple glow / amatör süs yok
- [x] Mevcut logo PNG asset’leri korunuyor — UI SVG varyasyon

---

## Ne değişmez (bu teslim)

- Panel API / iş kuralları / Prisma (P0 finans guard ayrı: v349)
- Mevcut `meridyen-logo-original.png` ve brand path’leri **replace edilmez**

## Onay

**A) Uygula** — 14 Tem 2026 Mustafa kuyruk onayı → `v350-logo-sidebar-topbar`

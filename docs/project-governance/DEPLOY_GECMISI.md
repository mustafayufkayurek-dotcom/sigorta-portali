# Deploy Geçmişi — Canlı Durum Özeti

**Tek kaynak (image):** `deploy/manifests/KNOWN_GOOD_IMAGES.json`  
**Açık işler:** `CANLIYA_ALINMAMIS_ENVANTER.md`  
**Son güncelleme:** 14 Temmuz 2026

> Her deploy sonrası: bu dosyaya **yeni satır** + manifest `label` / `description` güncelle. Sohbet değil, bu dosya “son ne alındı?” cevabıdır.

---

## Canlı durum (14 Temmuz 2026 — v350 web + v349 backend)

| Servis | Sürüm | Durum |
|--------|-------|--------|
| **Web** | `sigorta-web:dalga2-agreement-hr-01-v350-amd64` | healthy |
| **Backend** | `app-backend:dalga2-agreement-hr-01-v349-amd64` | healthy |
| **Rollback** | Web **v348** / Backend **v348** | manifest `rollbackImages` |
| **Etiket** | `v350-logo-sidebar-topbar` + `v349-guvenlik-finans-api-guard` | |

> **v350 (14 Tem):** Logo/sidebar/topbar SVG (224/70, header 56); kalıcı sağ kılavuz yok. **v349:** Finans API guard. Disk ~6G — prune `-af` yasak. PayTR büyük paket: **Mustafa onayı bekliyor**.

---

## Son deploy kronolojisi

### v350 — Web-only (14 Temmuz 2026) — Logo / Sidebar / Topbar

- **Kapsam:** web-only · migration yok · rollback web v348 / backend v348
- Sidebar 224 / 70; header `h-14`; brand SVG (`public/brand/meridyen-*.svg`); PNG arşiv korunur
- Topbar’da logo; Yardım ikon; kalıcı sağ kılavuz kaldırıldı
- Smoke: route PASS; login credential eksik (yerel smoke FAIL beklenen)

### v349 — Backend-only (14 Temmuz 2026) — Finans API Guard

- **Kapsam:** backend-only · migration: şema up-to-date (`20260713190000_repair_report_version_0_to_3` paketinde) · rollback backend v348 / web v348
- `assertDashboardFinanceAccess` — finance/budget/bottlenecks/ownership/daily-flow
- Cost-masking: report PDF/image binary pipe atlanır
- Web sonraki turda v350 aldı

### P1 kapanış notu — Doküman (13 Temmuz 2026) — *deploy yok*

- **Kapsam:** doküman-only · canlı sürüm değişmedi (**v348**)
- P1 Sidebar + Dashboard implementasyon paketi **kapandı** (S/A/D/F + A3/A4/A5)
- A5 P1 için yeterli (`AdminBottomRow` 3 sütun) → eski «v349-dashboard-p1» yok; etiket **güvenlik** için yeniden kullanıldı
- Kabul: `canli-kabul/P1_SIDEBAR_DASHBOARD_KABUL_KRITERLERI.md` · not: `inbox/TEST_OTURUMU_ACIK_KONULAR.md`

### v348 — Full (13 Temmuz 2026) — Dashboard Admin A3/A4 Faz 6

- **Kapsam:** full (web + backend) · migration: schema up-to-date · rollback web v346 / backend v342
- A3: Ekip Yoğunluğu Pzt–Paz bar chart; Geçen Hafta gerçek haftalık; Personel Yükü avatar + bar
- A4: Günün Akışı 4 bugün metriği + Gider Dağıtımı yeşil/amber kart
- Backend: `GET /dashboard/daily-flow` (today + teamDensity + lastWeek)
- Pakette: Saha v347 + D0 v346 şablonları
- Shell v344 / Admin KPI v345 korunur
- Smoke: panel route’ları PASS (login env yok → auth FAIL beklenen)

### v347 — Web-only (13 Temmuz 2026) — Dashboard Saha Operasyon Merkezi Faz 5 (F0) — *v348 ile canlıya alındı*

- Başlık **Saha Operasyon Merkezi** + **Saha** rozeti
- CTA: Dosyalarıma Git (mavi) + Carilerim (outline); Acil kapsama göre
- Saha Özeti 6 KPI (`/dashboard/my-performance`) + Günün Akışı (finans/onay yok)
- Alt 3’lü: SLA Riskleri / Bekleyen Aksiyonlar / Açık Dosyalarım (`claim-files` saha kapsamı)
- >1440px Saha Kullanım Kılavuzu paneli
- Admin v345 / Dosya Sorumlusu v346 şablonları dokunulmadı; shell v344 / backend v342 korunur

### v346 — Web-only (13 Temmuz 2026) — Dashboard Dosya Sorumlusu Merkezi Faz 4 (D0)

- Başlık **Dosya Sorumlusu Merkezi** + Dosya Sorumlusu rozeti
- CTA: + Yeni Hasar (mavi); + Yeni Acil yalnızca kapsama göre
- Operasyon Özeti kompakt band + Günün Akışı (finans kartı yok) + Onay Gecikmeleri
- Alt 3’lü: Kritik Uyarılar / Bekleyen Aksiyonlar / Son Aktiviteler
- >1440px Ofis Kullanım Kılavuzu paneli (finans linki yok)
- Admin v345 şablonu dokunulmadı; backend v342 korunur

### v345 — Web-only (13 Temmuz 2026) — Dashboard Admin KPI Faz 3

- Başlık **Operasyon Yönetim Merkezi** + Admin rozeti
- CTA: + Yeni Hasar (mavi), + Yeni Acil (kırmızı), Pazartesi Toplantısı (mavi outline)
- Finans Özeti 5 KPI (tam ₺ format); Operasyon Özeti 6 kompakt metrik
- Haftalık Performans + Günün Akışı; >1440px Kullanım Kılavuzu paneli (300px)
- Shell v344 dokunulmadı (sidebar 240/72, Hızlı İşlem, Operasyon Aktif)
- Backend değişmedi (v342)

### v344 — Web-only (13 Temmuz 2026) — Dashboard shell Faz 2

- Sidebar **240px / 72px** (ANA SAYFA TASARIM TALİMATI kilidi; 286/92 geri alındı)
- Aktif menü `#EEF4FF` / `#2563EB` + sol 4px çizgi
- Topbar: Global Arama (⌘K), **+ Hızlı İşlem**, bildirim, Kullanım Kılavuzu, **Operasyon Aktif**
- Alt footer: Menüyü Daralt + kılavuz; navigasyon maddeleri korunur
- Backend değişmedi (v342)

### v343 — Web-only (önceki)

- Finans Özeti tam ₺ tutar; tab ikon; randevu/süreç düzenlemeleri

### v282 — Web-only (11 Temmuz 2026 gece) — logo konusu kapatıldı

- Sidebar logo **kompakt tek satır** (v253): dar menüde alt chevron ve çift beyaz kutu kaldırıldı
- Commit: `167b345`

### v281 — Web-only (11 Temmuz 2026 gece)

- **Koyu mod kapalı** — test aşaması `PANEL_FORCE_LIGHT_MODE`
- Logo ölçeği **v274/ade5d73** seviyesine döndü (5rem şişirme geri alındı)
- Commit: `6d6d0a0`

### v280 — Web-only (11 Temmuz 2026 gece)

- Logo şeridi **koyu temada da beyaz** — dar menü yanıltıcı koyu şerit kaldırıldı
- Geniş menü logo **5.25rem** belirgin; dar küre h-11
- Commit: `b98076c`

### v279 — Web-only (11 Temmuz 2026 gece)

- Sidebar logo **ölçeklendirme** — ade5d73 cilası: dar menü beyaz kart + büyük küre; geniş menü 4.5rem logo
- v278 ölçek regresyonu geri alındı
- Backend **v276 sabit**; migration yok
- Commit: `f52f9cd`

### v278 — Web-only (11 Temmuz 2026 gece)

- **S2 dar menü logo:** `meridyen-globe-square.png` geri — v277 SVG ihlali geri alındı (`ONAYLI_UI_CHECKLIST`)
- Backend **v276 sabit**; migration yok
- Smoke: login FAIL (yerel credential — bilinen); routing PASS; web healthy
- Commit: `4ef1981`

### v277 — Web-only (11 Temmuz 2026 gece)

- **Sidebar logo:** dar menü `MeridyenGlobeAnimated` SVG; geniş menü `meridyen-logo-original.png`
- **Koyu tema:** geniş logo için beyaz zemin (JPEG şeffaf değil)
- Backend **v276 sabit**; migration yok
- Pre-deploy: disk/routing PASS; nginx → web PASS
- Smoke: login FAIL (yerel credential — bilinen, v274 ile aynı); diğer rotalar PASS; web container healthy v277
- Commit: `e0bd4fc`

### v276 — Full (11 Temmuz 2026 akşam)

- **İhbar konusu:** canonical only; gelen kutusu `claimSubjectId` bağlama
- **Logo:** sidebar beyaz kutu kaldırıldı
- **E-posta 404:** panel URL + `/claim-files/*` redirect
- **Onarım raporu:** yatay revizyon geçmişi (Dosya Bilgileri içinde)
- **Sürüm etiketi:** `panel-build-info.ts` → v276
- Migration yok
- Commit: `1fafa1b`
- Disk: eski image temizliği sonrası deploy (korunan: v275, v274 web, v272 backend)

### v275 — Full (11 Temmuz 2026 akşam)

- Operasyon dosya tıklama **500** düzeltmesi (`claim?.latestRepairReport`)
- **İhbar konusu** eşlemesi (`resolveClaimIhbarKonusu`); API claimSubject dahil
- Mail terminoloji normalizasyonu (Cam Kırılması, Dahili Su vb.)
- Sidebar nav aktif/hover kontrastı; sütun sıra ↑↓ ve genişlik iyileştirmesi
- Migration yok
- Commit: `9d26122`

### v274 — Web-only (11 Temmuz 2026 akşam)

- Koyu tema **tablo zebra kontrastı** — dosyalar okunur
- **Sidebar logo** kalıcı CSS: `rounded-xl`, ölçek, dar menü küre çipi
- Backend **v272 sabit**; migration yok
- Smoke: login FAIL (yerel credential — bilinen); routing PASS; web healthy
- Commit: `ade5d73`

### v273 — Web-only (11 Temmuz 2026 akşam)

- Onarım raporu dosya sorumlusu **23 madde UX** geri bildirimi
- Rapora Git doğrudan rapor sayfası; Dosya Bilgileri eksper/ihbar; tablo satır UX; Tespit sütunu; tedarikçi modal/hafıza; alt bant; revizyon geçmişi taşıma
- Backend **v272 sabit**; migration yok
- Smoke: login FAIL (yerel credential — bilinen); routing PASS; web healthy
- Commit: `6c9bfbc`

### v251 — Web-only (11 Temmuz 2026)

- Sidebar kabuğu cilası: **Menüyü Daralt** + **rol kılavuzu** alt bölümde sabit
- Logo: küre + MERİDYEN / ASİSTANCE (beyaz kutu kaldırıldı)
- Yuvarlak köşeler (12px), içerik kaydırması menüyü kesmez
- Backend **v249 sabit**

### v250 — Web-only (11 Temmuz 2026)

- **P1 şablon:** Lacivert sidebar (tam logo / küre, Menüyü Daralt, rehber kartı)
- **Admin Yönetim Merkezi:** Admin rozeti, kırmızı Yeni Acil, Pazartesi Toplantısı
- Operasyon 6 kompakt kart + yüzde, Ekip Yoğunluğu grafiği
- Günün Akışı şeridi + büyük Gider Dağıtımı kartı
- Alt sıra: Kritik Uyarılar | Finans Darboğazları | Personel Yük (progress bar)
- Backend **v249 sabit** — migration yok
- Mustafa onayı: 11 Temmuz 2026

### v246 — Full (önceki oturum)

- 403 / erişim düzeltmeleri (dosya sorumlusu)
- Hasar dosyası görünürlük + otomatik ofis ataması
- Bireysel tedarikçi `firstName` hatası
- İş grubu ekleme yetkisi
- Gelen kutusu v245 özellikleri

### v247 — Full

- Global arama (mailler, acil dosyalar, sigortalı adı)
- Operasyon tablosu **Sigortalı Adı Soyadı** sütunu
- Bitişik dosya no eşleştirme (`50663701` ↔ `5066 3701`)

### v248 — Full (10 Temmuz 2026)

- **Dashboard iskeleti** — Finans Özeti + Operasyon Özeti + Haftalık Performans bölümleri *(onaylı mockup şablonu birebir değil — bkz. envanter P1)*
- Yan menü yenilemesi (daralt/genişlet, Finans Merkezi)
- Hasar detay paneli: sigortalı adı, hasar adresi, ihbar içeriği
- Yeni dosyada `insuredName` kaydı düzeltmesi
- HASAR Graph delta otomatik kurtarma (sync state not found → delta sıfırla + yeniden tara)
- Operational access grants + 2 migration
- Oturum güvenliği, IDOR scope, sidebar UX (v232–v234 commit’leri)

### v249 — Backend-only (10 Temmuz 2026, v248 sonrası)

- Inbound ingest build fix (`ef87cdb` — kullanılmayan job parametresi)
- Web **v248 sabit** kaldı

### Operasyonel (deploy değil, canlıda uygulandı)

- HASAR gelen kutusu delta manuel sıfırlama + senkron → `50663701` Aynur Yar ve `50663630` Ayla Belgin mailleri çekildi

---

## Canlıda VAR (tekrar deploy gerekmez)

**Platform:** Ayarlar anayasası, kullanıcı davet, KVKK modal, Tanımlar hub, sol menü + kılavuz

**Operasyon / hasar:** Gelen kutusu çekirdek, dosya açma modal, global arama, operasyon sigortalı sütunu, bitişik dosya no, hasar detay paneli, 403 düzeltmeleri

**Finans:** Finans Merkezi sayfası, v250 **Yönetim Merkezi** şablonu (admin), PayTR kod yolu (`/odeme/[token]`)

**Diğer:** Harita pinleri, tedarikçi dış kaynak arama, personel özlük, eksper/sigorta/broker portalları, MinIO, müşteri modülü UX

---

## Canlıda YOK / henüz yapılmadı

### Deploy bekleyen kod

| # | Konu | Durum |
|---|------|--------|
| — | Repoda olup canlıda olmayan kod | **Boş** — son gap v250’de kapandı |

### Ürün — şablon sonrası açık işler

| # | Konu | Mockup / not |
|---|------|----------------|
| P2 | **Dosya sorumlusu** dashboard şablonu birebir UI | Ayrı mockup / doğrulama gerekir |
| P1 | Admin şablon — Mustafa canlı screenshot PASS | `canli-kabul/ekran-goruntuleri/p1-v250/` |

### Ops işi (kod deploy değil)

| # | Konu | Dosya |
|---|------|-------|
| D2 | Eski hasar dosyalarına ofis ataması backfill | `scripts/backfill-orphan-claim-office-assignments.sql` |

### Veri düzeltmesi (deploy değil)

- `2026 YB 13237` — sigortalı adı boş; panelden veya SQL ile manuel güncelleme (eski kayıt)

### Kabul / test eksik (A paketi)

A1 screenshot, A2 BACKLOG 13 madde, A3 gelen kutusu T1–T7, A4 giriş logo, A5 davet maili, A6 harita — ayrıntı: `CANLIYA_ALINMAMIS_ENVANTER.md`

### Gelecek faz (B paketi)

PayTR canlı mod, CRM derinliği, gelen kutusu F2–F3, saha keşif, e-imza — ayrıntı: envanter B maddeleri

---

## Özet cümle

Son büyük **kod** paketi **v250 (web-only) + v249 (backend)** canlıda: P1 sidebar + admin dashboard şablonu dahil. **Deploy bekleyen yeni kod yok.** Sırada: canlı screenshot PASS (P1), dosya sorumlusu şablonu (P2), ops backfill (D2).

---

## Deploy sonrası güncelleme şablonu

```markdown
### vNNN — Web-only | Backend-only | Full (TARİH)
- Madde 1
- Madde 2
Rollback: ...
```

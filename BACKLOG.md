# Operasyonel Hardening — Backlog Etiketlemeleri

Tarih: 2026-05-12

## Silent Catch / Fallback Workaround'lar

Aşağıdaki dosyalarda API hatası durumunda sessizce state boşaltan veya 0/null atan catch blokları bulunmaktadır. Bunlar geçici workaround olarak işaretlenmiştir.

| # | Dosya | Satır | Pattern | Risk |
|---|-------|-------|---------|------|
| 1 | `panel/acil-yardim/yeni/page.tsx` | 252 | `catch { setTcDupError(null); }` | Düşük — form validasyon |
| 2 | `panel/acil-yardim/yeni/page.tsx` | 265 | `catch { setPhoneDupError(null); }` | Düşük — form validasyon |
| 3 | `panel/acil-yardim/yeni/page.tsx` | 278 | `catch { setNameDupWarn(null); }` | Düşük — form validasyon |
| 4 | `panel/acil-yardim/yeni/page.tsx` | 294 | `catch { setFileNoError(null); }` | Düşük — form validasyon |
| 5 | `panel/tedarikciler/page.tsx` | 247 | `.catch(() => setVendor(null))` | Orta — detay veri kaybı |
| 6 | `panel/tedarikciler/page.tsx` | 767 | `.catch(() => { /* empty */ })` | Orta — listeleme veri kaybı |
| 7 | `panel/musteriler/[id]/page.tsx` | 31 | `catch { return null; }` | Düşük — SSR helper |
| 8 | `panel/musteriler/[id]/page.tsx` | 386 | `catch(e) { console.error(e); }` | Düşük — action error |
| 9 | `panel/musteriler/[id]/page.tsx` | 397 | `catch(e) { console.error(e); }` | Düşük — action error |
| 10 | `panel/musteriler/page.tsx` | 428 | `.catch(() => setCustomer(null))` | ~~Orta~~ **Düzeltildi v79** — toast + Tekrar Dene |
| 11 | `panel/musteriler/page.tsx` | 1243 | `.catch(() => { /* empty */ })` | ~~Orta~~ **Düzeltildi v79** — toast, liste korunur |
| 12 | `panel/hasar-dosyalari/yeni/page.tsx` | 262 | `catch { setTcDupError(null); }` | Düşük — form validasyon |
| 13 | `panel/hasar-dosyalari/yeni/page.tsx` | 275 | `catch { setPhoneDupError(null); }` | Düşük — form validasyon |
| 14 | `panel/hasar-dosyalari/yeni/page.tsx` | 288 | `catch { setNameDupWarn(null); }` | Düşük — form validasyon |
| 15 | `panel/hasar-dosyalari/[id]/page.tsx` | 30 | `catch { return null; }` | Düşük — SSR helper |
| 16 | `panel/hasar-dosyalari/[id]/page.tsx` | 87 | `.catch(() => setData(null))` | Yüksek — dosya detay veri kaybı |
| 17 | `panel/hasar-dosyalari/[id]/page.tsx` | 139 | `.catch(() => setSuggestions([]))` | Orta — öneri veri kaybı |
| 18 | `panel/hasar-dosyalari/[id]/page.tsx` | 2339 | `.catch(() => setVendors([]))` | Orta — dropdown veri kaybı |
| 19 | `panel/hasar-dosyalari/[id]/page.tsx` | 2344 | `.catch(() => setUsers([]))` | Orta — dropdown veri kaybı |
| 20 | `panel/hasar-dosyalari/page.tsx` | 81 | `catch { return { officeStaffUserId: null, isFieldStaff: false }; }` | Düşük — auth helper |
| 21 | `panel/admin/audit-logs/page.tsx` | 62 | `.catch(() => setRows([]))` | Orta — log veri kaybı |
| 22 | `panel/ayarlar/e-posta-bildirimleri/page.tsx` | 88-89 | `.catch(() => null)` (2 adet) | Düşük — settings fallback |
| 23 | `panel/personel-yonetimi/page.tsx` | 454 | `catch { setSearchResults([]); }` | Orta — arama veri kaybı |
| 24 | `panel/layout.tsx` | 737 | `.catch(() => { setPendingRevisionCount(0); })` | Düşük — badge fallback |

## Diğer Workaround'lar

| Dosya | Satır | Açıklama |
|-------|-------|----------|
| `panel/hasar-dosyalari/[id]/page.tsx` | 25 | `// JWT payload fallback` |
| `panel/hasar-dosyalari/[id]/page.tsx` | 3764 | `// fallback: load all vendors` |
| `panel/ayarlar/kurulum/page.tsx` | 1052 | `// localStorage'dan oku fallback` |
| `panel/ayarlar/kurulum/page.tsx` | 1059 | `// localStorage fallback on error` |

## Önerilen Aksiyon

1. **Yüksek risk** (#16): `hasar-dosyalari/[id]/page.tsx:87` — dosya detay verisi kaybolursa kullanıcı boş sayfa görür. Error boundary + retry eklenebilir.
2. **Orta risk** (#5-6, #10-11, #17-19, #21, #23): Listeleme/dropdown veri kaybı — toast notification + retry butonu eklenebilir.
3. **Düşük risk** (#1-4, #12-14, #20, #22, #24): Form validasyon, auth helper, badge — mevcut davranış kabul edilebilir.
4. **4012 satır dosya** (`hasar-dosyalari/[id]/page.tsx`): Faz 3'te refactor edilecek (ertelendi).

---

## Operasyon Gelen Kutusu (Microsoft 365)

Tarih: 2026-06-29 | Plan: `docs/project-governance/inbox/OPERASYON_GELEN_KUTUSU.md`

| Faz | Madde | Durum |
|-----|-------|-------|
| F1-çekirdek | Prisma schema + migration | ✅ iskelet |
| F1-çekirdek | `operation-inbox` modül + Bull kuyruk | ✅ iskelet |
| F1-çekirdek | Graph auth + delta sync | ⬜ |
| F2 | AI sınıflandırma + ihbar kartları | ⬜ |
| F2 | Talimatlı hasar/acil dosya açma | ⬜ |
| F2 | M365 ayar sihirbazı (Entegrasyonlar) | ⬜ |
| F3 | Dosya E-posta Yazışmaları sekmesi | ⬜ |
| F3 | Otomatik dosya eşleştirme + yanıt | ⬜ |

---

## Tedarikçi Dış Kaynak Arama (Google / Sosyal Medya)

Tarih: 2026-07-02 | Plan: [`docs/features/TEDARIKCI_DIS_ARAMA_HAZIRLIK.md`](docs/features/TEDARIKCI_DIS_ARAMA_HAZIRLIK.md)

| Faz | Madde | Durum |
|-----|-------|-------|
| F1-hazırlık | Teknik plan dokümanı | ✅ |
| F1-hazırlık | `vendor-discovery` backend mock (`GET /search`) | ✅ iskelet |
| F1-hazırlık | Tedarikçiler sayfası — Dış Kaynakta Ara paneli | ✅ iskelet |
| F2 | Google Places API canlı entegrasyon | ⬜ |
| F2 | Aday → tedarikçi formu import akışı | ⬜ |
| F2 | Prisma: VendorDiscoverySession + Candidate | ⬜ |
| F2 | Entegrasyonlar ayarı (API key, kota) | ⬜ |

---

## Harita Modülü (v125 / v61)

Tarih: 2026-07-02 | Canlı: `/panel/harita`

| Madde | Durum |
|-------|-------|
| Personel + onarım/acil tedarikçi pinleri (v125) | ✅ canlı |
| Mustafa manuel test (filtreler, pinler, Cmd+Shift+R) | ⬜ bekliyor |
| Tedarikçi canlı GPS (mobil uygulama) | ⬜ sonraki faz |

---

## Mobil / Tablet UX (v126)

Tarih: 2026-07-02 | Canlı: web **v126**

| Madde | Durum |
|-------|-------|
| Giriş sayfası — mobilde kaydırma / şifre alanı (overflow, login önce) | ✅ canlı |
| Viewport meta + safe-area | ✅ canlı |
| Panel içerik padding (küçük ekran) | ✅ canlı |
| Harita sayfası yüksekliği (`100dvh`) | ✅ canlı |
| Canlı deploy (web-only) | ✅ v127 (loading UI) — rollback v126 |

**Mustafa test listesi (telefon + tablet, Cmd+Shift+R):**
- [ ] `/giris` — form en üstte; e-posta/şifre alanına inilebiliyor; klavye açılınca alan görünür kalıyor
- [ ] `/giris` — dikey + yatay (landscape) mod
- [ ] Panel — kenar boşlukları, üst menü / hamburger, tablo taşması yok
- [ ] `/panel/harita` — filtreler ve harita yüksekliği mobilde düzgün

---

## Test Edilecekler (Mustafa)

| Öncelik | Konu | URL / Not | Durum |
|---------|------|-----------|-------|
| 1 | Harita modülü | `/panel/harita` — Tümü/Personel/Onarım/Acil filtreleri, pinler | ⬜ |
| 2 | Mobil giriş | `/giris` — şifre alanı, kaydırma, tablet | ⬜ |
| 3 | Mobil panel | Panel sayfaları genel (padding, menü) | ⬜ |
| 4 | Tedarikçi dış arama | `/panel/tedarikciler` → Dış Kaynakta Ara → Tedarikçi Olarak Ekle | ⬜ (Google key sonra) |
| 5 | Acil ihbar panel | `/panel/acil-yardim` → Yeni Dosya; asistans firma arama/liste/yeni kayıt (`subType=asistan_firmasi`) | ⬜ |
| 6 | Hasar ihbar panel | `/panel/hasar-dosyalari` → Yeni Dosya; eksper ofisi + sigorta şirketi alanları | ⬜ |
| 7 | Rol — ofis personeli | `office_staff`: her iki liste + yeni dosya paneli; hasar listesi kendi atamalarına filtreli | ⬜ |
| 8 | Rol — saha personeli | `field_staff`: hasar listesi görünür, **Yeni Dosya** gizli; acil sayfası menüde yok | ⬜ |
| 9 | Rol — finans | `accountant`: yalnız finans/rapor; ihbar paneli erişimi yok | ⬜ |
| 10 | Rol — eksper portal | `expert`: `/panel/eksper-portal`; operasyon ihbar paneli entegrasyonu **beklenmiyor** | ⬜ |
| 11 | Rol — sigorta portal | `insurance_company_user`: `/panel/sigorta-portal`; ihbar paneli entegrasyonu **beklenmiyor** | ⬜ |
| 12 | Deep link | `/panel/acil-yardim?yeni=1` ve `/panel/hasar-dosyalari?yeni=1` → sağ panel açılır; `/yeni` rotaları redirect | ⬜ |
| 13 | Gelen kutusu | Operasyon gelen kutusu (`InboxOpenFileModal`) ayrı akış — yeni panel formlarıyla karıştırma | ⬜ |

**Hasar ihbar paneli — rol bazlı test adımları (Mustafa):**

- [ ] Ofis personeli ile `/panel/hasar-dosyalari` → Yeni Dosya → eksper ofisi ara/liste yalnız `eksper_firmasi` müşterileri
- [ ] Yeni eksper ofisi kaydı → `subType=eksper_firmasi`, `serviceType=hasar`
- [ ] Sigorta şirketi zorunlu; broker ayrı bölüm yok (sigorta şirketi = dosya kaydı alanı)
- [ ] Saha personeli ile aynı sayfada Yeni Dosya butonu görünmemeli
- [ ] `?yeni=1` deep link paneli açmalı

**Acil ihbar paneli — rol bazlı test adımları (Mustafa):**

- [ ] `/panel/acil-yardim` → Yeni Dosya → asistans firma zorunlu; arama `subType=asistan_firmasi`
- [ ] Yeni asistans firması → `serviceType=acil_yardim`
- [ ] Saha personeli acil sayfasına erişememeli (403 veya menüde yok)
- [ ] Operasyon hub → `?yeni=1` linkleri panel açmalı

**Not:** Eksper portal ve sigorta portal kullanıcıları için yeni ihbar formu bu entegrasyon kapsamında değil; onay/dosya listesi kendi portal rotalarında kalır. Gelen kutusundan acil dosya açılışında asistan firma bağlanmıyor (bilinen gap — madde 13).


---

## Saha Keşif Ölçüsü — Defterden Dijital (AI + PDF + WhatsApp)

Tarih: 2026-07-06 | Plan: [`docs/features/MARANGOZ_KESIF_OLCU.md`](docs/features/MARANGOZ_KESIF_OLCU.md)

Marangoz, boya, seramik, parke, alçı… — lazer metre ölçüsü + fotoğraf; tedarikçiye WhatsApp/PDF.

| Faz | Madde | Durum |
|-----|-------|-------|
| F1-iskelet | Teknik plan + çok iş kolu parça tipleri | ✅ |
| F1-iskelet | Prisma `FieldSurveyBrief` + migration | ✅ iskelet |
| F1-iskelet | `field-survey-briefs` backend (scan, CRUD, PDF, share) | ✅ iskelet |
| F1-iskelet | `FieldSurveyBriefModal` + dosya detay girişi | ✅ iskelet |
| F2 | Annotated foto, gönderim geçmişi, raporlar sekmesi listesi | ⬜ |
| F2 | Atanan tedarikçi telefon ön doldurma | ⬜ |
| F3 | Bluetooth lazer / AR ölçüm entegrasyonu (defter tamamen kalkar) | ⬜ |
| F3 | Mobil native kamera + offline kuyruk | ⬜ |

---

## Deploy — Web v162 / Backend v153 gap (2026-07-03)

- [ ] **v153 backend (hazırlık, deploy yok):** Canlı backend **v152**; workspace’te `claim-files.service.ts` — `latestRepairReport` yalnız onaylı rapor (`approved`, `externally_approved`); `CreateClaimFileRevenueDto` — gelir **açıklama** (`description`) zorunlu. Web v162 bu sözleşmeyi UI’da varsayabilir; backend deploy onayı sonrası **backend-only**, migration beklenmiyor.
- [ ] **Mustafa canlı test (v162):** Hasar dosyası detay — Finans özet, gelir/fatura, gider/bütçe alt sekmeleri; Evraklar 4 alt sekme + sözleşmeler; Onarım raporu / revizyon UX.

---

## Onarım Raporu Yazım Süresi Analitiği (2026-07-11)

- [ ] **Analytics sonra:** `sessionStorage` anahtarı `report-write-started-at` — onarım raporu düzenleme sayfası açıldığında `{ reportId, claimFileId, startedAt }` yazılır. Süre ölçümü ve panel raporlaması için backend/BI entegrasyonu henüz yok.


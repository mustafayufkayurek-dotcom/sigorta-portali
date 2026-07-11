# Onarım Raporu — 42 Madde Master Listesi

**Tarih:** 11 Temmuz 2026  
**Amaç:** Yeni agent oturumu için tek kaynak; Mustafa’nın tüm istekleri madde madde.  
**Uygulanacak:** **41 madde** (B-1 hariç — aşağıda **İPTAL**).  
**Ek kapsam (Grup 3):** Operasyon C-1…C-6 (bu dosyada 42’nin dışında, aynı oturumda istendi).

---

## Kritik deploy gerçeği (11 Temmuz gece)

| Durum | Açıklama |
|-------|----------|
| Canlı web | **v287** (`02117db`) — çoğunlukla logo + Dosya Bilgileri görünürlük (`e3832e9`) |
| v285 paket | `425ece3` — kısmi 41-madde UX (revizyon şeridi, mahal serbest metin, alt bant hatırlatma) |
| **Yerel (commit edilmemiş)** | Tespit sütunu, Grup 2 B-4…B-23 tamamı, eksper fix, operasyon C-1…C-6, backend PDF/eksper |

**Mustafa’nın «canlıda sayfa aynı» şikâyeti doğru:** Son oturumdaki büyük UX paketi **henüz commit + deploy edilmedi**. v287 ≠ tam 41 madde.

**Sonraki adım (onay gerekir):** Tüm `M` dosyalarını commit → `deploy-web-production.sh` ile **web-only** (+ gerekirse backend v276+) → `post-deploy-smoke.sh` → Ctrl+Shift+R ile canlı doğrulama.

---

## Bölüm A — İlk Geri Bildirim (19 Madde)

| ID | İstek | Beklenen | Ana dosya(lar) | Kod (yerel) | Canlı v287 |
|----|-------|----------|----------------|-------------|------------|
| **A-1** | Hasar Nedeni → Dosya Bilgileri | Hasar nedeni rapor gövdesinde değil; Dosya Bilgileri kartında | `DosyaBilgileriDetay.tsx`, rapor `page.tsx` | ✅ | ⚠️ kısmi |
| **A-2** | Hasar nedeniyle uyumlu Hızlı Onarım Türü | Dahili/Harici Su gibi anlamsız ayrım yok; seçilen hasar nedeniyle liste uyumlu | `quick-repair-damage-types.ts`, dosya detay | ✅ | ⚠️ |
| **A-3** | «Hasar Türü(leri)» → «Hasar Türü» | Tekil etiket, Title Case | `[id]/page.tsx` | ✅ | ⚠️ |
| **A-4** | «Hızlı Onarım Kalemleri» → «Hızlı Onarım Türü» | «Kalem» ifadesi yok | `[id]/page.tsx` | ✅ | ⚠️ |
| **A-5** | Hızlı onarım türü/kapsam rapora yansır | Ekran + PDF’te seçilen tür/kapsam görünür | rapor `page.tsx`, `report-pdf.service.ts` | ⚠️ PDF kontrol | ❌ |
| **A-6** | Enter + «+ Kalem Ekle» satır UX | Mavi «Satır Ekle» yok; Enter kayıt; altta ince link | `onarim-raporu/[reportId]/page.tsx` | ✅ | ⚠️ v285 |
| **A-7** | Mavi «Satır Ekle» kaldır | Tabloda mavi ekle butonu yok | aynı | ✅ | ⚠️ |
| **A-8** | İşlem sütunu ikon tabanlı düzenle/sil | Metin yerine kalem/çöp/tik ghost ikonlar | aynı | ✅ | ⚠️ |
| **A-9** | Alt bant Kaydet sadeleştirme | Gereksiz bölüm içi Kaydet yok; dirty iken alt bant | aynı | ✅ | ⚠️ |
| **A-10** | Fotoğraf yükleme fix | JPEG/PNG/HEIC; «Yüklenemedi» yok | aynı, `EmergencyReportEditor` | ✅ | ❌ uncommitted |
| **A-11** | Foto etiketleri Tespit/Onarım/Onarım Sonrası + portal | Köşe etiket; eksper/sigorta portal sync | rapor + portal bileşenleri | ✅ | ❌ |
| **A-12** | Alt bant baloncuk metin ortalama | Durum badge içi ortalı | aynı | ✅ | ⚠️ |
| **A-13** | Sigortalı bilgileri rapor/PDF | Ad, iletişim rapor + PDF | rapor `page.tsx`, PDF servis | ⚠️ PDF | ❌ |
| **A-14** | Dosya Eksperi doğru kişi | Atanan eksper; dosya sorumlusu **eksper alanında görünmez** | `repair-report-expert.ts`, `DosyaBilgileriDetay.tsx`, rapor `page.tsx` | ✅ (bugün düzeltildi) | ❌ regresyon v287 |
| **A-15** | Kaydet/İptal sağa hizalı | Alt bant sağ hizalı | rapor `page.tsx` | ✅ | ❌ uncommitted |
| **A-16** | Yasal not şablon chip’leri | Kdv, Garanti, Muafiyet, Ön Tespit vb. tıklanınca metne eklenir | `legal-note-templates.ts`, rapor sayfası | ✅ | ⚠️ |
| **A-17** | «Dosya Bütçesi»; «Dahili» kaldır | Başlık Dosya Bütçesi; Dahili etiketi yok | rapor `page.tsx` | ✅ | ⚠️ |
| **A-18** | Tedarikçi ismi + karşılaştırma | Maliyet girilen tedarikçi adı; alternatif teklif seçimi | rapor `page.tsx`, `VendorQuoteModal` | ✅ | ❌ uncommitted |
| **A-19** | Revizyon akışı + geçmiş Dosya Bilgileri’nde **yatay şerit** | Revize Et modalı; geçmiş **Dosya Bilgileri içinde**, dikey kutu değil — v276 tarzı yatay akışkan scrollbar | `RevisionHistoryStrip.tsx`, `DosyaBilgileriDetay.tsx`, rapor `page.tsx` | ✅ (bugün düzeltildi) | ❌ yanlış stil canlıda |

---

## Bölüm B — Dosya Sorumlusu İkinci Tur (23 Madde)

| ID | İstek | Beklenen | Ana dosya(lar) | Kod (yerel) | Canlı v287 |
|----|-------|----------|----------------|-------------|------------|
| **B-1** | Rapora Git eski sekmeye dön | Tab değiştirme; eski UX | `[id]/page.tsx` | — | **İPTAL** — doğrudan `/onarim-raporu/[reportId]` Link kalacak |
| **B-2** | Dosya Eksperi Dosya Bilgileri’nde | `assignedInspectorVendor` + rapor `inspectorName` fallback | `DosyaBilgileriDetay.tsx` | ✅ (bugün) | ❌ eksper kaybolmuş |
| **B-3** | Hasar Tarihi kaldır; İhbar fallback | Hasar Tarihi yok; boşsa `claim.createdAt` | `DosyaBilgileriDetay.tsx` | ✅ | ⚠️ |
| **B-4** | Tab arama alanına atlamasın | Tab sıradaki hücreye | rapor `page.tsx` | ✅ | ❌ uncommitted |
| **B-5** | Satır Kaydet + Enter | Her satırda kaydet; Enter yeni satır | rapor `page.tsx` | ✅ | ❌ |
| **B-6** | Tedarikçi fiyat UX | Modal/popover tutarlı; odak kaybı yok | rapor `page.tsx` | ✅ | ❌ |
| **B-7** | Satır eklerken sayfa yenilenmesin | Scroll/odak korunur | rapor `page.tsx` | ✅ | ❌ |
| **B-8** | Tedarikçi fiyat hafızası | Önceki tedarikçi/fiyat önerileri | rapor `page.tsx` | ✅ | ❌ |
| **B-9** | Mahal/bölge korunsun | Yeni satırda üst satır mahali silinmez | rapor `page.tsx` | ✅ | ❌ |
| **B-10** | Tespit → Mahal → İş Grubu sıralama + grup başlıkları | Tablo gruplu; aynı alanda kopukluk az | rapor `page.tsx` | ✅ | ❌ |
| **B-11** | Mahal formatı `Kelime1 - Kelime2` | «Alt Kat - 5 Nolu Daire» tire ile | rapor `page.tsx`, `text-helpers` | ✅ | ⚠️ v285 |
| **B-12** | **Tespit sütunu** (Kategori yanı) | «Sigortalı Konut», «Alt Kat - 5 Nolu Daire» gibi; öneri/ekle; sıralama tespit → mahal | rapor `page.tsx` (`DetectionScopeInput`) | ✅ | ❌ **canlıda yok** |
| **B-13** | Kayıtta mahal silinmesin | Satır kaydında mahal sıfırlanmaz | rapor `page.tsx` | ✅ | ❌ |
| **B-14** | Tab sonraki hücreye; alt Kaydet’e gitmesin | Tab trap | rapor `page.tsx` | ✅ | ❌ |
| **B-15** | Tedarikçi karşılaştır → İşlem sütunu / geniş modal | Dar popover yerine okunaklı modal | rapor `page.tsx` | ✅ | ❌ |
| **B-16** | Satır kaydet emaresi (Ctrl+Enter, ↵) | Tik/kaydet geri bildirimi net | rapor `page.tsx` | ✅ | ❌ |
| **B-17** | + Kalem Ekle satırı sıfırlamasın | Üst satır verisi korunur | rapor `page.tsx` | ✅ | ❌ |
| **B-18** | Kategori seçince alt Kaydet belirginleşmesin | Sabit alt bant görünümü | rapor `page.tsx` | ✅ | ❌ |
| **B-19** | Kaydet hatırlatma pop-up | 2 dk idle + Geri; kaydedilmemiş alan | rapor `page.tsx` | ✅ | ❌ uncommitted |
| **B-20** | Sabit Kaydet/İptal + sayaçlar | Ekstra Kaydet çıkmaz; kayıt/iptal sayacı | rapor `page.tsx` | ✅ | ❌ |
| **B-21** | Yazım süresi (sessionStorage) | `report-write-started-at`; analitik sonra | rapor `page.tsx` | ✅ | ⏳ deploy sonrası ölçüm |
| **B-22** | Alt bant: finans ortada, butonlar sağda | Grid layout; düzensiz dağılım yok | rapor `page.tsx` | ✅ | ❌ |
| **B-23** | Foto yenilemesiz; revizyon geçmişi Dosya Bilgileri’nde | Optimistic foto; revizyon **içeride yatay** | `RevisionHistoryStrip`, `DosyaBilgileriDetay` | ✅ (bugün) | ❌ |

---

## Grup 3 — Operasyon (6 Madde, 42 dışı)

| ID | İstek | Ana dosya | Kod (yerel) | Canlı |
|----|-------|-----------|-------------|-------|
| **C-1** | Operasyon dosya tıklama 500 | `operasyon/page.tsx` | ✅ | ❌ uncommitted |
| **C-2** | İhbar konusu / ihbar notu karışması | `text-helpers.ts`, `inbound-mail-terminology.ts`, `DosyaBilgileriDetay` | ✅ | ❌ |
| **C-3** | Chrome yeniden giriş şifre | `auth-session.ts` | ✅ | ❌ |
| **C-4** | VAM/CAM → Cam Kırılması | `inbound-mail-terminology.ts` | ✅ | ❌ |
| **C-5** | Sütun yer değiştirme | `TableColumnPicker.tsx` | ✅ | ❌ |
| **C-6** | Sütun genişlik tutarlılığı | `PanelTable` colgroup | ✅ | ❌ |

---

## Mustafa’nın son şikâyetleri → madde eşlemesi

| Şikâyet | İlgili maddeler | Kök neden |
|---------|-----------------|-----------|
| Revizyon geçmişi dikey / yanlış yer | A-19, B-23 | Embedded kutu stili + collapsible dışında render; **düzeltildi yerelde** |
| Rapora Git / Kaydet / İptal canlıda yok | B-1 (Link korunacak), A-15, B-20, B-22 | **Deploy edilmemiş** |
| Dosya Eksperi kaybolmuş | A-14, B-2 | `resolveDosyaEksperi` yalnızca vendor; **inspectorName fallback eklendi** |
| Tespit sütunu yok (Sigortalı Konut vb.) | B-12, B-10 | Kod var; **commit/deploy yok** |
| Önceki yatay scrollbar daha profesyoneldi | A-19 | `bg-slate-50` kutu geri alındı; ince yatay scroll |

---

## Doğrulama rotası (canlı kabul)

1. **Ctrl+Shift+R** (önbellek temiz)
2. Operasyon → dosya aç → **Dosya Bilgileri** (eksper, ihbar, hasar nedeni, **içeride yatay revizyon**)
3. **Rapora Git** → `/onarim-raporu/[reportId]` (yeni sekme değil, doğrudan sayfa)
4. Tablo: **Tespit** sütunu, mahal tire formatı, grup sıralaması
5. Alt bant: Kaydet/İptal sağda, finans ortada, sayaçlar
6. Foto yükle → sayfa yenilenmemeli

**Pass formatı:** `A-19 PASS` · `B-12 HAYIR: sütun görünmüyor`

---

## Commit öncesi dosya listesi (uncommitted)

```
apps/web/.../onarim-raporu/[reportId]/page.tsx      # ana UX paketi
apps/web/.../_components/DosyaBilgileriDetay.tsx
apps/web/.../hasar-dosyalari/[id]/page.tsx
apps/web/src/components/damage-reports/RevisionHistoryStrip.tsx
apps/web/src/app/panel/operasyon/page.tsx
packages/shared/src/repair-report-expert.ts         # yeni
apps/backend/.../repair-reports.service.ts
apps/backend/.../report-pdf.service.ts
```

**Deploy tipi önerisi:** web-only (+ backend PDF/eksper için backend-only veya full) · migration yok · rollback: web v286 / backend mevcut manifest.

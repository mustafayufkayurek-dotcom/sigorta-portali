# Field Survey Briefs — Phase 1.2 Kilit

**Durum:** KAPALI (bakım / hata düzeltmesi dışında değişiklik yok)  
**Canlı:** Web `v446` · Backend `v447` (PDF footer düzeltmesi)  
**Ürün sahibi:** Mustafa  
**Kapsam:** Saha Keşif Ölçüsü (Field Survey Briefs) — Faz 1.2

---

## Kilitlenen yüzeyler

### Web (`apps/web/src/components/field-survey/`)

| Dosya | Rol |
|-------|-----|
| `FieldSurveyBriefModal.tsx` | Ana modal — kayıt, AI öneri, sesli not, PDF/WhatsApp |
| `FieldSurveyBriefList.tsx` | Liste + PDF indir |
| `FieldSurveyCameraModal.tsx` | Kamera ölçü emareleri |
| `FieldSurveyCropModal.tsx` | Fotoğraf kırpma |
| `FieldSurveySpeechButton.tsx` | Sesli not (Web Speech API) |
| `field-survey.constants.ts` | Sabitler |

### Backend (`apps/backend/src/modules/field-survey-briefs/`)

| Dosya | Rol |
|-------|-----|
| `field-survey-briefs.controller.ts` | API uç noktaları |
| `field-survey-briefs.service.ts` | İş mantığı + PDF veri mapping |
| `field-survey-scan.util.ts` | Vision AI prompt + parse |
| `pdf/field-survey-pdf.service.ts` | Internal / Supplier PDF HTML |
| `field-survey-briefs-content-disposition.util.ts` | PDF header (ASCII-safe) |

### Altyapı

| Dosya | Not |
|-------|-----|
| `nginx/nginx.conf` | `microphone=(self)` — v445'ten itibaren |

---

## Phase 1.2 tamamlanan maddeler

| # | Madde | Durum |
|---|-------|-------|
| 1 | Saha Tespit başlığı | ✅ v445 |
| 2 | Kaydet footer geri bildirimi + destek önerisi kaydırma | ✅ v446 |
| 3 | Kaydet ve Çık popup tutarlılığı | ✅ v445 |
| 4 | Sesli not mikrofon izni (nginx) | ✅ v445 |
| 5 | Supplier PDF sigortalı adı mapping | ✅ v444 |
| 6 | PDF buton loading/guard | ✅ v444 |
| 7 | Cam/ahşap kapak AI prompt iyileştirmesi | ✅ v446 |
| 8 | PDF footer tekrarlayan Meridyen kaldırma | ✅ v447 |
| 9 | Bilinen iyi manifest senkron | ✅ dc2acab / v446 manifest |
| 10 | Rollback image koruması (v444/v445) | ✅ sunucuda mevcut |

---

## Geriye dönük açık maddeler (kod dışı / kabul)

| Madde | Durum | Not |
|-------|-------|-----|
| Production ekran kabulü (Mustafa) | ⏳ | Cursor production browser doğrulamaz |
| Login smoke credential | ⏳ | Ortamda `LOGIN_EMAIL/PASSWORD` yok — otomatik test PARTIAL |
| Eski rollback image v437–v438 | ⚠️ Kabul | Sunucuda yok; v444/v445 yeterli |

---

## Yasak (açık onay olmadan)

- Yeni FSB özelliği (kamera geliştirmesi, yeni PDF alanı, Smart Takeoff entegrasyonu)
- Prisma schema / migration
- PDF tasarım yeniden yazımı
- AI onay kapısını kaldırma
- Supplier PDF'de iletişim/dosya no geri getirme

## İzinli (hata sınıfı)

- Regresyon düzeltmesi (kayıt, PDF, scan, UX mesajı)
- Vision prompt ince ayarı (malzeme sayımı)
- PDF metin/mapping düzeltmesi

---

## Kod işareti

İlgili dosyalarda `FSB_PHASE_1_2_LOCK` yorumu — bu belgeye aykırı değişiklik = dur, Mustafa onayı iste.

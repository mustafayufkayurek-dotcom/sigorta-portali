# Smart Quantity Takeoff — S4 Teslim Raporu

| Alan | Değer |
|------|--------|
| Sprint | **S4** |
| Branch | `feature/smart-quantity-takeoff-s1` |
| Tarih | 2026-08-02 |
| BUILD MODE | AKTİF |
| Push | **Yok** |
| Merge | **Yok** |
| Migration deploy | **Yok** |
| Deploy | **Yok** |

---

## 1. Yapılan geliştirmeler

S3 backend omurgası korundu; minimal dosya detay UI + manuel düzeltme API eklendi.

| Öncelik | Durum |
|---------|--------|
| 1. Operasyon İş Kalemleri UI | **Tamam** — `SmartTakeoffPanel` |
| 2. Explainable Calculation UI | **Tamam** — `TakeoffExplanationDrawer` (SlidePanel) |
| 3. Manual Override API | **Tamam** — `PATCH .../line-items/:id/override` |
| 4. Override audit | **Tamam** — `TakeoffManualOverride` append + önceki kayıt `active=false` |
| 5. Version integrity | **Tamam** — `quantityEngine` ve `RuleVersion` değişmez; yalnız `quantityFinal` güncellenir |

### UI konumu

- Hasar dosyası detay → **Raporlar** sekmesi
- `SmartMeasureList` altında `SmartTakeoffPanel`
- Bileşenler: `apps/web/src/components/smart-takeoff/`

### Yeni / güncellenen dosyalar

**Backend**

- `dto/takeoff-run.dto.ts` — override DTO + response alanları
- `ports/takeoff-persist.port.ts` — `applyLineItemOverride`
- `adapters/prisma-takeoff-persist.adapter.ts` — override persist + audit
- `adapters/in-memory-takeoff-persist.adapter.ts` — test override
- `smart-takeoff.service.ts` — `applyLineItemOverride`
- `smart-takeoff.controller.ts` — PATCH endpoint
- `mappers/takeoff-run.mapper.ts` — `hasOverride`, `overrides[]`
- `__tests__/s4-override.spec.ts`

**Web**

- `components/smart-takeoff/SmartTakeoffPanel.tsx`
- `components/smart-takeoff/TakeoffExplanationDrawer.tsx`
- `components/smart-takeoff/TakeoffOverrideDrawer.tsx`
- `components/smart-takeoff/smart-takeoff-api.ts`
- `components/smart-takeoff/smart-takeoff.types.ts`
- `app/panel/hasar-dosyalari/[id]/page.tsx` — panel mount

### Override tasarımı

1. `TakeoffManualOverride` satırı eklenir (`quantityEnginePreserved`, `quantityOverride`, `reason`, `createdByUserId`, `active=true`).
2. Önceki aktif override kayıtları `active=false` yapılır (geçmiş korunur).
3. `TakeoffLineItem.quantityFinal` güncellenir; `quantityEngine` **değişmez**.
4. `TakeoffCalculationExplanation.overrideSummaryJson` ve `humanReadableText` güncellenir.
5. `TakeoffRun` / `TakeoffRuleVersion` **immutable** kalır.

### API (S4)

| Method | Path | Açıklama |
|--------|------|----------|
| PATCH | `/api/v1/claim-files/:claimFileId/smart-takeoff/runs/:runId/line-items/:lineItemId/override` | Manuel düzeltme (audit) |

Body: `{ quantityOverride: number, reason: string }`

---

## 2. Test sonuçları

```
pnpm exec jest modules/smart-takeoff --no-cache
Test Suites: 7 passed, 7 total
Tests:       32 passed, 32 total
```

| Suite | Kapsam |
|-------|--------|
| `calculation.math.spec.ts` | S1 matematik |
| `s1-vertical-slice.spec.ts` | S1 pipeline |
| `s2-platform-slice.spec.ts` | SM → persist → API servis |
| `s3-prisma-persist.spec.ts` | Prisma adapter (mocked) |
| `s3-rule-version.spec.ts` | RuleVersion seed/resolver |
| `s3-sm-skirting.spec.ts` | SM mapper + SKIRTING pipeline |
| `s4-override.spec.ts` | **Yeni** — override audit + version integrity |

Web typecheck: dokunulan dosyalar için hata yok (`tsc --noEmit`).

Frontend component testi: proje deseni yok; manuel doğrulama notları aşağıda.

### Manuel doğrulama (local)

1. Hasar dosyası → Raporlar → Akıllı Ölçümler var mı kontrol et.
2. «Metraj Koşumu Oluştur» → tablo doluyor mu.
3. «Açıklama» drawer → hesaplama adımları görünüyor mu.
4. «Düzelt» → gerekçe + yeni miktar → satır «Düzeltilmiş» oluyor mu.
5. Motor miktarı (üstü çizili) korunuyor mu.

---

## 3. Bilinen eksikler

- **Migration production deploy** — S3 migration hâlâ deploy edilmedi
- **PDF export** — metraj PDF yok
- **SM resmi süpürgelik tipi** — extensionJson geçici yol
- **Koşum karşılaştırma / diff UI** — yok
- **Operasyon planlayıcı entegrasyonu** — iş kalemleri henüz planlayıcıya aktarılmıyor
- **Frontend otomatik test** — yok (proje deseni)

---

## 4. Canlıya hazırlık durumu

| Kapı | Durum |
|------|--------|
| Kod + testler | **PASS** (32/32) |
| S3 Review Gate ONAY | **ONAYLANDI** (bkz. S3_TESLIM) |
| S4 UI + override API | **Tamam** (local) |
| Migration dosyası | **Hazır** (deploy edilmedi) |
| Staging migrate + smoke | **Bekliyor** |
| Production deploy | **Hazır değil** — migration deploy + backend/web deploy + smoke |

**Özet:** S4 BUILD MODE kapsamı tamamlandı. Canlıya almak için S3 migration deploy, prisma generate, backend + web deploy ve smoke testleri gerekir.

---

## Onay kaydı

```
Ürün sahibi: Mustafa
Sprint: S4
Karar: BUILD MODE teslim — Review Gate deploy öncesi
Push: YOK
Deploy: YOK
Migration deploy: YOK
```

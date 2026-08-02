# Smart Quantity Takeoff

Bounded Context. SSOT: `docs/features/SMART_QUANTITY_TAKEOFF_*.md`.

## S3 — TAMAMLANDI (2026-08-02)

Branch: `feature/smart-quantity-takeoff-s1`  
BUILD MODE · Reusable Platform First

| Öğe | S3 durumu |
|-----|--------|
| AppModule kaydı | **Evet** |
| REST API | `POST/GET claim-files/:id/smart-takeoff/runs` |
| SM adapter | `PrismaMeasureReadAdapter` — gerçek SM tipleri + SKIRTING extensionJson |
| Persist | **`PrismaTakeoffPersistAdapter`** (InMemory test override) |
| Migration | **`20260802160000_smart_takeoff_s3`** (dosya oluşturuldu; production deploy ayrı onay) |
| RuleVersion | **DB-backed** — `TakeoffRuleVersion` + S1 seed (`RuleVersionResolver`) |
| Rule Library | S1 — 4 kural (değişmedi) |
| S1 pipeline | Korundu |
| UI | Yok (S4+) |

## API

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/api/v1/claim-files/:claimFileId/smart-takeoff/runs` | SM ölçülerinden iş kalemi koşumu |
| GET | `/api/v1/claim-files/:claimFileId/smart-takeoff/runs` | Koşum listesi |
| GET | `/api/v1/claim-files/:claimFileId/smart-takeoff/runs/:runId` | Koşum detayı + iş kalemleri |

## Katman ayrımı (zorunlu)

- **Rule Library** — operasyon bilgisi (deklaratif tanımlar)
- **Rule Engine** — aday kural çözümleme
- **Decision Engine** — hangi iş kalemleri (matematik yok)
- **Calculation Engine** — yalnız matematik
- **Pipeline** — zinciri bağlar; katmanları birleştirmez
- **RuleVersionResolver** — aktif kural sürümü (DB)
- **PrismaTakeoffPersistAdapter** — TakeoffRun + TakeoffLineItem + Explanation kalıcı persist

## SKIRTING / süpürgelik notu

SM katalogunda `supurgelik` tipi henüz resmi değil. S3 yolu:

- `extensionJson.takeoffStructureType = SKIRTING`
- `extensionJson.metrajElementType = supurgelik` (duvar elemanında)
- `extensionJson.lengthMm` veya `widthMm` (koşu uzunluğu)

SmartMeasureVersion şemasına `lengthMm` eklenmedi — extensionJson ile hizalandı.

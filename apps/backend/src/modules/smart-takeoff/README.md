# Smart Quantity Takeoff

Bounded Context. SSOT: `docs/features/SMART_QUANTITY_TAKEOFF_*.md`.

## S5 — TAMAMLANDI (2026-08-02)

Branch: `feature/smart-quantity-takeoff-s1`  
BUILD MODE · Reusable Platform First

| Öğe | S5 durumu |
|-----|--------|
| AppModule kaydı | **Evet** |
| REST API | `POST/GET/PATCH claim-files/:id/smart-takeoff/...` |
| SM adapter | `PrismaMeasureReadAdapter` — doğrudan id sorgusu + tüm SM senaryoları |
| Persist | **`PrismaTakeoffPersistAdapter`** (InMemory test override) |
| Migration | **`20260802160000_smart_takeoff_s3`** (dosya oluşturuldu; production deploy ayrı onay) |
| RuleVersion | **DB-backed** — `TakeoffRuleVersion` + S1 seed |
| E2E testler | **s5-e2e-scenarios · s5-lifecycle · s5-performance · s5-prisma-measure-read** |
| Batch limit | `TAKEOFF_MAX_MEASURES_PER_RUN = 200` |
| Local smoke | `scripts/smoke-smart-takeoff-s5.sh` |
| UI | **Hasar dosyası → Raporlar → Operasyon İş Kalemleri** (S4) |
| Manual Override | **PATCH line-item override** + audit trail |

## Run lifecycle

1. `createRun` — SM ölçülerinden iş kalemi üretir; her çağrı yeni koşum (`runNumber++`)
2. `listRuns` — dosyaya ait koşumlar (azalan runNumber)
3. `getRun` — detay + açıklama + override geçmişi
4. `applyLineItemOverride` — `quantityFinal` günceller; `quantityEngine` korunur

Re-run: önceki koşumlar değişmez; yeni koşum bağımsız üretilir.

## API

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/api/v1/claim-files/:claimFileId/smart-takeoff/runs` | SM ölçülerinden iş kalemi koşumu |
| GET | `/api/v1/claim-files/:claimFileId/smart-takeoff/runs` | Koşum listesi |
| GET | `/api/v1/claim-files/:claimFileId/smart-takeoff/runs/:runId` | Koşum detayı + iş kalemleri |
| PATCH | `/api/v1/claim-files/:claimFileId/smart-takeoff/runs/:runId/line-items/:lineItemId/override` | Manuel düzeltme (audit) |

## Katman ayrımı (zorunlu)

- **Rule Library** — operasyon bilgisi (deklaratif tanımlar)
- **Rule Engine** — aday kural çözümleme
- **Decision Engine** — hangi iş kalemleri (matematik yok)
- **Calculation Engine** — yalnız matematik
- **Pipeline** — zinciri bağlar; katmanları birleştirmez
- **RuleVersionResolver** — aktif kural sürümü (DB)
- **PrismaTakeoffPersistAdapter** — TakeoffRun + TakeoffLineItem + Explanation + Override kalıcı persist

## Test çalıştırma

```bash
cd apps/backend && pnpm exec jest modules/smart-takeoff --no-cache
# veya
bash scripts/smoke-smart-takeoff-s5.sh
```

## Web bileşenleri

- `apps/web/src/components/smart-takeoff/SmartTakeoffPanel.tsx`
- `TakeoffExplanationDrawer.tsx` · `TakeoffOverrideDrawer.tsx`

# Smart Takeoff — Testler

## S1–S4 (mevcut)

- `calculation.math.spec.ts` — saf matematik
- `s1-vertical-slice.spec.ts` — uçtan uca dikey dilim
- `s2-platform-slice.spec.ts` — SM adapter → persist → API
- `s3-prisma-persist.spec.ts` — Prisma persist (mocked)
- `s3-rule-version.spec.ts` — RuleVersion resolver
- `s3-sm-skirting.spec.ts` — SKIRTING extensionJson
- `s4-override.spec.ts` — manuel düzeltme audit

## S5 (yeni)

- `s5-e2e-scenarios.spec.ts` — kapı/pencere/tavan/süpürgelik/çoklu/empty/override
- `s5-lifecycle.spec.ts` — create → list → get → override, runNumber, re-run
- `s5-performance.spec.ts` — 50/100 eleman pipeline süresi
- `s5-prisma-measure-read.spec.ts` — PrismaMeasureReadAdapter SM mapping
- `fixtures/s5-sm-fixtures.ts` — paylaşılan test verisi

Çalıştırma:

```bash
cd apps/backend && pnpm exec jest modules/smart-takeoff --no-cache
# veya repo kökünden:
bash scripts/smoke-smart-takeoff-s5.sh
```

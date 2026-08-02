# Smart Quantity Takeoff

Bounded Context. SSOT: `docs/features/SMART_QUANTITY_TAKEOFF_*.md`.

## S2 — TAMAMLANDI (2026-08-02)

Branch: `feature/smart-quantity-takeoff-s1`  
BUILD MODE · Reusable Platform First

| Öğe | S2 durumu |
|-----|--------|
| AppModule kaydı | **Evet** |
| REST API | `POST/GET claim-files/:id/smart-takeoff/runs` |
| SM adapter | `PrismaMeasureReadAdapter` (salt okuma) |
| Persist | `InMemoryTakeoffPersistAdapter` (Review Gate → Prisma migration) |
| Migration | **Yok** (Sprint Review Gate sonrası) |
| Rule Library | S1 — 4 kural (değişmedi) |
| S1 pipeline | Korundu |
| UI | Yok (S3+) |

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

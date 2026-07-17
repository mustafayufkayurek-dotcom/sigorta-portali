# EPIC-05 — Belgeler Üst Boşluk

**Tarih:** 2026-07-17
**Ortam:** Local (`http://localhost:3001`)
**Deploy / Commit:** Yok

## Ölçüm

| Metrik | Değer | Hedef |
|--------|-------|-------|
| gapUpperToTabs (üst blok → sekmeler) | **8px** | ≤ 16px |
| gapOpsToTabs | 8px | ≤ 16px |
| gapZorunluToTabs | 8px | ≤ 16px |
| opsAlignedWithZorunlu (üst) | false | — |
| opsBottomAlignedWithZorunlu | true | true |
| opsInternalVoid | 4px | ≤ 24px |
| layout2x2 | true | true |

**Sonuç:** PASS

## Ne değişti

1. İki kolon yığını yerine **2×2 grid** — Operasyon ile Zorunlu aynı satırda.
2. Operasyon `self-end` — satır altında Zorunlu ile hizalı; sekmeler üstüne sol boşluk yok.
3. Operasyon kartı `h-fit` — içerik yüksekliği; kart içi beyaz okyanus yok.
4. Üst blok → Belgeler sekmeleri arası **8px**.
5. `Bağlı E-posta Yok` kompakt empty state.

## Kanıt

- `01-desktop.png`
- `01-tam-sayfa-desktop.png`
- `EVIDENCE.json`

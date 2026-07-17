# EPIC-05 — Yerleşim Yoğunluk (2026-07-17)

**Ortam:** Local (`web :3001`, `backend :3000`)  
**Deploy / Commit:** Yok  
**Kanıt:** `pass: true` — `gapVendorToOps: 10px`, kart yüksekliği `44.5px`

## Ne değişti

| Önce | Sonra |
|------|--------|
| Operasyon İşlemleri sayfanın altında, 5 büyük kare kart | Sol kolonda tedarikçinin hemen altında; kompakt ~44px kartlar |
| Google Alternatifleri boşken sol tarafta beyaz okyanus | Boşluk kalktı; ops tedarikçiye 10px mesafede |
| Boş alternatif uyarıları geniş dikey alan | Kompakt alert satırı |

## Yerleşim (xl)

```
[ Önerilen Tedarikçiler ]  [ Dosya Bütçesi     ]
[ Operasyon İşlemleri   ]  [ Zorunlu İşlemler  ]
```

Mobil sıra (`contents` + `order`): Tedarikçi → Bütçe+Zorunlu → Operasyon.

## Kartlar

- `aspect-square` kaldırıldı → içerik yüksekliği
- `min-h-[44px]`, küçük ikon + etiket, `rounded-lg`
- Handler / tooltip / disabled / zorunlu kapılar aynı (iş kuralı yok)

## Kanıt

- `01-desktop.png`
- `01-tam-sayfa-desktop.png`
- `EVIDENCE.json`

## Dosyalar

1. `apps/web/src/app/panel/acil-yardim/[id]/page.tsx`
2. `apps/web/src/components/vendor-discovery/RecommendedVendorsTabs.tsx`
3. `apps/web/src/components/vendor-discovery/AlternativeVendorServicePanel.tsx`
4. `apps/web/scripts/capture-epic05-yerlesim-yogunluk-20260717.mjs`

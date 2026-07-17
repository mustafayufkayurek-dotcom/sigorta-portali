# EPIC-05 — Tedarikçi Sekmeleri (2026-07-17) · Final UI

## Son düzeltme (local)

1. **Kayıtlı Tedarikçiler** — yalnızca **Dosyaya Ata**; **Havuza Kaydet / Havuzda** kaldırıldı
2. **Karar gerekçesi** (Title Case, mevcut ranking alanları):
   - Hizmet Kalitesi ← `avgServiceScore`
   - Bölgeye Uzaklık ← `distanceKm` / `distanceLabel` (yoksa —)
   - Ortalama Maliyet ← `avgCost`
   - Tamamlanan Dosya Sayısı ← `completedFileCount`
   - Son Çalışma Tarihi ← `lastWorkedAt` (yoksa —)
3. Üst aday kartında **Sistem Önerisi** rozeti
4. **Alternatif Öneriler** — Dosyaya Ata + Havuza Kaydet korunur; Google etiketi yok; gerekçe alanları yalnızca API’de varsa

## Davranış

| Durum | Sekme |
|------|--------|
| Kayıtlı öneri var | **Kayıtlı** (varsayılan) |
| Kayıtlı öneri yok | **Alternatif** (bir kez otomatik) |
| Red / `preferAlternatif` | **Alternatif** |

## Aksiyonlar

| Aksiyon | Kayıtlı | Alternatif |
|--------|---------|------------|
| Dosyaya Ata | `onAssign` | `POST /vendors` + `onAssigned` |
| Havuza Kaydet | — (yok) | `POST /vendors` + `onSavedToPool` |

## Not

Backend sıralama / skor algoritması değişmedi. `distanceKm` ve `lastWorkedAt` şu an recommended yanıtında yok → UI **—** gösterir; alan gelirse otomatik map edilir.

## Local doğrulama

| Kontrol | Sonuç |
|--------|--------|
| Kayıtlıda yalnızca Dosyaya Ata | PASS |
| Sistem Önerisi (üst kart) | PASS |
| Gerekçe etiketleri Title Case | PASS |
| Eksik alan = — | PASS |
| Alternatif: Dosyaya Ata + Havuza Kaydet | PASS |
| Google etiketi yok | PASS |

**Genel:** PASS (local) · Commit / push / deploy yok

## Kanıt

- `01-kayitli-tab.png` — Sistem Önerisi + gerekçe alanları + yalnızca Dosyaya Ata
- `02-alternatif-tab.png` — Dosyaya Ata + Havuza Kaydet
- `EVIDENCE.json`

## Değişen dosyalar

- `VendorCandidateCard.tsx` — Sistem Önerisi rozeti
- `RecommendedVendorsTabs.tsx` — Havuz butonu kaldırıldı; gerekçe metrikleri
- `AlternativeVendorServicePanel.tsx` — opsiyonel gerekçe; üst aday rozeti
- `emergencyApi.ts` / `VendorSuggestPanel.tsx` — opsiyonel alan tipleri
- Capture script + bu rapor

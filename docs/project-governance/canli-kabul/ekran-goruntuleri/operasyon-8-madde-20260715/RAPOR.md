# Operasyon 8 Madde — Kanıt

| # | Madde | Sonuç |
|---|-------|-------|
| 1 | KPI güçlü | PASS |
| 2 | Gecikme Süresi sütunu | PASS |
| 3 | 72s kuralı | PASS |
| 4 | İşlemler fonksiyon | PASS |
| 5 | Üç nokta menü | PASS |
| 6 | Görüntüle/Düzenle UX | PASS |
| 7 | PDF (no 500) | PASS |
| 8 | Mail alıcı etiket | PASS |
| | Typecheck / Build / Browser | PASS |

At: 2026-07-15T18:33:24.151Z

## PDF kök neden (madde 7)

1. `getReport()` claimFile `include` → Prisma şema kolonları (`assigned_inspector_vendor_id`, `customers.updated_by_user_id`) lokal DB’de yoksa 400.
2. PDF buffer üretilse bile `Content-Disposition` Türkçe dosya adı → Node `ERR_INVALID_CHAR` → 500.

Düzeltme: `getReportForPdf` minimal select + ASCII-safe `Content-Disposition` + Chrome executable fallback.

Commit / push / deploy: yok.

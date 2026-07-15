# EPIC-03 Operasyon — Son Revizyon Kanıtı (2026-07-15)

**Sonuç:** Browser **13/13 PASS** · typecheck PASS · web build PASS · 72s unit PASS · PDF-email unit PASS  
**Base:** `http://localhost:3001` · API `http://127.0.0.1:3000/api/v1`  
**Commit / push / deploy:** **YOK**

## PASS tablosu

| # | Sonuç | Detay |
|---|-------|-------|
| 1 | PASS | operation-stats HTTP 200 (+ `reportApproval`) |
| 2 | PASS | KPI set alanları (open…urgent + reportApproval) |
| 3 | PASS | `POST /claim-files/approval-72h-check` → 201 |
| 4 | PASS | Sayfa başlığı Operasyon |
| 5 | PASS | KPI etiketleri 8/8 |
| 6–7 | PASS | Gelen Kutu KPI yok (şerit dışı; header butonu kaldı) |
| 8 | PASS | Veri kolonlarında sıralama göstergesi ↑/↓ |
| 9 | PASS | Dosya No header tık → aktif sort |
| 10 | PASS | İşlem menüsü: Görüntüle · Düzenle · PDF Oluştur · E-posta Gönder · WhatsApp · Not · Geçmiş |
| 11 | PASS | E-posta modal açılır |
| 12 | PASS | PDF’siz gönderim engelli (rapor yok → buton disabled / uyarı) |
| 13 | PASS | 72s UI (banner + Onay Talep Et + KPI) |

## KPI seti

Açık Dosya · Onay Bekleyen · Rapor Yazılıyor · Rapor Onayı · Finansa Aktarılacak · 72 Saat + Risk · Bugün Açılan · Acil Dosya  

Dil: RC1 `StripKpi` (yatay, `min-h-[40px]`, kart büyütme yok). Mail / Gelen Kutu KPI kaldırıldı.

## E-posta / PDF

| Katman | Sonuç |
|--------|--------|
| Kod yolu | `OperationSendEmailModal` → `POST /repair-reports/:id/send-email` → `generatePdf` → `ReportEmailService.sendReport` (ek zorunlu) |
| Boş PDF | `BadRequestException` — gönderim yok |
| SMTP yok | `mode: staging-no-smtp`, `pdfAttached: true`, `success: false` (PARTIAL dürüst) |
| Unit | `report-email.service.spec.ts` 3/3 PASS |
| Browser | Modal + “PDF’siz gönderim yok” + rapor yokken gönderim kapalı |

**PARTIAL:** Yerel SMTP tanımlı değil; gerçek SMTP gönderimi bu ortamda kanıtlanmadı. PDF ek zinciri kodda zorunlu.

## 72 saat

- Rule: `approval-72h.rule.ts` + scheduler + liste `approval72hExceeded` / **Onay Talep Et**
- Unit: `approval-72h.rule.spec.ts` PASS
- Endpoint: `approval-72h-check` 201
- UI: kırmızı banner + KPI “72 Saat + Risk” + satır aksiyonu

## Değişen dosyalar

- `apps/web/src/app/panel/operasyon/page.tsx`
- `apps/web/src/components/operasyon/OperationRowActions.tsx`
- `apps/web/src/components/operasyon/OperationSendEmailModal.tsx` (yeni)
- `apps/web/src/components/ui/TableColumnPicker.tsx` (sort hover/aktif)
- `apps/web/src/app/panel/hasar-dosyalari/[id]/page.tsx` (`?grup=&alt=` deep-link)
- `apps/web/src/app/panel/hasar-dosyalari/[id]/_components/tabs/TakipTab.tsx`
- `apps/backend/.../claim-files.service.ts` (`reportApproval` stats + contactEmail)
- `apps/backend/.../report-email.service.ts` (+ `.spec.ts`)
- `apps/backend/.../repair-reports.service.ts` (boş PDF fail)
- `apps/web/scripts/capture-epic03-operasyon-revizyon.mjs`

## Screenshots

`docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-revizyon-20260715/`

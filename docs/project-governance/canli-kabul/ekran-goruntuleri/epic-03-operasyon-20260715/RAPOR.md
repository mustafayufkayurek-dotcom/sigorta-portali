# EPIC-03 Operasyon — Canlı Kabul Kanıtı (2026-07-15)

**Sonuç:** PASS (11/11 browser) · typecheck PASS · build PASS  
**Base:** `http://localhost:3001` · API `http://127.0.0.1:3000/api/v1`  
**Commit / push / deploy:** yapılmadı

## PASS tablosu

| # | Sonuç | Detay |
|---|-------|-------|
| 1 | PASS | operation-stats HTTP 200 |
| 2 | PASS | page title Operasyon |
| 3 | PASS | operasyon KPI labels 8/8 |
| 4 | PASS | enterprise columns (Kimde / Sonraki Aksiyon / İşlemler) |
| 5 | PASS | Tüm Dosyalar section |
| 6 | PASS | İşlemler column header |
| 7 | PASS | double delete step 1 modal |
| 8 | PASS | preset chip Onay Bekleyen |
| 9 | PASS | column picker interaction |
| 10 | PASS | 72s Geçen preset chip |
| 11 | PASS | no finance KPI on operasyon page |

Ayrıntılı checklist: `CHECKLIST.md`

## Screenshots

- `01-operasyon-overview-1440.png`
- `02-preset-onay-bekleyen.png`
- `03-column-picker.png`
- `04-double-delete-step1.png`
- `05-final-state.png`
- `00-operation-stats.json`
- `EVIDENCE.json`

## 72s nasıl çalışır

1. **Tespit:** `RepairReport.status ∈ {pending_approval, submitted}` + `ReportApprovalHistory` (yoksa `updatedAt`) üzerinden bekleyiş süresi ≥ 72 saat.
2. **Liste / KPI:** `opsPreset=approval_72h|delay_risk` + satırda `approval72hExceeded` / kırmızı **72s** rozeti + **Onay Talep Et**.
3. **Scheduler:** `Approval72hScheduler` (@Cron her saat) → sorumlu + yöneticilere in-app `approval_72h_exceeded` (günde 1 kez / kullanıcı / dosya).
4. **Manuel test:** `POST /claim-files/approval-72h-check`

## PARTIAL

- Acil yardım birleşik listede hâlâ client `slice(50)` — hasar tarafı page/limit/sort/opsPreset server-side.
- Yerel DB’de `assigned_inspector_vendor_id` yoktu; liste `select` ile güvenli alanlara alındı (migration yapılmadı).

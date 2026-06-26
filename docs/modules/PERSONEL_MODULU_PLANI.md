# Personel ve Demirbaş Modül Planı

## Bağlam

Canlı kullanıcı açılışından sonra **Personel Modülü** ve **Demirbaş Modülü** pod olarak bağlanacak. Şu an yalnızca altyapı (schema + modül registry + guard) hazır; UI ve iş kuralları sonraki fazda.

## İş modeli (netleşen)

| Konu | Karar |
|------|--------|
| Personel tipi | Yalnızca **iç personel** (Safran bordrolu, Meridyen operasyonu) |
| Sözleşme türü | **Belirsiz süreli** — OİB/İŞKUR izni gerekmez |
| Kapsam dışı | Tedarikçi, eksper, sigorta şirketi kullanıcıları |
| Bordro işvereni | Safran — Ayarlar → Şirket Bilgileri (opsiyonel toggle) |
| Operasyon | Meridyen — hasar dosyası süreçleri |

## Pod mimarisi

```
platform_modules (registry)
  ├── personnel      → HrModule (puantaj, izin, evrak, arşiv)
  └── fixed_assets   → FixedAssetsModule (zimmet, demirbaş)
```

- `PlatformModuleGuard` + `@RequirePlatformModule('personnel')` ile endpoint kilidi
- Admin: `PATCH /platform-modules/:code { isEnabled }` ile aç/kapa
- Durum: `GET /hr/status`, `GET /fixed-assets/status`

## Veri modeli (iskelet)

### hr_employee_profiles
- `userId` → mevcut `users` (iç personel rolleri)
- `employmentType`: `indefinite` (varsayılan)
- `payrollEmployerName`: snapshot (Safran)

### hr_attendance_entries (puantaj)
- Günlük kayıt: `workDate`, `minutesWorked`, `entryType`

### hr_leave_requests (izin)
- Onay akışı: `pending` → `approved`

### hr_documents (resmi evrak + dijital imza + arşiv)
- `contentHash`, `signedAt`, `signatureMeta`, `archivedAt`

### fixed_assets (demirbaş)
- Zimmet: `assignedEmployeeId` → `hr_employee_profiles`

## Faz planı

### Faz 0 — Tamamlandı
- Platform modül registry, schema iskeleti, guard, şirket bilgileri sayfası

### Faz 1 — Personel çekirdek
- HrEmployeeProfile CRUD, puantaj, izin, `/panel/personel` menüsü

### Faz 2 — Evrak ve arşiv
- Dijital imza, arşiv export

### Faz 3 — Hizmet kayıtları

### Faz 4 — Demirbaş modülü

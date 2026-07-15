# EPIC-03 Operasyon — Kabul Checklist (2026-07-15)

| # | Madde | Sonuç | Not |
|---|-------|-------|-----|
| 1 | Tablo + kolon yönetimi (gizle/göster, DnD, width, localStorage `operasyon-v5`) | PASS | Mevcut `TableColumnPicker` pattern |
| 2 | Durum display mapping (İhbar Alındı → Dosya Kapandı) | PASS | `@sigorta/shared` `operation-status` — backend enum kırılmaz |
| 3 | 72s kuralı (Onay Bekliyor >72s → Onay Talep Et + bildirim) | PASS | Rule engine + saatlik cron + liste bayrağı; AI değil |
| 4 | Operasyon KPI (ciro/kâr yok) | PASS | 8 kart + `/claim-files/operation-stats` |
| 5 | Hazır filtreler server-side | PASS | `opsPreset` query |
| 6 | Satır aksiyonları | PASS | Görüntüle, Düzenle, Not, Mail, WhatsApp, menü |
| 7 | Concurrent edit uyarısı | PASS | `expectedUpdatedAt` → 409 |
| 8 | Silmede çift onay | PASS | `DoubleDeleteConfirm` 1/2 + type-to-confirm |
| 9 | Server-side filter/sort/page | PASS | Hasar; acil hâlâ client slice (PARTIAL) |
| 10 | typecheck (web + backend) | PASS | |
| 11 | build (web) | PASS | |
| 12 | Gerçek browser kanıt | PASS | 11/11 capture checks |

**Genel:** PASS (küçük PARTIAL: acil yardım listesinde sayfalama yok)

Commit / push / deploy: **YOK** (kullanıcı onayı bekleniyor)

# Büyük Paket Deploy Planı — 12 Temmuz 2026

**Durum:** Planlama — **canlıya alınmadı** (Mustafa onayı bekleniyor)  
**Dal:** `safety/pre-v318-kilit-20260712`  
**Canlı referans:** Web v318 / Backend v303 (`deploy/manifests/KNOWN_GOOD_IMAGES.json`)

---

## Kapsam özeti

Post-v164 operasyon + finans paketi: PayTR online tahsilat, operasyon gelen kutusu (M365 ingest), finans görünürlük/rol genişlemeleri, HR/personel migration'ları, vendor ve operasyonel erişim tabloları, `report_write_sessions` analitiği (henüz commit dışı migration dosyası).

**Bu belge deploy yapmaz** — sıra, risk ve rollback rehberidir.

---

## Dal vs canlı farkı (özet)

| Alan | Canlı (v303 backend) | Dalda bekleyen |
|------|----------------------|----------------|
| Onarım raporu foto kategori | Yok | `report-image-category.ts` (2e06c56 — **ayrı backend-only deploy planlandı**) |
| PayTR / `payment_collection_links` | Migration muhtemelen uygulanmamış | `20260628180000_payment_collection_links_paytr` |
| Operasyon gelen kutusu | Kısmen UI var; backend ingest eksik olabilir | `20260629200000_operation_inbox` + izin migration'ları |
| Finans operasyon inbox | — | `20260706225000_finance_operation_inbox` |
| Claim finans görünürlük | — | `20260628210000_claim_financial_visibility_config` |
| Overhead / masraf VAT | — | `20260628120000_overhead_pool_vat`, `20260628100000_expense_category_link` |
| HR / personel genişleme | — | `20260704130000_personnel_ozluk_expansion`, devam migration'ları |
| Report write sessions | Yok | `20260712120000_report_write_sessions` (working tree, henüz commit yok) |

**Not:** Canlıda hangi migration'ların uygulandığı kesin değil — deploy öncesi sunucuda `docker exec sigorta-backend sh -c 'cd /app/apps/backend && npx prisma migrate status'` zorunlu.

---

## Migration envanteri

### 202606* (23 dosya — finans / operasyon / vendor / HR iskelet)

| Migration | Konu |
|-----------|------|
| `20260624120000_agreement_acceptance_evidence` | Sözleşme kabul kanıtı |
| `20260624120000_overhead_multi_target` | Overhead çoklu hedef |
| `20260624140000_platform_modules_hr_skeleton` | HR modül iskeleti |
| `20260624190000_document_type_scope_fields` | Belge tipi kapsam |
| `20260624193000_neighborhoods_and_address_fields` | Mahalle / adres |
| `20260624_document_type_service_branches` | Belge tipi şube |
| `20260626220000_user_must_change_password` | Zorunlu şifre değişimi |
| `20260627120000_user_archive_fields` | Kullanıcı arşiv |
| `20260627213000_document_type_department_ids` | Belge tipi departman |
| `20260627_document_type_service_types` | Belge tipi servis türleri |
| `20260628100000_expense_category_link` | Masraf kategori bağlantısı |
| `20260628120000_overhead_pool_vat` | Overhead KDV havuzu |
| `20260628180000_payment_collection_links_paytr` | **PayTR tahsilat linkleri** |
| `20260628190000_payment_due_date_vendor_hakedis` | Vade / tedarikçi hakediş |
| `20260628193000_claim_hide_financial_from_assignees` | Atananlardan finans gizleme |
| `20260628210000_claim_financial_visibility_config` | Finans görünürlük config |
| `20260629140000_vendor_document_custom_label` | Tedarikçi belge etiketi |
| `20260629150000_vendor_service_branches` | Tedarikçi servis şubeleri |
| `20260629160000_service_branch_scope` | Servis şube kapsamı |
| `20260629170000_service_branch_scope_meridyen` | Meridyen şube kapsamı |
| `20260629180000_payment_receipt` | Ödeme makbuzu |
| `20260629200000_operation_inbox` | **Operasyon gelen kutusu** |

### 202607* (Temmuz — finans inbox, HR, operasyonel erişim)

| Migration | Konu |
|-----------|------|
| `20260702120000_vendor_discovery` | Tedarikçi keşif |
| `20260704130000_personnel_ozluk_expansion` | Personel özlük |
| `20260704220000_hr_attendance_compliance` | Devam uyumu |
| `20260705120000_hr_attendance_clock_times` | Mesai saatleri |
| `20260705140000_hr_attendance_period_signatures` | Dönem imzaları |
| `20260705143000_merge_staj_department_into_sovtaj` | Staj → sovtaj birleşim |
| `20260706150000_office_staff_inbox_permissions` | Ofis personeli inbox izinleri |
| `20260706160000_field_survey_briefs` | Saha anketi |
| `20260706170000_office_staff_demo_permissions` | Demo izinleri |
| `20260706183000_finance_note_update_test_notes` | Finans not test |
| `20260706223000_finance_customer_view` | Finans müşteri görünümü |
| `20260706224500_vendor_created_by_and_finance_vendor_view` | Tedarikçi created_by |
| `20260706225000_finance_operation_inbox` | Finans operasyon inbox |
| `20260706230000_operation_inbox_permission_records` | Inbox izin kayıtları |
| `20260709140000_operational_access_grants` | Operasyonel erişim |
| `20260709180000_customer_updated_by` | Müşteri updated_by |
| `20260711130000_vendor_inspector_claim_assignment` | Eksper atama |
| `20260712120000_report_write_sessions` | Rapor yazım oturumu (**henüz commit yok**) |

---

## Risk değerlendirmesi

| Risk | Seviye | Not |
|------|--------|-----|
| PayTR migration + env secret | Yüksek | `PAYTR_*` env canlıda doğrulanmalı; test modu kapalı |
| Operasyon inbox Graph webhook | Yüksek | M365 abonelik + `client_state` canlı doğrulama |
| Çok sayıda migration tek seferde | Yüksek | Kısmi uygulama durumunda `migrate status` şart |
| Finans görünürlük / rol değişimi | Orta | Atanan personel finans görememe regresyonu |
| HR migration'ları | Orta | Personel modülü henüz tam kabul edilmemiş olabilir |
| Rollback | Orta | Backend image v303; DB geri dönüş yedekten |

---

## Önerilen deploy sırası (Mustafa onayı sonrası)

1. **Ön kontrol:** `pre-deploy-safety.sh`, `verify-backup-health.sh`, `prisma migrate status` (canlı)
2. **Backend-only küçük paket (tamamlandı / ayrı):** Foto kategori — migration yok → `v319-backend-foto-kategori`
3. **Web v319:** Pazartesi + operasyon tablo (migration yok)
4. **Büyük paket — aşamalı (öneri):**
   - **4a.** Finans + PayTR migration'ları (`20260628180000` … `20260628210000`) — bakım penceresi, PayTR sandbox → prod geçiş kontrolü
   - **4b.** Operasyon inbox backend (`20260629200000` + izin migration'ları)
   - **4c.** Vendor / servis şube migration'ları
   - **4d.** HR / personel (ayrı kabul oturumu — UI hazır değilse ertele)
   - **4e.** `report_write_sessions` — onarım raporu kabul paketi ile birlikte
5. **Full deploy:** `bash scripts/deploy-full-production.sh post-v164-operasyon-finans-vXXX`
6. **Smoke + manuel PASS:** `post-deploy-smoke.sh`, `ONAYLI_UI_CHECKLIST.md`, finans tahsilat test linki

---

## Rollback

| Bileşen | Geri dönüş |
|---------|------------|
| Web | `sigorta-web:dalga2-agreement-hr-01-v318-amd64` |
| Backend | `app-backend:dalga2-agreement-hr-01-v303-amd64` (veya foto deploy sonrası v319-backend) |
| DB | Migration geri alınamaz — `scripts/rollback-production.sh` + yedekten restore (onaylı) |

---

## Bekleyen kararlar

- **AK-001:** Karar bekliyor — kodlama/deploy yapılmadı
- **Manuel PASS:** Mustafa dinleniyor — büyük paket öncesi zorunlu
- **post-v164-operasyon-finans:** Repo'da ayrı branch/tag yok; bu belge paket adını standardize eder

---

## Deploy yapılmayacak (bu oturum)

- Full deploy + migration otomatik çalıştırma **yasak**
- HR modülü canlı açılışı Mustafa kabul oturumu olmadan yapılmamalı

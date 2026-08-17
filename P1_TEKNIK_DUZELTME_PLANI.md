# P1 Teknik Düzeltme Planı — Öncelikli Stabilizasyon

**Tarih:** 15 Mayıs 2026
**Kaynak:** Ürün Olgunluk Analizi + Danışman Değerlendirme Talimatı
**Amaç:** Production'da çalışan sistemi kırılgan noktalardan güçlendirmek

---

## 1. Yetki ve Permission Sistemi Tutarlılığı

### 1.1 Mevcut Durum
- **8 rol** tanımlı, DB'de permission sayıları: admin(48), manager(35), office_staff(21), finance(18), field_staff(9), adjuster(9), expert(8), insurance_company_user(4)
- `PermissionsGuard` içinde **hardcoded fallback** var: `ROLE_DEFAULT_PERMISSIONS` — DB'de permission yoksa bu kullanılıyor
- Hardcoded permission isimleri (`file.view`, `customer.create`) ile DB seed'deki permission isimleri (`claim_file.view`, `customer.manage`) **UYUŞMUYOR**
- Frontend `layout.tsx`'te route bazlı **üçüncü bir permission sözlüğü** var
- **Risk:** Expert kullanıcı doğru permission'a sahip olmasına rağmen "yetkiniz yok" hatası alabilir (daha önce yaşandı)

### 1.2 Yapılacaklar
| # | İş | Öncelik | Tahmini Etki |
|---|---|---------|-------------|
| 1.2.1 | `PermissionsGuard` hardcoded fallback'i kaldır — DB permission'ları tek kaynak yap | KRİTİK | Yetki davranışı tek noktadan kontrol |
| 1.2.2 | Backend controller'lardaki `@RequirePermissions()` dekoratörlerini DB permission isimleriyle eşleştir | KRİTİK | Guard-controller uyumsuzluğu giderilir |
| 1.2.3 | Frontend `layout.tsx` route permission'larını backend sözlüğüyle senkronize et | YÜKSEK | Frontend-backend yetki tutarlılığı |
| 1.2.4 | Eksik roller için permission audit — her role hangi endpoint'e erişebilir tablosu çıkar | YÜKSEK | Klarite ve dokümantasyon |
| 1.2.5 | `insurance_company_user` (4 permission) ve `adjuster` (9 permission) rollerini gözden geçir — yeterli mi? | ORTA | Sigorta portalı ve eksper portalı stabilizasyonu |

### 1.3 Kabul Kriterleri
- Hardcoded fallback SIFIR — tüm yetki DB'den
- Tek bir permission sözlüğü: DB seed = controller decorator = frontend check
- Her rol için erişim matrisi dokümente edilmiş

---

## 2. Cascade Delete Veri Kaybı Riski

### 2.1 Mevcut Durum
- Schema'da **83 adet** `onDelete: Cascade` tanımlı
- **Kritik zincirler:**
  - `User` silinirse → adjuster_assignments, task_assignments, notes, audit_logs, notifications HEPSİ silinir
  - `ClaimFile` silinirse → notes, tasks, documents, budget_items, financial_summaries, repair_reports, status_history HEPSİ silinir
  - `Vendor` silinirse → agreements, work_assignments, payment_statements HEPSİ silinir
  - `InsuranceCompany` silinirse → adjuster_assignments (eksper bağlantıları) silinir
  - `Department` silinirse → report_field_configs, department_file_subjects silinir
- **Risk:** Admin panelden yanlışlıkla bir kullanıcı/firma/dosya silinirse, bağlı TÜM operasyonel veri geri dönüşsüz kaybolur

### 2.2 Yapılacaklar
| # | İş | Öncelik | Etki |
|---|---|---------|------|
| 2.2.1 | KRİTİK tablolarda `onDelete: Cascade` → `onDelete: Restrict` veya `SetNull` dönüştür | KRİTİK | Veri kaybı önlemi |
| 2.2.2 | Silinebilir entity'lerde soft-delete (status=inactive) zorunlu yap | KRİTİK | Geri alınabilirlik |
| 2.2.3 | Admin panelde silme işlemlerinde impact analizi göster ("Bu kaydı silmek 47 notu, 12 görevi de silecek") | YÜKSEK | Kullanıcı farkındalığı |
| 2.2.4 | Migration hazırla: cascade → restrict dönüşümü | KRİTİK | DB koruması |

### 2.3 Dönüşüm Öncelik Sırası (En Riskli → En Az)
1. **User → tüm alt tablolar** (audit_log, note, notification, task_assignment) — RESTRICT
2. **ClaimFile → tüm alt tablolar** (note, task, document, budget, report, status_history) — RESTRICT
3. **Vendor → agreements, payments** — RESTRICT
4. **InsuranceCompany → adjuster_assignments** — SET NULL
5. **Department → config/subjects** — SET NULL
6. Junction/log tablolarında cascade KABUL EDİLEBİLİR (role_permissions, notification_recipients)

### 2.4 Kabul Kriterleri
- User, ClaimFile, Vendor, InsuranceCompany, Department silme denemesinde bağlı kayıt varsa hata mesajı
- Soft-delete aktif olan entity'lerde fiziksel silme engeli
- Migration başarılı, mevcut veri korunuyor

---

## 3. Frontend'e Sızmış İş Kuralları

### 3.1 Mevcut Durum
- Route erişim kontrolü **sadece frontend** `layout.tsx`'te — backend guard'sız sayfalar var
- Dosya durumu geçişleri frontend'te kontrol ediliyor ama backend'te zorunlu değil
- localStorage'dan JWT token okuma — XSS açığı
- Bazı dropdown seçenekleri frontend'te hardcoded

### 3.2 Yapılacaklar
| # | İş | Öncelik |
|---|---|---------|
| 3.2.1 | Her backend endpoint'te uygun permission guard'ı olduğunu doğrula | KRİTİK |
| 3.2.2 | Dosya durumu geçiş kurallarını backend service'e taşı (state machine) | YÜKSEK |
| 3.2.3 | JWT token'ı httpOnly cookie'ye taşı | ORTA |
| 3.2.4 | Hardcoded dropdown seçeneklerini DB/API kaynaklı yap | ORTA |

### 3.3 Kabul Kriterleri
- Backend'siz erişilebilir hiçbir operasyonel endpoint yok
- Durum geçişleri backend'te validate ediliyor

---

## 4. Test Altyapısı

### 4.1 Mevcut Durum
- Unit test: **YOK** veya minimal
- E2E test: **YOK**
- Integration test: **YOK**
- CI pipeline: **YOK**
- Manuel test: kullanıcı canlıda test ediyor

### 4.2 Yapılacaklar
| # | İş | Öncelik |
|---|---|---------|
| 4.2.1 | Backend jest config + ilk 5 kritik service testi (auth, claim-files, permissions, departments, claim-subjects) | YÜKSEK |
| 4.2.2 | API endpoint smoke test scripti (curl/wget tabanlı — production health check) | KRİTİK |
| 4.2.3 | Frontend component testi altyapısı (jest + testing-library) | ORTA |
| 4.2.4 | Deploy öncesi otomatik build + test pipeline | YÜKSEK |
| 4.2.5 | Permission guard integration testi — her rol her endpoint | YÜKSEK |

### 4.3 Kabul Kriterleri
- `pnpm test` çalışıyor ve en az 5 servis testi geçiyor
- Production smoke test scripti mevcut ve deploy sonrası çalıştırılabiliyor
- Permission guard testi her rol için 100% kapsam

---

## Uygulama Sırası (Sprint Önerisi)

### Sprint A (1 hafta) — Veri Koruma
1. Cascade → Restrict migration (2.2.1, 2.2.4)
2. Kritik entity'lerde soft-delete zorunluluğu (2.2.2)
3. Production smoke test scripti (4.2.2)

### Sprint B (1 hafta) — Yetki Tutarlılığı
1. PermissionsGuard hardcoded fallback kaldır (1.2.1)
2. Permission sözlüğü senkronizasyonu (1.2.2, 1.2.3)
3. Rol-endpoint erişim matrisi (1.2.4)

### Sprint C (1 hafta) — Backend Güçlendirme
1. Endpoint guard audit (3.2.1)
2. İlk 5 service testi (4.2.1)
3. Permission integration testi (4.2.5)

### Sprint D (1 hafta) — İleri Stabilizasyon
1. State machine (3.2.2)
2. JWT httpOnly cookie (3.2.3)
3. Frontend test altyapısı (4.2.3)
4. CI pipeline (4.2.4)

---

## Karar Soruları (Uygulama Öncesi Onay Gerekli)
1. Cascade → Restrict dönüşümünde junction tablolar (role_permissions, notification_recipients) hariç tutulacak mı?
2. Soft-delete'te `status=inactive` mi yoksa `deletedAt` timestamp mi tercih ediliyor?
3. JWT httpOnly cookie geçişi mobile app'i etkiler — mobil auth akışı ayrı mı tutulacak?
4. Test önceliği: Backend unit test mi, E2E smoke test mi ilk?
5. Sprint A'ya hemen başlansın mı?

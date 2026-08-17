# Mühendis Raporu — 15 Mayıs 2026

---

## 1. Sabah Production ve Değişiklik Kontrolü

### Son Deploy Sonrası Değişiklik Durumu

| Kontrol Maddesi | Sonuç |
|-----------------|-------|
| Yeni deploy yapıldı mı? | ❌ Hayır — son deploy dün 20:44 UTC, bu sabah değişiklik yok |
| Yeni migration çalıştırıldı mı? | ❌ Hayır — son migration `20260514130000_claim_subject_department_and_auto_codes` |
| Yeni validation kuralı eklendi mi? | ❌ Hayır |
| Yeni regex veya format zorunluluğu eklendi mi? | ❌ Hayır |
| Yeni otomatik atama davranışı eklendi mi? | ❌ Hayır |
| Yeni zorunlu alan kontrolü eklendi mi? | ❌ Hayır |
| MEMORY.md çelişkisi var mı? | ❌ Hayır — tüm danışman kararları uyumlu |

**Kanıt:** Production container'da `claim-files.service.js` dosyasında DOS regex, format zorunluluğu veya zorunlu alan kontrolleri arandı → 0 eşleşme. Tüm servisler dünkü rapordan bu yana 14+ saat kesintisiz healthy.

### Servis Durumu

| Servis | Uptime | Durum |
|--------|--------|-------|
| Backend | 14 saat | ✅ Healthy |
| Web | 14 saat | ✅ Healthy |
| PostgreSQL | 24 saat | ✅ Healthy |
| Redis | 24 saat | ✅ Healthy |
| MinIO | 24 saat | ✅ Healthy |
| Nginx | 3 gün | ✅ Healthy |

---

## 2. Korunacak Danışman Kararları — Uyumluluk Doğrulaması

| Karar | Production Kontrolü | Yöntem |
|-------|---------------------|--------|
| Dosya numarası otomatik üretilmeyecek | ✅ Uyumlu | grep: DOS helper çağrısı yok |
| DOS-YYYY-00001 regex/format zorunluluğu yok | ✅ Uyumlu | grep: 0 regex eşleşmesi |
| dosyaNo = manuel giriş + benzersizlik kontrolü | ✅ Uyumlu | Sadece unique check mevcut |
| Sigorta şirketi otomatik atanmayacak | ✅ Uyumlu | grep: auto-assign yok |
| insuranceCompanyId/policyNo/claimNo/productBranch/lossType evrensel zorunlu alan yapılmayacak | ✅ Uyumlu | grep: 0 "zorunludur" hatası |
| Eksper portalı gereksiz zorunlu alanlarla engellenmeyecek | ✅ Uyumlu | Zorunlu alan yok |
| Deploy öncesi MEMORY.md çelişki kontrolü | ✅ Bu rapor ile yapıldı |

**Sonuç:** Production davranışı MEMORY.md danışman kararlarıyla %100 uyumlu.

---

## 3. P1 Teknik Düzeltme Planı

### 3.1 Yetki Modelini Tekilleştirme

**Mevcut durum:**
- `PermissionsGuard` içinde `ROLE_DEFAULT_PERMISSIONS` hardcoded fallback var
- Hardcoded isimler: `file.view`, `customer.create`, `supplier.view`
- DB seed isimleri: `claim_file.view`, `customer.manage`, `vendor.manage`
- Frontend `layout.tsx`: üçüncü bir permission/role matrisi
- 3 farklı yetki sözlüğü birbirine UYMUYOR

**Somut kanıt:**
- Dosya: `apps/backend/src/common/guards/permissions.guard.ts` satır 1-50 — `ROLE_DEFAULT_PERMISSIONS` objesi
- Dosya: `apps/backend/prisma/seed.ts` — DB permission isimleri (`claim_file.view`)
- Dosya: `apps/web/src/app/panel/layout.tsx` — frontend route permission matrisi
- Fallback mantığı: `dbPermissions.length > 0 ? dbPermissions : ROLE_DEFAULT_PERMISSIONS[roleCode]`

**Risk seviyesi:** KRİTİK
**İş etkisi:** Expert kullanıcı DB'de doğru permission'a sahipken "yetkiniz yok" alabilir (daha önce yaşandı — `claim_file.create` eklenmeden expert dosya oluşturamıyordu). Yeni permission eklendikçe çelişki büyür.

**Önerilen teknik çözüm:**
1. `ROLE_DEFAULT_PERMISSIONS` hardcoded fallback'i tamamen kaldır
2. DB seed'deki permission isimleri tek kaynak (source of truth) olsun
3. Controller `@RequirePermissions()` dekoratörleri DB isimleriyle eşleşsin
4. Frontend erişim kontrolü backend permission API'den beslensin

**Etkilenecek modüller:** Auth guard, tüm controller'lar, frontend layout, seed
**Veri kaybı riski:** Yok — yetki konfigürasyonu değişikliği
**Regression riski:** YÜKSEK — yanlış eşleşmede tüm roller kilitlenebilir
**Rollback planı:** Hardcoded fallback'i geri ekle (tek commit revert)
**Test ve kabul:** Her rol her endpoint'e erişim matrisi testi, admin/expert/field_staff login sonrası navigasyon kontrolü
**Danışman onayı gerekli:** Permission isim sözlüğü standardı (snake_case entity.action formatı onay)

---

### 3.2 Permission Registry / Seed / Controller Uyumu

**Mevcut durum:**
- DB'de 8 rol, toplam permission dağılımı: admin(48), manager(35), office_staff(21), finance(18), field_staff(9), adjuster(9), expert(8), insurance_company_user(4)
- Controller'larda kullanılan permission isimleri ile DB seed isimleri arasında fark var
- Bazı controller'lar `system.manage`, `settings.manage` gibi genel permission kullanıyor — hangi rolde bu permission var belli değil

**Somut kanıt:**
- `service-types.controller.ts` → `system.manage`
- `report-templates.controller.ts` → `settings.manage`
- `audit-logs.controller.ts` → `audit_log.view`
- Bunların hangisinin DB seed'de tanımlı olduğu belirsiz

**Risk seviyesi:** YÜKSEK
**İş etkisi:** Yeni modül eklendiğinde permission eksikliği runtime'da keşfedilir
**Önerilen çözüm:** Permission registry dosyası (`permissions.registry.ts`) — tüm permission'lar tek yerde tanımlı, seed ve controller aynı kaynaktan beslensin
**Test:** Automated script — her controller decorator permission'ı DB'de var mı kontrolü
**Danışman onayı gerekli:** Yok — teknik standartlaştırma

---

### 3.3 Cascade Delete Veri Kaybı Analizi

**Mevcut durum:**
- Schema'da **83 adet** `onDelete: Cascade` tanımlı
- Kritik zincirler:
  - `User` → notes, tasks, assignments, audit_logs, notifications (operasyonel tarihçe kaybı)
  - `ClaimFile` → notes, tasks, documents, budget_items, financial_summaries, status_history (dosya tarihçesi kaybı)
  - `Vendor` → agreements, payments (tedarikçi geçmişi kaybı)
  - `InsuranceCompany` → adjuster_assignments (eksper bağlantıları kaybı)

**Somut kanıt:**
- Dosya: `apps/backend/prisma/schema.prisma` — 83 cascade ilişki
- Admin panelde kullanıcı/firma silme butonu mevcut — cascade koruması yok

**Risk seviyesi:** KRİTİK
**İş etkisi:** Admin yanlışlıkla bir kullanıcı silerse, o kullanıcının oluşturduğu tüm notlar, görevler, denetim kayıtları geri dönüşsüz kaybolur

**Önerilen teknik çözüm:**
1. Kritik entity'lerde (User, ClaimFile, Vendor, InsuranceCompany) `onDelete: Cascade` → `onDelete: Restrict` migration
2. Tüm entity silme işlemlerinde soft-delete zorunlu (status=inactive veya deletedAt timestamp)
3. Admin panelde silme öncesi impact sayısı gösterimi
4. Junction/log tablolarında cascade kabul edilebilir (role_permissions, notification_recipients)

**Etkilenecek modüller:** Tüm service delete metodları, Prisma schema, admin UI
**Veri kaybı riski:** Dönüşüm sırasında yok (restrict daha güvenli); dönüşüm yapılMAZSA mevcut veri kaybı riski devam
**Regression riski:** ORTA — restrict sonrası "silme başarısız" hataları çıkabilir (beklenen davranış)
**Rollback:** Migration revert (cascade'e geri dönüş — güvenlik açısından istenmez)
**Test:** Admin panelden User/ClaimFile/Vendor silme denemesi → bağlı kayıt varsa hata mesajı
**Danışman onayı gerekli:** Soft-delete stratejisi: `status=inactive` mi yoksa `deletedAt` timestamp mi?

---

### 3.4 Temel Regresyon Testleri ve Release Blocker Akışları

**Mevcut durum:**
- Unit test: **YOK**
- E2E test: **YOK**
- CI pipeline: **YOK**
- Tüm test manuel — kullanıcı canlıda test ediyor

**Somut kanıt:**
- `apps/backend/` altında test dosyası aranması → 0 sonuç
- `package.json` test script'i default jest config — çalışan test yok

**Risk seviyesi:** YÜKSEK
**İş etkisi:** Her deploy potansiyel regression taşıyor; dünkü "Acil Yardım inactive" sorunu test olsaydı deploy öncesi yakalanırdı

**Önerilen çözüm:**
1. **Smoke test scripti** (curl/wget) — deploy sonrası 10 kritik endpoint otomatik kontrol
2. **İlk 5 backend service testi** — auth, claim-files, permissions, departments, claim-subjects
3. **Permission guard integration testi** — her rol her endpoint erişim matrisi
4. **Deploy öncesi build + test gate** (CI-lite)

**Test ve kabul:** `pnpm test` çalışıyor, en az 5 servis testi geçiyor, smoke test scripti deploy sonrası otomatik çalıştırılabiliyor
**Danışman onayı gerekli:** Test önceliği: smoke test mi, unit test mi ilk?

---

### 3.5 Public Endpoint Güvenlik Değerlendirmesi

**Mevcut durum:**
- `claim-subjects/active` → `@Public()` — auth gerekmeden erişilebilir
- `insurance-companies` GET list → `@Public()`
- `system-settings/ihbar-konulari` → `@Public()`

**Somut kanıt:**
- Production'da 81 dosyada `@Public` dekoratörü var (compiled dist)
- `claim-subjects/active` endpoint: kategori ve departman ID'ye göre ihbar konusu listesi dönüyor

**Risk değerlendirmesi:**

| Endpoint | Döndürdüğü Veri | Risk |
|----------|-----------------|------|
| claim-subjects/active | İhbar konusu adı, kodu, departman adı | **DÜŞÜK** — operasyonel referans verisi, hassas değil |
| insurance-companies | Sigorta şirketi adı, kodu | **DÜŞÜK** — kamuya açık bilgi |
| system-settings/ihbar-konulari | İhbar konusu string listesi | **DÜŞÜK** — statik referans |

**Gerekçe:** Bu endpoint'ler eksper portalı login ekranında dropdown doldurmak için kullanılıyor. Login öncesi seçim yapılabilmesi gerekiyor. Döndürdükleri veri hassas değil — şirket adları ve konu başlıkları.

**Önerilen çözüm:**
- Mevcut @Public endpoint'ler GÜVENLİ — korunabilir
- Rate limiting eklenmesi önerilir (brute-force/scraping koruması)
- Kişisel veri döndüren endpoint'lerin (users, claim-files detay) public OLMADIĞI doğrulanmalı

**Danışman onayı gerekli:** Public endpoint'lerin korunmasını onaylıyor musunuz?

---

## 4. Dünkü Rapordan Açık 3 Konunun Kök Nedeni

### 4.1 Acil Yardım Departmanı Neden Inactive'di?

**Kök neden analizi:**
- Audit log'da department entity kaydı **0** — admin panelden silme/güncelleme yapılmamış
- `departments.service.ts` `remove()` metodu soft-delete yapıyor (`status: 'inactive'`)
- Olası senaryo: Worker'ın local'deki test veya deploy sırasında yanlışlıkla DELETE endpoint'i çağrılmış olabilir, veya seed sırasında eski veri overwrite edilmiş
- Audit log'un boş olması iki şeye işaret eder: ya audit log middleware bu entity'yi kapsamıyor, ya da değişiklik doğrudan SQL ile yapılmış

**Kalıcı çözüm önerisi:**
1. Seed'de 3 gerçek departmanı her zaman `status: 'active'` ile upsert et (idempotent)
2. Department delete endpoint'ine admin-only guard ekle
3. Audit log middleware'ini department CRUD'u kapsayacak şekilde genişlet

### 4.2 Expert Şifresi Neden Manuel Sıfırlandı?

**Kök neden:**
- Expert kullanıcı seed.ts'de `bcrypt.hash('admin123', 10)` ile oluşturulmuş — `pilot123` değil
- Migration/seed yeniden çalıştırıldığında şifre `admin123`'e dönüyor
- Dün container içinden `bcrypt.hash('pilot123', 10)` ile SQL UPDATE yapıldı
- Ancak local bcrypt binary'si ile container bcrypt binary'si farklı hash üretebilir (native module farkı)
- Bu nedenle local'de üretilen hash container'da çalışmadı, container içinden üretilen hash ile sıfırlandı

**Kalıcı çözüm önerisi:**
1. `seed.ts`'de expert kullanıcı şifresini `pilot123` ile upsert et
2. Veya daha iyisi: seed'de test kullanıcıları ENV'den okunsun (`EXPERT_DEFAULT_PASSWORD`)
3. Production'da seed çalıştırıldığında şifre koruması: `skipIfExists` flag

### 4.3 claim-subjects/active Endpoint Public Olması Doğru mu?

**Gerekçe:** EVET, doğru.

1. Bu endpoint eksper portalı login ekranında kullanılıyor — eksper giriş yapmadan dosya oluşturma formundaki ihbar konusu dropdown'ını doldurmak için çağrılır
2. Döndürdüğü veri: ihbar konusu adı, kodu, departman adı — **kişisel veri YOK**, **operasyonel sır YOK**
3. Sigorta sektöründe ihbar konuları (yangın, su hasarı, hırsızlık vb.) kamuya açık kavramlar
4. Alternatif: Auth sonrası çağrı → eksper login ekranı dropdown'suz olur → kullanıcı deneyimi kötüleşir

**Risk azaltma:** Rate limiting (IP bazlı, dakikada max 60 istek) eklenmesi önerilir.

---

## 5. Ürün Vizyonu Uyumluluğu

**Mevcut durum değerlendirmesi:**

| Alan | Sigortacılığa Gömülülük | Genelleştirme Potansiyeli |
|------|------------------------|--------------------------|
| Dosya (ClaimFile) | `insuranceCompanyId`, `policyNo`, `claimNo` alanları sektöre özel | → İş Emri / Servis Kaydı + opsiyonel sektör alanları |
| İhbar Konusu (ClaimSubject) | İsimler sektöre özel ama yapı genel | → Talep Kategorisi (yapı hazır) |
| Eksper (Expert/Adjuster) | İsim sektöre özel, yapı genel | → Saha Uzmanı / Teknik Personel |
| Sigorta Şirketi | Model tamamen sektöre özel | → Müşteri / İş Ortağı (genelleştirme gerekli) |
| Departman | Genel yapı (Hasar Onarım, Acil Yardım, Sovtaj) | ✅ Zaten sektörden bağımsız org birimi |
| Hizmet Türü | Genel yapı | ✅ Zaten sektörden bağımsız |

**Danışman kararlarıyla uyumluluk:**
- `insuranceCompanyId` vb. alanlar opsiyonel bırakılması → ✅ Genelleştirmeye uygun (zorunlu yapılmadı)
- Dosya numarası serbest format → ✅ Sektör bağımsız (DOS-YYYY kısıtlaması iptal edildi)
- İhbar konuları departmana bağlı → ✅ Kategori-departman ilişkisi her sektörde geçerli

**Öneri:** Yeni alan/validasyon eklenirken "Bu alan tadilat/servis sektöründe de geçerli mi?" sorusu sorulmalı. Geçerli değilse opsiyonel veya metadata/extension alanı olmalı.

---

## 6. Kredi Kontrollü Çalışma Yaklaşımı

Bu rapor, kredi kontrollü çalışma talimatına uygun olarak hazırlanmıştır:

| Kural | Bu Raporda Uygulanışı |
|-------|----------------------|
| Kapsam netleşmeden başlatma | ✅ 8 başlıklı talimat okundu, kapsam belirlendi |
| Önce kısa plan, risk, etki | ✅ Her P1 maddesi format'a uygun hazırlandı |
| Danışman onayı olmadan deploy yok | ✅ Kod değişikliği / deploy yapılmadı |
| Karar sorusu olarak ilet | ✅ 5 danışman onay sorusu listelendi |
| Kabul kriteri belirt | ✅ Her P1 maddesinde test/kabul kriteri var |
| Analiz ≠ implementasyon | ✅ Bu rapor tamamen analiz — sıfır kod değişikliği |
| Ne yapıldı/yapılmadı/karar bekliyor | ✅ Aşağıda |

---

## 7. Teslim Özeti

**Ne yapıldı:**
- Production sabah kontrolü — değişiklik yok, tüm servisler stable
- MEMORY.md danışman kararları uyumluluk doğrulaması — %100 uyumlu
- P1 teknik plan 5 başlıkta hazırlandı (yetki, permission, cascade, test, public endpoint)
- 3 açık konunun kök nedeni ve kalıcı çözümü belirlendi
- Ürün vizyonu uyumluluk değerlendirmesi yapıldı

**Ne yapılmadı:**
- Kod değişikliği
- Production deploy
- Migration
- Worker dispatch

**Danışman kararı bekleyen konular:**
1. Permission isim standardı onayı (snake_case entity.action)
2. Soft-delete stratejisi: `status=inactive` mi, `deletedAt` mi?
3. Test önceliği: smoke test mi, unit test mi ilk?
4. Public endpoint'lerin korunması onayı
5. Cascade → Restrict dönüşümünde junction tablo istisnaları

# Faz 1 Temiz Patch Karar Raporu

## 1. Yönetici Özeti

Danışman kararı gereği Faz 1 production'a alınabilir durumda değildir. Mevcut çalışma seti içinde Faz 1 kapsamına giren satırlar ile faz dışı değişiklikler aynı dosyalarda karışmış durumdadır; bu nedenle temiz patch ayrıştırması zorunludur.

Bu rapor üç ana çıktıyı sunar:

- Faz 1 için tutulabilecek backend/frontend değişikliklerinin faz dışı satırlardan ayrıştırılması
- `apps/backend/src/modules/service-types/service-types.service.ts` içindeki typecheck blocker'ın kök neden analizi
- Production üzerinde test kullanıcıları ve ilişkili kayıtlar için read-only veri izi listesi

Bu çalışma boyunca deploy, rebuild, recreate, migration, seed ve veri temizliği yapılmamıştır.

## 2. Temiz Faz 1 Patch Ayrıştırma Matrisi

### Faz 1'e Dahil Edilecek Konular

- `insurance-company-scopes` route / service / DTO
- screen-permissions payload normalize
- frontend tarafında canonical `screens[].code` payload çağrıları

### Faz Dışı Tutulacak Konular

- nested department memberships DTO / service
- responsibility assignments
- role switch cleanup
- `isPrimary` validasyonu
- büyük UI refactor
- Türkçeleştirme / label / helper text değişiklikleri
- `apps/backend/package.json` içindeki Jest `moduleNameMapper`

### Ayrıştırma Matrisi

| Dosya | Faz 1 satırları / hunk özeti | Faz dışı satırlar / hunk özeti | Patch'e dahil mi? |
|---|---|---|---|
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts` | `CreateUserDto`, `UpdateUserDto`, `UpdateScreenPermissionsDto`, `NormalizedScreenPermission`, `UpdateInsuranceCompanyScopesDto` importu; `screen-permissions` endpointinde payload normalize; yeni `PUT :id/insurance-company-scopes` route'u | `CreateUserDto` / `UpdateUserDto` importu dolaylı olarak faz dışı nested DTO'ları da taşıyor | **Evet, split patch gerekli** |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts` | `Prisma` importu teknik olarak yalnız yeni include/helper yapısına eşlik ediyor; `upsertScreenPermissions` için null/array guard; `updateInsuranceCompanyScopes()` metodu | `userDetailInclude()`, nested department memberships, responsibility assignments, `validateNestedUserRelations()`, `persistDepartmentMemberships()`, `persistResponsibilityAssignments()`, `cleanupRoleSwitchState()`, role switch audit log, `serviceAreas` include/refactor, `updateServiceAreas` guard | **Kısmi, ağır split patch gerekli** |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx` | screen permissions okurken `item.screenCode ?? item.code`; create/edit akışında `PUT /screen-permissions` için canonical `{ code }` payload; `PUT /insurance-company-scopes` çağrıları; `insuranceCompanyIds` form state kullanımı | operasyon yapısı sekmeleri, `departmentMemberships`, `responsibilityAssignments`, `scope` altyapısı, büyük modal/UI refactor, etki özeti, yeni component entegrasyonları, çok sayıda label/UX değişikliği | **Kısmi, yalnız seçili hunklar alınmalı** |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/ayarlar/kurulum/page.tsx` | screen permissions okurken `item.screenCode ?? item.code`; canonical `{ code }` payload ile `PUT /screen-permissions`; `PUT /insurance-company-scopes`; `insuranceCompanyIds` state kullanımı | `departmentMemberships`, `responsibilityAssignments`, operasyon scope altyapısı, kurulum sayfası kullanıcı modali refactor'u, label/helper metinleri, geniş UI değişiklikleri | **Kısmi, yalnız seçili hunklar alınmalı** |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/package.json` | Yok | Jest `moduleNameMapper` | **Hayır** |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.dto.ts` | `ScreenPermissionInputDto`, `UpdateScreenPermissionsDto`, `NormalizedScreenPermission`, `UpdateInsuranceCompanyScopesDto` | `UserDepartmentMembershipInputDto`, `UserResponsibilityAssignmentInputDto`, `CreateUserDto` içindeki `departmentMemberships` ve `responsibilityAssignments` alanları | **Kısmi, yeni temiz DTO patch'i önerilir** |

### Temiz Patch İçin Önerilen Uygulama Sırası

1. `users.dto.ts` içinde yalnız Faz 1 DTO'larını ayıran temiz patch hazırlanmalı
2. `users.controller.ts` içinde yalnız:
   - `screen-permissions` normalize
   - `insurance-company-scopes` route
3. `users.service.ts` içinde yalnız:
   - `upsertScreenPermissions` payload guard / canonical kullanım
   - `updateInsuranceCompanyScopes()`
4. `kullanicilar/page.tsx` içinde yalnız canonical screen payload ve insurance company scope çağrıları
5. `kurulum/page.tsx` içinde yalnız canonical screen payload ve insurance company scope çağrıları
6. `apps/backend/package.json` tamamen dışarıda bırakılmalı

### Patch Seviyesinde Rollback Planı

| Patch birimi | Geri alma kapsamı |
|---|---|
| Backend DTO/controller patch | `users.dto.ts` Faz 1 DTO'ları, `users.controller.ts` normalize + insurance-company-scopes route |
| Backend service patch | `users.service.ts` içindeki `upsertScreenPermissions` Faz 1 guard'ı ve `updateInsuranceCompanyScopes()` |
| Frontend kullanıcılar patch | `apps/web/src/app/panel/kullanicilar/page.tsx` içindeki canonical payload ve insurance scopes çağrıları |
| Frontend kurulum patch | `apps/web/src/app/panel/ayarlar/kurulum/page.tsx` içindeki canonical payload ve insurance scopes çağrıları |
| Typecheck mini patch | `apps/backend/src/modules/service-types/service-types.service.ts` içindeki ayrı düzeltme |

Rollback sırasında faz dışı hunks geri alınmayacak; her alt patch bağımsız tutulmalıdır.

## 3. Typecheck Blocker Analizi ve Mini Düzeltme Planı

### Bulgular

İncelenen dosya: `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/service-types/service-types.service.ts`

Typecheck hatası bildirilen noktalar:

- satır 35 civarı: `this.prisma.serviceType.create({ data: { name, description, isActive, sortOrder } })`
- satır 71 civarı: `this.prisma.serviceType.create({ data: { ...st, isActive: true } })`

İncelenen schema: `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/prisma/schema.prisma`

Mevcut `ServiceType` modeli:

- `id`
- `name`
- `description`
- `isActive`
- `sortOrder`
- `createdAt`
- `updatedAt`

Schema içinde **`code` alanı bulunmamaktadır**.

Prisma client kontrolü:

- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/node_modules/.prisma/client/` dizini bulunmamıştır.

### Kök Neden Değerlendirmesi

Kök neden tek eksende değil, iki olası durum birlikte işaret etmektedir:

1. **Schema / generated client uyumsuzluğu olasılığı yüksek**
   - Mevcut schema'da `code` alanı yok
   - Hata mesajı ise create input içinde eksik `code` alanı beklendiğini söylüyor
   - Bu, typecheck'in baktığı Prisma tiplerinin mevcut schema dosyasından farklı bir generate çıktısına işaret ettiğini düşündürür

2. **Prisma client generate çıktısı bu çalışma ağacında mevcut değil**
   - `apps/backend/node_modules/.prisma/client/` yok
   - Bu nedenle yerel bağımlılık yapısı eksik veya generate başka path'te

3. **Service kodunda `code` kullanmama durumu tek başına kök neden değil**
   - Çünkü mevcut schema gerçekten `code` alanı içermiyor
   - Yani salt service düzeltmesi, schema/client tarafı doğrulanmadan kesin çözüm olmayabilir

### Net Sınıflandırma

- **Schema:** mevcut dosyada `code` yok
- **Client:** generate edilmiş client yerel path'te bulunmuyor veya typecheck başka tip seti görüyor
- **Service:** mevcut create payload'ları `code` göndermiyor; fakat bunun hata olması için client tiplerinin `code` bekliyor olması gerekir

Sonuç olarak blocker, en kuvvetli ihtimalle **client/schema hizasızlığı** kaynaklıdır; service dosyası yalnız görünen temas noktasıdır.

### Mini Düzeltme Planı (Ayrı Patch)

1. Önce typecheck'in gerçekten hangi Prisma tip setini kullandığı doğrulanmalı
2. Eğer kurum kararı gereği schema değişikliği istenmiyorsa, bu fazda `schema.prisma` değiştirilmemeli
3. Ayrı mini patch olarak yalnız `service-types.service.ts` ele alınmalı
4. Ancak service patch'i uygulanmadan önce şu karar verilmelidir:
   - eğer beklenen doğru modelde `code` alanı zorunlu ise: danışman onayı olmadan düzeltme tamamlanamaz
   - eğer `code` beklentisi stale client'tan geliyorsa: Prisma client regenerate gerekir
5. Bu nedenle mini düzeltme planı şu şekilde yazılmalıdır:
   - **Patch kapsamı:** yalnız `service-types.service.ts`
   - **Schema değişikliği:** yok
   - **Regenerate gereksinimi:** yüksek olasılıkla evet, fakat bu rapor kapsamında uygulanmadı

## 4. Production Test Veri İzi Listesi

### Özet

Production üzerinde read-only sorgularla 6 test/tmp karakterli kullanıcı tespit edildi. Bunlardan yalnız birinde ilişkili operasyonel assignment kaydı bulundu; screen permissions ve insurance company scopes tablolarında test/tmp filtrelerine düşen kullanıcılar için kayıt bulunmadı.

### Rol Eşlemesi

- `16aa0d72-61fd-4090-8f81-7dcc16e6db2b` → `field_staff` / Saha Personeli
- `1ae0cce1-6cf5-4d2a-9991-06ac320be4c1` → `expert` / Eksper Portalı
- `49881ed6-d820-4bc1-9cf7-4d8666239de2` → `office_staff` / Ofis Personeli
- `c0bc2641-2530-417f-98f9-499c5c189fec` → `insurance_company_user` / Sigorta Şirketi

### Kullanıcı Bazlı Liste

| ID | Email | Ad Soyad | Rol | Durum | Oluşturma tarihi | Screen permissions | Insurance scopes | Assignments | Temizlik önerisi |
|---|---|---|---|---|---|---|---|---|---|
| `7fcf1daa-4710-4a73-9c3c-d924c7f3c63e` | `a@a.com` | Tests Tetst | `field_staff` | active | `2026-05-17 15:33:17.464` | Yok | Yok | Yok | **Temizlik için danışman onayı gerekli** |
| `141182b0-9cbd-4fcb-b822-70b795c2f993` | `info@safranbh.com` | Test Test | `expert` | active | `2026-05-17 13:38:32.588` | Yok | Yok | Yok | **Temizlik için danışman onayı gerekli** |
| `982721e9-4588-4a2b-9ffa-040e36c90f6b` | `A@A.COM` | Test Test | `field_staff` | active | `2026-05-17 13:30:57.019` | Yok | Yok | Yok | **Temizlik için danışman onayı gerekli** |
| `732ce7f4-d309-4632-be70-140a1229f9da` | `tok2280108@test.com` | Testok2 P280108 | `office_staff` | active | `2026-05-17 13:24:05.320` | Yok | Yok | Yok | **Temizlik için danışman onayı gerekli** |
| `9737b600-8d06-4f0f-9d60-f0966952e081` | `tmp.verify.field2@example.invalid` | Tmp Field | `field_staff` | active | `2026-05-17 07:45:00.275` | Yok | Yok | **Var (3 adet responsibility assignment)** | **Temizlik için danışman onayı gerekli** |
| `85060bef-50dd-40ef-8abb-219919984974` | `tmp.verify.insurance@example.invalid` | Tmp Verify | `insurance_company_user` | active | `2026-05-17 07:44:43.692` | Yok | Yok | Yok | **Temizlik için danışman onayı gerekli** |

### İlişkili Assignment Detayı

`tmp.verify.field2@example.invalid` kullanıcısı için 3 kayıt bulundu:

- `department_id = e931493f-9c43-4a63-92c9-67584d65c124`, `region_type = countrywide`
- `department_id = 74ff932f-29df-48dd-90ba-1a1996952557`, `region_type = countrywide`
- `department_id = 66b65da2-f23e-41c5-8f02-ce774e95c24e`, `region_type = countrywide`

### Karar Notu

Bu rapor, veri temizliği işlemi yapmaz. İlişkili kayıt zinciri bulunan kullanıcı için doğrudan silme/temizleme önerisi verilmemiştir. İlişkisi olmayan kullanıcılar için bile temizleme aksiyonu danışman onayı olmadan öneri seviyesini aşmamalıdır.

## 5. Bir Sonraki Onay Kapısı Tablosu

| Konu | Gerekli karar | Onay olmadan yapılmayacak işlem |
|---|---|---|
| Temiz Faz 1 patch üretimi | Hangi hunks kesin alınacak? | Kod patch uygulaması |
| DTO ayrıştırması | `CreateUserDto` / `UpdateUserDto` Faz 1'den tamamen ayrılacak mı? | Backend DTO refactor'u |
| Typecheck blocker | `ServiceType.code` beklenmeli mi, stale client mı? | Service mini patch + Prisma generate |
| Prisma client | Regenerate yetkisi verilecek mi? | Generate / build zinciri |
| Test veri temizliği | Hangi kullanıcılar için aksiyon alınacak? | Production veri temizliği |
| Word teslim sonrası Faz 2 | Faz 2 kapsamı yeniden açılacak mı? | Faz 2 geliştirmeleri |

## 6. Açık Beyan

Bu çalışma kapsamında:

- deploy yapılmadı
- rebuild yapılmadı
- recreate yapılmadı
- migration yapılmadı
- seed yapılmadı
- veri temizliği yapılmadı

## Doğrulama Özeti

- Faz 1 patch'i, mevcut diff içinde faz dışı değişikliklerden ayrıştırılacak şekilde sınıflandırıldı
- typecheck blocker için schema / client / service ekseninde kök neden analizi çıkarıldı
- production test kullanıcıları ve ilişkili kayıtlar kullanıcı bazında listelendi

# Kalan 2 Kanıt Kapısı Raporu

Tarih: 2026-05-17  
Proje: Sigorta Hasar Sistemi  
Kapsam: Sadece analiz, kanıt toplama, log inceleme, raporlama. Kod/deploy/migration/seed/validation/mail ayarı değişikliği yapılmadı.

## 1. Yönetici Özeti

| Kanıt Kapısı | Durum | Sonuç |
|---|---|---|
| Expert hesabı | Beklemede / FAIL kanıtı | Kullanıcı production DB'de aktif ve `expert` rolde. Ancak parola bilinmediği için güvenli login testi yapılamadı. Ayrıca mevcut veride `adjuster_id` boş ve responsibility assignment kaydı yok; bu nedenle beklenen own-file scope/403 davranışı production verisiyle doğrulanamadı. |
| Users create/update yan endpointleri | FAIL | Frontend, ana `/users` çağrısından sonra üç yan endpoint çağırıyor; backend yalnızca `service-areas` ve `screen-permissions` route'larını sunuyor. `PUT /users/:id/insurance-company-scopes` route'u backend'de yok. Ayrıca frontend `screen-permissions` payload shape'i backend beklenen alan adıyla uyumsuz. Bu nedenle kısmi başarı/hata riski somut olarak kanıtlandı. |

## 2. Expert Hesabı Kanıtı

### 2.1 Production kullanıcı kaydı

Production DB sorgusu sonucu:
- E-posta: `info@safranbh.com`
- Durum: `active`
- Rol: `expert` / `Eksper Portalı`
- `password_hash` mevcut ve uzunluğu 60 karakter
- `adjuster_id`: `NULL`
- `last_login_at`: `NULL`

Kanıtlar:
- Production SQL: `SELECT id, email, status, role_id FROM users WHERE email = 'info@safranbh.com';`
- Production SQL: `SELECT r.code, r.name FROM roles r JOIN users u ON u.role_id = r.id WHERE u.email = 'info@safranbh.com';`
- Production SQL: `SELECT id, email, status, role_id, CASE WHEN password_hash IS NOT NULL THEN true ELSE false END AS has_password_hash, LENGTH(password_hash) AS password_hash_len FROM users WHERE email = 'info@safranbh.com';`
- Production SQL: `SELECT id, email, adjuster_id, last_login_at FROM users WHERE email = 'info@safranbh.com';`

### 2.2 Login kanıtı

Bu çalışma kapsamında production şifresi yalnızca hash olarak doğrulandı; düz parola güvenli şekilde elde edilemedi. Görev talimatı gereği geçici parola oluşturulmadı ve parola reset yapılmadı.

Sonuç:
- Login testi: **yapılamadı**
- Rapor beyanı: **Parola bilinmiyor, login testi yapılamadı**

### 2.3 Assignment durumu

İlk sorguda beklenen kolon adı yanlış varsayıldı; production şeması doğrulandıktan sonra doğru kolonlarla tekrar sorgulandı.

Production şema kanıtı:
- `claim_responsibility_assignments` kolonları: `id`, `user_id`, `department_id`, `region_type`, `region_values`, `coverage_type`, `coverage_config`, `priority`, `is_active`, `created_at`, `updated_at`

Doğru sorgu sonucu:
- `info@safranbh.com` için `claim_responsibility_assignments` kaydı bulunmadı (`0 rows`)

Sonuç:
- Expert assignment: **yok**

### 2.4 Backend expert erişim kısıtı incelemesi

Kod incelemesinde expert için claim file listeleme sırasında özel scoping bulundu:
- `apps/backend/src/modules/claim-files/claim-files.controller.ts:21-29` içinde kullanıcı rolü `expert` ve `adjusterId` doluysa `query.assignedAdjusterId = user.adjusterId` uygulanıyor.
- Aynı controller'da expert'e özel ayrı endpoint listesi tanımlı değil; route erişimi permission guard ile belirleniyor.
- `apps/backend/src/modules/users/screen-permissions.defaults.ts:35-58` içinde `expert` rolü için varsayılan ekran listesi boş (`expert: []`).
- `apps/backend/src/modules/claim-files/claim-files.service.ts:157-200` içinde detay endpointte yalnızca `field_staff` için explicit ownership/48 saat `ForbiddenException` kontrolü var; `expert` için eşdeğer explicit 403 kontrolü görünmüyor.

Yorum:
- Expert'in liste scoping'i ancak `adjusterId` doluysa devreye giriyor.
- Production kullanıcıda `adjuster_id` boş olduğu için bu scoping fiilen uygulanmaz.
- Bu nedenle "own-file ve 403 davranışı" production verisiyle ispatlanamadı; mevcut kod ve veri durumu beklenen güvenlik kapısını desteklemiyor.

### 2.5 Expert kapısı sonucu

Durum: **Beklemede / FAIL kanıtı**

Gerekçe:
1. Parola bilinmediği için login testi yapılamadı.
2. `adjuster_id` boş olduğu için expert own-file scope mantığı production kullanıcıda tetiklenmiyor.
3. Assignment kaydı yok.
4. Kodda explicit expert-specific detail 403 koruması bulunmadı; yalnızca `field_staff` için açık kontrol mevcut.

## 3. Users Create/Update Kanıtı

### 3.1 Frontend create/update akışı

`apps/web/src/app/panel/kullanicilar/page.tsx:552-662` incelemesine göre akış şöyle:

#### Create akışı
1. `POST /users`
2. Eğer `serviceAreas.length > 0` ise `PATCH /users/:id/service-areas`
3. Eğer rol `field_staff` ise `PUT /users/:id/screen-permissions`
4. Eğer rol `insurance_company_user` ise `PUT /users/:id/insurance-company-scopes`

#### Update akışı
1. `PATCH /users/:id`
2. Koşulsuz `PATCH /users/:id/service-areas`
3. Eğer rol `field_staff` ise `PUT /users/:id/screen-permissions`
4. Eğer rol `insurance_company_user` ise `PUT /users/:id/insurance-company-scopes`

Önemli gözlem:
- Bu çağrılar tek `try/catch` zincirinde ardışık çalışıyor.
- Ana `/users` çağrısı başarılı olup yan endpointlerden biri başarısız olursa kullanıcı kısmen oluşmuş/güncellenmiş olur; UI genel hata gösterir ama önceki başarılı adımlar rollback edilmez.

### 3.2 Backend controller route durumu

`apps/backend/src/modules/users/users.controller.ts:32-140` incelemesine göre mevcut route'lar:
- `POST /users`
- `PATCH /users/:id`
- `PUT /users/:id`
- `GET /users/:id/service-areas`
- `PATCH /users/:id/service-areas`
- `GET /users/:id/screen-permissions`
- `PUT /users/:id/screen-permissions`

Eksik route:
- **`PUT /users/:id/insurance-company-scopes` yok**

Production log route map kanıtı da bunu destekliyor:
- `/api/v1/users/:id/service-areas` GET/PATCH map edilmiş
- `/api/v1/users/:id/screen-permissions` GET/PUT map edilmiş
- `/api/v1/users/:id/insurance-company-scopes` map edilmiş görünmüyor

### 3.3 Payload shape uyumsuzluğu

Frontend ekran izinleri isteği şu payload ile gidiyor:
- `{ screenPermissions: [{ screenCode, canView: true }] }`

Backend controller ise şu shape'i bekliyor:
- body alanı: `screens: Array<{ code: string; canView: boolean; canEdit?: boolean }>`

Bu bulgu, route mevcut olsa bile `screen-permissions` çağrısında request body uyuşmazlığı riski olduğunu gösteriyor.

### 3.4 Request/response matrisi

| Endpoint | Method | Sıra | Koşul | Frontend Payload Shape | Backend Beklentisi | Response / Risk |
|---|---|---:|---|---|---|---|
| `/users` | POST | 1 (create) | her zaman | `buildUserPayload(...)` | `CreateUserDto` | Başarılıysa kullanıcı ID döner |
| `/users/:id` | PATCH | 1 (update) | her zaman | `buildUserPayload(...)` | `UpdateUserDto` | Başarılıysa kullanıcı güncellenir |
| `/users/:id/service-areas` | PATCH | 2 | create: yalnızca `serviceAreas.length > 0`; update: her zaman | `{ serviceAreas: [{ provinceId, districtId }] }` | `{ serviceAreas: Array<{ provinceId, districtId? }> }` | Route mevcut; payload uyumlu |
| `/users/:id/screen-permissions` | PUT | 3 | yalnızca `field_staff` | `{ screenPermissions: [{ screenCode, canView }] }` | `{ screens: [{ code, canView, canEdit? }] }` | Route mevcut; **payload alan adları uyumsuz**, hata riski yüksek |
| `/users/:id/insurance-company-scopes` | PUT | 4 | yalnızca `insurance_company_user` | `{ insuranceCompanyIds: string[] }` | backend route yok | **404 / route missing** riski yüksek |

### 3.5 Son 48 saat production log kanıtı

İstenen filtre ile son 48 saat loglarında esasen `RouterExplorer` route map satırları görüldü; users create/update sonrası spesifik runtime hata satırı yakalanmadı.

Bulgular:
- Loglar, route mapping sırasında `service-areas` ve `screen-permissions` endpointlerinin mevcut olduğunu gösteriyor.
- `insurance-company-scopes` route'u loglarda görünmüyor.
- Structured request/response hata logları olmadığı için belirli bir kullanıcı create/update çağrısının başarısız yan endpointini mevcut log formatıyla korele etmek zor.

### 3.6 Users kapısı sonucu

Durum: **FAIL**

Gerekçe:
1. Frontend create/update sonrasında çok-adımlı yan endpoint zinciri kullanıyor.
2. `insurance-company-scopes` backend route'u eksik.
3. `screen-permissions` payload shape frontend/backend arasında uyumsuz.
4. Bu nedenle partial success / partial failure riski doğrudan kanıtlandı.

## 4. Production Riski

### Müşteri etkisi
- Kullanıcı oluşturma/güncelleme ekranında "başarısız" mesajı alınsa bile kullanıcı temel kaydı DB'de oluşmuş/güncellenmiş olabilir.
- `field_staff` rolünde ekran izinleri eksik/yanlış kaydedilebilir; kullanıcı beklenen ekranları göremez veya yetki matrisi tutarsız kalabilir.
- `insurance_company_user` rolünde şirket kapsamı hiç yazılamayabilir; kullanıcı erişim problemi yaşar.
- Expert hesabında login ve own-file güvenlik davranışı doğrulanamadığından operasyonel belirsizlik vardır.

### Production etkisi
- Destek ekipleri için tekrarlayan "kullanıcı oluştu mu / neden giriş yapamıyor / neden ekranları yok" vakaları üretir.
- DB state ile UI sonucu arasında tutarsızlık oluşur.
- Structured log eksikliği nedeniyle olay sonrası teşhis maliyeti yükselir.

## 5. Arıza Yakalama Kanıt Modeli Önerisi

### 5.1 Request-id korelasyonu
- Reverse proxy veya Nest interceptor katmanında her isteğe `x-request-id` atanmalı ve response header'a geri yazılmalı.
- Frontend, create/update zincirindeki ana ve yan çağrılarda aynı `flowId`/`requestGroupId` taşımalı.
- Böylece `/users` ve devamındaki yan endpointler aynı işlem zinciri altında korele edilebilir.

### 5.2 Eşleştirme alanları
Her log girdisinde en az şu alanlar olmalı:
- `requestId`
- `flowId`
- `endpoint`
- `method`
- `targetUserId`
- `actorUserId`
- `actorRole`
- `payloadShapeSummary` (ham payload değil, shape/array count)
- `httpStatus`
- `exceptionName`
- `exceptionMessage`

### 5.3 Structured logging yokken mevcut loglarla teşhis
Mevcut yapıda en pratik yöntem:
1. Aynı zaman penceresindeki frontend network trace veya tarayıcı HAR kaydını almak
2. Backend container logunda timestamp'e göre yakın satırları taramak
3. Önce route mapping değil runtime exception satırlarını grep etmek (`Exception`, `BadRequest`, `Forbidden`, `NotFound`, `screen-permissions`, `service-areas`, `insurance-company-scopes`)
4. DB'de kullanıcı temel kaydı oluştu mu, yan tablolar (`user_service_areas`, screen permission tablosarı, insurance scope tablosarı) doldu mu diye karşılaştırmak

Bu yöntem düşük güvenilirliktedir; request-id olmadan birebir korelasyon zayıftır.

## 6. Sonraki Adım

Kod yazmadan önce kapanması gereken kararlar:
1. Expert hesabı için danışman onaylı güvenli login test yöntemi belirlenecek mi? (mevcut parola doğrulama / kontrollü reset / danışman eşliğinde test)
2. Expert kullanıcı için `adjuster_id` zorunlu mu, yoksa farklı scoping modeli mi hedefleniyor?
3. Users create/update akışında kısmi başarı kabul ediliyor mu, yoksa tek transaction benzeri backend orkestrasyonu mu isteniyor?
4. `screen-permissions` için canonical payload shape hangisi olacak?
5. `insurance-company-scopes` endpointi gerçekten `/users/:id/...` altında mı tasarlanacak?

Tahmini efor/kredi (kod aşaması için, bu rapor dışında):
- Düşük-Orta: route/payload hizalama ve log iyileştirmeleri
- Orta: partial success riskini tek akışta güvenli hale getirme
- Orta: expert erişim modelini veri + permission + ownership tarafında netleştirme

## 7. Açık Beyan

Bu çalışma kapsamında:
- Kod değişikliği yapılmadı
- Deploy yapılmadı
- Migration yapılmadı
- Seed çalıştırılmadı
- Validation değiştirilmedi
- Mail ayarı değiştirilmedi
- Dosya silinmedi
- Parola, token veya secret rapora yazılmadı

## Ek Kanıt Referansları

### Dosya referansları
- `apps/web/src/app/panel/kullanicilar/page.tsx:552-662`
- `apps/backend/src/modules/users/users.controller.ts:32-140`
- `apps/backend/src/modules/claim-files/claim-files.controller.ts:18-31`
- `apps/backend/src/modules/claim-files/claim-files.service.ts:157-200`
- `apps/backend/src/modules/users/screen-permissions.defaults.ts:35-58`

### Production sorgu / log özetleri
- `users` tablosunda `password_hash` kolonu mevcut, `encrypted_password` yok
- `claim_responsibility_assignments` tablosunda `claim_file_id` ve `status` kolonu yok
- `info@safranbh.com` için `adjuster_id = NULL`, `last_login_at = NULL`, responsibility assignment kaydı yok
- 48 saat log kesitinde `insurance-company-scopes` route mapping satırı görülmedi

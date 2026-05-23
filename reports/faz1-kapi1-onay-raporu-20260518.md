# Kapı 1 — Temiz Faz 1 Patch Önerisi (Yeniden Üretim)

Tarih: 2026-05-18  
Proje: Sigorta Hasar Sistemi  
Kapsam: Sadece analiz, planlama, patch önerisi ve raporlama. Deploy, rebuild, recreate, migration, seed, Prisma generate, schema değişikliği, ServiceType mini patch, veri temizliği ve Faz 2 kapsamı bu çalışmanın dışındadır.

## 1. Temiz Patch Özeti

Bu bölüm mevcut diff’ten ayıklama değil, sıfırdan tanımlanan ideal temiz Faz 1 patch’ini tarif eder. Amaç yalnızca üç problemi çözmektir:

- backend `PUT /users/:id/insurance-company-scopes` eksikliğini kapatmak
- backend `PUT /users/:id/screen-permissions` için legacy + canonical payload normalizasyonu sağlamak
- frontend’de minimal canonical `screens[].code` ve `insuranceCompanyIds` çağrılarını hizalamak

| Dosya | Hunk | Amaç | Risk | Faz Dışı Bağımlılık Yok Beyanı |
|---|---|---|---|---|
| `apps/backend/src/modules/users/users.dto.ts` | `ScreenPermissionInputDto`, `UpdateScreenPermissionsDto`, `UpdateInsuranceCompanyScopesDto` ekleme/ayırma | `screenPermissions/screenCode` ile `screens/code` payload’larını tek normalize DTO altında toplamak; `insuranceCompanyIds` için minimal DTO tanımlamak | Düşük | Bu hunk faz dışı bağımlılık içermez; nested department memberships, responsibility assignments, `isPrimary`, role-switch cleanup veya schema değişikliği gerektirmez. |
| `apps/backend/src/modules/users/users.controller.ts` | `PUT :id/screen-permissions` normalize mapping | Controller katmanında `dto.normalizedScreens` içinden `code ?? screenCode` map’leyerek legacy + canonical uyumluluğu sağlamak | Düşük | Bu hunk faz dışı bağımlılık içermez; sadece mevcut kullanıcı izin endpointinin request body normalizasyonunu iyileştirir. |
| `apps/backend/src/modules/users/users.controller.ts` | `PUT :id/insurance-company-scopes` route ekleme | Frontend’in zaten çağırdığı ama backend’de eksik olan route’u minimal şekilde expose etmek | Düşük | Bu hunk faz dışı bağımlılık içermez; mevcut users modülü içinde yeni tablo veya schema değişikliği olmadan servis metodunu dışarı açar. |
| `apps/backend/src/modules/users/users.service.ts` | `upsertScreenPermissions` defensive normalize uyumu | Controller’dan gelen normalize ekran listesini güvenli işlemek; boş/tekrarlı girdilerde istikrarlı davranmak | Düşük | Bu hunk faz dışı bağımlılık içermez; yalnızca ekran izni yazım yoluna odaklanır, role-switch cleanup veya diğer kullanıcı alt modellerine dokunmaz. |
| `apps/backend/src/modules/users/users.service.ts` | `updateInsuranceCompanyScopes(userId, insuranceCompanyIds)` minimal servis metodu | Kullanıcının sigorta şirketi scope kayıtlarını sil-yeniden-yaz yaklaşımıyla güncellemek; UUID varlığını doğrulamak | Düşük-Orta | Bu hunk faz dışı bağımlılık içermez; mevcut `userInsuranceCompanyScope` ve `insuranceCompany` tablolarını kullanır, migration veya seed istemez. |
| `apps/web/src/app/panel/kullanicilar/page.tsx` | create/edit submit bloklarında canonical `screens` payload | Kullanıcılar ekranında `field_staff` için `{ screens: [{ code, canView }] }` çağrısını netleştirmek | Düşük | Bu hunk faz dışı bağımlılık içermez; büyük UI refactor, scope mimarisi veya Türkçeleştirme gerektirmez. |
| `apps/web/src/app/panel/kullanicilar/page.tsx` | create/edit submit bloklarında insurance scope çağrısı | `insurance_company_user` için `{ insuranceCompanyIds }` ile minimal yan çağrıyı korumak | Düşük | Bu hunk faz dışı bağımlılık içermez; nested memberships, responsibility assignments veya ek form mimarisi gerektirmez. |
| `apps/web/src/app/panel/ayarlar/kurulum/page.tsx` | create/edit submit bloklarında canonical `screens` payload | Kurulum ekranında aynı canonical ekran izin payload’ını kullanmak | Düşük | Bu hunk faz dışı bağımlılık içermez; yalnızca API çağrı shape’ini hizalar, büyük görsel refactor gerektirmez. |
| `apps/web/src/app/panel/ayarlar/kurulum/page.tsx` | create/edit submit bloklarında insurance scope çağrısı | Kurulum ekranında sigorta şirketi scope çağrısını minimal tutmak | Düşük | Bu hunk faz dışı bağımlılık içermez; yalnızca mevcut form state’den yan endpoint çağrısı yapar. |
| `apps/web/src/app/panel/kullanicilar/[id]/page.tsx` | detay ekranı save payload’ında canonical `screens[].code` kullanımı | Detay ekranı ile create/edit ekranlarının aynı canonical kontratta buluşmasını sağlamak | Düşük | Bu hunk faz dışı bağımlılık içermez; yalnızca payload alan adını standartlaştırır. |

### İdeal Patch’e Bilinçli Olarak Dahil Edilmeyecekler

- nested department memberships
- responsibility assignments
- role switch cleanup
- `isPrimary` validasyonu
- büyük UI refactor
- Türkçeleştirme
- Jest `moduleNameMapper`
- ServiceType düzeltmesi
- schema/migration/seed/generate değişiklikleri

### Patch Sınırı

İdeal temiz patch, users modülünde yalnızca route/DTO/service seviyesi minimal eklemeleri ve web tarafında yalnızca çağrı payload hizalamasını içermelidir. Aynı dosyalarda mevcut olan fakat Faz 1 dışı tüm hunklar bu patch’in dışında kalmalıdır.

## 2. Typecheck Karar Planı

ServiceType typecheck blocker, Faz 1 patch’ine karıştırılmamalıdır. Bu bölüm sadece karar planıdır.

### Kök Neden Adayları

1. stale Prisma client
2. `schema.prisma` ile client tipi arasında uyumsuzluk
3. doğrudan service kodu eksikliği

### Generate veya Schema Değişikliği Yapmadan Doğrulama Adımları

1. `apps/backend/prisma/schema.prisma` içinde `model ServiceType` tanımını kontrol et
   - `name`, `description`, `isActive`, `sortOrder` alanlarını doğrula
   - `code` alanı var mı, yok mu netleştir
2. `apps/backend/src/modules/service-types/service-types.service.ts` içinde satır 35 ve 71 çevresini kontrol et
   - `create()` içinde `prisma.serviceType.create({ data: ... })` payload’ında hangi alanlar gönderiliyor bak
   - `seed()` içinde varsayılan kayıtlar için hangi alanlar yazılıyor bak
3. `node_modules/.prisma/client` veya `apps/backend/node_modules/.prisma/client` var mı kontrol et
   - client’ın varlığı/yokluğu ayrı bir sinyal olarak not edilir
   - fakat generate çalıştırılmaz

### Mevcut Kanıta Göre En Güçlü Kök Neden

En güçlü kök neden **service kodu ile beklenen Prisma client tipi arasında uyumsuzluk** görünmektedir.

Gerekçe:

- `schema.prisma` içindeki görünen `ServiceType` modelinde `code` alanı yok
- `service-types.service.ts` içindeki `create()` ve `seed()` akışı da `code` göndermiyor
- buna rağmen önceki raporda typecheck hatası `code` alanının zorunlu olduğuna işaret ediyorsa, en güçlü açıklama çalışma anındaki Prisma tiplerinin schema ile senkron olmaması veya repoda farklı üretilmiş client artığı bulunmasıdır

### Karar

- Faz 1 patch’ine **dokunulmayacak**
- önce salt teşhis yapılacak
- eğer Prisma client gerçekten `code` bekliyorsa, bu problem ayrı bir onayla ele alınmalı

### Ayrı Onay Gerekiyor mu?

**Evet.** Schema değişikliği veya Prisma generate gerektiren her adım için ayrıca onay gerekir.

## 3. Smoke Test Planı

Bu plan local veya staging ortamında çalıştırılmak üzere tasarlanmıştır. Amaç yalnızca Faz 1 patch kapsamını doğrulamaktır.

| # | Senaryo | Adımlar | Beklenen Sonuç | Risk |
|---|---|---|---|---|
| 1 | insurance-company-scopes valid | 1) Geçerli bir kullanıcı ID seç. 2) Geçerli bir sigorta şirketi UUID’si seç. 3) `PUT /users/:id/insurance-company-scopes` isteğini `{ \"insuranceCompanyIds\": [\"uuid\"] }` body’si ile gönder. 4) Yanıt body’sini ve tekrar GET eden ekran davranışını kontrol et. | `200` döner; response içinde başarı mesajı ve aynı UUID listesi görünür; kullanıcı scope kaydı oluşur. | Düşük |
| 2 | insurance-company-scopes invalid | 1) Geçerli kullanıcı ID ile isteği gönder. 2) Body’de `{ \"insuranceCompanyIds\": [\"invalid\"] }` kullan. 3) Validation veya servis hatasını gözle. | `400` döner; geçersiz UUID veya geçersiz şirket kimliği mesajı alınır; veri yazılmaz. | Düşük |
| 3 | insurance-company-scopes empty | 1) Mevcut scope’u olan kullanıcı seç. 2) `PUT /users/:id/insurance-company-scopes` isteğini `{ \"insuranceCompanyIds\": [] }` ile gönder. 3) Sonraki okumada scope listesini kontrol et. | `200` döner; kapsam temizlenmiş olur; boş liste idempotent çalışır. | Düşük |
| 4 | screen-permissions legacy | 1) `field_staff` rolündeki kullanıcıyı seç. 2) `PUT /users/:id/screen-permissions` isteğini `{ \"screenPermissions\": [{ \"screenCode\": \"x\", \"canView\": true }] }` ile gönder. 3) Kaydın cevapta ve sonraki GET’te normalize işlendiğini kontrol et. | `200` döner; legacy payload kabul edilir ve canonical matrise yazılır. | Düşük |
| 5 | screen-permissions canonical | 1) Aynı veya başka bir `field_staff` kullanıcısı seç. 2) `PUT /users/:id/screen-permissions` isteğini `{ \"screens\": [{ \"code\": \"x\", \"canView\": true }] }` ile gönder. 3) Sonraki GET ile sonucu kontrol et. | `200` döner; canonical payload doğrudan kabul edilir. | Düşük |
| 6 | GET screen-permissions | 1) Ekran izni yazılmış kullanıcı için `GET /users/:id/screen-permissions?roleCode=...` çağrısı yap. 2) Dönen satırlarda ekran kodu, varsayılanlar ve kullanıcı override’larını karşılaştır. | Doğru matrix döner; rol varsayılanları ve kullanıcı kayıtları tutarlı görünür. | Düşük |
| 7 | Regression users create | 1) Minimum geçerli body ile `POST /users` çağrısı yap. 2) Rol `field_staff` veya `insurance_company_user` değilse yan endpoint çağrısı yapmadan sonucu kontrol et. 3) İsteğe bağlı olarak ilgili rol ile create + yan endpoint zincirini de ayrı dene. | `201` döner; temel kullanıcı oluşturma akışı bozulmaz. | Düşük |
| 8 | Regression users update | 1) Var olan kullanıcı için temel alanları içeren `PUT /users/:id` veya mevcut akışa göre `PATCH /users/:id` çağrısı yap. 2) Ad, soyad, durum gibi temel alanların güncellendiğini doğrula. 3) Ardından gerekirse ilgili yan endpointleri çağır. | `200` döner; temel kullanıcı güncelleme akışı bozulmaz. | Düşük |

### Smoke Test Notları

- Testler hem legacy hem canonical payload’ı ayrı ayrı kapsamalıdır.
- `insurance-company-scopes` testi için en az bir geçerli sigorta şirketi kaydı önceden mevcut olmalıdır.
- Regression senaryoları, Faz 1 patch’in ana `/users` akışını bozmadığını göstermek içindir.

## 4. Açık Yasak Beyanı

Bu çalışma kapsamında aşağıdaki aksiyonlar **yapılmadı**:

- Deploy yapılmadı
- Rebuild yapılmadı
- Recreate yapılmadı
- Migration yapılmadı
- Seed yapılmadı
- Prisma generate çalıştırılmadı
- Schema değişikliği yapılmadı
- ServiceType mini patch uygulanmadı
- Production test verisi temizlenmedi/değiştirilmedi
- Faz 2 açılmadı

## Sonuç

Kapı 1 için önerilen temiz Faz 1 patch, users modülünde yalnızca `screen-permissions` normalize desteği ile `insurance-company-scopes` route/service/DTO akışını ve frontend’de yalnızca minimal canonical payload çağrılarını kapsamalıdır. ServiceType typecheck konusu bu patch’e katılmamalı; yalnızca ayrı karar akışı olarak ele alınmalıdır.
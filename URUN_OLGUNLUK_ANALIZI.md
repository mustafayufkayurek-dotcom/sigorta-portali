# ÜRÜN OLGUNLUK ANALİZİ

## 1. Yönetici Özeti

Bu repo, sigorta hasar onarım operasyonunu uçtan uca dijitalleştirmeyi hedefleyen, kapsamı giderek büyümüş bir monorepo ürünüdür. Ürün; web paneli, mobil uygulama ve kapsamlı bir NestJS API ile yalnızca “hasar dosyası yönetimi” değil, eksper portalı, sigorta portalı, acil yardım, finans, raporlama, sözleşme, tedarikçi ve evrak süreçlerini de kapsayan geniş bir operasyon platformuna dönüşmüştür.

Mevcut tabloya göre ürün olgunluk seviyesi **özellik kapsamı açısından yüksek**, ancak **ürün modeli tutarlılığı, yetki tasarımı, veri modeli disiplini, test güvencesi ve bakım sürdürülebilirliği açısından orta düzeyde** görünmektedir. Kod tabanı, gerçek iş problemlerini çözebilen zengin fonksiyonlar içeriyor; ancak ürünün çekirdek modeli ile ekran bazlı büyüme arasında belirgin bir gerilim oluşmuş durumdadır.

### En kritik 5 risk

1. **Yetki modelinin parçalı ve tutarsız olması**
   - Backend guard, seed rol/izinleri, shared enum’lar ve frontend route erişimleri aynı rol sözlüğünü kullanmıyor.
   - Sonuç: yanlış erişim, görünür ama çalışmayan ekranlar, güvenlik açığı veya operasyonel karışıklık.

2. **İş kurallarının önemli kısmının frontend’e sızmış olması**
   - Route erişim kontrolü, role fallback, JWT payload okuma ve bazı görünürlük kuralları istemci tarafında kurgulanmış.
   - Sonuç: backend ile UI arasında davranış ayrışması, bypass riski, bakım maliyeti artışı.

3. **Veri modelinde yoğun `Cascade` kullanımı nedeniyle kritik veri kaybı riski**
   - Prisma şemasında pek çok operasyonel ilişki `onDelete: Cascade` ile tanımlı.
   - Sonuç: ana kayıt silmelerinde tarihçe, belge, görev, not, atama ve finans verisinin zincirleme kaybı.

4. **Dokümantasyon, seed ve kod gerçekliği arasında sapma**
   - README ile seed admin hesabı farklı; dokümanlarda rol ve yetki tanımları kodla birebir örtüşmüyor; `document_types` için ayrı seed SQL var.
   - Sonuç: kurulum, denetim, onboarding ve dış değerlendirme süreçlerinde yanlış varsayımlar.

5. **Test güvencesinin çok zayıf olması**
   - Repo çapında test altyapısı kağıt üzerinde var; fiilen görünen test kapsamı çok sınırlı.
   - Sonuç: regresyon riski yüksek, özellikle yetki, workflow, seed, migration ve portal akışlarında güven düşük.

---

## 2. Ürün Modeli

### 2.1 Projenin amacı ve mevcut ürün tanımı

Proje, temelde sigorta şirketleri adına yürütülen hasar operasyonunun dijital yönetimi için geliştirilmiş bir platformdur. Başlangıç çekirdeği “hasar dosyası açma, atama, saha/eksper süreci, onarım ve finans kapanışı” gibi akışlardan oluşurken, zaman içinde sistem şu alanlara genişlemiştir:

- hasar dosyası yaşam döngüsü
- acil yardım vakaları
- eksper portalı
- sigorta şirketi portalı
- müşteri ve tedarikçi yönetimi
- evrak ve dosya yönetimi
- finans/P&L katmanı
- raporlama ve analitik
- sözleşme ve onay akışları
- mobil saha operasyonu

Bu nedenle ürün artık tekil bir CRUD panel değil; **operasyon yönetim platformu** niteliği taşımaktadır. Ancak bu genişleme, bazı yerlerde ortak ürün modelinden çok ekran bazlı büyüme şeklinde ilerlemiştir.

### 2.2 Hedef kullanıcılar ve roller

İstenen analiz kapsamındaki iş kullanıcıları:

- **admin**
  - sistemin tam yetkili yöneticisi
  - ayarlar, kullanıcılar, güvenlik, operasyon ve finans dahil tüm alanlara erişim beklentisi var

- **expert / adjuster / eksper kullanıcıları**
  - repo içinde iki farklı eksper kavramı bulunuyor:
    - iç operasyon tarafında `adjuster`
    - portal tarafında `expert`
  - bu ayrım ürün modeli açısından kritik bir kavram çakışmasıdır

- **field_staff**
  - sahada görev yapan kullanıcı
  - kendisine atanmış dosyalar, notlar, bazı maliyet kısıtlamaları, konum/ziyaret akışları ile sınırlı çalışması bekleniyor

- **office_staff**
  - dosya açma, koordinasyon, evrak ve günlük operasyon işlemlerini yapan kullanıcı

Ek olarak kod tabanında görülen diğer roller:

- `manager`
- `finance`
- `accountant`
- `viewer` beklentisi var ancak ortak enumlarda görünmüyor
- `super_admin` beklentisi var ancak gerçek seed/enum akışında görünür değil
- `insurance_company_user`

### 2.3 Yetki yapısı ve erişim kuralları

Sistem kağıt üzerinde backend merkezli RBAC kullanıyor:

- JWT doğrulama
- `JwtAuthGuard`
- `PermissionsGuard`
- `AgreementGuard`
- rol → permission eşleşmeleri
- ekran izinleri (`ScreenPermission`)

Ancak fiili durum daha karmaşık:

1. **Backend**
   - JWT guard kullanıcıyı DB’den yükleyip permission listesini request’e koyuyor.
   - Permission guard önce DB permission’larını, yoksa default rol fallback’lerini kullanıyor.

2. **Frontend**
   - `panel/layout.tsx` içinde ayrıca role tabanlı route ve navigation görünürlüğü tanımlanmış.
   - Bu listeler DB permission sisteminden bağımsız ikinci bir yetki katmanı oluşturuyor.

3. **Çelişki örnekleri**
   - frontend bazı yerlerde `FINANS`, bazı yerlerde `accountant`, bazı yerlerde lowercase role code kullanıyor
   - shared enum’larda `finance` var, fakat layout’ta `FINANS` string’i de kullanılıyor
   - seed’de `adjuster` ve `expert` ayrı; README’de roller daha farklı listelenmiş
   - bazı controller’larda `settings.manage`, `system.manage`, `audit_log.view` gibi permission’lar kullanılıyor; seed’de bu permission’ların tamamı görünür değil

Bu nedenle yetki sistemi tasarım olarak güçlü görünse de uygulamada **tek kaynaklı gerçeklikten uzak**.

### 2.4 Ana iş akışları

#### A. Dosya açma
- ofis veya yetkili kullanıcı hasar dosyası oluşturur
- sigorta şirketi, poliçe, hasar numarası, ürün branşı, kayıp tipi, tarih bilgileri girilir
- dosya numarası kullanıcı tarafından serbest formatta manuel girilir; backend'de yalnızca benzersizlik kontrolü yapılır (otomatik üretim veya format zorunluluğu yoktur)
- gerekirse adres kaydı otomatik oluşturulur
- dosya atamaları ve bildirimler tetiklenebilir

#### B. İhbar / claim subject akışı
- ihbar konusu `claim_subjects` üzerinden yönetilir
- yeni domain ayrıştırma ile departman ilişkisi eklenmiştir
- ihbar konusu ile departman ve hizmet tipi arasında ilişki kurma ihtiyacı vardır
- eski `departmentFileSubject` ile yeni `claimSubject` modelinin bir süre birlikte yaşadığı görülüyor

#### C. Departman yönlendirme
- son geliştirmeler, claim subject → department ayrıştırmasına işaret ediyor
- kullanıcıların çoklu departman üyelikleri (`UserDepartmentMembership`) ve sorumluluk atamaları (`ClaimResponsibilityAssignment`) tanımlanmış
- bu yapı ürün açısından olumlu bir olgunlaşma sinyali, ancak eski alanlarla birlikte geçiş karmaşası oluşturuyor

#### D. Eksper süreci
- iç operasyon eksper yönetimi (`adjusters`) var
- dış/portal eksper kullanıcı akışı (`expert`) var
- randevu, saha ziyareti, check-in/out, rapor gönderme, onay akışları mevcut
- onarım raporu ekranı ve dış onay süreci oldukça gelişmiş

#### E. Evrak süreci
- klasik documents yapısı
- file documents yapısı
- document types tanımları
- entity documents
- vendor documents
- public token ile evrak erişim akışları

Bu, ürünün evrak tarafında zaman içinde katmanlanmış bir modele geçtiğini gösteriyor.

#### F. Raporlama
- dashboard KPI’ları
- finansal raporlar
- dosya performansı
- personel performansı
- eksper raporları
- SLA ve analitik ekranları

Raporlama kapsamı güçlü; ancak yetki ve veri kalitesi tutarlılığı bu çıktının güvenilirliğini etkileyebilir.

### 2.5 Tüm ekranlar ve ekran aileleri

Kod tabanında yaklaşık 90+ `page.tsx` route’u vardır. Ekranlar aile bazında şu şekilde gruplanabilir:

#### Genel ve giriş
- `/`
- `/giris`
- `/giris/sifre-sifirla`

#### Public token akışları
- `/anket/[token]`
- `/ekstre/[token]`
- `/evrak/[token]`
- `/onay/[token]`
- `/sozlesme/[token]`

#### Ana panel
- `/panel`
- `/panel/profil`
- `/panel/harita`
- `/panel/operasyon`
- `/panel/carilerim`
- `/panel/ozel-dosyalar`
- `/panel/sahiplik`

#### Hasar dosyaları
- `/panel/hasar-dosyalari`
- `/panel/hasar-dosyalari/yeni`
- `/panel/hasar-dosyalari/[id]`
- `/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]`

#### Acil yardım
- `/panel/acil-yardim`
- `/panel/acil-yardim/yeni`
- `/panel/acil-yardim/[id]`
- `/panel/acil-yardim/finans`
- `/panel/acil-yardim/finans/faturalar`

#### Müşteri / tedarikçi / eksper
- `/panel/musteriler`
- `/panel/musteriler/[id]`
- `/panel/tedarikciler`
- `/panel/tedarikciler/[id]`
- `/panel/eksperler`
- `/panel/eksperler/[id]`

#### Kullanıcı ve personel
- `/panel/kullanicilar`
- `/panel/kullanicilar/[id]`
- `/panel/personel-yonetimi`

#### Finans
- `/panel/finans`
- `/panel/finans/faturalar`
- `/panel/finans/tahsilatlar`
- `/panel/finans/fatura-talepleri`
- `/panel/finans/dosya-pl`
- `/panel/finans/portfolyo-pl`
- `/panel/finans/sabit-giderler`
- `/panel/finans/karlilik`
- `/panel/finans/banka-hesaplari`
- `/panel/finans/masraflar`

#### Raporlar
- `/panel/raporlar/brans-analizi`
- `/panel/raporlar/dosya-performansi`
- `/panel/raporlar/personel-performansi`
- `/panel/raporlar/finansal`
- `/panel/raporlar/eksper`
- `/panel/raporlar/sla`

#### Revizyon ve itiraz
- `/panel/revizyon-talepleri`
- `/panel/revizyon-talepleri/[id]`
- `/panel/itirazlar`

#### Güvenlik ve audit
- `/panel/guvenlik`
- `/panel/guvenlik/erisim-loglari`
- `/panel/admin/audit-logs`

#### Ayarlar
- departmanlar
- dosya konuları
- ihbar konuları
- hizmet türleri
- hizmet branşları
- evrak türleri
- roller
- tanımlar
- fiyat yönetimi / fiyat listesi
- bölgesel zamlar
- iş grupları
- mahalle/mahaller
- müşteri tipleri
- ilişki türleri
- mail kurulumu / e-posta / SMS bildirimleri
- entegrasyonlar
- kurulum
- sözleşmeler / sözleşme şablonları / rapor şablonları

#### Portallar
- eksper portal
- sigorta portal

### 2.6 Kritik kavram sözlüğü

- **dosya / claim file**
  - çekirdek operasyon nesnesi
  - hasar işinin ana kaydı

- **ihbar**
  - dosyanın doğmasına neden olan bildirim/olay
  - ürün içinde kimi yerde `claim subject`, kimi yerde dosya konusu, kimi yerde departman dosya konusu ile temsil ediliyor

- **hizmet türü**
  - operasyonun sunulan servis kategorisi
  - çekirdek kavram olması gerekirken yetki ve ayar uçları tam oturmamış

- **ihbar konusu / claim subject**
  - işin türsel konusu
  - departman yönlendirmesiyle ilişkili yeni çekirdek kavram

- **departman**
  - organizasyonel ve operasyonel ayrım noktası
  - son dönemde modelin merkezine alınmaya başlanmış

- **eksper**
  - hem iç adjuster kaydı hem dış portal kullanıcısı anlamında kullanılıyor
  - kavram çakışması var

- **sigorta şirketi**
  - iş veren / müşteri kurum / entegrasyon partneri benzeri çekirdek aktör

- **evrak türü**
  - belge süreçlerinin standardizasyonu için lookup tablosu
  - seed eksikliği ürün güvenilirliğini etkiliyor

### 2.7 Kavram çakışmaları

En belirgin çakışmalar:

1. **adjuster vs expert**
   - biri operasyonel kişi/varlık
   - diğeri portal rolü
   - kullanıcı açısından aynı “eksper” gibi algılanıyor

2. **claim subject vs department file subject**
   - eski/yeni model birlikte bulunuyor
   - geçiş sürüyor

3. **document / file document / entity document / vendor document**
   - belge sistemi yatay bir çekirdeğe oturmaktan çok kullanım bağlamına göre çoğalmış

4. **role setleri**
   - README, shared enum, seed, frontend route guard ve kullanıcı beklentisi birebir aynı değil

### 2.8 Sektör dışına taşınabilirlik değerlendirmesi

Ürün mantığı yalnızca sigortacılık için yazılmış değil; aslında “olay → dosya → atama → saha/uzman → evrak → finans → kapanış” akışı taşıyan daha genel bir servis operasyon motoruna benziyor. Ancak sigortacılık terimleri halen çekirdeğe önemli ölçüde gömülü:

- `insuranceCompany`
- `policyNo`
- `claimNo`
- hasar / eksper / sigorta portalı isimlendirmeleri

Yani ürün mimarisi **sektör dışına taşınabilir**, fakat mevcut domain dili çekirdekte yoğun biçimde sigorta odaklı.

---

## 3. Teknik Mimari

### 3.1 Genel yapı

Monorepo bileşenleri:

- `apps/backend`: NestJS API
- `apps/web`: Next.js 14 App Router yönetim paneli
- `apps/mobile`: Expo tabanlı mobil uygulama
- `packages/shared`: ortak enum, tip ve zod şemaları

Altyapı:

- PostgreSQL
- Redis
- MinIO / S3 uyumlu storage
- Nginx reverse proxy
- Docker Compose / VPS deploy

### 3.2 Frontend yapısı

Frontend App Router yapısı üzerine kurulmuş. Route sayısı yüksek ve doğrudan ekran bazlı büyümüş durumda.

#### Güçlü yönler
- zengin ekran kapsamı
- portal ayrımı mevcut
- ortak UI/component kullanımı var
- `api-client` ile ortak fetch katmanı kurulmuş

#### Zayıf yönler
- bazı ekranlarda doğrudan `localStorage` token okuma ve manuel auth header oluşturma yaygın
- route erişimi `layout.tsx` içinde ayrıca kodlanmış
- rol kodları string olarak dağılmış
- bazı büyük sayfalar çok şişkin; ör. hasar dosyası detay ekranı

#### Form ve state yapısı
- react-hook-form bazı yerlerde kullanılıyor
- birçok sayfada ekran içi state yönetimi yoğun
- yerel modals, fallback’ler, manuel axios kullanımları mevcut

### 3.3 Backend yapısı

Backend modüler NestJS mimarisi kullanıyor ve modül sayısı çok yüksek. Bu durum iki yönlü okunabilir:

#### Olumlu
- domain ayrıştırma niyeti var
- controller/service ayrımı korunuyor
- Swagger, filter, guard, storage, audit gibi kesitsel konular düşünülmüş

#### Riskli
- modül sayısı ürün çekirdeğinden hızlı büyümüş
- permission sözlüğü ile modüllerin kullandığı permission kodları tam hizalı değil
- bazı modüller gerçek bounded context yerine ekran ihtiyacına göre eklenmiş izlenimi veriyor

#### Öne çıkan backend alanları
- auth
- users / rbac
- claim-files
- claim-subjects
- claim-responsibilities
- departments
- documents / file-documents / uploads
- repair-reports
- finance
- emergency
- analytics / dashboard
- surveys / agreements / vendor statements / contracts

### 3.4 Backend endpoint yapısı

Dokümantasyon ve controller yapısına göre sistem geniş bir REST yüzeyi sunuyor:

- auth
- users
- roles / permissions
- insurance companies
- claim files
- tasks
- notes
- documents
- uploads
- notifications
- adjusters
- repair reports
- departments
- claim subjects
- document types
- finance
- emergency
- analytics
- search
- surveys

Risk burada endpoint çokluğundan çok, **aynı iş alanı için birden fazla model ve izin yolunun bulunması**.

### 3.5 Veritabanı modeli

Prisma şeması büyük ve operasyonel kapsamı yüksek. Ana alanlar:

#### Çekirdek tablolar
- `users`
- `roles`
- `permissions`
- `role_permissions`
- `claim_files`
- `claim_statuses`
- `customers`
- `addresses`
- `tasks`
- `notes`
- `file_assets`
- `audit_logs`

#### Domain genişletme tabloları
- `departments`
- `claim_subjects`
- `department_file_subjects`
- `user_department_memberships`
- `claim_responsibility_assignments`
- `document_types`
- `file_documents`
- `screen_permissions`
- `service_types`
- `emergency_cases`

#### İlişki yapısı değerlendirmesi

Olumlu taraf:
- veri modeli ürünleşme eğilimi gösteriyor
- lookup ve bağlamsal tablolar ayrıştırılmış
- kullanıcı, departman ve sorumluluk ekseni büyütülmüş

Zayıf taraf:
- çok sayıda ilişki doğrudan `Cascade`
- geçiş dönemi alanları aynı anda taşınıyor
- bazı alanlar backward compatibility için yaşamaya devam ediyor
- veri modeli güçlü ama aşırı geniş; çekirdek ile genişleme katmanları daha net ayrılmalı

### 3.6 FK ve iş alanları

`claim_files` tablosunda aşağıdaki alanlar tanımlıdır; ancak **tümü zorunlu değildir**. Hangi alanların hangi rol/ekran/senaryo için zorunlu olacağı ayrıca rol bazlı iş akışı analiziyle belirlenmelidir:

- `insuranceCompanyId` — şu an opsiyonel, kullanıcı/eksper manuel seçer
- `policyNo` — opsiyonel
- `claimNo` — opsiyonel
- `productBranch` — opsiyonel
- `lossType` — opsiyonel
- `incidentDate`
- `notificationDate`
- `currentStatusId`

Bu olumlu. Ancak ürünün geleceği için aşağıdaki alanlar kritik:

- departman
- claim subject
- sorumlu kullanıcı / sorumlu rol
- evrak tamamlama durumu
- rapor/onay durumları

Bu alanların bir bölümü sonradan eklenmiş ve henüz tam konsolide görünmüyor.

### 3.7 Auth, JWT, guard ve rol sistemi

Auth yapısı teknik olarak doğru temellere sahip:

- JWT access token
- refresh token
- blacklist desteği
- global guard zinciri
- agreement zorunluluğu

Ancak riskler:

1. **JWT + localStorage**
   - web tarafında access token localStorage’da tutuluyor
   - XSS etkisi büyürse oturum güvenliği zedelenir

2. **role fallback mantıkları**
   - backend ve frontend ikili fallback yapıları kullanıyor
   - auth gerçeği ile UI gerçeği ayrışabiliyor

3. **permission sözlüğü eksikleri**
   - bazı controller’lar `settings.manage`, `system.manage`, `audit_log.view` istiyor
   - seed’de görünen permission listesi bu seviyeyi tam karşılamıyor

### 3.8 Dosya / evrak yönetimi

Sistemde en az dört belge ekseni mevcut:

- `documents`
- `file_documents`
- `entity_documents`
- `vendor_documents`

Artı olarak:

- `file_assets`
- upload / storage katmanı
- public token erişim endpoint’leri

Bu tasarım, ihtiyaçların büyüdüğünü gösteriyor ancak aynı zamanda belge modelinin yekpare bir çekirdeğe oturmadığını düşündürüyor. Evrak türleri (`document_types`) bu yapıyı standardize etmesi gereken lookup tablosu; seed eksikliği burada doğrudan operasyonel sorun yaratır.

### 3.9 Entegrasyon yapısı

#### Redis
- cache ve token blacklist amaçlı kullanılıyor
- rate limit ve kuyruk altyapısında da etkisi var

#### MinIO / S3
- dosya depolama soyutlaması var
- local uploads + S3 compatible storage birlikte düşünülmüş

#### Sentry
- backend ve web için init kodu mevcut

#### SMTP
- e-posta akışları var

#### Nginx / Docker Compose
- production compose ve reverse proxy standardı tanımlı

Bu, altyapı olgunluğunun kötü olmadığını; ama ürün mantığının altyapıdan daha hızlı büyüdüğünü gösteriyor.

---

## 4. Risk Matrisi

### 4.1 Risk: Yetki modelinde çoklu gerçeklik
- **Neden önemli**
  - erişim ve görünürlük kuralları birden fazla yerde tutuluyor
- **Mevcut belirti veya kanıt**
  - frontend `panel/layout.tsx` içinde route bazlı rol kontrolü var
  - backend `PermissionsGuard` içinde DB permission + fallback mantığı var
  - shared enum, seed ve README rol setleri birebir aynı değil
- **Olası etki**
  - güvenlik açığı, yanlış yönlendirme, görünür ama çalışmayan ekran, destek maliyeti
- **Düzeltme önerisi**
  - tek kanonik rol ve permission sözlüğü oluştur
  - frontend navigation görünürlüğünü backend’den gelen ekran izinleriyle birleştir
  - string literal role kullanımını kaldır
- **Test/kabul kriteri**
  - her rol için backend ve frontend erişim matrisi otomatik doğrulanmalı
  - bir ekran görünüyorsa ilgili API permission’ı da aynı sonucu vermeli
- **Öncelik**
  - **Kritik**

### 4.2 Risk: Permission kodlarının seed/controller uyumsuzluğu
- **Neden önemli**
  - controller bir permission ister, seed bu permission’ı üretmezse ekranlar beklenmedik şekilde kırılır
- **Mevcut belirti veya kanıt**
  - `service-types.controller` `system.manage` istiyor
  - `report-templates.controller` ve `damage-repair-templates.controller` `settings.manage` istiyor
  - görünen seed permission listesinde bu sözlük eksik
  - `audit-logs.controller` `audit_log.view` istiyor
- **Olası etki**
  - yönetim ekranlarının erişilememesi, prod’da gizli yetki hataları, fallback ile davranış sapması
- **Düzeltme önerisi**
  - permission registry oluştur
  - controller decorator’ları build-time veya startup validation ile denetle
- **Test/kabul kriteri**
  - her kullanılan permission kodu seed/registry içinde bulunmalı
- **Öncelik**
  - **Kritik**

### 4.3 Risk: Cascade delete ile veri kaybı
- **Neden önemli**
  - operasyonel verilerde audit, history, belge ve finans izlerinin korunması gerekir
- **Mevcut belirti veya kanıt**
  - Prisma şemasında çok sayıda `onDelete: Cascade` ilişkisi var
  - claim file silinince bağlı not, görev, history, belge, rapor vb. veriler silinebilir
- **Olası etki**
  - veri kaybı, denetim izi kaybı, finans ve süreç geçmişinin bozulması
- **Düzeltme önerisi**
  - çekirdek operasyon nesnelerinde hard delete yerine soft delete yaklaşımı
  - kritik ilişkilerde `Restrict`/`SetNull` stratejisini yeniden değerlendir
- **Test/kabul kriteri**
  - kritik varlıklarda silme senaryoları veri kaybı matrisiyle test edilmeli
- **Öncelik**
  - **Kritik**

### 4.4 Risk: İş kurallarının frontend’e sızması
- **Neden önemli**
  - kurallar backend yerine UI’da ise sistem güvenilirliği düşer
- **Mevcut belirti veya kanıt**
  - route erişimi `layout.tsx` içinde
  - çeşitli sayfalarda JWT payload fallback ve role-based görünürlükler var
  - localStorage tabanlı kullanıcı/rol okuma yaygın
- **Olası etki**
  - bypass, tutarsız davranış, bakım maliyeti, mobil/web ayrışması
- **Düzeltme önerisi**
  - tüm kritik kural ve erişim kararlarını backend API’ye taşı
  - frontend yalnızca backend kararını yansıtsın
- **Test/kabul kriteri**
  - UI görünürlük kararları backend’den gelen permission/screen policy ile üretilebilmeli
- **Öncelik**
  - **Yüksek**

### 4.5 Risk: Ürün modeli yerine ekran birikimi
- **Neden önemli**
  - ekranlar çoksa ama çekirdek model net değilse gelişim maliyeti artar
- **Mevcut belirti veya kanıt**
  - 90+ route
  - aynı problem alanı için çoklu belge, çoklu eksper, çoklu konu yapısı
- **Olası etki**
  - eğitim maliyeti, kavram kirliliği, yeni özellik ekleme zorluğu
- **Düzeltme önerisi**
  - domain map ve bounded context sadeleştirmesi
  - ana varlık sözlüğü çıkarıp ekranları buna bağla
- **Test/kabul kriteri**
  - her ekranın tek bir ürün capability haritasına bağlanabilmesi
- **Öncelik**
  - **Yüksek**

### 4.6 Risk: `document_types` seed eksikliği
- **Neden önemli**
  - evrak standardizasyonu yoksa belge süreçleri bozulur
- **Mevcut belirti veya kanıt**
  - repo içinde `document_types_seed.sql` var
  - bilinen durum olarak tabloda 0 kayıt olduğu belirtilmiş
- **Olası etki**
  - evrak yükleme/filtreleme/zorunlu belge mantığında bozulma
- **Düzeltme önerisi**
  - seed’i ana seed akışına al
  - zorunlu belge senaryolarını startup health check ile doğrula
- **Test/kabul kriteri**
  - boş `document_types` ile sistem kritik evrak ekranlarını açmamalı veya açık uyarı vermeli
- **Öncelik**
  - **Yüksek**

### 4.7 Risk: Kurulum dokümantasyonu ile gerçek seed hesaplarının farklı olması
- **Neden önemli**
  - operasyon, demo, denetim ve test başlangıçları yanlış hesapla yapılır
- **Mevcut belirti veya kanıt**
  - README varsayılan admin `admin@example.com`
  - seed’de admin kullanıcısı `admin@meridyenassistance.com`
- **Olası etki**
  - onboarding hatası, zaman kaybı, yanlış alarm
- **Düzeltme önerisi**
  - dokümantasyon tek kaynaktan üretilmeli
- **Test/kabul kriteri**
  - README, seed ve deploy smoke script aynı login bilgisini kullanmalı
- **Öncelik**
  - **Orta**

### 4.8 Risk: Audit kapsamasının parçalı olması
- **Neden önemli**
  - kritik operasyonlarda kim-ne zaman-ne yaptı izi gerekir
- **Mevcut belirti veya kanıt**
  - audit log modülü var
  - bazı servisler log yazıyor ama sistematik bir bütünlük görünmüyor
  - audit ekranı özel permission gerektiriyor
- **Olası etki**
  - regülasyon ve iç denetim zayıflığı
- **Düzeltme önerisi**
  - hangi varlıklarda zorunlu audit tutulacağı netleştirilmeli
  - merkezi audit policy geliştirilmeli
- **Test/kabul kriteri**
  - claim file, role/user, payment, invoice, document ve assignment işlemleri audit üretmeli
- **Öncelik**
  - **Orta**

### 4.9 Risk: Test eksikliği nedeniyle regresyon
- **Neden önemli**
  - bu kadar geniş ürün alanı manüel doğrulama ile sürdürülemez
- **Mevcut belirti veya kanıt**
  - package script’leri test gösteriyor
  - görünür test örnekleri çok sınırlı, ağırlıkla cache servisi düzeyinde
- **Olası etki**
  - prod regresyonu, permission ve workflow kırılması
- **Düzeltme önerisi**
  - en kritik akışlar için backend entegrasyon ve web smoke testleri
- **Test/kabul kriteri**
  - login, dosya açma, atama, rapor, evrak ve finans temel akışları otomatik doğrulanmalı
- **Öncelik**
  - **Kritik**

### 4.10 Risk: Mobil paket olgunluk farkı
- **Neden önemli**
  - web ve backend ilerlerken mobile geri kalırsa saha süreçleri kopar
- **Mevcut belirti veya kanıt**
  - ayrı mobile paket mevcut
  - typecheck sorunları olduğu bilinen durum olarak verilmiş
- **Olası etki**
  - saha operasyonu kesintisi, veri asimetrisi
- **Düzeltme önerisi**
  - mobile için bağımsız kalite kapısı ve release readiness listesi
- **Test/kabul kriteri**
  - mobile typecheck ve temel akış smoke testleri zorunlu olmalı
- **Öncelik**
  - **Yüksek**

### 4.11 Risk: Performans ve okunabilirlik sorunu yaratan aşırı büyük ekranlar
- **Neden önemli**
  - özellikle detay ekranları büyüdükçe bakım ve hata ayıklama zorlaşır
- **Mevcut belirti veya kanıt**
  - hasar dosyası detay ve onarım raporu sayfaları çok büyük
- **Olası etki**
  - yavaş geliştirme, yan etki riski, render maliyeti
- **Düzeltme önerisi**
  - ekranları feature component’lere böl
  - domain hook/service katmanı oluştur
- **Test/kabul kriteri**
  - büyük ekranlar sekme/özellik bazlı modüllere ayrılmış olmalı
- **Öncelik**
  - **Orta**

### 4.12 Risk: Global hata yönetimi geçmişte kritik bug üretmiş olması
- **Neden önemli**
  - exception handling kusuru request hang gibi ağır sonuçlar üretir
- **Mevcut belirti veya kanıt**
  - GlobalExceptionFilter için kritik bug geçmişi belirtilmiş
  - mevcut filter artık JSON response döndürüyor
- **Olası etki**
  - request kilitlenmesi, kullanıcı timeout, gözlemlenebilirlik kaybı
- **Düzeltme önerisi**
  - filter davranışı için otomatik testler
  - tüm bilinmeyen exception senaryoları için regresyon güvencesi
- **Test/kabul kriteri**
  - throw edilen custom / prisma / generic error’ların tamamı beklenen response üretmeli
- **Öncelik**
  - **Yüksek**

---

## 5. Kritik Sorular Değerlendirmesi

### 5.1 Yazılım ekranlar toplamı mı yoksa gerçek ürün modeli mi?

**Sonuç:** Gerçek bir ürün modeli var, ancak bunun üzerinde zamanla ekran-bazlı büyüme oluşmuş.

Kanıtlar:
- çekirdek veri modeli zengin ve süreç odaklı
- claim file, department, responsibility, repair report, finance, survey, agreement gibi iş kavramları mevcut
- ancak çok sayıda ekran, ayrı belge tipleri, çoklu portal ve tekrarlı erişim kurguları ürün modelini bulanıklaştırıyor

### 5.2 Sigortacılık kavramları sisteme aşırı gömülü mü?

**Sonuç:** Evet, çekirdeğe belirgin ölçüde gömülü; ama tamamen kilitli değil.

Özellikle gömülü alanlar:
- insurance company
- policy no
- claim no
- eksper/sigorta portalı
- hasar terminolojisi

Genelleştirilebilir taraf:
- case/file
- assignment
- field visit
- report
- document workflow
- finance / profitability

### 5.3 Veri modeli iş akışını taşıyabilecek kadar sağlam mı?

**Sonuç:** Evet, taşıyabilecek kadar güçlü; ancak fazla büyümüş, geçiş kalıntıları ve silme riskleri nedeniyle kırılganlık artmış.

### 5.4 Yetki sistemi rolleri gerçekten ayırıyor mu?

**Sonuç:** Tasarım niyeti güçlü, uygulama tutarlılığı zayıf.

Roller teoride ayrışıyor; pratikte:
- frontend role string’leri karışık
- backend permission sözlüğü tam hizalı değil
- fallback’ler fazla

### 5.5 İş kuralları backend’te mi, sadece frontend’te mi?

**Sonuç:** Her ikisinde de var; kritik sorun da bu.

Backend’te:
- validation
- auth
- claim file create kuralları
- field staff erişim sınırı

Frontend’te:
- route access
- token fallback
- bazı görünürlük ve rol yorumları

### 5.6 Audit log, validation, hata yönetimi, test yapısı var mı?

- **audit log:** var ama kapsamı parçalı
- **validation:** var; global `ValidationPipe` ve zod/shared şemalar mevcut
- **hata yönetimi:** var; global filter mevcut, ama kritik bug geçmişi var
- **test yapısı:** teknik altyapı var, kapsam yetersiz

---

## 6. Sektör Dışı Taşınabilirlik

### 6.1 İhbar → Talep / İş Emri / Servis Kaydı

Mevcut `claim file` ve `claim subject` modeli aşağıdaki daha genel modele evrilebilir:

- claim file → case / work order / service record
- claim subject → request type / issue type / service category
- claim status → workflow stage

### 6.2 Eksper → Usta / Teknik Personel / Saha Ekibi

Eksper kavramı sigorta bağlamından çıkarıldığında:

- adjuster → specialist / technician / field assessor
- expert portal → contractor / field partner portal

### 6.3 Sigorta şirketi → Müşteri / Kurum / İş Ortağı

`insuranceCompany` tablosu mantıksal olarak:

- enterprise customer
- contract owner
- business partner

gibi genellenebilir.

### 6.4 Sigortacılığa özel alanlar çekirdeğe gömülü mü, modüler mi?

**Değerlendirme:**
- isimlendirme ve bazı alanlar çekirdeğe gömülü
- ancak mimari modülerleştirmeye müsait

**Modernizasyon yaklaşımı:**
- çekirdek domain: case, assignment, visit, document, approval, billing
- sigortacılık eklentisi: policy, claim no, insurance company, expert wording

Bu ayrım yapılırsa sistem farklı sektörlerde yeniden kullanılabilir.

---

## 7. Mevcut Teknik Borçlar

### 7.1 Tekrar eden hata kaynakları

- role / permission string tutarsızlığı
- fallback mantıklarının çoğalması
- localStorage üzerinden kritik auth/role bilgisi okunması
- büyük sayfalarda feature separation eksikliği
- eski ve yeni domain alanlarının birlikte yaşaması

### 7.2 Bilinen hatalar / zayıflıklar

- GlobalExceptionFilter geçmişte request hang bug’ı üretmiş
- Prisma spread bug geçmişi var
- `document_types` seed eksik
- mobile typecheck sorunları mevcut
- bazı sayfalarda fallback ile sessiz hata yutma eğilimi var

### 7.3 Test altyapısı durumu

- backend test script’i var
- turbo ile repo çapında test script’i var
- pratikte görünen test kapsamı çok sınırlı
- kritik business flow testleri görünür değil

### 7.4 Deploy / migration / seed süreçleri

Olumlu:
- Docker Compose prod yapısı mevcut
- deploy script ve smoke script’ler mevcut
- seed production koruması var

Borç:
- seed ve dokümantasyon uyumsuzlukları
- lookup seed’lerin parçalı olması
- migration ve domain ayrıştırma geçişleri dikkat gerektiriyor

---

## 8. Düzeltme Planı

### 8.1 P1 — Yetki modelini tekilleştir
- **Öncelik:** Kritik
- **Gerekçe:** güvenlik ve ürün davranışı tutarlılığı
- **Kapsam:** rol sözlüğü, permission registry, frontend route erişimi, screen permission entegrasyonu
- **Test kriteri:** tüm roller için ekran + API erişim matrisi aynı sonucu vermeli
- **Onay gerektiren kararlar:** `finance/accountant/viewer/super_admin/expert/adjuster` rollerinin nihai taksonomisi

### 8.2 P1 — Permission sözlüğü denetimini ekle
- **Öncelik:** Kritik
- **Gerekçe:** controller/seed uyumsuzluğu prod kırığı üretir
- **Kapsam:** kullanılan tüm permission kodlarının merkezi registry ile doğrulanması
- **Test kriteri:** bilinmeyen permission kullanan modül build/startup aşamasında fail etmeli
- **Onay gerektiren kararlar:** `settings.manage` ve `system.manage` ayrımı korunacak mı?

### 8.3 P1 — Kritik operasyon verilerinde silme stratejisini yeniden tasarla
- **Öncelik:** Kritik
- **Gerekçe:** veri kaybı ve audit izi kaybı
- **Kapsam:** `claim_files`, rapor, belge, görev, not, finans bağlılıkları
- **Test kriteri:** ana varlık silme simülasyonlarında tarihi veriler korunmalı
- **Onay gerektiren kararlar:** hard delete yasaklanacak mı, soft delete standardı ne olacak?

### 8.4 P1 — Temel regresyon testlerini kur
- **Öncelik:** Kritik
- **Gerekçe:** ürün alanı manuel doğrulamayı aşmış durumda
- **Kapsam:** login, dosya açma, atama, evrak, onarım raporu, finans temel akışları
- **Test kriteri:** CI’da en az çekirdek akışların otomatik doğrulanması
- **Onay gerektiren kararlar:** hangi akışlar release blocker sayılacak?

### 8.5 P2 — Ürün çekirdeğini ekranlardan ayır
- **Öncelik:** Yüksek
- **Gerekçe:** ürün modeli netleşmeden ölçeklenebilirlik zor
- **Kapsam:** domain sözlüğü, capability map, ekran → domain eşleme
- **Test kriteri:** her ekran tek bir yetenek ağacında konumlanabilmeli
- **Onay gerektiren kararlar:** ürün artık sigorta odaklı mı kalacak, yoksa genel servis operasyonuna mı evrilecek?

### 8.6 P2 — Evrak modelini sadeleştir
- **Öncelik:** Yüksek
- **Gerekçe:** belge akışları çekirdeğe dağılmış
- **Kapsam:** document, file document, entity document, vendor document haritası
- **Test kriteri:** belge tipleri, zorunluluk ve erişim kuralları tek merkezden tanımlanmalı
- **Onay gerektiren kararlar:** belge çekirdeği tek tablo mu, çok bağlamsal tablo mu olacak?

### 8.7 P2 — Seed ve kurulum gerçeğini tekilleştir
- **Öncelik:** Orta
- **Gerekçe:** onboarding/doğrulama hataları
- **Kapsam:** README, deploy smoke, seed user, lookup seed’ler
- **Test kriteri:** sıfırdan kurulum dokümanıyla birebir aynı sonuç üretmeli
- **Onay gerektiren kararlar:** demo kullanıcı seti standardize edilecek mi?

### 8.8 P2 — Büyük ekranları modülerleştir
- **Öncelik:** Orta
- **Gerekçe:** bakım maliyeti
- **Kapsam:** özellikle hasar dosyası detay ve onarım raporu ekranları
- **Test kriteri:** ekranlar feature component/hook/service katmanlarına bölünmeli
- **Onay gerektiren kararlar:** UI refactor ayrı iş akışı olarak mı ele alınacak?

### 8.9 P3 — Sektör dışı taşınabilirlik için domain soyutlaması
- **Öncelik:** Orta
- **Gerekçe:** ürünleşme ve yeniden kullanım potansiyeli
- **Kapsam:** claim terminology → generic case model
- **Test kriteri:** sigorta alanları eklenti/modül katmanına ayrılabilmeli
- **Onay gerektiren kararlar:** stratejik ürün yönü

---

## 9. Kritik Dosyalar

Analiz ve modernizasyon için özellikle incelenmesi gereken dosyalar:

### Ürün ve belge kaynakları
- `README.md`
- `YAZILIM_DOKUMANTASYONU.md`
- `ROUTE_INVENTORY.md`
- `BACKLOG.md`
- `DOMAIN_MAPPING.md`
- `IMPLEMENTATION_SUMMARY.md`

### Backend çekirdeği
- `apps/backend/src/main.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/common/guards/jwt-auth.guard.ts`
- `apps/backend/src/common/guards/permissions.guard.ts`
- `apps/backend/src/common/guards/agreement.guard.ts`
- `apps/backend/src/common/filters/global-exception.filter.ts`
- `apps/backend/src/modules/claim-files/claim-files.service.ts`
- `apps/backend/src/modules/claim-subjects/claim-subjects.controller.ts`
- `apps/backend/src/modules/service-types/service-types.controller.ts`
- `apps/backend/src/modules/report-templates/report-templates.controller.ts`
- `apps/backend/src/modules/damage-repair-templates/damage-repair-templates.controller.ts`
- `apps/backend/src/modules/audit-logs/audit-logs.controller.ts`

### Veri modeli
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/seed.ts`
- `apps/backend/prisma/migrations/`
- `docs/sql/document_types_seed.sql`

### Frontend çekirdeği
- `apps/web/src/app/panel/layout.tsx`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/app/panel/hasar-dosyalari/page.tsx`
- `apps/web/src/app/panel/hasar-dosyalari/[id]/page.tsx`
- `apps/web/src/app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx`
- `apps/web/src/components/timeline/ProcessTimeline.tsx`

### Altyapı ve operasyon
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `scripts/deploy.sh`
- `scripts/post-deploy-smoke.sh`
- `scripts/regression-check.sh`

### Mobil uygulama
- `apps/mobile/package.json`
- `apps/mobile/app/`
- `apps/mobile/hooks/useLocationTracking.ts`

---

## 10. Çalıştırma Komutları

### 10.1 Kurulum

```bash
pnpm install
```

### 10.2 Altyapı servisleri

```bash
docker-compose up -d
docker-compose ps
```

### 10.3 Backend migration / seed

```bash
cd apps/backend
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

### 10.4 Uygulamaları çalıştırma

```bash
pnpm dev
```

Ayrı ayrı:

```bash
cd apps/backend && pnpm dev
cd apps/web && pnpm dev
cd apps/mobile && pnpm dev
```

### 10.5 Kalite kontrolleri

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Backend özel:

```bash
cd apps/backend && pnpm test
cd apps/backend && pnpm test:cov
```

### 10.6 Production / smoke

```bash
bash scripts/deploy.sh
bash scripts/post-deploy-smoke.sh
bash scripts/regression-check.sh
```

---

## 11. Karar Soruları

Belirsiz veya yönetim kararı gerektiren başlıklar:

1. **Nihai rol sözlüğü nedir?**
   - `finance`, `accountant`, `viewer`, `super_admin`, `adjuster`, `expert`, `insurance_company_user` nasıl konumlanacak?

2. **Eksper kavramı ikiye mi ayrılacak?**
   - iç operasyonel kaynak (`adjuster`) ve portal kullanıcı (`expert`) kalıcı ayrı kavramlar mı?

3. **Claim subject geçişi tamamlanacak mı?**
   - `departmentFileSubject` tamamen kaldırılacak mı, yoksa hibrit model devam mı edecek?

4. **Belge modeli tekilleştirilecek mi?**
   - `documents`, `file_documents`, `entity_documents`, `vendor_documents` uzun vadede nasıl sadeleşecek?

5. **Ürün stratejisi sigorta odaklı mı kalacak?**
   - yoksa daha genel servis operasyon platformuna mı evrilecek?

6. **Silme politikası ne olacak?**
   - kritik operasyon verileri için hard delete tamamen yasaklanacak mı?

---

## 12. Nihai Değerlendirme

Bu ürün, küçük bir admin panelini aşmış ve ciddi operasyonel derinliği olan bir platform haline gelmiştir. En güçlü yanı, gerçek iş akışlarını kapsayacak kadar zengin veri modeli ve modül kapsamına ulaşmış olmasıdır. En zayıf yanı ise bu büyümenin tek ve net bir ürün çekirdeği etrafında tam konsolide olmamış olmasıdır.

Bugünkü haliyle sistem:

- **çalışan ve değer üreten bir ürün**
- **özellikçe gelişmiş**
- **altyapı olarak fena olmayan**
- fakat **yönetimsel ve mimari sadeleştirme ihtiyacı yüksek** bir yapıdadır

En kritik modernizasyon ihtiyacı, yeni özellik eklemek değil; mevcut sistemi:

- tek rol/izin gerçeğine oturtmak
- veri kaybı riskini azaltmak
- test güvencesi oluşturmak
- ürün modelini ekranlardan ayırmak
- sigortacılığa gömülü kavramları çekirdek ve eklenti katmanlarına bölmek

şeklinde yeniden toparlamaktır.

Bu adımlar atılmazsa ürün büyümeye devam etse bile bakım maliyeti ve hata riski hızla artacaktır. Bu adımlar atılırsa ise sistem yalnızca sigorta hasar yönetimi için değil, daha genel servis operasyon alanları için de güçlü bir platforma dönüşebilir.
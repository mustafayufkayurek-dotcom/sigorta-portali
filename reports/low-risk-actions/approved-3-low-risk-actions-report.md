# Onaylanan 3 Düşük Riskli Aksiyon Raporu

## 1. Yönetici Özeti

- Bu çalışma yalnızca analiz, kanıt toplama, log inceleme ve raporlama kapsamında yürütüldü; kod/deploy/migration/seed/validation/mail ayarı değişikliği yapılmadı.
- Mail akışlarında iki ayrı kaynak modeli tespit edildi: `system-settings` modülü DB içindeki `mail_config` kaydını kullanırken operasyonel e-posta akışlarının büyük kısmı `SMTP_*` environment değişkenlerine bağlı.
- DB tabanlı mail kullanımı yalnızca sistem ayarları ekranındaki `GET/PUT /system-settings/mail-config` ve `POST /system-settings/mail-config/test` akışıyla sınırlı bulundu.
- Operasyonel e-postalar; bildirim servisi, onarım raporu e-posta gönderimi, dış onay e-postası ve anket raporu gönderiminde `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, kısmen `SMTP_FROM` kullanıyor.
- Production DB doğrulamasında `info@safranbh.com` kullanıcısı mevcut, `status=active` ve rolü `expert / Eksper Portalı` olarak bulundu.
- Aynı expert kullanıcı için `claim_responsibility_assignments` tablosunda kayıt bulunmadı; bu durum own-file erişim kapsamını daraltan potansiyel neden olarak raporlandı.
- Verilen SQL komutundaki iki alan production şemasıyla uyuşmadı: `users.is_active` ve `claim_responsibility_assignments.expert_id` kolonları production'da yok; fiili şema `status` ve `user_id` kullanıyor.
- Expert login ve 403 regresyonu production üzerinde doğrulanamadı; görev girdisinde expert parola verilmediği için token üretilemedi ve kullanıcı endpoint denemeleri yapılamadı.
- Son 24 saat ve son 2000 satır backend log taramasında users create/update için 500 istisnası bulunamadı; yalnızca route mapping/başlangıç logları görüldü.
- Frontend payload yapısı ile backend DTO karşılaştırmasında, UI tarafının rol bazlı gizlenen alanları payload'dan sanitize ettiği; ancak users DTO'nun `workflowScopeCodes`, `operationScope`, `screenPermissions`, `insuranceCompanyIds`, `serviceAreas` gibi bazı UI kavramlarını doğrudan kabul etmediği ve bunların ayrı endpointlere dağıtıldığı görüldü. Log kanıtı olmadan 500 kök nedeni PASS seviyesinde ispatlanamadı.

## 2. PASS/FAIL/Beklemede Tablosu

| Aksiyon | Durum | Özet |
| --- | --- | --- |
| Aksiyon 1: Mail Akış Envanteri | PASS | Mail gönderen backend servisleri tarandı ve DB `mail_config` vs `SMTP_*` env kaynak matrisi çıkarıldı. |
| Aksiyon 2: Expert Test Hesabı Doğrulama | Beklemede | Kullanıcının varlığı, rolü ve assignment durumu doğrulandı; parola bilinmediği için login ve 403 regresyonu doğrulanamadı. |
| Aksiyon 3: Users Create/Update Payload Korelasyonu | Beklemede | Frontend payload ve backend DTO incelendi ancak son 24 saat loglarında users 500 exception kanıtı bulunamadı; stale hidden fields ile 500 arasında production log korelasyonu kurulamadı. |

## 3. Aksiyon 1: Mail Akış Envanteri

### Kök Neden
Sistemde mail gönderimi için tek bir merkezi kaynak kullanılmıyor. Yönetimsel mail yapılandırması DB'deki `mail_config` anahtarından okunurken, operasyonel e-posta akışlarının çoğu doğrudan environment üzerinden `SMTP_*` değişkenleriyle çalışıyor.

### Kanıt

#### Mail Akış Matrisi

| Endpoint/Servis | Kaynak (DB/env) | Alanlar | Not |
| --- | --- | --- | --- |
| `GET /api/v1/system-settings/mail-config` | DB | `mail_config` içinden `host`, `port`, `username`, `password`, `security`, `fromName`, `fromEmail` | `SystemSettingsService.getMailConfig()` DB'den okuyor. |
| `PUT /api/v1/system-settings/mail-config` | DB | Aynı alanlar | `SystemSettingsService.setMailConfig()` DB'ye yazıyor; bu görev kapsamında çağrılmadı. |
| `POST /api/v1/system-settings/mail-config/test` | DB | `host`, `port`, `username`, `password`, `security`, `fromName`, `fromEmail` | Test maili akışı DB `mail_config` ile `nodemailer` transport kuruyor. Test tetiklenmedi. |
| `POST /api/v1/repair-reports/:id/send-email` | env | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | `ReportEmailService.sendReport()` env yoksa gönderimi atlıyor. |
| `POST /api/v1/repair-reports/:reportId/send-external-approval` (`channel=email`) | env | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `APP_URL` | `ExternalApprovalsService.sendApprovalEmail()` env tabanlı. |
| `ClaimEventEmailService` olay bazlı e-postalar | env | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL` | Yeni dosya, atama, onay/red, SLA, revizyon, talimat, kapanış bildirimleri `EmailService` üzerinden gidiyor. |
| `SurveyReportService.sendMonthlyReports` | env | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Aylık şirket memnuniyet raporları `EmailService.sendEmail()` ile gönderiliyor. |
| `Notifications EmailService.sendEmail/sendTemplateEmail/sendIfPreferred` | env | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP yoksa `email_log` kaydı failed oluyor, gönderim yapılmıyor. |

#### Dosya Bazlı Kanıt Özeti
- `apps/backend/src/modules/system-settings/system-settings.service.ts`: `get('mail_config')` ile DB okuması ve `sendTestMail()` içinde DB tabanlı transport kurulumu.
- `apps/backend/src/modules/system-settings/system-settings.controller.ts`: `GET/PUT/POST mail-config` endpointleri.
- `apps/backend/src/modules/repair-reports/email/report-email.service.ts`: yalnızca `SMTP_*` env kullanımı.
- `apps/backend/src/modules/external-approvals/external-approvals.service.ts`: dış onay maili için env SMTP kullanımı.
- `apps/backend/src/modules/notifications/email/email.service.ts`: bildirim e-postaları için env SMTP + `SMTP_FROM` kullanımı.
- `apps/backend/src/modules/notifications/email/claim-event-email.service.ts`: çağrı zinciri ile olay bazlı mail akışları.
- `apps/backend/src/modules/surveys/survey-report.service.ts`: aylık rapor mail akışı.

### Production Riski
- Yüksek olmayan ama operasyonel açıdan anlamlı bir konfigürasyon ayrışması mevcut: admin panelinde güncellenen DB `mail_config`, operasyonel mail akışlarının çoğunu etkilemeyebilir.
- Bu durum “test mail çalışıyor ama gerçek iş akışı mail atmıyor” veya tam tersine “admin panelinde boş görünse de operasyonel mail çalışıyor” tipinde karışıklık yaratabilir.

### Müşteri Etkisi
- Bildirim, dış onay ve rapor e-postalarında beklenmedik başarısızlıkların teşhisi zorlaşır.
- Destek ekibi mail arızasını yanlış katmanda arayabilir; çözüm süresi uzayabilir.

## 4. Aksiyon 2: Expert Test Hesabı Doğrulama

### Kök Neden
Expert hesabı production DB'de aktif görünse de erişim kapsamını belirleyen responsibility assignment kaydı bulunmadı. Ayrıca login doğrulaması için parola bilgisi görev girdisinde sağlanmadığı için endpoint regresyonları sonlandırılamadı.

### Kanıt
- Production `users` tablosunda `info@safranbh.com` kaydı bulundu: kullanıcı ID'si mevcut, adı `Test Test`, `status=active`.
- `roles` join sorgusunda rol `expert` / `Eksper Portalı` olarak doğrulandı.
- `claim_responsibility_assignments` tablosunda aynı kullanıcı için `user_id` üzerinden 0 kayıt döndü.
- Görevde önerilen SQL'in production şeması ile birebir uyumlu olmadığı görüldü:
  - `users.is_active` kolonu yok.
  - `claim_responsibility_assignments.expert_id` kolonu yok; tabloda `user_id` var.
- Expert login çağrısı yapılmadı; parola bilinmiyor.
- Expert token üretilemediği için:
  - `GET /api/v1/claim-files` own-file doğrulaması yapılamadı.
  - `GET /api/v1/users` other-file / yetki 403 regresyonu yapılamadı.

### Durum Özeti
| Kontrol | Sonuç |
| --- | --- |
| Kullanıcı var mı? | Doğrulandı |
| Rol expert mi? | Doğrulandı |
| Status aktif mi? | Doğrulandı (`active`) |
| Responsibility assignment var mı? | Doğrulanamadı, çünkü kayıt yok bulundu |
| Login yapılabildi mi? | Doğrulanamadı |
| Own-file erişimi test edildi mi? | Doğrulanamadı |
| Other-file / users 403 regresyonu test edildi mi? | Doğrulanamadı |

### Production Riski
- Expert rolünde assignment kaydı olmaması, uzmanın kendine ait dosyaları dahi listeleyememesi veya boş liste görmesi riskini artırır.
- Yetki regresyonu varsa müşteri tarafında “hesap aktif ama içerik görünmüyor / 403 alıyor” şikayeti doğabilir.

### Müşteri Etkisi
- Expert portalına erişim olsa bile iş üretilemeyebilir.
- Test hesabının işe yaramaması, canlı destek ve demo süreçlerinde güven kaybına neden olabilir.

## 5. Aksiyon 3: Users Create/Update Payload Korelasyonu

### Kök Neden
İstenen 500 korelasyonu bu çalışma içinde üretilemedi; çünkü production backend loglarında users create/update için son 24 saat ve son 2000 satır içinde 500/exception kanıtı bulunmadı. Kod incelemesi, UI payload'ının rol bazlı alanları sanitize ettiğini ve bazı alanları ayrı endpointlere böldüğünü gösterdi; ancak bu tek başına 500 hatasını kanıtlamıyor.

### Kanıt

#### Backend Log İncelemesi
- `docker logs sigorta-backend --tail 2000 ...` filtresinde users modülüne ilişkin yalnızca `UsersController` route mapping logları döndü.
- `docker logs --since '24h' ...` filtresinde de 500/error/exception/users kombinasyonunda yalnızca startup/route logları bulundu; stack trace veya request payload kaydı yok.
- `reports/runtime-stabilization/runtime-regression-results.json` içinde `500` için grep sonucu bulunmadı.

#### Frontend Payload Şekli
`apps/web/src/app/panel/kullanicilar/page.tsx` içinde:
- Create akışında `POST /users` sonrası ayrı ayrı:
  - `PATCH /users/:id/service-areas`
  - rol `field_staff` ise `PUT /users/:id/screen-permissions`
  - rol `insurance_company_user` ise `PUT /users/:id/insurance-company-scopes`
- Update akışında da aynı parçalı model kullanılıyor.
- Kaydetmeden önce `validateUserScope()` ve `sanitizeScopeByRole()` çağrıları yapılıyor.

`apps/web/src/app/panel/kullanicilar/_lib/user-scope-mappers.ts` içinde:
- Ana payload sadece şu alanları içeriyor: `firstName`, `lastName`, `email`, `phone`, `roleId`, `status`, opsiyonel `password`, opsiyonel `departmentMemberships`, opsiyonel `responsibilityAssignments`.
- Gizli rol alanları `sanitizeScopeByRole()` ile temizleniyor.

#### Backend DTO Şekli
`apps/backend/src/modules/users/users.dto.ts` içinde `CreateUserDto` / `UpdateUserDto` şu alanları kabul ediyor:
- temel alanlar: `branchId`, `roleId`, `adjusterId`, `firstName`, `lastName`, `email`, `phone`, `password`, `status`, `employeeCode`, `isMobileUser`, `isWebUser`
- ilişkisel alanlar: `departmentMemberships`, `responsibilityAssignments`

#### Korelasyon Yorumu
- UI'da görünmeyen alanların stale kalıp ana create/update payload'ına sızmasını engelleyen aktif sanitize mekanizması var.
- `serviceAreas`, `screenPermissions`, `insuranceCompanyIds` ana users DTO'suna değil yan endpointlere gidiyor; bu nedenle stale hidden fields varsa etki büyük ihtimalle users POST/PATCH yerine takip endpointlerinde ortaya çıkacaktır.
- Production loglarında exception olmadığı için “UI stale hidden fields doğrudan users 500 üretiyor” iddiası bu çalışmada kanıtlanamadı.

### Production Riski
- Parçalı kayıt modeli nedeniyle ilk çağrı başarılı olup ikinci/üçüncü çağrıların fail olması, UI'da kullanıcıya tek bir genel hata gibi yansıyabilir.
- Yetersiz structured logging, gelecekte benzer 500'lerin kök nedenini üretimde ayırt etmeyi zorlaştırır.

### Müşteri Etkisi
- Kullanıcı oluşturma/güncelleme adımlarında kısmi başarı-kısmi hata yaşanırsa operasyonda tutarsız kullanıcı kayıtları oluşabilir.
- Destek ekibi kesin sebep göremediği için çözüm süresi uzayabilir.

## 6. Açık Beyan

Bu çalışma kapsamında:
- Kod değişikliği yapılmadı.
- Deploy yapılmadı.
- Migration yapılmadı.
- Seed çalıştırılmadı.
- Dosya silinmedi.
- Validation davranışı değiştirilmedi.
- Mail ayarı değiştirilmedi.
- Production'a test mail dışında herhangi bir e-posta gönderimi tetiklenmedi; test mail de gönderilmedi.
- Parola rapora yazılmadı; expert login yalnızca doğrulandı/doğrulanamadı seviyesinde ele alındı.

## 7. Bir Sonraki Adım Önerileri

| Öneri | Efor/Kredi | Production Riski | Gerekçe |
| --- | --- | --- | --- |
| Expert test hesabı için geçici doğrulama parolası sağlanıp login + `claim-files` + `users` smoke testi yapılması | Düşük | Düşük | Aksiyon 2'nin beklemede kalan kısmını netleştirir. |
| `users` create/update ve yan endpointler için request-id + payload shape + exception loglamasının gözden geçirilmesi | Orta | Düşük-Orta | Aksiyon 3'te kanıt eksikliğini giderir, gelecekte kök neden tespitini hızlandırır. |
| Mail konfigürasyonu için DB ve env kullanımının operasyonel dokümantasyonda net ayrıştırılması | Düşük | Düşük | Yanlış troubleshooting'i azaltır. |
| Orta vadede operasyonel mail servislerinin tek kaynağa konsolide edilmesi (DB veya env) | Orta-Yüksek | Orta | Konfigürasyon drift riskini azaltır. |
| Expert assignment veri modelinin iş kuralı doğrulamasıyla düzenli denetlenmesi | Orta | Düşük-Orta | Aktif expert hesabın boş kapsamla kalmasını önler. |


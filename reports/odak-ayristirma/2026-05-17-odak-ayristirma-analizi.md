# Sonraki Odak Ayrıştırma Analizi — 3 Kritik Alan

Tarih: 2026-05-17
Kapsam beyanı: Bu çalışma yalnızca analiz, kanıt toplama, kök neden ayrıştırma ve raporlamadır. Kod değişikliği, deploy, migration, seed, validation değişikliği veya dosya silme yapılmamıştır.

## 1. Yönetici özeti

1. Production `is_primary` backfill sonucu mevcut gerçek kullanıcı setinde `2+ primary` kaydı bulunmadı; 11 kullanıcıda tam 1 primary, 2 kullanıcıda 0 primary var.
2. `0 primary` görünen iki kullanıcı `ihbar@safranbh.com` ve `tmp.verify.insurance@example.invalid`; her ikisinin de hiç departman üyeliği yok, dolayısıyla sorun çoklu-primary değil, üyelik boşluğu.
3. Repository kanıtı, `create` akışında `departmentMemberships` hiç gönderilmezse backend’in create’i kabul ettiğini; yalnızca alan gönderildiğinde primary sayımı yaptığını gösteriyor.
4. Runtime stabilizasyon kanıtı, `update` akışında `departmentMemberships` gönderilip hiçbir `isPrimary=true` yoksa isteğin hatalı şekilde `200` döndüğünü gösteriyor; bu, production veri backfill’inden ayrı bir API validasyon regresyonu.
5. Admin erişimi production’da çalışıyor: `/api/v1/auth/login` ve admin token ile `GET /api/v1/users` çağrısı `200`.
6. `insurance_company_user` izolasyonu PASS; ancak örnek kanıtta erişim reddi `scope isolation` nedeniyle değil, “aktif sözleşme onayı” guard’ı nedeniyle `403` ile geliyor.
7. Expert 403 doğrulaması beklenen şekilde tamamlanamamış; stabilizasyon artefaktlarında expert login doğrudan `401` dönüyor, dolayısıyla admin endpoint / own-file / other-file davranışı test edilememiş.
8. Production’da kullanıcı create API’si şu an minimum payload ile de nested payload ile de `201` dönüyor; incelenen anda canlı bir `500` üretilemedi.
9. Create/Edit parity açısından API katmanı büyük ölçüde simetrik; stabilizasyon FAIL’i backend parity bozukluğundan çok UI otomasyonunun kullanıcıyı oluşturduğunu doğrulayamamasına işaret ediyor.
10. Office 365 tarafında kod yolu çalışabilir durumda; esas risk production’da DB tabanlı `mail_config` ile container env SMTP ayarlarının birbiriyle çelişmesi ve Office 365 hesap/politika gereksinimleri.

## 2. Durum tablosu

| Odak | Durum | Sonuç |
|---|---|---|
| Kullanıcı mimarisi ve `isPrimary` | FAIL | Veri backfill büyük ölçüde temiz; fakat 0-membership kullanıcılar var ve update validasyon regresyonu sürüyor |
| Create/Edit akışı | Beklemede | Canlıda incelenen anda `500` üretilemedi; geçmiş hata için daha dar zaman pencereli prod log korelasyonu gerekiyor |
| Office 365 Mail | Karar gerekiyor | Koddan çok altyapı/hesap/politika ve çift-konfigürasyon uyuşmazlığı öne çıkıyor |

## 3. Odak 1 — Kullanıcı Mimarisi ve isPrimary

### Kök neden

- Production backfill sonrası veri setinde çoklu-primary sorunu görünmüyor.
- Asıl açık iki farklı seviyede:
  - Bazı kullanıcıların hiç `user_department_memberships` kaydı yok.
  - Backend validasyonu yalnızca `departmentMemberships` alanı request içinde varsa çalışıyor; alan hiç gönderilmezse kullanıcı primary olmadan oluşturulabiliyor.
- Runtime kanıtına göre update tarafında da `missing primary` senaryosu hatalı olarak `200` dönebiliyor; bu da create/update davranışını tutarsız hale getiriyor.

### Kanıt

#### 3.1 Production kullanıcı-primary tablo özeti

Production sorgu çıktısı:

| email | primary_count | not |
|---|---:|---|
| `admin@meridyenassistance.com` | 1 | 3 üyelikten 1’i primary |
| `asli.gungor@safranbh.com` | 1 | 3 üyelikten 1’i primary |
| `hasar@safranbh.com` | 1 | 3 üyelikten 1’i primary |
| `seda.yufkayurek@safranbh.com` | 1 | 3 üyelikten 1’i primary |
| `mustafayufkayurek@gmail.com` | 1 | 2 üyelikten 1’i primary |
| `info@safranbh.com` | 1 | tek üyelik primary |
| `ihbar@safranbh.com` | 0 | üyelik yok |
| `tmp.verify.insurance@example.invalid` | 0 | üyelik yok |

Dağılım:

- `0 primary`: 2 kullanıcı
- `1 primary`: 11 kullanıcı
- `2+ primary`: 0 kullanıcı

#### 3.2 Repo kanıtı — backend validasyon davranışı

- `apps/backend/src/modules/users/users.dto.ts` içinde `departmentMemberships` opsiyonel.
- `apps/backend/src/modules/users/users.service.ts` içinde:
  - `validateNestedUserRelations()` yalnızca `departmentMemberships` mevcutsa `primaryCount` kontrolü yapıyor.
  - `persistDepartmentMemberships()` yalnızca alan gönderilmişse kayıt yazıyor.
  - Sonuç: üyelik alanı hiç gelmezse primary zorunluluğu fiilen devre dışı kalıyor.

#### 3.3 Runtime stabilizasyon kanıtı

- `reports/runtime-stabilization/runtime-regression-results.json`
  - Test 4 FAIL: role switch sonrası stale screen payload temizlenmiyor.
  - Test 5 FAIL: `missingPrimaryStatus: 200`.
  - Test 7 FAIL: expert login başarısız, dolayısıyla 403 davranışı doğrulanamamış.
  - Test 9 FAIL: role switch sonrası stale state sürüyor.

### Admin erişimi / expert / insurance_company_user

- Admin login: `POST /api/v1/auth/login` → `201`
- Admin token ile `GET /api/v1/users?page=1&limit=5` → `200`
- Expert login artefaktı: `info@safranbh.com` için `401 E-posta veya şifre hatalı`
  - Bu nedenle expected `403` admin endpoint testi tamamlanamamış.
- `insurance_company_user` izolasyonu test seti PASS:
  - kullanıcı oluşturma ve scope ataması başarılı.
  - ancak örnek `claim-files` çağrısında `403` mesajı “Önce aktif sözleşmeleri onaylamanız gerekiyor.”
  - yani bu kanıt izolasyon guard’ından önce agreement/contract guard’ın devreye girdiğini gösteriyor.

### Production riski

- Yeni kullanıcıların departmansız/primary’siz oluşması operasyonel yönlendirme, atama ve ekran davranışlarında bozulma üretir.
- Role switch stale-state sorunu ekran yetkileri ve görünür modüllerde yanlış pozitiflere neden olabilir.

### Müşteri etkisi

- Yanlış ya da eksik departman birincilliği, kullanıcı bazlı görev ve sorumluluk yönlendirmesini belirsizleştirir.
- Yanlış ekran görünürlüğü, kullanıcıların yetkisi olmayan ekranları görmesine veya eski role ait kalıntı deneyim yaşamasına neden olabilir.

## 4. Odak 2 — Create/Edit Akışı

### Kök neden ayrıştırması

- İstenen anda canlı production’da `create` çağrısı hem minimum payload ile hem de nested payload ile başarılı oldu; bu yüzden “sürekli tekrarlanan sistematik 500” kanıtlanamadı.
- İncelenen backend kodu da create tarafında bariz bir `500` sebebi göstermiyor:
  - duplicate email → `400`
  - invalid department id → `400`
  - nested primary count bozukluğu → `400`
- Bu nedenle en olası ayrım:
  1. `500` belirli payload varyasyonuna veya UI’den taşınan stale alanlara bağlı olarak aralıklı oluşuyor,
  2. ya da geçmiş anda oluşmuş transient bir prod durumu artık tekrar etmiyor.

### Kanıt

#### 4.1 Prod log taraması

- `docker logs sigorta-backend --tail 500 | grep -i '500|error|exception|users'`
- İncelenen pencerede anlamlı `users` create stack trace’i dönmedi.

#### 4.2 Minimum payload create

- Admin token ile minimum payload:
  - `roleId`, `firstName`, `lastName`, `email`, `password`, `isWebUser`
  - sonuç: `201 Created`

Yorum:
- Create için departman üyeliği zorunlu değil; bu hem başarıyı açıklıyor hem de Odak 1’deki veri açığını doğruluyor.

#### 4.3 Nested payload create

- Nested payload (`departmentMemberships` + `responsibilityAssignments`) ile:
  - sonuç: `201 Created`
  - response içinde nested ilişkiler geri dönüyor.

#### 4.4 Create/Edit parity

- Stabilizasyon Test 3 PASS:
  - nested create response
  - create sonrası GET
  - nested update response
  - update sonrası GET
- Bu veri, API seviyesinde nested alanların korunduğunu gösteriyor.
- Stabilizasyon Test 10 FAIL:
  - Playwright script yalnızca UI akışının sonucu ekranda teyit edilmesini deniyor.
  - Script içinde `createdUserId: null` loglanıyor; yani failure backend response parity’sinden çok UI doğrulama / locator / screen flow kaynaklı.

### Create/Edit parity sonucu

- API katmanında create ve edit arasında temel nested veri korunumu açısından parity büyük ölçüde mevcut.
- Asimetrik nokta validasyon davranışı:
  - create minimum payload ile departmansız kullanıcıya izin veriyor,
  - update tarafında ise `departmentMemberships` gönderildiğinde primary kuralı teorik olarak devreye giriyor fakat runtime kanıtı bunun da delindiğini gösteriyor.

### İki aşamalı akış önerisi değerlendirmesi

Temel bilgi + operasyon ayarları ayrımı teknik olarak mantıklı görünüyor çünkü:

- Bugünkü payload tasarımı UI stale state taşımasına açık.
- Role değişince ekran yetkisi, service areas, department memberships ve responsibility assignments aynı transaction içinde ama farklı anlam katmanlarında işleniyor.
- “Kullanıcı kimlik bilgileri” ile “operasyonel yetki/örgüt atamaları” ayrıldığında:
  - validation daha netleşir,
  - create sırasında minimum zorunlu alanlarla kullanıcı açılır,
  - ikinci adım olmadan kullanıcıyı aktif etmemek gibi daha güvenli kontroller tasarlanabilir.

Ancak bu aşamada bu bir analiz önerisidir; uygulama kararı ürün/operasyon onayı gerektirir.

### Production riski

- Aralıklı 500 varsa kullanıcı açılışı kesintili hale gelir.
- Daha kritik ve doğrulanmış risk: create’in departmansız kullanıcı kabul etmesi.

### Müşteri etkisi

- Operasyon ekibi kullanıcı açılışlarında tutarsız deneyim yaşar.
- Kullanıcı oluşturulsa bile eksik operasyon atamaları yüzünden sonradan erişim/iş yönlendirme sorunları çıkar.

## 5. Odak 3 — Office 365 Mail

### Maskeli config özeti

Production DB `mail_config`:

| Alan | Değer |
|---|---|
| host | `smtp.office365.com` |
| port | `587` |
| security | `TLS` |
| fromEmail | `hasar@safranbh.com` |
| username | `has***` |
| password | `***MASKED***` |

Production backend env:

| Alan | Değer |
|---|---|
| SMTP_HOST | `mail.meridyen-tr.com` |
| SMTP_PORT | `587` |
| SMTP_USER | `nor***` |
| SMTP_FROM | `noreply@meridyen-tr.com` |
| SMTP_PASS | `***MASKED***` |

### Kök neden ayrıştırması

#### 5.1 Kod hatası mı?

Zayıf olasılık.

Repo kanıtı:
- `apps/backend/src/modules/system-settings/system-settings.service.ts`
  - `sendTestMail()` DB’den `mail_config` okuyor.
  - `security === 'TLS'` ise `requireTLS = true` ayarlıyor.
  - `nodemailer.createTransport()` ile standart SMTP auth yapıyor.
  - eksik konfigürasyonda kontrollü `BadRequestException` atıyor.

Bu yol, Office 365 için teknik olarak beklenen temel SMTP modeline uyuyor.

#### 5.2 Altyapı / konfigürasyon çakışması mı?

Güçlü olasılık.

- Aynı production ortamında iki ayrı mail konfigürasyonu var:
  - DB: Office 365
  - Container env: `mail.meridyen-tr.com`
- `sendTestMail()` DB config kullanıyor.
- Uygulamanın diğer mail servisleri env `SMTP_*` kullanıyor olabilir.
- Sonuç: “test mail çalışıyor / gerçek mail çalışmıyor” ya da tam tersi türü ayrışmış davranışlar bu çift kaynaklı yapı ile kolayca açıklanır.

#### 5.3 Office 365 hesap/politika sorunu mu?

Güçlü olasılık.

Özellikle şu başlıklar ayrıştırılmalı:

- SMTP AUTH tenant veya mailbox bazında kapalı olabilir.
- MFA açıksa normal şifre yerine app password gerekebilir.
- Modern Auth / basic auth kısıtları tenant policy ile engelleniyor olabilir.
- Conditional Access politikası sunucu/IP bazlı blok üretiyor olabilir.
- Hesap parolası yanlış, değişmiş veya süresi dolmuş olabilir.

#### 5.4 Şifre sorunu mu?

Orta-yüksek olasılık.

- DB’de parola mevcut görünüyor ancak doğruluğu analiz sırasında test edilmedi.
- Bu raporda güvenlik gereği gerçek parola hiçbir yere yazılmamıştır.

### Son sınıflandırma

| Sınıf | Sonuç |
|---|---|
| Kod hatası | Düşük olasılık |
| Office 365 hesap/politika | Yüksek olasılık |
| Şifre yanlış/expired | Orta-Yüksek olasılık |
| Çift konfigürasyon uyuşmazlığı | Yüksek olasılık |

### Production riski

- Test mail ve gerçek bildirim akışları farklı kaynaklardan besleniyorsa teşhis zorlaşır ve arıza tekrarlanır.
- Mail kesintisi müşteri iletişimi, onay akışları ve bildirim zincirini doğrudan etkiler.

### Müşteri etkisi

- Bildirim gecikmesi / hiç gitmemesi.
- Operasyonun “gönderildi sanıldı ama ulaşmadı” türü güven kaybı yaşaması.

## 6. Kod/deploy/migration yapılmadığına dair açık beyan

Bu çalışma boyunca:

- Kod değişikliği yapılmadı.
- Deploy yapılmadı.
- Migration çalıştırılmadı.
- Seed çalıştırılmadı.
- Validation davranışı değiştirilmedi.
- Dosya silinmedi.

Not: Analysis amacıyla production API üzerinde okuma ve kontrollü create çağrıları yapıldı; sistem davranışı değiştiren kodsal bir müdahale yapılmadı.

## 7. Sıradaki en düşük riskli 3 aksiyon önerisi

| Öneri | Açıklama | Efor/Kredi | Production riski |
|---|---|---:|---|
| 1. Mail akış envanteri çıkar | Hangi endpoint/servisin DB `mail_config`, hangisinin env `SMTP_*` kullandığını dosya-seviye matriste netleştir | 2/5 | Düşük |
| 2. Expert test hesabını doğrula | `info@safranbh.com` için doğru şifre / hesap durumu netleştirilip 403 regresyonu yeniden koşturulsun | 1/5 | Düşük |
| 3. Users create/update payload korelasyon log analizi | 500 raporlanan zaman aralığı için request payload shape + backend exception eşlemesi çıkarılsın; özellikle stale hidden fields odaklı | 3/5 | Düşük-Orta |

## 8. Sonuç

- `isPrimary` backfill production verisini büyük ölçüde toparlamış, ancak kullanıcı mimarisindeki asıl açıklık “departmansız kullanıcı oluşabilmesi” ve update validasyon regresyonudur.
- Create 500, analiz anında yeniden üretilemedi; şu anda kanıtlar kalıcı backend create arızasından çok payload/UI/stale-state kaynaklı aralıklı bir probleme işaret ediyor.
- Office 365 tarafında ana şüphe kod değil; Office 365 hesap/politika gereksinimleri ile DB/env çift konfigürasyon ayrışmasıdır.
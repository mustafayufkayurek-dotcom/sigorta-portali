# Kredi Kontrollü Genel Toparlama ve Envanter Raporu — 17 Mayıs 2026

## 1. Yönetici Özeti

1. Local çalışma ağacı temiz değil; 5 `modified` ve çok sayıda `untracked` dosya var. Ana yoğunluk kullanıcı mimarisi, migration/seed SQL ve rapor-artifact klasörlerinde toplanıyor.
2. En büyük kirli değişiklik kümesi `apps/backend/src/modules/users/*` ve `apps/web/src/app/panel/kullanicilar/*` çevresinde; bu küme nested departman üyeliği, sorumluluk ataması, service area ve ekran izinlerini aynı akışta toplamaya çalışıyor.
3. Runtime stabilizasyon kanıtları kullanıcı mimarisi değişikliklerinin henüz güvenli kapanmadığını gösteriyor: hydration, role switch stale state, `isPrimary` doğrulaması ve create/edit parity testleri FAIL.
4. Production servis sağlık kanıtı mevcut; ancak production DB’den son 5 migration kaydı bu iterasyonda alınamadı. SSH ile konteyner sağlık çıktısı alındı, `_prisma_migrations` sorgusu parola nedeniyle tamamlanamadı.
5. Fotoğraf upload akışı için kod seviyesinde bağ kanıtı mevcut: eksper portalı ihbar oluşturduktan sonra rapor açıyor ve fotoğrafları `repair-reports/:id/images` endpoint’ine yüklüyor. Buna rağmen production’da gerçek bağın çalıştığını gösteren bu iterasyona ait response/log kanıtı eksik.
6. Office 365 için kurulum ekranında preset kanıtı var; fakat gerçek test mail gönderim response/log kanıtı yok.
7. `Carilerim` ekranı route seviyesinde görünür, ancak istenen “finans menüsü / geri tuşu / finans sayfa tepkisi” davranışına dair doğrudan kod kanıtı yok; bu başlık ürün kararı gerektiriyor.
8. Evrak türleri için backend modülü, admin ekranı ve seed SQL mevcut; buna rağmen production snapshot’ta aktiflik kanıtı bu iterasyonda toplanamadı.
9. Ölü kod adayı olarak en güçlü kümeler: tekrar eden ekran izin etiketleri, kullanılmayan generic auto-code helper, yarım kalmış runtime/regression worker-script artefaktları ve eski/hardcoded sigorta şirketi fallback listesi.
10. Bu çalışmada kod/deploy/migration yapılmadı; yalnızca repo, git çalışma ağacı, artifact klasörleri ve production read-only sağlık verisi incelendi.

## 2. Kirli Çalışma Ağacı Dosya Envanteri

Aşağıda her kirli dosya için tam path, durum, amaç, production etkisi, danışman kararı çelişkisi ve öneri verilmiştir.

| Dosya yolu | Durum | Amaç | Production etkisi | Danışman kararı çelişkisi | Öneri |
|---|---|---|---|---|---|
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/package.json` | Modified | Backend Jest yapılandırmasına alias çözümü eklenmiş; kullanıcı modülü test dosyasını çalıştırma denemesi | Sadece backend test altyapısını etkiler; deploy edilirse runtime’a doğrudan etkisi düşük | Doğrudan ürün kararı çelişkisi yok; ancak henüz başarısız runtime regression kümesini güvenli kapattığına dair kanıt yok | Bekleyecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.controller.ts` | Modified | `any` yerine DTO kullanımı ile kullanıcı create/update sözleşmesini sıkılaştırma | `/users` create/update endpoint sözleşmesini etkiler; kullanıcı oluşturma/güncelleme akışı, validasyon ve Swagger etkilenir | Dolaylı risk: yeni kullanıcı mimarisi runtime FAIL kümesiyle birlikte geliyor | Karar gerekiyor |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.ts` | Modified | Nested departman üyelikleri, sorumluluk atamaları, stale-state cleanup ve hydration detaylarını backend’e taşıma | `/users/:id`, `/users`, `/users/:id/service-areas`, `/users/:id/screen-permissions` akışları; kullanıcı ekranları, yetki görünürlüğü ve rol değişimi etkilenir | Evet: role-switch ve `isPrimary` alanlarında runtime kanıtı FAIL; danışman onayı olmadan production’a alınması riskli | Karar gerekiyor |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/ayarlar/kurulum/page.tsx` | Modified | Kurulum ekranı içine gelişmiş kullanıcı formu, rol bazlı scope kuralları, ekran izinleri ve Office 365 preset rehberi ekleme | `/panel/ayarlar/kurulum` ekranı, kullanıcı kurulum akışı, Office 365 preset görünümü etkilenir | Office 365 test mail kanıtı yok; ayrıca kullanıcı mimarisi regression kümesine bağlı | Bekleyecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/page.tsx` | Modified | Çok sekmeli yeni kullanıcı yönetim arayüzü, operasyon yapısı, ekran izinleri ve scope validasyonu | `/panel/kullanicilar` ekranı; create/edit parity, hydration ve role-switch görselliği etkilenir | Evet: runtime regression raporunda hydration / stale state / parity FAIL | Karar gerekiyor |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/MUHENDIS_RAPORU_20260515.md` | Untracked | 15 Mayıs production durum ve danışman kararı uyum raporu | Doğrudan runtime etkisi yok; analiz referansı | Çelişki yok; referans belge | Commitlenecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/P1_TEKNIK_DUZELTME_PLANI.md` | Untracked | Stabilizasyon odaklı teknik plan | Runtime etkisi yok | Çelişki yok; karar referansı | Commitlenecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/PROFESSIONAL_CALISMA_MODELI.md` | Untracked | Devir/çalışma modeli dokümanı | Runtime etkisi yok | Çelişki yok | Commitlenecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/PROJE_DEVIR_PLANI.md` | Untracked | Devir planı ve operasyon aktarımı | Runtime etkisi yok | Çelişki yok | Commitlenecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/URUN_OLGUNLUK_ANALIZI.md` | Untracked | Ürün riskleri, genelleştirme ve mimari analiz | Runtime etkisi yok | Karar referansı; sigorta merkezli kilitlenme riskini vurguluyor | Commitlenecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/prisma/migrations/20260514130000_claim_subject_department_and_auto_codes/migration.sql` | Untracked | `claim_subjects.department_id` ve `service_types.code` ilişki/otomatik kod migration’ı | DB şeması; claim subject → department ve service type code alanları etkilenir | Çelişki yok; ancak production uygulanma seviyesi bu turda DB sorgusuyla tekrar teyit edilemedi | Bekleyecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/prisma/migrations/20260517120000_user_department_memberships_is_primary_backfill/migration.sql` | Untracked | `user_department_memberships.is_primary` backfill denemesi | DB’de kullanıcı departman birincilliği; kullanıcı görünürlüğü/atama akışı etkilenir | Evet: runtime kanıtında `missingPrimaryStatus: 200`; migration tüm kayıtları false yapıp seçili e-postaları true yaptığı için ürün/danışman kararı gerektirir | Kaldırma adayı |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/common/helpers/auto-code.helper.ts` | Untracked | Generic kod üretme helper’ı; muhtemel service/document/workgroup kodları için hazır altyapı | Şu an call-site bulunmadığı için deploy edilse bile etkisi yok | Doğrudan çelişki yok; ancak kullanılmayan helper olarak kalıyor | Kaldırma adayı |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.dto.ts` | Untracked | Kullanıcı modülü DTO sınıfları | `/users` API request validasyonu ve Swagger etkilenir | Yeni kullanıcı mimarisi regression kümesinin parçası | Karar gerekiyor |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/src/modules/users/users.service.spec.ts` | Untracked | Kullanıcı servisindeki nested relation ve role switch cleanup davranışını test etme | Sadece test katmanı | Çelişki yok; fakat testler runtime FAIL’leri kapattığını tek başına kanıtlamıyor | Bekleyecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/_components/user-impact-summary.tsx` | Untracked | Kullanıcı formu için etki özeti kartı | `/panel/kullanicilar` ve kurulum ekranı | Yeni kullanıcı mimarisi kümesinin parçası | Bekleyecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/_components/user-scope-sections.tsx` | Untracked | Rol bazlı operasyon kapsamı form bölümleri | Kullanıcı ekranı/kurulum ekranı | Yeni kullanıcı mimarisi kümesinin parçası | Bekleyecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/_lib/user-scope-mappers.ts` | Untracked | UI formu → API payload ve user hydration mapper’ı | Kullanıcı create/edit payload sözleşmesi | Yeni kullanıcı mimarisi kümesinin parçası | Bekleyecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/_lib/user-scope-rules.ts` | Untracked | Rol bazlı görünürlük/zorunluluk kuralları | Kullanıcı form validasyonu/görünürlüğü | Permission ve zorunlu alan kararlarına dolaylı etkisi var; runtime kanıtı tamamlanmamış | Karar gerekiyor |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/kullanicilar/_lib/user-scope-validation.ts` | Untracked | Rol bazlı kullanıcı scope validasyonu | Kullanıcı form submit blokajları | Zorunlu alan davranışı açısından ürün kararı gerektirir | Karar gerekiyor |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/src/utils/screen-permissions.ts` | Untracked | Web tarafında ekran izinleri sözlüğü | Kullanıcı ekran izinleri, route görünürlüğü | Mevcut backend sözlüğünün kopyası; yetki tek kaynaklılık ilkesine ters yönde çoğalma riski | Kaldırma adayı |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docs/sql/claim_subject_department_seed.sql` | Untracked | Claim subject → department elle seed/onarım SQL’i | DB veri düzeltme scripti | Production uygulanırsa claim-subject dağılımını etkiler; danışman onayı gerekir | Karar gerekiyor |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docs/sql/document_types_seed.sql` | Untracked | Evrak türlerini aktif seed eden SQL | `document_types` tablosu, evrak dropdown’ları ve belge akışları | Evrak türlerinin aktifliği istenen kararlarla uyumlu olabilir; fakat production uygulanma/aktiflik kanıtı yok | Bekleyecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/durum-teyit/durum-teyit-raporu-20260517.md` | Untracked | 17 Mayıs durum teyit raporu | Runtime etkisi yok; yönetim raporu | Çelişki yok | Commitlenecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/evidence/auth-admin-login.json` ve aynı klasördeki tüm `test*`, `cleanup*`, lookup JSON/TXT dosyaları | Untracked | Runtime regresyon ve API evidence artefaktları | Runtime etkisi yok; kanıt ve test çıktısı | Çelişki yok; fakat kalıcı rapor mu geçici artifact mı kararı gerekli | Karar gerekiyor |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/run-runtime-regression.js` | Untracked | Runtime regression scripti | Test/kanıt üretimi | Çelişki yok | Bekleyecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/runtime-regression-report.md` | Untracked | Runtime test özeti | Runtime etkisi yok | Çelişki yok | Commitlenecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/runtime-regression-results.json` | Untracked | Makine-okur test sonuçları | Runtime etkisi yok | Çelişki yok | Commitlenecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/ui-create-edit-parity.js` | Untracked | UI parity scripti | Test/kanıt üretimi | Çelişki yok | Bekleyecek |
| `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/reports/runtime-stabilization/ui-hydration-check.js` | Untracked | UI hydration scripti | Test/kanıt üretimi | Çelişki yok | Bekleyecek |

### Kirli ağaç hakkında genel sınıflandırma

- **Commitlenmeye en yakınlar:** analiz/durum raporları ve referans dokümanlar.
- **Beklemesi gerekenler:** kullanıcı mimarisi ile ilişkili büyük değişiklik kümesi ve production kanıtı eksik SQL’ler.
- **Kaldırma adayı olanlar:** kullanılmayan helper, tartışmalı backfill migration, çoğaltılmış screen permission sözlüğü.

## 3. Ölü Kod / Kullanılmayan Kod Aday Listesi

> Not: Aşağıdaki öğeler doğrudan silme önerisi değildir. “EVET/HAYIR” ifadesi yalnızca kaldırma adaylığı içindir ve **danışman onayı gerekir**.

### 3.1 `apps/backend/src/common/helpers/auto-code.helper.ts`
- **Neden aday:** Repo genel aramada `createWithAutoCode` ve dosya adı için hiçbir call-site bulunmadı; yalnızca tanım dosyası mevcut.
- **Kanıt:** Helper içinde export var, fakat repo çapında import/call sonucu yok.
- **Kaldırılırsa etki:** Mevcut import/route/endpoint/test davranışı etkilenmez; sadece geleceğe dönük planlanan generic helper kalkmış olur.
- **Silme önerisi:** **EVET** — danışman onayı gerekir.

### 3.2 `apps/web/src/utils/screen-permissions.ts`
- **Neden aday:** Aynı ekran kodları ve etiketler backend’de `apps/backend/src/modules/users/screen-permissions.defaults.ts` içinde de bulunuyor. Web dosyası yalnızca iki ekran tarafından kullanılıyor; bu, tek kaynaklı yetki hedefiyle çelişen kopya sözlük oluşturuyor.
- **Kanıt:** Kullanım yalnızca `/panel/kullanicilar/page.tsx` ve `/panel/ayarlar/kurulum/page.tsx`; ayrıca `apps/web/src/app/panel/kullanicilar/[id]/page.tsx` kendi `SCREEN_LABELS` sabitini ayrı tanımlıyor.
- **Kaldırılırsa etki:** İlgili kullanıcı ekranları kırılır; önce ortak sözlük/tek kaynak tasarımı gerekir.
- **Silme önerisi:** **HAYIR** — şu an doğrudan silinmemeli, önce konsolidasyon gerekir; danışman onayı gerekir.

### 3.3 `apps/web/src/app/panel/kullanicilar/[id]/page.tsx` içindeki yerel `SCREEN_LABELS`
- **Neden aday:** Aynı ekran etiketleri başka dosyada zaten tanımlı. Bu, çoğaltılmış sabit ve bakım yükü oluşturuyor.
- **Kanıt:** Repo aramasında hem `apps/web/src/utils/screen-permissions.ts` hem de `[id]/page.tsx` içinde ayrı `SCREEN_LABELS` tanımı mevcut.
- **Kaldırılırsa etki:** Detay ekranı derleme hatası alır; önce ortak import’a taşınması gerekir.
- **Silme önerisi:** **HAYIR** — doğrudan silme değil, birleştirme adayı; danışman onayı gerekir.

### 3.4 `apps/web/src/app/panel/eksper-portal/page.tsx` içindeki `INSURANCE_COMPANIES` hardcoded listesi
- **Neden aday:** Aynı dosya runtime’da `GET /insurance-companies?limit=200` çağrısı yapıyor; API boş dönerse hardcoded fallback kullanılıyor. Bu, artık ana kaynak olmayan eski liste gibi duruyor.
- **Kanıt:** Dosyada hem sabit liste hem de API çağrısı var; render sırasında öncelik API verisinde.
- **Kaldırılırsa etki:** API yanıtı başarısız olduğunda dropdown boş kalabilir; bu nedenle fallback’in kaldırılması öncesi ürün kararı gerekir.
- **Silme önerisi:** **HAYIR** — yüksek operasyon etkisi nedeniyle doğrudan kaldırılmamalı; danışman onayı gerekir.

### 3.5 `reports/runtime-stabilization/` altındaki script ve evidence kümeleri
- **Neden aday:** Bunlar uygulama runtime parçası değil; test/kanıt artefaktı. Uzun vadede repo içinde birikirse “yarım kalmış worker/script denemesi” ve tarihsel gürültü oluşturabilir.
- **Kanıt:** Dosyalar `reports/` altında, uygulama import zincirinde yer almıyor; Node scriptleri sadece evidence üretmek için var.
- **Kaldırılırsa etki:** Runtime etkisi olmaz; ancak geçmiş kanıt kaybolur. Denetim izi açısından dikkat gerekir.
- **Silme önerisi:** **HAYIR** — arşiv mi repo dosyası mı olacağına dair karar gerekir; danışman onayı gerekir.

### 3.6 `apps/backend/src/modules/users/users.service.spec.ts`
- **Neden aday:** Mevcut test altyapısına eklenmiş ama kirli ağaçta tekil kalmış durumda; henüz rapordaki FAIL runtime kümesini kapattığı kanıtlanmamış.
- **Kanıt:** Test dosyası mevcut, `package.json` Jest alias eklemesi yapılmış; buna rağmen runtime regression artefaktları FAIL gösteriyor.
- **Kaldırılırsa etki:** Test kapsamı düşer; runtime etkisi olmaz.
- **Silme önerisi:** **HAYIR** — test adayı silinmemeli, sadece kapsam/doğruluk kararı netleşmeli; danışman onayı gerekir.

### 3.7 Olası kullanılmayan backend endpoint adayları
- **Aday:** `GET departments/seed`, `POST service-types/seed`, `POST work-groups/seed`
- **Neden aday:** Seed amaçlı endpointler production çalışma zamanında nadiren gerekir ve operasyonel yüzeyi gereksiz genişletebilir.
- **Kanıt:** Controller tanımları mevcut; işlevleri seed/geliştirme odaklı isimlendirilmiş. Bu iterasyonda doğrudan UI call-site kanıtı bulunmadı.
- **Kaldırılırsa etki:** Admin/seed bakım akışları etkilenebilir; script veya manuel operasyon bunlara bağlıysa kırılır.
- **Silme önerisi:** **HAYIR** — önce call-site ve operasyon süreci netleştirilmeli; danışman onayı gerekir.

## 4. Eksik Kanıtlar ve Tamamlanması Gereken Teyitler

| Başlık | Mevcut durum | Kanıt / eksik | Teyit ihtiyacı |
|---|---|---|---|
| Migration son 5 kayıt (production DB) | **Eksik** | SSH ile container sağlık çıktısı alındı; `_prisma_migrations` sorgusu parola olmadan tamamlanamadı | Production DB içinde son 5 migration kaydı read-only sorgu ile alınmalı |
| Fotoğraf upload bağ kanıtı | **Kısmi** | Kodda eksper portalı `claim-files` oluşturduktan sonra `repair-reports/:id/images` çağırıyor; ancak bu iterasyonda production response/log kanıtı yok | Gerçek bir ihbar sonrası report image kayıtlarının response veya DB/log kanıtı alınmalı |
| Office 365 test mail kanıtı | **Eksik** | Kurulum ekranında `smtp.office365.com:587 TLS` preset’i var; test mail ekranı/akışı referanslı. Başarılı gönderim kanıtı yok | Test mail response/log veya screenshot/JSON kanıtı alınmalı |
| Carilerim-finans karar kanıtı | **Eksik** | `Carilerim` route görünür; ekran içinde finans menüsü veya geri tuşu yok | Ürün kararı yazılı teyit edilmeli: finans ilişkisi isteniyor mu, ekran kapsamı dışında mı |
| Evrak türleri aktiflik kanıtı | **Kısmi** | Backend document-types modülü ve admin ekranı var, ayrıca seed SQL mevcut | Production’da `document-types?status=active` cevabı veya DB kayıt kanıtı alınmalı |
| claim subject → department production teyidi | **Kısmi** | Migration SQL ve önceki rapor var; production DB SELECT kanıtı bu turda alınamadı | `claim_subjects.department_id` örnek kayıtları read-only sorgu ile teyit edilmeli |
| Kullanıcı mimarisi stabilization kanıtı | **Eksik** | Runtime regression sonuçları FAIL; mevcut evidence daha çok problemin sürdüğünü kanıtlıyor | Yeni kullanıcı kümesi için PASS kanıtı gerek |
| Public endpoint envanteri | **Kısmi** | Çeşitli `@Public()` endpointler bulundu; tam risk sınıflandırma tablosu ayrı çıkarılmadı | Public endpoint envanteri ve veri sınıflandırması tamamlanmalı |

### Diğer eksik kanıtlar
- `test10-playwright-stdout.txt` create/edit parity için hata ayrıntısını özetleyen daha okunabilir bulgu seti hazırlanmalı.
- `claim_file` veya `repair_report` fotoğraflarının `uploads/` ya da DB kaydı ile gerçekten bağlandığına dair entity-level evidence toplanmalı.
- `document_types` seed SQL’in production’da uygulanıp uygulanmadığı net değil.

## 5. Risk Sınıflandırma Matrisi

| Risk adı | Sınıf | Müşteri etkisi | Production etkisi | Veri kaybı riski | Tahmini kredi/efor |
|---|---|---|---|---|---|
| Kullanıcı mimarisi regression kümesi | Kritik | Kullanıcı oluşturma/güncelleme ve rol görünürlüğü bozulabilir | `/users` API, kullanıcı ekranı, role switch akışları etkilenir | Düşük-orta; daha çok yanlış görünürlük/yetki riski | Yüksek |
| `isPrimary` backfill ve validasyon tutarsızlığı | Yüksek | Yanlış departman birincilliği kullanıcı deneyimini ve atamayı bozar | `user_department_memberships` verisi ve filtreleme etkilenir | Orta | Orta |
| Role-switch stale state | Yüksek | Kullanıcı yanlış ekranları görebilir | Yetki/görünürlük modelinde sapma yaratır | Düşük | Orta |
| Production migration kanıt eksikliği | Yüksek | Yönetimsel güven düşer, yanlış snapshot kararı alınabilir | Deploy/migration kararları körleşir | Düşük | Düşük |
| Fotoğraf upload bağ kanıtı eksikliği | Orta | Yüklenen fotoğrafın rapora bağlanmaması halinde operasyon kesilir | Eksper portalı ve onarım raporu zinciri etkilenir | Orta | Orta |
| Office 365 test mail kanıtı eksikliği | Orta | Mail kurulumuna güvenilemez | Bildirim/test mail akışı belirsiz kalır | Düşük | Düşük |
| Evrak türleri aktiflik belirsizliği | Orta | Dosya evrak akışında yanlış/boş liste olabilir | `document_types` ve belge seçim ekranları etkilenir | Düşük | Düşük |
| Çoğaltılmış permission/screen sözlükleri | Orta | Farklı ekranlarda tutarsız etiket/görünürlük oluşabilir | Frontend/backend yetki sözleşmesi ayrışır | Düşük | Düşük-orta |
| Hardcoded fallback listeler | Düşük | Lookup API düşerse kullanıcı sınırlı ama eski veri görür | Eksper portal dropdown’ları etkilenir | Düşük | Düşük |
| Seed endpointlerinin canlı yüzeyde kalması | Orta | Yanlış kullanım idari karışıklık yaratabilir | Seed davranışları yanlışlıkla tetiklenebilir | Orta | Orta |

## 6. Danışman Kararlarıyla Çelişki Tablosu

| Bulgu | İlgili dosya/akış | Çelişen karar/ilke | Kanıt | Etki | Durum |
|---|---|---|---|---|---|
| Kullanıcı mimarisi büyük değişiklik kümesi stabil değil | `/users` backend + `/panel/kullanicilar` + `/panel/ayarlar/kurulum` | Production baseline korunmalı, agresif değişiklikler dikkatle ilerlemeli | Runtime regression 1/4/5/9/10 FAIL | Kullanıcı yönetimi kırılabilir | Çelişki / yüksek risk |
| `is_primary` backfill e-posta bazlı ve seçici | `20260517120000_user_department_memberships_is_primary_backfill` | Gerçek operasyon modeli veri odaklı olmalı; özel kullanıcı listesiyle gizli kural olmamalı | SQL tüm kayıtları false yapıp belirli e-postaları true yapıyor | Veri doğruluğu ve sürdürülebilirlik riski | Çelişki |
| Web’de ayrı screen permission sözlüğü tutuluyor | `apps/web/src/utils/screen-permissions.ts` | Permission/erişim için tek kaynaklılık hedefi | Aynı sözlük backend’de de var | Tutarsızlık ve bakım yükü | Kısmi çelişki |
| Carilerim-finans beklentisi kararsız | `apps/web/src/app/panel/carilerim/page.tsx` | Ekran kapsamı ve ürün vizyonu net olmalı | Ekran sadece müşteri/dosya listesi sunuyor | Yanlış beklenti / gereksiz iş üretimi | Karar eksikliği |
| Office 365 preset var ama test sonucu kanıtı yok | `/panel/ayarlar/kurulum` | Yapılandırma iddiaları kanıtlı olmalı | Sadece preset görüldü | Operasyon güveni düşük | Kanıt eksikliği |
| Evrak türleri için seed var ama active snapshot kanıtı yok | `document_types` modülü + seed SQL | Tanım verileri code/doküman/prod uyumlu olmalı | UI ve SQL var, prod active kanıtı yok | Evrak akışı belirsiz | Kanıt eksikliği |

## 7. İlk 3 Küçük ve Düşük Riskli Aksiyon Önerisi

| Aksiyon | Amaç | Risk seviyesi | Tahmini kredi/efor | Migration/deploy gerekiyor mu | Müşteri hata riski | Durma noktası |
|---|---|---|---|---|---|---|
| Production `_prisma_migrations` son 5 kaydı read-only kanıtla toplamak | Snapshot belirsizliğini kapatmak | Düşük | Düşük | Hayır | Çok düşük | Son 5 migration adı + tarih alınırsa dur |
| `document-types?status=active` ve örnek UI/response kanıtı toplamak | Evrak türleri aktiflik belirsizliğini kapatmak | Düşük | Düşük | Hayır | Çok düşük | Aktif liste kanıtı geldiğinde dur |
| Office 365 test mail response/log kanıtını ayrı artifact olarak almak | Kurulum ekranı iddiasını doğrulamak | Düşük | Düşük | Hayır | Çok düşük | Başarılı/başarısız test sonucu net loglandığında dur |

## 8. Eksik Karar Gereken Noktalar

1. `apps/backend/prisma/migrations/20260517120000_user_department_memberships_is_primary_backfill/migration.sql` tutulacak mı, yoksa özel kullanıcı/e-posta bağı nedeniyle kaldırılacak mı?
2. Kullanıcı mimarisi büyük değişiklik kümesi tek parça mı ilerleyecek, yoksa DTO/backend/web/scope bileşenleri ayrı fazlara mı bölünecek?
3. `apps/web/src/utils/screen-permissions.ts` ile backend ekran izin sözlüğü tekilleştirilecek mi?
4. `Carilerim` ekranı finans aksiyonu içermeli mi, yoksa ürün kapsamı dışında mı sayılmalı?
5. `reports/runtime-stabilization/` altındaki script ve evidence dosyaları kalıcı repo artefaktı mı, geçici çalışma çıktısı mı?
6. Seed endpointleri (`/departments/seed`, `/service-types/seed`, `/work-groups/seed`) canlı yüzeyde kalacak mı?
7. Eksper portalındaki hardcoded sigorta şirketi fallback listesi korunacak mı?

## 9. Kod/Deploy/Migration Yapılmadığına Dair Açık Beyan

Bu çalışmada:
- hiçbir uygulama kodu değiştirilmedi,
- hiçbir dosya silinmedi,
- hiçbir refactor yapılmadı,
- hiçbir migration çalıştırılmadı,
- hiçbir seed çalıştırılmadı,
- hiçbir deploy yapılmadı,
- hiçbir validation davranışı değiştirilmedi.

Yalnızca mevcut repo, git çalışma ağacı, mevcut rapor/artifact dosyaları ve production read-only sağlık bilgileri incelenmiştir.

## 10. Sonuç ve Özet

- Projenin mevcut kirli çalışma ağacı içinde en büyük risk, kullanıcı yönetimi tarafında birikmiş ama henüz tam doğrulanmamış büyük değişiklik kümesidir.
- Bu küme teknik olarak anlamlı bir hedefe gidiyor olsa da eldeki runtime kanıtları bunun halen güvenli kapanmadığını gösteriyor.
- Analiz tarafında en kritik eksik kanıtlar production migration listesi, Office 365 test mail sonucu, fotoğraf upload bağının production-level kanıtı ve evrak türleri active snapshot teyididir.
- Düşük riskli en doğru sonraki adım, yeni kod yazmak değil, eksik kanıtları kapatıp hangi kirli dosyaların gerçekten kalıcı olacağına karar vermektir.
- Özellikle `users` kümesi ve `is_primary` backfill migration’ı danışman kararı olmadan commit/deploy hattına alınmamalıdır.

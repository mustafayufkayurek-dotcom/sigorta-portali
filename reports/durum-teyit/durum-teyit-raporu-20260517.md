# Durum Teyit Raporu — 17 Mayıs 2026

## 1. Yönetici Özeti

1. Local repo `main` branch üzerinde `fcbc037` commit’inde; ancak çalışma ağacında hem tracked hem untracked değişiklikler var, bu yüzden local HEAD production gerçeğiyle birebir eşit kabul edilemez.
2. Production tarafında çalışan container seti aktif ve healthy görünüyor: `sigorta-backend`, `sigorta-web`, `sigorta-postgres`, `sigorta-redis`, `sigorta-minio`, `sigorta-nginx`.
3. Production backend container adı önceki rapordaki isimden farklı; bu nedenle önceki `meridyen-backend-1` varsayımı artık geçerli değil, güncel gerçeklik `sigorta-backend` olarak teyit edildi.
4. Repo içi önceki raporlar production’ın 15 Mayıs itibarıyla danışman kararlarıyla uyumlu olduğunu söylüyor; ancak mevcut kod incelemesi bu uyumun bugün local kodda kısmen bozulduğunu gösteriyor.
5. En kritik sapma: backend `ClaimFilesService.create()` hâlen boş `fileNo` geldiğinde otomatik dosya numarası üretiyor; bu, “dosya numarası otomatik üretilmeyecek” kararıyla çelişiyor.
6. İkinci kritik sapma: backend create akışı `insuranceCompanyId`, `policyNo`, `claimNo`, `productBranch`, `lossType` alanlarını zorunlu kılıyor; bu, bunların evrensel zorunlu yapılmaması kararına aykırı.
7. Eksper portalı formu da `sigortaSirketi`, `policeNo`, bazı kimlik/iletişim alanları için bloklayıcı doğrulama içeriyor; bu nedenle “gereksiz zorunlu alanlar dosya oluşturmayı engellemeyecek” kararı local akışta tam korunmuyor.
8. Sigorta şirketi otomatik atama yönünde koda dayalı bir kanıt bulunmadı; mevcut akışlarda sigorta şirketi kullanıcı seçimiyle taşınıyor. Bu karar local kod ve önceki raporlarla uyumlu.
9. Ürün vizyonu açısından veri modeli ve analiz dokümanları halen genelleştirme yönünü destekliyor; fakat local backend/web validasyonları ve shared schema halen sigortacılık alanlarını merkezde tuttuğu için ürün kilitlenmesi riski sürüyor.
10. Bugün için en net tablo: stabilization ve domain-separation yönünde commitler mevcut, fakat çalışma ağacındaki yeni local değişiklikler ile önceki production-uyum raporu arasında kopukluk oluşmuş durumda; raporun geri kalanı bu ayrımı temel almalıdır.

## 2. Production ve Snapshot Teyidi

### 2.1 Production container durumu

Toplanan production çıktısına göre aktif container’lar:

- `sigorta-backend | app-backend | Up 38 minutes (healthy)`
- `sigorta-web | app-web | Up 2 hours (healthy)`
- `sigorta-postgres | postgres:16-alpine | Up 24 hours (healthy)`
- `sigorta-redis | redis:7-alpine | Up 24 hours (healthy)`
- `sigorta-minio | minio/minio:latest | Up 24 hours (healthy)`
- `sigorta-nginx | nginx:1.25-alpine | Up 5 days (healthy)`
- `sigorta-certbot | certbot/certbot:latest | Up 5 days`

### 2.2 Son migration teyidi

Mevcut repo ve önceki rapor kanıtlarına göre son teyit edilen migration bilgisi:

- Önceki mühendis raporunda son migration olarak `20260514130000_claim_subject_department_and_auto_codes` belirtilmiş.
- Local repoda bunun üstüne ayrıca şu uncommitted migration klasörü mevcut:
  - `apps/backend/prisma/migrations/20260517120000_user_department_memberships_is_primary_backfill/`

Yorum:
- Bu yeni migration local çalışma ağacında bulunuyor, fakat production’da çalıştırıldığına dair bu iterasyonda doğrudan DB çıktısı alınamadı.
- Bu nedenle güvenli ifade şudur: **production’da en az `20260514130000_claim_subject_department_and_auto_codes` seviyesine kadar teyit var; `20260517120000_user_department_memberships_is_primary_backfill` için production uygulama kanıtı yok.**

### 2.3 Local git HEAD ve çalışma ağacı

- Mevcut local branch: `main`
- Mevcut local HEAD: `fcbc037 feat: claim_responsibility_assignments seed - 6 records (consultant approved, countrywide, all coverage)`
- Son commit zincirinde öne çıkanlar:
  - `36e63f5 feat: user_department_memberships seed - real operation model (consultant approved)`
  - `fb0f187 feat: permission stabilization - fix guard fallback names, add DB permission loading to JWT, add 25 missing permissions migration`
  - `0af54bf feat: domain separation - claim subjects, user departments, responsibility assignments`
  - `0b4f0fa feat: sync ihbar konulari from admin settings API instead of hardcoded list`
  - `df5b37d feat: allow manual file number entry in eksper portal ihbar form`

### 2.4 Local çalışma ağacı ile snapshot farkı

Çalışma ağacında commitlenmemiş değişiklikler mevcut. Öne çıkanlar:

**Modified:**
- `apps/backend/package.json`
- `apps/backend/src/modules/users/users.controller.ts`
- `apps/backend/src/modules/users/users.service.ts`
- `apps/web/src/app/panel/ayarlar/kurulum/page.tsx`
- `apps/web/src/app/panel/kullanicilar/page.tsx`

**Untracked:**
- `MUHENDIS_RAPORU_20260515.md`
- `P1_TEKNIK_DUZELTME_PLANI.md`
- `PROFESSIONAL_CALISMA_MODELI.md`
- `PROJE_DEVIR_PLANI.md`
- `URUN_OLGUNLUK_ANALIZI.md`
- `apps/backend/prisma/migrations/20260514130000_claim_subject_department_and_auto_codes/`
- `apps/backend/prisma/migrations/20260517120000_user_department_memberships_is_primary_backfill/`
- `apps/backend/src/common/helpers/auto-code.helper.ts`
- `apps/backend/src/modules/users/users.dto.ts`
- `apps/backend/src/modules/users/users.service.spec.ts`
- `apps/web/src/app/panel/kullanicilar/_components/`
- `apps/web/src/app/panel/kullanicilar/_lib/`
- `apps/web/src/utils/screen-permissions.ts`
- `docs/sql/`
- `reports/`

Sonuç:
- **Production ile local repo arasında tam snapshot eşleşmesi teyit edilemedi.**
- Çünkü production içindeki uygulama dizini ve container adı değişmiş; ayrıca local çalışma ağacı temiz değil.
- Eldeki güvenli karşılaştırma şudur:
  - Production: healthy çalışan container seti mevcut.
  - Local HEAD: `fcbc037`.
  - Local working tree: ek migrationlar, users modülü değişiklikleri ve yeni rapor/dokümanlar içeriyor.
  - Bu nedenle production’ın tam olarak local HEAD veya working tree ile eşit olduğu söylenemez.

### 2.5 Önceki production raporu ile bugünkü teyit arasındaki ilişki

`MUHENDIS_RAPORU_20260515.md` şu iddiaları içeriyor:

- son deploy sonrası yeni validation yok
- son migration `20260514130000_claim_subject_department_and_auto_codes`
- danışman kararlarıyla %100 uyumluluk

Bugünkü toplu değerlendirme sonucu:
- Bu iddialar **15 Mayıs production snapshot’ı için belge kanıtı** olarak kullanılabilir.
- Ancak local kodun bugünkü hali, özellikle `claim-files.service.ts` ve eksper portal form validasyonları nedeniyle aynı uyumu artık yansıtmıyor.

## 3. Danışman Kararları Çelişki Kontrolü

Aşağıdaki tablo yalnızca istenen 5 karar alanını kapsar.

| Karar | Local kod durumu | Önceki production raporu | Sonuç |
|---|---|---|---|
| Dosya numarası otomatik üretilmeyecek, manuel giriş + benzersizlik | ÇELİŞİYOR | UYUMLU denmiş | Riskli / Kopuk |
| Sigorta şirketi otomatik atanmayacak, manuel seçilecek | UYUMLU | UYUMLU denmiş | Uyumlu |
| `insuranceCompanyId`, `policyNo`, `claimNo`, `productBranch`, `lossType` evrensel zorunlu olmayacak | ÇELİŞİYOR | UYUMLU denmiş | Riskli / Kopuk |
| Eksper portalı gereksiz zorunlu alanlarla akışı engellemeyecek | KISMEN ÇELİŞİYOR | UYUMLU denmiş | Riskli |
| Yeni validasyonlar ürünü sadece sigortacılığa kilitlemeyecek | KISMEN RİSKLİ | Stratejik olarak genelleştirme hedefi korunuyor | Riskli ama geri döndürülebilir |

### 3.1 Dosya numarası

**Karar:** otomatik üretilmeyecek, manuel giriş + benzersizlik.

**Local kod kanıtı:**
- `apps/backend/src/modules/claim-files/claim-files.service.ts`
- `create()` içinde:
  - kullanıcı `fileNo` gönderirse onu kullanıyor
  - boş gelirse `generateFileNo()` çağırıyor
- `generateFileNo()` ise `HD-${year}-${seq}` formatında otomatik dosya no üretiyor.

**Değerlendirme:**
- Bu davranış kararla doğrudan çelişiyor.
- `df5b37d feat: allow manual file number entry in eksper portal ihbar form` commit’i manuel giriş desteğini göstermesine rağmen otomatik fallback backend’de yaşamaya devam ediyor.

**Hüküm:** **Çelişki var.**

### 3.2 Sigorta şirketi otomatik atama

**Karar:** otomatik atanmayacak, manuel seçilecek.

**Local kod kanıtı:**
- Eksper portalı payload’ında `insuranceCompanyId: form.sigortaSirketi`
- Backend create akışında `insuranceCompanyId` request’ten alınarak kullanılıyor.
- Otomatik sigorta şirketi atayan bir helper/flow kanıtı bulunmadı.

**Önceki rapor kanıtı:**
- `MUHENDIS_RAPORU_20260515.md` içinde “Sigorta şirketi otomatik atanmayacak | ✅ Uyumlu”.

**Hüküm:** **Çelişki yok, uyumlu.**

### 3.3 Evrensel zorunlu alanlar

**Karar:** `insuranceCompanyId`, `policyNo`, `claimNo`, `productBranch`, `lossType` ayrı onay olmadan evrensel zorunlu yapılmayacak.

**Local kod kanıtı:**
- `apps/backend/src/modules/claim-files/claim-files.service.ts`
  - `if (!insuranceCompanyId) throw ... 'Sigorta şirketi zorunludur'`
  - `if (!policyNo) throw ... 'Poliçe numarası zorunludur'`
  - `if (!claimNo) throw ... 'Hasar numarası zorunludur'`
  - `if (!productBranch) throw ... 'Ürün branşı zorunludur'`
  - `if (!lossType) throw ... 'Hasar türü zorunludur'`
- `packages/shared/src/schemas.ts`
  - `createClaimFileSchema` içinde bu alanlar zorunlu tanımlı.
- Buna karşılık `URUN_OLGUNLUK_ANALIZI.md` açıkça bu alanların tümünün her senaryoda zorunlu olmaması gerektiğini söylüyor.

**Hüküm:** **Belirgin çelişki var.**

### 3.4 Eksper portalı bloklayıcı validasyon

**Karar:** gereksiz zorunlu alanlar dosya oluşturma akışını engellemeyecek.

**Local kod kanıtı:**
- `apps/web/src/app/panel/eksper-portal/page.tsx`
- Form validation şu alanları bloklayıcı yapıyor:
  - `policeTuru`
  - `konu`
  - `sigortaSirketi`
  - `policeNo`
  - `sigortaliAdi`
  - `sigortaliTelefon`
  - `il`
  - koşullu olarak `ilce`
  - ticari akışta `ticariUnvan`, `vergiDairesi`, `vergiNo`
- Submit payload ayrıca backend’in zorunlu kıldığı alanları da dolduruyor.

**Değerlendirme:**
- “Hiç zorunlu alan olmayacak” sonucu çıkmaz; ama mevcut form ve backend birlikte düşünüldüğünde akışın halen yüksek derecede bloklayıcı olduğu görülüyor.
- Önceki 15 Mayıs raporundaki “Zorunlu alan yok” ifadesi bugünkü local kodla örtüşmüyor.

**Hüküm:** **Kısmi çelişki / yüksek risk var.**

### 3.5 Ürün vizyonu sigortacılığa kilitlenme riski

**Karar:** yeni validasyonlar ürünü sadece sigortacılığa kilitlemeyecek.

**Lehte kanıtlar:**
- `URUN_OLGUNLUK_ANALIZI.md` ürünün genel servis operasyon platformuna evrilebileceğini açıkça savunuyor.
- `claim_subjects`, `user_department_memberships`, `claim_responsibility_assignments` gibi yeni domain ayrıştırmaları genelleşmeye elverişli.
- `claim_subjects` → departman ilişkisi ve çoklu departman üyeliği sektörden bağımsız modellere yakın.

**Aleyhte kanıtlar:**
- `ClaimFile` create akışı sigorta şirketi, poliçe, hasar numarası, ürün branşı, hasar türü gibi alanları zorunlu kılıyor.
- `packages/shared/src/schemas.ts` aynı alanları zorunlu tanımlıyor.
- Eksper portalı kopyası ve alan adları doğrudan sigortacılık diline bağlı.

**Hüküm:**
- **Tam kilitlenme olmuş değil**, ancak local validasyon katmanında belirgin sigortacılık merkezlenmesi var.
- Bu nedenle karar ile tam çelişki denmez; fakat **risk yüksek** denir.

## 4. Açık İşler ve Task Listesi

### 4.1 Bugün tamamlandığı commitlerle görülen stabilizasyon işleri

Aşağıdaki maddeler git geçmişinde tamamlanmış iş olarak görünüyor; production deploy durumu ayrı teyit edilmediği için sadece repo/commit gerçeği olarak yazılmıştır.

| Commit | İş | Durum | Not |
|---|---|---|---|
| `fcbc037` | `claim_responsibility_assignments` seed — 6 kayıt | Kodda tamam | Production uygulama teyidi yok |
| `36e63f5` | `user_department_memberships` seed — gerçek operasyon modeli | Kodda tamam | Production uygulama teyidi yok |
| `fb0f187` | permission stabilization, JWT’ye DB permission yükleme, eksik permission migration | Kodda tamam | Stabilizasyon niteliğinde |
| `0af54bf` | domain separation — claim subjects, user departments, responsibility assignments | Kodda tamam | Mimari temel atılmış |
| `0b4f0fa` | ihbar konularını admin settings API’dan senkronize etme | Kodda tamam | Hardcoded listeden çıkış yönünde |
| `df5b37d` | eksper portal ihbar formunda manuel dosya no girişi | Kodda tamam | Backend fallback nedeniyle karar tam kapanmamış |
| `365e23d` | eksper portal ihbar creation lifecycle unblock | Kodda tamam | Akış stabilizasyonu |
| `877cbea` | public insurance companies list unblock | Kodda tamam | Dropdown akışı için kritik |
| `38174da` | web tarafında eksper portal lifecycle stabilizasyonu | Kodda tamam | UI akışı iyileştirmesi |
| `b73ec45` | expert fotoğraf yükleme yeniden aktif | Kodda tamam | Fotoğraf akışında ilerleme |

### 4.2 Hâlen bekleyen / kapanmamış işler

| İş başlığı | Amaç | Mevcut durum | Risk |
|---|---|---|---|
| Dosya numarası kararının backend’de tam uygulanması | Otomatik üretimi kaldırmak | Açık | Yüksek |
| Evrensel zorunlu alanların gevşetilmesi | Ürünü sigortaya kilitlememek, akışı bloklamamak | Açık | Yüksek |
| Eksper portal bloklayıcı validasyon sadeleştirmesi | Formu kararlarla hizalamak | Açık | Yüksek |
| Permission modeli tek kaynaklı hale getirme | Guard / seed / frontend uyumunu sağlamak | Mimari plan hazır, uygulama sürüyor | Yüksek |
| Cascade delete / soft delete stratejisi | Veri kaybı riskini azaltmak | Plan aşamasında | Kritik |
| Temel regresyon testleri | Release blocker akışlarını otomatize etmek | Kısmi script var, kapsam yetersiz | Yüksek |
| Admin UI ayrıştırmaları | Departmanlar, ihbar konuları, dosya sorumluları | Eksik | Orta |
| Role switch / stale state sorunları | Kullanıcı ekran yetkisi ve görünürlük senkronizasyonu | Runtime regression raporunda FAIL | Yüksek |
| `isPrimary` validasyon regrese alanı | Çoklu departman üyeliği doğruluğu | Runtime regression raporunda FAIL | Yüksek |
| Expert 403 davranışı ve create/edit parity | Portal erişim ve form tutarlılığı | Runtime regression raporunda FAIL | Yüksek |

### 4.3 Mimari plan olarak bekleyen başlıklar

`P1_TEKNIK_DUZELTME_PLANI.md` ve `URUN_OLGUNLUK_ANALIZI.md` temelli bekleyen mimari başlıklar:

1. Yetki modelini tekilleştirme
2. Permission registry / seed / controller uyumu
3. Kritik veri silme stratejisinin cascade → restrict / soft-delete yönünde yeniden tasarımı
4. Temel regresyon testlerinin kalıcılaştırılması
5. Ürün çekirdeğini ekranlardan ayırma
6. Evrak modelini sadeleştirme
7. Seed ve kurulum gerçeğini tekilleştirme
8. Büyük ekranları modülerleştirme
9. Sektör dışı taşınabilirlik için domain soyutlaması

### 4.4 Açık işlerin okunma kuralı

Bu iterasyonda en önemli operasyonel not şudur:

- **Commit geçmişi**, stabilization yönünde önemli ilerleme gösteriyor.
- **Önceki production raporu**, 15 Mayıs snapshot’ında danışman kararlarıyla uyum söylüyor.
- **Bugünkü local kod**, bazı temel kararlarda yeniden sapma veya en azından kapanmamış geçiş durumu gösteriyor.

Dolayısıyla açık işler listesi değerlendirilirken:
- “commit var” = işin repo tarafında başlandığı veya kısmen bittiği,
- “production uyumlu” = yalnızca önceki snapshot için belgelenmiş bir durum,
- “bugünkü local gerçeklik” = yeni çelişkilerin aktif kaynak kodda görüldüğü durum
olarak ayrı okunmalıdır.

## Kanıt Özeti

- Git HEAD: `fcbc037`
- Çalışma ağacı kirli: modified + untracked dosyalar mevcut
- Production container isimleri: `sigorta-backend`, `sigorta-web`, `sigorta-postgres`, `sigorta-redis`, `sigorta-minio`, `sigorta-nginx`
- Önceki rapor: `MUHENDIS_RAPORU_20260515.md`
- Mimari plan: `P1_TEKNIK_DUZELTME_PLANI.md`
- Stratejik analiz: `URUN_OLGUNLUK_ANALIZI.md`
- Kritik local kod akışları:
  - `apps/backend/src/modules/claim-files/claim-files.service.ts`
  - `apps/web/src/app/panel/eksper-portal/page.tsx`
  - `packages/shared/src/schemas.ts`

## 5. Test Notları-2 Durum Matrisi

| Başlık | Durum | Kök neden | Etkilenen dosyalar | Çözüm sınırı | Test / kabul kriteri |
|---|---|---|---|---|---|
| Kurulum / Sistem Ayarları (koyu mod, renk şeması, Office 365 test maili) | Devam ediyor | `Kurulum` ekranı içinde tema (`mode`, `colorScheme`) ve Office 365 preset’i tanımlı; ancak bu rapor iterasyonunda bunların backend persist ve gerçek test-mail sonucu için ayrı kanıt yok | `apps/web/src/app/panel/ayarlar/kurulum/page.tsx` | UI/konfigürasyon seviyesi; production mail gönderim kanıtı bu rapor kapsamında yok | Kurulum ekranında koyu mod ve renk şeması seçenekleri görünmeli; Office 365 preset’i `smtp.office365.com:587 TLS` olarak seçilebilmeli; test mail sonucu ayrıca response/log kanıtı ile teyit edilmeli |
| Alan Zorunlulukları (geri tuşu, sayfa navigasyon standardı) | Riskli | Kurulum ekranında `window.history.back()` ile geri tuşu var; ancak standardizasyon tüm ayar ekranlarında kanıtlı değil. Zorunlu alan yönetimi ayrı ekrana taşınmış olsa da claim create ve eksper portal validasyonları hâlen bloklayıcı | `apps/web/src/app/panel/ayarlar/kurulum/page.tsx`, `apps/web/src/app/panel/ayarlar/alan-zorunluluklari/page.tsx`, `apps/backend/src/modules/claim-files/claim-files.service.ts`, `apps/web/src/app/panel/eksper-portal/page.tsx`, `packages/shared/src/schemas.ts` | UI + backend validation sınırı; tek ekran düzeltmesiyle kapanmaz | Ayar ekranlarında geri/navigasyon davranışı tutarlı olmalı; zorunlu alan yönetimi ekranı ile gerçek create validasyonları çelişmemeli; dosya oluşturma gereksiz alanlarla bloklanmamalı |
| Carilerim (finans menüsü, geri tuşu, finans sayfa tepkisi) | Beklemede | `Carilerim` ekranı müşteri/dosya listeliyor; finans menüsü veya geri tuşu içermiyor. Finans ilişkisi ürün analizinde route olarak geçiyor fakat `Carilerim` ile bağlantısına dair kod kanıtı yok | `apps/web/src/app/panel/carilerim/page.tsx`, `URUN_OLGUNLUK_ANALIZI.md` | Ekran kapsamı belirsiz; ürün kararı gerektirir | `Carilerim` için finans aksiyonu isteniyorsa route, buton ve permission matrisi açıkça tanımlanmalı; aksi halde “ekran kapsamı dışında” kararı yazılı teyit edilmelidir |
| Eksper Yeni İhbar (tarih alanı, fotoğraf yükleme, form gönderimi, sigorta şirketi tanıma) | Riskli | Form gönderimi ve fotoğraf yükleme akışı mevcut; ihbar konuları API’dan yükleniyor; ancak form zorunlu alanları hâlen yüksek derecede bloklayıcı. Sigorta şirketi manuel seçiliyor, otomatik tanıma kanıtı yok | `apps/web/src/app/panel/eksper-portal/page.tsx`, `apps/backend/src/modules/claim-files/claim-files.service.ts`, `packages/shared/src/schemas.ts`, `git log` içindeki `df5b37d`, `b73ec45`, `76d4be9`, `38174da` commitleri | Web form + backend create akışı; tek başına frontend değişikliği yetmez | Eksper portalında tarih alanı ve fotoğraf yükleme çalışmalı; en az 1 örnek create akışı başarılı olmalı; sigorta şirketi manuel seçim olarak kalmalı; gereksiz validasyonlar akışı kesmemeli |
| İhbar Konuları (admin tanımlarının eksper alanına yansıması, departman ilişkisi) | Devam ediyor | Admin tanımları `system-settings/ihbar-konulari` üzerinden yönetiliyor; eksper portalı konuları API’dan çekiyor; ayrıca migration ile `claim_subjects.department_id` eklenmiş. Ancak bu iki modelin tek bir kanonik yapı altında birleştiğine dair tam kanıt yok | `apps/web/src/app/panel/ayarlar/ihbar-konulari/page.tsx`, `apps/web/src/app/panel/eksper-portal/page.tsx`, `apps/backend/prisma/migrations/20260514130000_claim_subject_department_and_auto_codes/migration.sql`, `MUHENDIS_RAPORU_20260515.md` | Settings API + domain model hizalama sınırı | Admin’de eklenen/çıkarılan ihbar konusu eksper listesine yansımalı; departman ilişkisi response’da görülebilmeli; hardcoded liste kullanılmamalı |
| Fotoğraf algoritması (görsellerin dosya/rapor eklerine bağlanması) | Devam ediyor | Fotoğraf yükleme yeniden aktif edilmiş; eksper portalı ihbar fotoğraflarını gönderiyor. Ancak görselin dosya/rapor eki olarak ilişkilenmesini uçtan uca gösteren bu rapor iterasyonunda yeni kanıt yok | `apps/web/src/app/panel/eksper-portal/page.tsx`, `git log` içindeki `b73ec45`, `reports/runtime-stabilization` kanıt seti | Upload + attachment ilişkilendirme sınırı | Fotoğraf yüklemeden sonra ilgili dosya detayında veya rapor ekinde görsel referansı görünmeli; dosya/rapor ID bağının API cevabı veya DB select ile doğrulanması gerekir |

## 6. Test Notları-3 Durum Matrisi

| Başlık | Durum | Kök neden | Etkilenen dosyalar | Çözüm sınırı | Test / kabul kriteri |
|---|---|---|---|---|---|
| Kullanıcı mimarisi | Devam ediyor | Local değişiklikler kullanıcı modülüne nested departman üyeliği, sorumluluk ataması, hizmet alanı ve ekran izinlerini birlikte taşıyan yeni yapı ekliyor; ancak runtime regresyon raporu hydration, role-switch ve stale-state alanlarında FAIL veriyor | `apps/backend/src/modules/users/users.controller.ts`, `apps/backend/src/modules/users/users.service.ts`, `apps/backend/src/modules/users/users.dto.ts`, `apps/backend/src/modules/users/users.service.spec.ts`, `apps/web/src/app/panel/kullanicilar/page.tsx`, `apps/web/src/app/panel/kullanicilar/_components/*`, `apps/web/src/app/panel/kullanicilar/_lib/*`, `apps/web/src/utils/screen-permissions.ts`, `reports/runtime-stabilization/runtime-regression-report.md` | Backend + web + permission/hydration zinciri | `/users/:id` hydration PASS olmalı; role switch sonrası stale screen/service-area/departman kalmamalı; create/edit parity korunmalı |
| Evrak türleri | Beklemede | Ayarlar/tanımlar ekranında evrak türleri sekmesi var; seed SQL dosyası mevcut. Fakat bu iterasyonda evrak türlerinin production snapshot’ta aktif olduğuna veya dosya akışına bağlandığına dair doğrudan ekran/DB kanıtı toplanmadı | `apps/web/src/app/panel/ayarlar/tanimlar/page.tsx`, `docs/sql/document_types_seed.sql` | Tanım verisi + dosya iş akışı sınırı | Evrak türleri listesi okunmalı, oluşturulmalı ve dosya içinde seçilebilir olmalı; kanıt olarak endpoint veya UI response eklenmeli |
| İhbar/departman ilişkisi | Devam ediyor | `claim_subjects.department_id` migration ile eklendi; önceki mühendis raporu `claim-subjects/active` endpoint’inin kategori + departman ID’ye göre döndüğünü belirtiyor. Ancak current production DB’den bu raporda yeni SELECT kanıtı alınamadı | `apps/backend/prisma/migrations/20260514130000_claim_subject_department_and_auto_codes/migration.sql`, `MUHENDIS_RAPORU_20260515.md`, `URUN_OLGUNLUK_ANALIZI.md` | Migration + endpoint + UI entegrasyon sınırı | Seçilen departmana göre uygun ihbar konuları dönmeli; endpoint cevabında department referansı görünmeli; eksper/admin akışları aynı kaynağı kullanmalı |
| Hizmet türleri | Devam ediyor | Migration `service_types.code` alanını ve benzersiz indexi ekliyor; ayrıca service-types controller seed/create/update/delete sunuyor. Fakat mevcut production snapshot için son verinin ne durumda olduğu okunamadı | `apps/backend/prisma/migrations/20260514130000_claim_subject_department_and_auto_codes/migration.sql`, `apps/backend/src/common/helpers/auto-code.helper.ts`, `apps/backend/src/modules/service-types/service-types.controller.ts`, `apps/web/src/app/panel/ayarlar/tanimlar/page.tsx` | Seed + admin yönetimi + production veri kanıtı sınırı | Hizmet türleri listesinde benzersiz kod görünmeli; yeni kayıtlar çakışmadan oluşmalı; admin ekranı ile API aynı veri modelini göstermeli |
| Otomatik kod kapsamı | Karar gerekiyor | `auto-code.helper.ts` genel amaçlı otomatik kod üretimi ekliyor; migration da `service_types.code` için kod standardı tanımlıyor. Buna karşılık danışman kararı dosya numarası için otomatik üretime karşı. Hangi entity’lerde otomatik kod serbest olduğu net çizilmemiş | `apps/backend/src/common/helpers/auto-code.helper.ts`, `apps/backend/prisma/migrations/20260514130000_claim_subject_department_and_auto_codes/migration.sql`, `apps/backend/src/modules/claim-files/claim-files.service.ts` | Domain policy sınırı; koddan çok karar meselesi | Otomatik kodun geçerli olduğu tablolar yazılı tanımlanmalı; `claim_files.fileNo` bunun dışında bırakılmalı; her entity için unique ve geriye uyumlu davranış ayrı test edilmeli |

## 7. Risk Listesi

| Risk adı | Neden önemli | Kod / veri / production kanıtı | Olası etki | Önerilen çözüm | Test / acceptance kriteri | Onay gerekiyor mu |
|---|---|---|---|---|---|---|
| Local-production snapshot kopukluğu | Karar verirken yanlış referans alınmasına yol açar | Local HEAD `fcbc037`; kirli çalışma ağacı mevcut; production backend container `Created=2026-05-17T16:59:40Z`, `StartedAt=2026-05-17T17:00:18Z`; production DB migration SELECT’i bu iterasyonda alınamadı | Hatalı deploy, yanlış teyit, müşteri güveni kaybı | Deploy öncesi local temiz ağaç + production image/migration parity raporu zorunlu tutulmalı | HEAD, image, migration listesi ve diff envanteri tek tabloda eşleşmeli | Evet |
| Kullanıcı mimarisi regresyonu | Yeni kullanıcı modeli sistem genel erişimi etkiliyor | `users.service.ts` local diff büyük; runtime test 1/4/5/9/10 FAIL | Yetki hatası, ekran kaybı, kullanıcı oluşturma/güncelleme bozulması | Nested kullanıcı yapısı ile runtime regression sonuçları hizalanmalı | Hydration, role-switch cleanup, isPrimary, create/edit parity testleri PASS olmalı | Evet |
| `isPrimary` veri doğruluğu riski | Çoklu departman mimarisinin çekirdeği bozulur | Test 5 FAIL; `missingPrimaryStatus: 200`; local backfill migration tüm kayıtları false yapıp belirli email’leri tekrar true yapıyor | Yetki/atama sapması, yanlış departman görünümü | Backfill ve validation davranışı birlikte gözden geçirilmeli | Primary olmayan güncelleme 4xx vermeli; her kullanıcıda tek primary garantilenmeli | Evet |
| Stale state / role switch kalıntısı | Rol değişiminde görünmemesi gereken ekranlar kalıyor | Test 4 ve 9 FAIL; stale screen listeleri kanıtlı | Yetki ihlali, yanlış ekran görünümü, operasyon hatası | Role switch temizliği ile frontend hydration aynı sözleşmede toparlanmalı | Rol değişiminden sonra screen/service-area/departman kalıntısı sıfır olmalı | Evet |
| Evrensel zorunlu alan blokajı | Ürünü sigortaya kilitleyip dosya açmayı gereksiz yere engeller | `claim-files.service.ts` zorunlu alan exception’ları; `packages/shared/src/schemas.ts` zorunlu şema; eksper portal validasyonları | Form gönderim başarısızlığı, düşük dönüşüm, ürün kısıtı | Zorunlu alanlar departman/ürün tipine göre yeniden sınıflanmalı | Sigortasız veya sade akış için create işlemi bloklanmamalı | Evet |
| Dosya numarası karar sapması | Danışman kararına doğrudan aykırı davranış üretir | `claim-files.service.ts` içinde boş `fileNo` için `generateFileNo()` fallback’i | Uyuşmaz iş kuralı, kayıt standardı bozulması | `claim_files.fileNo` için otomatik fallback tamamen kaldırılmalı veya karar güncellenmeli | Boş fileNo ile create sonucu karar dokümanına uygun olmalı | Evet |
| Public / düşük korumalı referans endpoint riski | Referans veri sızıntısı veya erişim modelinde belirsizlik yaratabilir | Önceki commit geçmişinde `claim-status` için `@Public()` düzeltmesi var; önceki mühendis raporu `claim-subjects/active` endpoint’ini düşük riskli/public benzeri değerlendiriyor | Yetki, veri görünürlüğü, güven modeli karışıklığı | Public olması gereken/olmayan endpointler envanterlenmeli | Her public endpoint için veri sınıflandırması ve kabul kararı olmalı | Evet |
| Fotoğraf akışı kanıt eksikliği | Upload var ama dosya/rapor bağının kopuk olma ihtimali sürer | Commit geçmişinde fotoğraf düzeltmeleri var; eksper portalında upload alanı mevcut; uçtan uca attachment kanıtı bu raporda sınırlı | Fotoğraf kaybı, rapor eksikliği, müşteri güveni | Upload sonrası dosya/rapor attachment teyidi ayrı kanıt setiyle doğrulanmalı | Yüklenen görsel dosya detayında/raporda görünmeli | Hayır |
| Production migration görünürlüğü eksikliği | Production veri modelinin local kodla aynı olup olmadığı belirsiz kalıyor | Production DB `_prisma_migrations` sorgusu parola nedeniyle sonuç dönmedi | Deploy/migration uyumsuzluğu, runtime hata | Read-only DB erişim bilgisi standartlaştırılmalı | Son 5 migration kaydı okunabilir ve rapora eklenebilir olmalı | Evet |

## 8. Teknik Borç Listesi

| Teknik borç | Gözlem | Kanıt | Etki |
|---|---|---|---|
| Zorunlu alanlar çatışması | Ayarlarda alan zorunlulukları yönetiliyor; fakat gerçek create akışı ayrı kurallarla çalışıyor | `apps/web/src/app/panel/ayarlar/alan-zorunluluklari/page.tsx`, `apps/backend/src/modules/claim-files/claim-files.service.ts`, `packages/shared/src/schemas.ts`, `apps/web/src/app/panel/eksper-portal/page.tsx` | UI kararları ile backend davranışı ayrışıyor |
| Sigorta bağımlılığı | Domain ayrışmasına rağmen create ve form katmanı sigortacılık terimlerine sıkı bağlı | `URUN_OLGUNLUK_ANALIZI.md`, `claim-files.service.ts`, `exper-portal/page.tsx`, `schemas.ts` | Ürünün sektör dışı genellenmesi zorlaşıyor |
| Test eksikleri | Runtime regression seti var ama kritik akışların bir bölümü FAIL; users modülü için yeni spec eklenmiş olsa da kapsam sınırlı | `reports/runtime-stabilization/runtime-regression-report.md`, `apps/backend/src/modules/users/users.service.spec.ts` | Regresyonlar production’a sızabilir |
| Cascade ilişkiler | Stratejik analiz veri kaybı riskini vurguluyor; bu rapor iterasyonunda ilişkilerin tam matrisi çıkarılmadı | `URUN_OLGUNLUK_ANALIZI.md` | Silme işlemlerinde veri/iz kaybı olabilir |
| Public endpointler | Hangi endpoint’in gerçekten public kalacağı ve neden düşük riskli olduğu tek listede toplanmış değil | `git log` içindeki `db5d527`, `MUHENDIS_RAPORU_20260515.md` | Güvenlik modeli belirsizleşir |

## 9. Eksik Kanıtlar

1. Production DB `_prisma_migrations` son 5 kaydı:
   - Denenen sorgu parola nedeniyle sonuç üretmedi.
   - Bu yüzden `20260517120000_user_department_memberships_is_primary_backfill` migration’ının production’da çalıştığı söylenemiyor.
2. Production backend image ile local `fcbc037` commit eşleşmesi:
   - Container create/start zamanı var, fakat image içine gömülü git SHA kanıtı yok.
3. Kurulum ekranındaki koyu mod / renk şeması ayarlarının persist ve runtime etkisi:
   - UI tanımı var, ancak response/log kanıtı yok.
4. Office 365 test mailinin gerçekten gönderildiği kanıt:
   - Preset tanımı var, test gönderimi çıktısı yok.
5. Carilerim ekranı için finans menüsü / geri tuşu / finans sayfa tepkisi:
   - Ekran kodunda buna dair doğrudan unsur bulunamadı; talebin kapsam kararı eksik.
6. Fotoğraf algoritmasının görseli dosya veya rapor ekine bağladığını gösteren yeni uçtan uca kanıt:
   - Upload bileşeni ve önceki fix commit’leri var; attachment response kanıtı yok.
7. Evrak türleri için aktif endpoint/UI response kanıtı:
   - Ayar ekranı ve seed SQL var; production veri veya örnek response eklenmedi.
8. İhbar konusu admin tanımı ile departmanlı `claim_subject` modelinin tek kanonik yapı olarak birleştiği kanıt:
   - İki ayrı kanıt var, ancak aynı response zincirinde birleşik kanıt yok.

## 10. Sıradaki 3 Güvenli Adım

1. **Production migration görünürlüğünü tamamla**
   - Amaç: `_prisma_migrations` son 5 kaydını read-only şekilde rapora eklemek.
   - Güvenlik gerekçesi: Sadece SELECT ve container/env doğrulaması yapılır, veri değişmez.
   - Durma noktası: Son 5 migration adı + `finished_at` tablosu elde edilince dur.

2. **Kirli çalışma ağacı dosyaları için satır-bazlı karar etiketi çıkar**
   - Amaç: Her modified/untracked dosyayı “production etkili / sadece dokümantasyon / migration riski / kullanıcı ekranı riski” şeklinde tek listede sınıflamak.
   - Güvenlik gerekçesi: Sadece diff ve kaynak okuma yapılır.
   - Durma noktası: Tüm kirli dosyalar için tür + etki + danışman çelişki etiketi tamamlanınca dur.

3. **Runtime FAIL testlerini rapor eki olarak karar listesine bağla**
   - Amaç: Test 1/4/5/7/9/10 bulgularını risk ve teknik borç maddelerine birebir referanslamak.
   - Güvenlik gerekçesi: Var olan kanıt dosyaları okunur, kod çalıştırılmaz.
   - Durma noktası: Her FAIL test en az bir risk veya teknik borç maddesine bağlanınca dur.

Bu rapor kapsamında kod değişikliği, deploy, migration, seed veya validation değişikliği yapılmamıştır.

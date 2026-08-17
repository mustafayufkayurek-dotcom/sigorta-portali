# PROJE DEVİR PLANI

## Amaç

Bu doküman, `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi` projesinin Codex/ChatGPT tarafına güvenli, eksiksiz ve operasyonel olarak anlamlı şekilde devredilebilmesi için hazırlanmıştır. Amaç yalnızca kaynak kodu paylaşmak değil; proje bağlamını, aktif kararları, üretim durumunu, riskleri, açık işleri ve çalışma sınırlarını birlikte aktarabilmektir.

Bu plan, aşağıdaki kaynakların birlikte değerlendirilmesiyle oluşturulmuştur:

- Repo: `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi`
- Merkezi hafıza: `/Users/mustafayufkayurek/.verdent/workspace/base/MEMORY.md`
- Masaüstü danışman dokümanları:
  - `/Users/mustafayufkayurek/Desktop/URUN_OLGUNLUK_ANALIZI.md`
  - `/Users/mustafayufkayurek/Desktop/P1_REVIZE_TEKNIK_PLAN.md`
  - `/Users/mustafayufkayurek/Desktop/MUHENDIS_RAPORU_20260515.md`
  - `/Users/mustafayufkayurek/Desktop/GUN_SONU_PRODUCTION_KONTROL_20260515.md`

## Kapsam ve Güvenlik İlkeleri

- Secret, parola, token, API key, private certificate ve gerçek `.env` içerikleri devredilmeyecek.
- Production erişim bilgileri dokümana yazılmayacak; yalnızca erişim modeli ve operasyon akışı özetlenecek.
- Devir paketi, inceleme ve geliştirme için yeterli olacak; canlı yönetim yetkisi devretmeyecek.
- Kaynak dosyalar ile dokümanlar çelişirse teknik gerçeklikte kod ve konfigürasyon öncelikli kabul edilecek.
- README ve bazı eski dokümanlarda örnek credential veya eski davranış bilgileri bulunduğundan, bu alanlar devir paketinde redakte edilerek yeniden özetlenecek.

---

## 1. Devir paketi içerik listesi

### 1. Güncel proje kod tabanı

Hazırlanacak içerik:

- Monorepo yapısının özeti
- Uygulama bazlı kapsam:
  - `apps/backend` — NestJS API
  - `apps/web` — Next.js 14 yönetim paneli
  - `apps/mobile` — Expo tabanlı mobil uygulama
  - `packages/shared` — ortak tipler ve şemalar
  - `scripts` — deploy/smoke/yardımcı operasyon scriptleri
  - Docker ve Nginx altyapısı
- Hariç tutulacak klasörler:
  - `node_modules`
  - build çıktıları (`dist`, `.next`)
  - local upload/veri klasörleri
  - cache/artifacts

Kaynaklar:

- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/README.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/package.json`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/pnpm-workspace.yaml`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/packages/shared`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docker-compose.yml`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docker-compose.prod.yml`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/Dockerfile.backend`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/Dockerfile.web`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/nginx`

Not:

- Repo, kod tabanı açısından yeterli kapsama sahip; ancak ham repo kopyasının doğrudan zip’lenmesi yerine redakte edilmiş, indekslenmiş ve açıklamalı teslim önerilir.

### 2. Çalıştırma bilgileri

Hazırlanacak içerik:

- Lokal geliştirme gereksinimleri
- Sürüm matrisi
- Başlatma komutları
- Docker tabanlı yardımcı servisler
- Web/backend/mobile çalışma düzeni
- Temel kalite komutları

Kaynaklar:

- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/README.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/package.json`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/package.json`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/web/package.json`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/mobile/package.json`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docker-compose.yml`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docs/OPERATIONS.md`

Öne çıkan gerçeklik:

- Root `package.json` Node `>=18`, pnpm `>=8` istiyor.
- Repo, Turbo tabanlı monorepo.
- Local servisler için PostgreSQL + Redis + MinIO `docker-compose.yml` üzerinden ayağa kalkıyor.
- Mobil uygulama Expo tabanlı; bu nedenle mobil kurulum adımları ayrı başlıkla aktarılmalı.

### 3. Ortam değişkenleri

Hazırlanacak içerik:

- Tekilleştirilmiş environment değişken kataloğu
- Root `.env.example` ile `apps/backend/.env.example` karşılaştırması
- Her değişken için:
  - hangi servis kullanıyor
  - zorunlu / opsiyonel
  - secret / non-secret
  - local / production etkisi

Kaynaklar:

- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/.env.example`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/.env.example`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docs/ENV_VARIABLES.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docker-compose.prod.yml`

Kritik notlar:

- Root `.env.example` çok daha kapsamlı; backend tarafındaki `.env.example` ise neredeyse boş ve devir için yetersiz.
- `docs/ENV_VARIABLES.md` içinde örnek secret benzeri değerler bulunuyor; bunlar doğrudan taşınmamalı, açıklamalı placeholder’a dönüştürülmeli.
- `NEXT_PUBLIC_*` değişkenlerinin build-time davranışı ayrıca belirtilmeli.

### 4. Veritabanı bilgisi

Hazırlanacak içerik:

- Prisma schema özeti
- Migration envanteri
- Seed akışı
- Lookup tabloları ve özel seed notları
- Seed / dokümantasyon uyumsuzluk riskleri

Kaynaklar:

- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/prisma/schema.prisma`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/prisma/migrations`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/prisma/seed.ts`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/IMPLEMENTATION_SUMMARY.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/DOMAIN_MAPPING.md`
- `/Users/mustafayufkayurek/Desktop/URUN_OLGUNLUK_ANALIZI.md`

Öne çıkan gerçeklik:

- Son önemli veri modeli değişikliği domain separation çalışması ile yapılmış.
- `ClaimSubject`, `UserDepartmentMembership`, `ClaimResponsibilityAssignment` yeni bağlam için kritik.
- Ürün olgunluk analizine göre seed/dokümantasyon gerçekliği arasında tarihsel sapmalar var.
- `document_types` seed konusu daha önce kritik risk olarak işaretlenmiş.

### 5. Production durumu

Hazırlanacak içerik:

- Son bilinen production durumu
- Son deploy ve son doğrulama özeti
- Aktif davranışlar, stabilite kararı ve dikkat gerektiren alanlar
- Açık production sonrası izleme başlıkları

Kaynaklar:

- `/Users/mustafayufkayurek/.verdent/workspace/base/MEMORY.md`
- `/Users/mustafayufkayurek/Desktop/GUN_SONU_PRODUCTION_KONTROL_20260515.md`
- `/Users/mustafayufkayurek/Desktop/MUHENDIS_RAPORU_20260515.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docs/PRODUCTION_DEPLOYMENT_STANDARDI.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docs/OPERATIONS.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/ROUTE_INVENTORY.md`

Öne çıkan gerçeklik:

- Production durumu stable olarak işaretlenmiş.
- Son deploy 14 Mayıs bilgisi yönetsel bağlamda korunmalı.
- 15 Mayıs production kontrol raporu, servis sağlık ve smoke doğrulamasını özetliyor.
- Production baseline’ın korunması danışman kararı olarak özellikle vurgulanmalı.

### 6. MEMORY.md ve karar kayıtları

Hazırlanacak içerik:

- MEMORY’den projeye ait bağlam özeti
- Danışman kararları
- Bağlayıcı teknik karar listesi
- Geçici / kesin / tekrar doğrulanmalı ayrımı

Kaynaklar:

- `/Users/mustafayufkayurek/.verdent/workspace/base/MEMORY.md`
- `/Users/mustafayufkayurek/Desktop/P1_REVIZE_TEKNIK_PLAN.md`
- `/Users/mustafayufkayurek/Desktop/MUHENDIS_RAPORU_20260515.md`
- Repo içi teknik plan ve analiz dokümanları

Öne çıkan gerçeklik:

- Permission standardı, soft delete, test önceliği, public endpoint güvenliği, cascade → restrict dönüşümü bağlayıcı kararlar olarak taşınmalı.
- Ürün yalnızca hasar yazılımı değil, operasyon koordinasyon platformu olarak konumlanıyor.
- Production’da büyük refactor ve agresif değişikliklere kapalı dönem ilkesi sürüyor.

### 7. Açık task listesi

Hazırlanacak içerik:

- `devam eden`
- `bekleyen`
- `paused`
- `has_questions`

ayrımına göre normalize edilmiş görev listesi.

Kaynaklar:

- `/Users/mustafayufkayurek/Desktop/P1_REVIZE_TEKNIK_PLAN.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/BACKLOG.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/IMPLEMENTATION_SUMMARY.md`
- `/Users/mustafayufkayurek/.verdent/workspace/base/MEMORY.md`
- `/Users/mustafayufkayurek/Desktop/GUN_SONU_PRODUCTION_KONTROL_20260515.md`

Öne çıkan gerçeklik:

- Domain separation sonrası admin UI ve routing uyarlamaları açık iş olarak duruyor.
- P1 teknik plan, doğrudan backlog’a çevrilebilir.
- Production kontrol raporunda açık kalan has_questions ve paused konuları ayrıca sınıflandırılmalı.

### 8. Kod kalitesi ve risk dokümanları

Hazırlanacak içerik:

- Risk dokümanları indeksi
- Doküman başına kapsam ve geçerlilik değerlendirmesi
- Öncelikli okunma sırası

Kaynaklar:

- `/Users/mustafayufkayurek/Desktop/URUN_OLGUNLUK_ANALIZI.md`
- `/Users/mustafayufkayurek/Desktop/P1_REVIZE_TEKNIK_PLAN.md`
- `/Users/mustafayufkayurek/Desktop/MUHENDIS_RAPORU_20260515.md`
- `/Users/mustafayufkayurek/Desktop/GUN_SONU_PRODUCTION_KONTROL_20260515.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/BACKLOG.md`

Öne çıkan gerçeklik:

- `URUN_OLGUNLUK_ANALIZI.md` çok kritik ve önce okunması gereken ana analiz belgesi.
- `BACKLOG.md`, silent catch / workaround haritası açısından özellikle frontend risklerini görünür kılıyor.
- `MUHENDIS_RAPORU_20260515.md`, danışman kararları ile teknik gerçekliğin uyum kontrolünü içeriyor.

### 9. Deploy ve operasyon bilgileri

Hazırlanacak içerik:

- Deploy akışı
- Smoke test yaklaşımı
- Rollback özeti
- Log ve gözlemleme notları
- OOM ve düşük kaynak riski

Kaynaklar:

- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docs/PRODUCTION_DEPLOYMENT_STANDARDI.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docs/OPERATIONS.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/docs/SPRINT2_ROLLBACK_PLAN.md`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/scripts`
- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/backup.sh`

Öne çıkan gerçeklik:

- Dokümanlarda production IP ve örnek SSH/rsync akışları geçiyor; devir paketinde bu kısım redakte edilerek prosedür seviyesinde verilmeli.
- 4GB RAM kaynaklı OOM build riski açıkça belgelenmeli.
- Tek seferde full rebuild yaklaşımı önerilmiyor; servis bazlı kontrollü dağıtım notu aktarılmalı.

### 10. Sınırlı test erişimi

Hazırlanacak içerik:

- Geçici test kullanıcısı politikası
- Gerekli rol setleri
- Minimum yetki ilkesi
- Hangi akışların hangi kullanıcı ile test edileceği
- Test sonrası kapatma/rotasyon planı

Kaynaklar:

- `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/apps/backend/prisma/seed.ts`
- `/Users/mustafayufkayurek/Desktop/GUN_SONU_PRODUCTION_KONTROL_20260515.md`
- `/Users/mustafayufkayurek/.verdent/workspace/base/MEMORY.md`
- Permission / role / auth akışları

Kritik not:

- Mevcut dokümanlarda örnek kullanıcı e-posta ve şifre bilgileri dağınık şekilde görünüyor.
- Devir paketinde gerçek veya yaşayan test hesabı paylaşılmamalı.
- Bunun yerine rol bazlı “oluşturma ve rotasyon politikası” anlatılmalı.

---

## 2. Hangi dosyaların/dokümanların nereden alınacağı

### Birincil kaynaklar

1. Repo içi teknik gerçeklik
   - Kod
   - Docker compose dosyaları
   - Dockerfile’lar
   - Nginx konfigürasyonları
   - Prisma schema/migration/seed
   - Script’ler
   - README ve docs klasörü

2. Merkezi proje hafızası
   - `/Users/mustafayufkayurek/.verdent/workspace/base/MEMORY.md`

3. Masaüstü danışman dokümanları
   - analiz
   - teknik plan
   - mühendis raporu
   - gün sonu production kontrol

### İkincil kaynaklar

- Commit geçmişi
- Repo içi ek markdown özetleri:
  - `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/IMPLEMENTATION_SUMMARY.md`
  - `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/DOMAIN_MAPPING.md`
  - `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/ROUTE_INVENTORY.md`
  - `/Users/mustafayufkayurek/Projects/sigorta-hasar-sistemi/YAZILIM_DOKUMANTASYONU.md`

### Kaynak güven sırası

1. Kod ve çalışan konfigürasyon
2. Migration / seed / script dosyaları
3. MEMORY
4. Güncel masaüstü raporları
5. README ve eski özet dokümanlar

### Çakışma çözüm kuralı

- Kod ile doküman çelişirse: kod öncelikli
- Seed ile README çelişirse: seed öncelikli, README uyumsuzluk olarak notlanır
- Production raporu ile repo farklıysa: “doğrulanmalı” etiketiyle aktarılır
- MEMORY ile eski repo dokümanı çelişirse: MEMORY + mevcut kod birlikte değerlendirilir

---

## 3. Eksik bilgilerin tespiti

Codex/ChatGPT tarafının projeyi doğrudan inceleyebilmesi için aşağıdaki boşluklar ayrıca işaretlenmelidir.

### Kritik eksik veya doğrulanması gereken alanlar

1. **Backend `.env.example` yetersiz**
   - `apps/backend/.env.example` neredeyse boş.
   - Gerçek env kataloğu root `.env.example` ve `docs/ENV_VARIABLES.md` üzerinden çıkarılmalı.

2. **README’de eski/uyumsuz bilgiler var**
   - Varsayılan admin kullanıcı ve örnek credential bilgileri artık authoritative kabul edilmemeli.
   - Devir paketinde README doğrudan kopyalanmamalı, redakte edilerek özetlenmeli.

3. **Seed / permission / dokümantasyon uyumu riskli**
   - Ürün olgunluk analizinde permission sözlüğü uyumsuzluğu açık risk olarak geçiyor.
   - Codex/ChatGPT devralırken yanlış kaynağı authoritative sanabilir.

4. **Son migration ↔ production uygulama eşlemesi tek yerde normalize değil**
   - Domain separation migration bilgisi mevcut, ancak production’da tam hangi migration setinin kesin uygulandığı ayrıca doğrulanmalı.

5. **Lookup seed akışı parçalı olabilir**
   - `document_types` ve benzeri lookup verilerinde tarihsel olarak ayrı seed/SQL akışı bulunduğu belirtilmiş.
   - Tek referans akış dokümanı hazırlanmalı.

6. **Açık görevler tek bir normalize backlog’da birleşik değil**
   - `BACKLOG.md`, `IMPLEMENTATION_SUMMARY.md`, MEMORY ve masaüstü planları arasında dağınık.

7. **Test kullanıcı stratejisi yazılı ve güvenli formatta hazır değil**
   - Yaşayan kullanıcı bilgisini değil, rol bazlı test erişim politikasını aktarmak gerekiyor.

8. **Production operasyon akışı belgelerde hassas ayrıntı içeriyor**
   - Redaksiyon yapılmadan doğrudan paylaşım güvenlik riski üretir.

9. **Mobile uygulama onboarding notları dağınık**
   - `apps/mobile/package.json` komutları mevcut; ancak cihaz/emülatör, Expo ve çevre bağımlılıklarının ayrıca özetlenmesi gerekir.

10. **Danışman bağlayıcı kararları çok yoğun**
   - MEMORY’de çok sayıda bağlayıcı ilke var; bunlar normalize edilmezse model yanlış öneriler üretebilir.

### Eksik bilgi işaretleme formatı

Her eksik için devir paketinde şu format kullanılmalı:

- Başlık
- Etki alanı
- Neden önemli
- Muhtemel kaynak
- Doğrulama durumu:
  - tamam
  - doğrulanmalı
  - redakte edilmeli
  - eksik

---

## 4. Devir paketinin yapısı

Önerilen klasör yapısı:

```text
PROJE_DEVIR_PAKETI/
  00_INDEX/
    DEVIR_REHBERI.md
    ICERIK_HARITASI.md
    KAYNAK_ENVANTERI.md
  01_KOD_TABANI/
    REPO_SNAPSHOT.md
    MONOREPO_HARITASI.md
    UYGULAMA_OZETLERI.md
  02_CALISTIRMA/
    LOCAL_KURULUM.md
    SURUM_MATRISI.md
    KOMUT_MATRISI.md
  03_ENV/
    ENV_KATALOGU.md
    ENV_REDAKSIYON_NOTLARI.md
  04_VERITABANI/
    SCHEMA_OZETI.md
    MIGRATION_ENVANTERI.md
    SEED_VE_LOOKUP_NOTLARI.md
  05_PRODUCTION/
    PRODUCTION_DURUMU.md
    AKTIF_KARARLAR.md
    ACIK_PRODUCTION_KONULARI.md
  06_MEMORY_KARARLAR/
    MEMORY_OZETI.md
    DANISMAN_KARARLARI.md
    TEKNIK_KARAR_KAYITLARI.md
  07_TASKS/
    ACIK_TASK_LISTESI.md
    P1_BACKLOGA_DONUSUM.md
  08_RISK_KALITE/
    RISK_DOKUMANLARI_INDEX.md
    ONCELIKLI_OKUMA_REHBERI.md
  09_OPERASYON/
    DEPLOY_OZETI.md
    ROLLBACK_OZETI.md
    SMOKE_TEST_OZETI.md
    OPERASYON_RISKLERI.md
  10_TEST_ERISIMI/
    GECICI_TEST_KULLANICI_POLITIKASI.md
  99_KONTROL/
    SECRET_REVIEW_CHECKLIST.md
    TESLIM_ONCESI_KONTROL.md
```

### Paketleme tercihi

Önerilen teslim biçimi:

- Açıklamalı klasör yapısı
- Gerekirse bunun tek zip çıktısı

Tercih nedeni:

- Ham repo zip yerine daha güvenli
- Codex/ChatGPT için okunabilir
- Gizlilik ve onboarding kalitesini artırır

Kaçınılması gereken teslim biçimi:

- Tüm proje dizinini olduğu gibi sıkıştırmak

Riskleri:

- secret sızıntısı
- gereksiz build/cache yükü
- uploads veya lokal çalışma artıkları
- production’a özgü dosya bulaşması

---

## 5. Riskler ve dikkat edilecek noktalar

### Secret ve erişim güvenliği

Paket içine alınmamalı:

- `.env.production`
- gerçek `.env`
- JWT secret
- DB bağlantı şifreleri
- Redis parolası
- MinIO access/secret key
- SMTP parola
- Sentry DSN’nin gerçek production değeri
- SSH komut detayları ve credential kalıntıları
- private SSL materyalleri

### Dokümanlarda redaksiyon gerektiren alanlar

- README içindeki örnek kullanıcı/şifreler
- production deploy dokümanlarındaki doğrudan erişim komutları
- operasyon notlarındaki IP / erişim / komut dizileri
- env dokümanlarındaki örnek secret benzeri değerler

### Teknik/operasyonel riskler

1. Seed ve dokümantasyon arasında uyumsuzluk riski
2. Permission sözlüğünün tek kaynakta normalize edilmemiş olması
3. Cascade delete geçmişi ve soft-delete kararlarının kritikliği
4. Production stable döneminde büyük değişiklik önerilmemesi gereği
5. OOM build riski
6. Public endpoint’lerin güvenli kapsamının doğru anlatılması gereği
7. Açık backlog’un dağınık yapısı

### Codex/ChatGPT için dikkat notları

- Bu proje yalnızca hasar takip yazılımı olarak ele alınmamalı.
- Ürün vizyonu operasyon koordinasyon platformu yönünde.
- Danışman kararları bağlayıcıdır; yeni öneriler bunlarla çelişmemelidir.
- Production baseline korunmalıdır; “iyileştirme” adı altında geniş refactor önerilmemelidir.

---

## 6. Adım adım hazırlama planı

### Adım 1 — Kaynak envanterini kesinleştir

Yapılacaklar:

- Repo içi kaynakları sınıflandır
- Merkezi MEMORY’den bu projeye ait maddeleri ayıkla
- Masaüstü dokümanlarını devir kapsamına bağla
- Hariç tutulacak klasör ve dosya türlerini netleştir

Çıktı:

- Kaynak envanteri
- paylaşılabilir / paylaşılmayacak varlık listesi

### Adım 2 — 10 başlık için kaynak eşleme tablosu hazırla

Yapılacaklar:

- Her devir maddesini somut kaynak dosyalara bağla
- Birincil ve ikincil kaynak ayrımı yap
- Çakışma çözüm kurallarını görünür yaz

Çıktı:

- Başlık → kaynak matrisi

### Adım 3 — Redaksiyon ve güvenlik taraması yap

Yapılacaklar:

- Secret, credential, erişim detayı, production komutları ve örnek şifreleri ayıkla
- Doküman bazlı redaksiyon listesi çıkar

Çıktı:

- Redaksiyon kontrol listesi
- Güvenlik notları

### Adım 4 — Teknik gerçeklik özetlerini üret

Yapılacaklar:

- Monorepo özeti
- sürüm matrisi
- env kataloğu
- DB ve seed özeti
- production durumu özeti

Çıktı:

- 01–05 bölümlerinin içerikleri

### Adım 5 — MEMORY ve bağlayıcı kararları normalize et

Yapılacaklar:

- danışman kararlarını tarih ve başlığa göre grupla
- kesin / geçici / doğrulanmalı ayrımı yap
- ürün vizyonu ve değişiklik sınırlarını sadeleştir

Çıktı:

- karar kayıtları
- aktif sınırlar ve prensipler listesi

### Adım 6 — Açık görevleri normalize backlog’a dönüştür

Yapılacaklar:

- `BACKLOG.md`, `IMPLEMENTATION_SUMMARY.md`, MEMORY ve masaüstü planlarını tek listede birleştir
- görevleri statü bazlı sınıflandır
- hedef alan ve risk bilgisi ekle

Çıktı:

- `devam eden / bekleyen / paused / has_questions` listesi

### Adım 7 — Operasyon ve test erişimi politikasını hazırla

Yapılacaklar:

- deploy, smoke, rollback akışlarını secretsız özetle
- test kullanıcısı paylaşımı yerine rol bazlı politika yaz
- minimum yetki ve rotasyon yaklaşımını belirt

Çıktı:

- operasyon özeti
- test erişim politikası

### Adım 8 — Teslim öncesi kalite kontrol

Yapılacaklar:

- 10 maddenin her biri için içerik olup olmadığını kontrol et
- secret sızıntısı olmadığını kontrol et
- çelişkili alanları etiketle
- okunma sırası ve onboarding akışını ekle

Çıktı:

- teslim öncesi kontrol listesi
- son paket

---

## 7. Devir paketi için önerilen okuma sırası

Codex/ChatGPT için önerilen kullanım sırası:

1. `00_INDEX/DEVIR_REHBERI.md`
2. `05_PRODUCTION/PRODUCTION_DURUMU.md`
3. `06_MEMORY_KARARLAR/MEMORY_OZETI.md`
4. `06_MEMORY_KARARLAR/DANISMAN_KARARLARI.md`
5. `08_RISK_KALITE/ONCELIKLI_OKUMA_REHBERI.md`
6. `07_TASKS/ACIK_TASK_LISTESI.md`
7. Gerekli alana göre:
   - `01_KOD_TABANI`
   - `03_ENV`
   - `04_VERITABANI`
   - `09_OPERASYON`

---

## 8. Devir paketinde mutlaka ayrıca vurgulanması gereken kararlar

### Ürün ve mimari bağlam

- Tech stack: Next.js + NestJS + Prisma + PostgreSQL + Redis + MinIO
- Ürün yönü: operasyon koordinasyon platformu
- Monorepo yaklaşımı korunuyor

### Bağlayıcı danışman kararları

- Permission standardı tek sözlüğe bağlanmalı
- Soft delete yaklaşımı ana varlıklarda zorunlu
- Test önceliği smoke/regression merkezli
- Public endpoint’ler yalnızca referans veri düzeyinde kabul edilebilir
- Cascade → Restrict dönüşümü analizsiz yapılmamalı
- Production baseline korunmalı
- Büyük refactor ve agresif redesign önerileri dikkatle filtrelenmeli

### Son bilinen aktif teknik konular

- Domain separation sonrası admin UI ve bazı akışlar tamamlanmamış
- Permission/seed/controller uyumu halen kritik alan
- Seed ve README gerçekliği tam hizalı değil
- Frontend’de silent catch / workaround alanları izlenmeli

---

## 9. Sonuç

Bu proje için doğru devir yaklaşımı, tek başına repo teslimi değil; **repo + hafıza + karar kayıtları + production özeti + açık görevler + redaksiyon kontrollü operasyon dokümanları** kombinasyonudur.

En kritik başarı kriteri şudur:

- Codex/ChatGPT projeyi açtığında yalnızca “nasıl çalıştıracağını” değil,
- **neyin neden böyle olduğunu**,
- **hangi kararların bağlayıcı olduğunu**,
- **nerede dikkatli ilerlemesi gerektiğini**,
- **hangi işlerin açık ve riskli olduğunu**

ek sözlü açıklamaya ihtiyaç duymadan anlayabilmelidir.

Bu nedenle devir paketi hazırlanırken teknik doğruluk kadar bağlam doğruluğu ve gizlilik disiplini de temel kabul edilmelidir.
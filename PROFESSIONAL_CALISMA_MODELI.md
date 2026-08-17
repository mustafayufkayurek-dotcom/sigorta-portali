# PROFESYONEL ÇALIŞMA MODELİ

## 1. Yönetici Özeti

Bu model, tekrar eden hata döngülerini azaltmak, plansız dene-düzelt davranışını engellemek, alınan kararları kalıcı şekilde görünür kılmak, bağımsız doğrulamayı zorunlu hale getirmek ve kredi tüketimini kontrol altına almak için tasarlanmıştır.

Modelin temel yaklaşımı şudur: hiçbir iş doğrudan uygulamaya geçmez; her iş, tanımlı faz kapılarından geçer, her faz kabul kriterleriyle ölçülür, her önemli karar kayıt altına alınır, her sonuç bağımsız şekilde doğrulanır ve her değişiklik için geri dönüş yaklaşımı önceden düşünülür.

Bu yöntem özellikle aşağıdaki problem desenlerini önlemeyi hedefler:

- aynı hatanın farklı görünümle tekrar etmesi
- sonsuz retry veya kör tekrar
- uygulama esnasında verilen kritik kararların kaybolması
- doğrulanmamış “tamamlandı” beyanları
- gereksiz kredi ve zaman tüketimi

## 2. İşletim İlkeleri

### 2.1 Zorunlu prensipler

1. Önce düşün, sonra uygula.
2. Her iş faz kapısından geçer.
3. Her önemli karar kayıt altına alınır.
4. Worker beyanı tek başına kabul edilmez.
5. Aynı strateji sınırsız tekrar edilemez.
6. Her değişiklik için geri dönüş düşünülür.
7. Bütçe görünürlüğü olmadan iş ilerlemez.

### 2.2 Profesyonel davranış standardı

- Plansız deneme profesyonel çalışma sayılmaz.
- Bir fazın kabul kriterleri geçilmeden sonraki faza geçilmez.
- Doğrulama yapılmadan teslim kararı verilmez.
- Karar kaydı olmadan büyük yöntem değişikliği yapılmaz.
- Retry limiti aşıldığında ya strateji değişir ya da escalation uygulanır.

## 3. Faz Kapılı Çalışma Modeli

## Faz 0 — Talep Tanımı ve Sınırlandırma

### Amaç

İşin ne olduğunu, ne olmadığını, beklenen çıktıyı ve kısıtları baştan netleştirmek.

### Prosedür

1. Talep tek cümlede tanımlanır.
2. Beklenen çıktı açık biçimde yazılır.
3. Kısıtlar ve yasaklar görünür hale getirilir.
4. Kapsam dışı alanlar ayrıca listelenir.
5. Belirsiz noktalar soru veya karar maddesine dönüştürülür.

### Kabul kriterleri

- Problem tanımı nettir.
- Beklenen çıktı türü ve yeri bellidir.
- Kısıtlar yazılıdır.
- Kapsam dışı maddeler ayrılmıştır.
- Kritik belirsizlikler görünür durumdadır.

### Gate kararı

Bu netlik sağlanmadan Faz 1’e geçilmez.

### Checklist

- Amaç net mi?
- Çıktı net mi?
- Kısıtlar listelendi mi?
- Kapsam dışı maddeler yazıldı mı?
- Karar gerektiren noktalar işaretlendi mi?

## Faz 1 — Keşif ve Ön Analiz

### Amaç

Uygulama öncesi bağlam toplamak, tekrar eden sorun örüntülerini anlamak ve kök neden hipotezleri oluşturmak.

### Prosedür

1. İlgili bağlam, mevcut sistem, bağımlılıklar ve önceki benzer sorunlar incelenir.
2. Hata veya risk örnekleri kategori bazında gruplanır.
3. “İlk dene sonra düzelt” yaklaşımı yerine hipotez listesi hazırlanır.
4. Hangi varsayımın doğrulanması gerektiği yazılır.
5. Risk ve blokajlar öncelik sırasına konur.

### Kabul kriterleri

- En az bir kök neden hipotezi yazılmıştır.
- Bilinen riskler listelenmiştir.
- Doğrulanacak varsayımlar görünürdür.
- Benzer önceki hata kalıpları ayırt edilmiştir.

### Gate kararı

Hipotezsiz veya bağlamsız iş, Faz 2’ye geçmez.

### Checklist

- Sorunun nedeni hakkında hipotez var mı?
- Aynı tip hata daha önce yaşanmış mı?
- Bağımlılık ve çevre riskleri listelendi mi?
- Doğrulanacak varsayımlar yazıldı mı?

## Faz 2 — Çözüm Tasarımı ve Karar Kaydı

### Amaç

Uygulama öncesi yaklaşımı seçmek, alternatifleri değerlendirmek ve kararı kayda almak.

### Prosedür

1. En az iki alternatif çözüm yazılır.
2. Her alternatif risk, maliyet, doğrulanabilirlik ve geri dönüş kolaylığı açısından değerlendirilir.
3. Seçilen yöntem ve reddedilen yöntemler kayıt altına alınır.
4. Her kritik tercih karar kaydı girdisine dönüştürülür.
5. Rollback yaklaşımı taslak düzeyde tanımlanır.

### Kabul kriterleri

- Seçilen yaklaşım yazılıdır.
- Reddedilen alternatifler ve nedenleri kayıtlıdır.
- Kararın gerekçesi açıktır.
- Rollback yaklaşımı tanımlanmıştır.
- Doğrulama yöntemi düşünülmüştür.

### Gate kararı

Karar kaydı olmadan Faz 3’e geçilmez.

### Checklist

- En az iki alternatif değerlendirildi mi?
- Neden bu yöntem seçildi?
- Neler reddedildi ve neden?
- Rollback taslağı yazıldı mı?
- Doğrulama mantığı belirlendi mi?

## Faz 3 — Yürütme Planı

### Amaç

İşi küçük, ölçülebilir ve doğrulanabilir parçalara ayırmak.

### Prosedür

1. İş 3 ile 7 arasında somut adıma bölünür.
2. Her adım için hedef tanımlanır.
3. Her adım için risk ve başarısızlık sinyali yazılır.
4. Her adım için doğrulama yöntemi tanımlanır.
5. Her adım için rollback tetikleyicisi belirlenir.
6. Kredi veya maliyet tüketimi görünür hale getirilir.

### Kabul kriterleri

- Her adım bağımsız doğrulanabilir durumdadır.
- Her adım için başarısızlık sinyali bellidir.
- Her adım için rollback tetikleyicisi vardır.
- Bütçe veya kredi sınırı görünürdür.

### Gate kararı

Adımlar doğrulanabilir değilse Faz 4’e geçilmez.

### Checklist

- İş küçük adımlara bölündü mü?
- Her adımın çıktısı net mi?
- Her adım için nasıl doğrulanacağı belli mi?
- Bütçe sınırı tanımlandı mı?
- Durdurma koşulları yazıldı mı?

## Faz 4 — Kontrollü Uygulama

### Amaç

Değişikliği kontrollü şekilde yürütmek, her adım sonunda ara doğrulama yapmak ve kör tekrarları engellemek.

### Prosedür

1. Aynı anda tek aktif adım yürütülür.
2. Her adım sonunda ara doğrulama yapılır.
3. Beklenen sonuç ile gerçekleşen sonuç kısa kayıtla karşılaştırılır.
4. Hata çıkarsa önce kök neden değerlendirilir.
5. Aynı strateji, yeni veri olmadan tekrar edilmez.
6. Retry sayacı görünür biçimde güncellenir.

### Kabul kriterleri

- Her adımın sonucu kaydedilmiştir.
- Beklenen ve gerçekleşen çıktı karşılaştırılmıştır.
- Retry durumu günceldir.
- Başarısız adım için sonraki aksiyon bellidir.

### Gate kararı

Ara doğrulaması geçmeyen iş, “tamamlandı” sayılmaz; doğrulama veya rollback akışına gider.

### Checklist

- Adım sonucu kaydedildi mi?
- Beklenen çıktı oluştu mu?
- Hata varsa yeni hipotez üretildi mi?
- Retry limiti kontrol edildi mi?

## Faz 5 — Bağımsız Doğrulama

### Amaç

Worker’ın “tamamlandı” beyanını bağımsız kontrollerle doğrulamak.

### Prosedür

1. Faz veya iş sonunda ayrı bir doğrulama adımı çalıştırılır.
2. Çıktı gerçekten oluşmuş mu kontrol edilir.
3. İçeriğin beklenen kaliteyi karşılayıp karşılamadığı incelenir.
4. Acceptance criteria maddeleri tek tek işaretlenir.
5. Negatif senaryo kontrolü yapılır.
6. Sonuç Passed, Failed veya Re-opened olarak işaretlenir.

### Kabul kriterleri

- Doğrulama uygulamadan bağımsız tanımlanmıştır.
- Acceptance criteria tek tek kontrol edilmiştir.
- En az bir negatif doğrulama vardır.
- Sonuç durumu nettir.

### Gate kararı

Doğrulama geçmeden kapanış yapılamaz.

### Checklist

- Beklenen artefakt var mı?
- İçerik beklenen kaliteyi sağlıyor mu?
- Tüm acceptance criteria geçti mi?
- Negatif kontrol yapıldı mı?
- Sonuç Passed, Failed veya Re-opened olarak işaretlendi mi?

## Faz 6 — Kapanış ve Öğrenim Kaydı

### Amaç

İşi kapatırken kararları, öğrenimleri, maliyet özetini ve varsa açık riskleri kurumsal hafızaya aktarmak.

### Prosedür

1. Son durum özeti hazırlanır.
2. Alınan kararlar ve sonuçları ilişkilendirilir.
3. Harcanan kredi veya maliyet kaydedilir.
4. Tekrar etmemesi gereken hata deseni not edilir.
5. Gerekirse sonraki aksiyonlar öneri olarak bırakılır.

### Kabul kriterleri

- Kapanış özeti vardır.
- Karar geçmişi günceldir.
- Bütçe veya kredi özeti yazılmıştır.
- Öğrenim kaydı eklenmiştir.

### Checklist

- İş neden başarılı veya başarısız oldu?
- Hangi kararlar kritik etki yarattı?
- Ne kadar maliyet tüketildi?
- Hangi örüntü tekrar etmemeli?

## 4. Acceptance Criteria Standardı

Her faz ve her önemli iş parçası için acceptance criteria aşağıdaki başlıklardan oluşmalıdır:

- beklenen çıktı
- kalite seviyesi
- doğrulama yöntemi
- hata toleransı
- başarısızlık durumunda sınıflandırma

### İyi acceptance criteria örneği

- Çıktı dosyası üretilmiş olmalı.
- İçerik talep edilen başlıkların tamamını içermeli.
- Fazların her biri için prosedür ve checklist bulunmalı.
- Başarılı ve başarısız senaryolar ayrı başlıklarla yer almalı.

### Zayıf acceptance criteria örneği

- Güzel bir doküman olsun.
- Gerekirse bakarız.
- Muhtemelen yeterli olur.

## 5. Retry ve Tekrar Önleme Mekanizması

### 5.1 Genel kural

Aynı yaklaşım, aynı bağlam ve yeni veri olmadan tekrar edilemez.

### 5.2 Retry limiti

- Aynı strateji en fazla 2 kez denenir.
- İkinci başarısızlıktan sonra strateji değişikliği zorunludur.
- Üçüncü kör tekrar yasaktır.
- Retry sadece yeni hipotez, yeni veri veya düzeltilmiş çevre koşulu varsa yapılır.

### 5.3 Strateji değişikliği tetikleyicileri

- Aynı hata kodu yeniden oluşuyorsa
- Beklenen artefakt hiç oluşmuyorsa
- Ara doğrulama başarısızsa
- Maliyet artışı orantısız hale geldiyse
- Kök neden hipotezi yanlışlandıysa

### 5.4 Escalation koşulları

- Retry limiti dolduysa
- Aynı problem farklı ekipleri etkilemeye başladıysa
- Rollback olmadan ilerlemek riskli hale geldiyse
- Bütçe eşikleri aşıldıysa

### 5.5 Hata tipine göre örnek yaklaşım

#### Örnek: PUPPETEER_SKIP_DOWNLOAD sorunu

Doğru yaklaşım:

1. Aynı kurulum adımını tekrar etmeden önce çevre politikası incelenir.
2. Sorun bağımlılık indirme politikası mı, ağ erişimi mi, paket yönetimi mi ayrıştırılır.
3. Strateji değişikliği gerekiyorsa alternatif tarayıcı kullanımı veya indirmeyi atlayan model değerlendirilir.

Yanlış yaklaşım:

- Aynı install komutunu tekrar tekrar çalıştırmak
- Hata mesajını kategoriye ayırmadan denemeyi sürdürmek
- Retry sayaç tutmadan ilerlemek

#### Örnek: bcrypt sorunu

Doğru yaklaşım:

1. Native derleme gereksinimi ve sürüm uyumu ayrıştırılır.
2. Çevre bağımlılığı, platform uyumu ve paket sürümü birlikte ele alınır.
3. Aynı paket kurulumu kör tekrar yapılmaz.

Yanlış yaklaşım:

- Aynı paketi peş peşe yeniden kurmak
- Sorunu sadece geçici ağ problemi sanmak
- Uyumluluk değerlendirmesi yapmamak

#### Örnek: sonsuz retry örüntüsü

Doğru yaklaşım:

1. Retry limiti dolduğunda iş otomatik olarak durdurulur.
2. Yeni hipotez veya strateji olmadan devam edilmez.
3. Gerekirse escalation açılır.

Yanlış yaklaşım:

- “Bu kez olur” mantığıyla aynı denemeyi sürdürmek
- Başarısızlığı kayıt altına almamak
- Maliyet takibini göz ardı etmek

## 6. Karar Kayıt Protokolü

## 6.1 Karar kaydı alanları

Her önemli karar aşağıdaki alanlarla kayıt altına alınmalıdır:

- Karar ID
- Tarih veya sıra bilgisi
- Bağlam
- Problem tanımı
- Alternatifler
- Seçilen seçenek
- Gerekçe
- Reddedilen seçenekler ve nedenleri
- Riskler
- Doğrulama yöntemi
- Rollback yaklaşımı
- Sahip veya karar otoritesi

## 6.2 Karar kaydı ne zaman zorunludur

- Kapsam değiştiğinde
- Yeni strateji seçildiğinde
- Retry limiti dolduğunda
- Risk seviyesi yükseldiğinde
- Kullanıcı veya yönetici tercihine göre rota değiştiğinde

## 6.3 Örnek karar kaydı

### Karar ID

DEC-014

### Bağlam

Tekrarlayan kurulum hataları nedeniyle mevcut yöntem güvenilir değil.

### Problem

Aynı stratejinin tekrar edilmesi maliyeti yükseltiyor ve yeni bilgi üretmiyor.

### Alternatifler

1. Aynı yöntemi tekrar denemek
2. Kök neden analizini güncellemek
3. Alternatif bağımlılık veya çevre stratejisine geçmek

### Seçilen seçenek

Alternatif 3

### Gerekçe

İlk iki deneme yeni veri üretmedi ve retry limiti doldu.

### Reddedilen seçenekler

- Alternatif 1: Yeni bilgi sağlamadığı için reddedildi.
- Alternatif 2: Tek başına yeterli değil, ama destekleyici analiz olarak tutuldu.

### Riskler

- Yeni strateji ek öğrenme maliyeti getirebilir.

### Doğrulama

- Yeni strateji sonrası bağımsız doğrulama yapılacak.

### Rollback

- Sonuç alınamazsa önceki kararlı yaklaşım veya belge düzeyi plana geri dönülecek.

## 7. Bağımsız Doğrulama Prosedürü

### 7.1 İlke

Uygulayan kişi ya da worker bir işi tamamladığını söyleyebilir; ancak bu beyan, bağımsız doğrulama yapılmadan kabul edilmez.

### 7.2 Doğrulama türleri

- Çıktı doğrulaması
- İçerik doğrulaması
- Acceptance criteria doğrulaması
- Negatif senaryo doğrulaması
- Yan etki doğrulaması

### 7.3 Doğrulama sonuç sınıfları

- Passed
- Failed
- Re-opened

### 7.4 Re-opened koşulları

- Artefakt yoksa
- İçerik eksikse
- Acceptance criteria’nın kritik maddesi geçmediyse
- Negatif senaryo tekrar oluştuysa

### 7.5 Doğrulama checklist’i

- Beklenen çıktı gerçekten üretildi mi?
- İçerik tamam mı?
- Biçim ve yapı beklentiyle uyumlu mu?
- Bilinen hata deseni yeniden oluşuyor mu?
- Teslim kararı için tüm koşullar geçti mi?

## 8. Rollback ve Geri Dönüş Planı

### 8.1 Her değişiklik için sorulacak sorular

1. Ne değişecek?
2. Etki alanı nedir?
3. Tersine çevirme yöntemi nedir?
4. Rollback hangi koşulda tetiklenir?
5. Rollback sonrası ne doğrulanır?

### 8.2 Rollback seviyeleri

- Dokümansal rollback: karar veya plan düzeyi geri dönüş
- Konfigürasyon rollback: ayarların geri alınması
- Uygulama rollback: değişikliğin önceki kararlı duruma döndürülmesi
- Operasyonel rollback: süreç veya rota değişikliğinin eski yönteme alınması

### 8.3 Rollback tetikleyicileri

- Acceptance criteria kritik maddesi başarısızsa
- Negatif etki beklenenden yüksekse
- Doğrulama Re-opened sonucu verdiyse
- Maliyet sınırı aşıldıysa

### 8.4 Rollback checklist’i

- Geri dönüş yöntemi tanımlandı mı?
- Etkilenen alanlar belirlendi mi?
- Rollback tetikleyicisi yazıldı mı?
- Rollback sonrası kontrol planı hazır mı?

## 9. Maliyet ve Kredi Kontrol Modeli

### 9.1 Amaç

Yüksek maliyetli tekrarları önlemek, tüketimi görünür kılmak ve düşük değerli denemeleri erken durdurmak.

### 9.2 Temel kurallar

- Her iş için bir bütçe üst limiti tanımlanır.
- Faz bazında tüketim görünür tutulur.
- Doğrulama maliyeti işin zorunlu parçasıdır.
- Düşük öğrenim değeri üreten tekrarlar durdurulur.

### 9.3 Kontrol noktaları

- Faz başlangıcında: kalan bütçe görünür mü?
- Retry sonrası: yeni denemenin öğrenim değeri var mı?
- Faz sonunda: harcanan maliyet çıktı değerine değdi mi?

### 9.4 Durdurma kuralları

- Aynı hataya karşı peş peşe maliyetli deneme yapılamaz.
- Keşif aşamasında bütçenin büyük bölümü tüketildiyse kapsam yeniden değerlendirilir.
- Doğrulama yapılmadan ek maliyet açılmaz.

### 9.5 Maliyet özeti formatı

- Faz adı
- Harcanan kredi veya maliyet
- Üretilen çıktı
- Öğrenim değeri
- Sonraki adım kararı

## 10. Operasyonel Checklists

## 10.1 İşe başlamadan önce

- Amaç yazıldı mı?
- Çıktı tanımlandı mı?
- Kısıtlar listelendi mi?
- Kapsam dışı maddeler ayrıldı mı?
- Belirsizlikler görünür hale getirildi mi?

## 10.2 Uygulamaya geçmeden önce

- En az iki alternatif değerlendirildi mi?
- Karar kaydı oluşturuldu mu?
- Acceptance criteria yazıldı mı?
- Verification adımı tanımlandı mı?
- Rollback yaklaşımı yazıldı mı?
- Retry limiti netleştirildi mi?
- Bütçe sınırı işlendi mi?

## 10.3 Adım tamamlandı demeden önce

- Beklenen çıktı oluştu mu?
- Ara doğrulama yapıldı mı?
- Sonuç kayda geçti mi?
- Retry sayacı güncellendi mi?
- Beklenen ve gerçek sonuç karşılaştırıldı mı?

## 10.4 Teslim demeden önce

- Tüm acceptance criteria geçti mi?
- Bağımsız verification tamamlandı mı?
- Karar kayıtları güncel mi?
- Bütçe özeti işlendi mi?
- Geri açma gerektiren madde kaldı mı?

## 10.5 Başarısızlık durumunda

- Kök neden hipotezi güncellendi mi?
- Aynı strateji tekrar edilmiyor mu?
- Rollback gerekiyor mu?
- Escalation gerekli mi?
- Maliyet sınırı aşıldı mı?

## 11. Senaryo Örnekleri

## 11.1 Başarılı senaryo

Bir iş talebi alındığında önce kapsam netleştirilir. Faz 1’de tekrar eden hata kalıpları incelenir ve iki kök neden hipotezi çıkarılır. Faz 2’de iki çözüm alternatifi karşılaştırılır; düşük riskli ve kolay doğrulanabilir yöntem seçilir. Faz 3’te iş küçük adımlara bölünür, acceptance criteria ve rollback planı yazılır. Faz 4’te kontrollü ilerlenir ve her adım sonunda ara doğrulama yapılır. Faz 5’te bağımsız verification sonucunda tüm kriterler geçtiği görülür. Faz 6’da karar kaydı ve maliyet özeti kapanışla birlikte arşivlenir.

Bu senaryoda başarıyı getiren unsurlar şunlardır:

- uygulama öncesi düşünme
- kontrollü adımlara bölme
- kararları kayıt altına alma
- bağımsız doğrulama
- tekrarları sınırlama

## 11.2 Başarısız senaryo

Bir sorun görülür görülmez plansız şekilde çözüm denenir. Aynı hata yeniden alındıkça aynı komut veya aynı yöntem tekrar edilir. Retry limiti olmadığı için maliyet artar. Karar kaydı tutulmadığı için neden bu yöntemin seçildiği sonradan anlaşılamaz. Worker işin tamamlandığını söyler ancak artefakt bağımsız olarak doğrulanmaz. Sonuçta teslim edilen iş geri açılır ve güven kaybı oluşur.

Bu senaryoda başarısızlık nedenleri şunlardır:

- faz kapısı olmadan ilerleme
- kabul kriterlerinin olmaması
- retry limitinin olmaması
- karar kaydının tutulmaması
- doğrulama eksikliği

## 11.3 Düzeltici senaryo

İki başarısız denemeden sonra süreç otomatik olarak durdurulur. Yeni hipotez üretilmeden aynı strateji tekrar edilmez. Karar kaydı açılır ve neden strateji değiştirildiği yazılır. Yeni yöntem daha düşük risk ve daha yüksek doğrulanabilirlik sağladığı için seçilir. Sonrasında bağımsız verification yapılır. Eğer verification yine başarısızsa rollback çalıştırılır ve iş Re-opened olarak işaretlenir.

Bu senaryoda toparlayıcı unsurlar şunlardır:

- retry limitinin varlığı
- otomatik strateji değişimi
- karar kaydı
- bağımsız verification
- rollback disiplini

## 12. Roller ve Sorumluluklar

### Talep sahibi

- amacı netleştirir
- başarı tanımını onaylar
- kritik tercihleri netleştirir

### Worker

- fazlara uygun ilerler
- kararları kaydeder
- aynı stratejiyi kör tekrar etmez
- tamamlandı iddiasını kanıtlarla destekler

### Doğrulayıcı

- acceptance criteria’yı bağımsız kontrol eder
- çıktı ve içerik doğrulaması yapar
- gerektiğinde işi Re-opened durumuna alır

### Yönetici veya karar otoritesi

- escalation durumlarında yön belirler
- bütçe ve risk dengesini gözetir
- kritik karar kayıtlarını onaylar

## 13. Standart Şablonlar

## 13.1 Faz ilerleme özeti şablonu

- Faz:
- Amaç:
- Beklenen çıktı:
- Gerçekleşen çıktı:
- Risk:
- Sonuç:
- Sonraki karar:

## 13.2 Karar kaydı kısa şablonu

- Karar ID:
- Problem:
- Alternatifler:
- Seçim:
- Gerekçe:
- Risk:
- Doğrulama:
- Rollback:

## 13.3 Kapanış özeti şablonu

- İş sonucu:
- Geçilen acceptance criteria:
- Açık riskler:
- Harcanan maliyet:
- Öğrenim:
- Tekrar etmemesi gereken hata:

## 14. Uygulama Kuralları Özeti

1. Faz kapısı geçilmeden sonraki aşamaya ilerleme yapılmaz.
2. Acceptance criteria sağlanmadan tamamlandı denmez.
3. Karar kaydı olmayan kritik rota değişikliği yapılmaz.
4. Aynı strateji iki başarısız denemeden fazla sürdürülmez.
5. Worker beyanı bağımsız doğrulama yerine geçmez.
6. Rollback planı olmayan değişiklik yüksek riskli sayılır.
7. Bütçe görünürlüğü olmayan iş profesyonel süreçten geçmiş kabul edilmez.

## 15. Sonuç

Bu modelin amacı yalnızca daha düzenli görünmek değildir. Amaç; hata tekrarını azaltmak, karar kaybını önlemek, doğrulanabilir ilerleme sağlamak, geri dönüş güvenliğini artırmak ve kredi tüketimini ölçülebilir şekilde yönetmektir.

Profesyonel çalışma modeli, “hızlıca dene ve belki olur” yaklaşımının yerine; faz kapılı, ölçülebilir, kayıtlı, doğrulamalı ve kontrollü bir operasyon disiplini koyar. Böylece hem güvenilir çıktı kalitesi artar hem de tekrar eden maliyetli döngüler sistematik olarak azaltılır.
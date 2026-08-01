# Meridyen Operasyon Yönetim Platformu

# Resmi Ürün Geliştirme Yol Haritası ve Geliştirme Standartları

Bu doküman Meridyen Operasyon Yönetim Platformu'nun bundan sonraki tüm geliştirmeleri için **resmi referans**tır.

Bu kurallar tüm geliştirmeler için zorunludur.  
Hiçbir geliştirme bu kuralların dışında yürütülmeyecektir.

---

## 1. Geliştirme Prensibi

Aynı anda yalnızca **bir** ürün modülü geliştirilecektir.

Her modül aşağıdaki yaşam döngüsünü eksiksiz tamamlayacaktır:

1. İş Analizi
2. Ürün Tasarımı
3. Teknik Mimari
4. Domain Modeli
5. ER Diagramı
6. API Tasarımı
7. UI/UX Tasarımı
8. Geliştirme
9. Test
10. Dokümantasyon
11. Kod İncelemesi
12. Ön İzleme
13. Deploy
14. Teslim

Bir modül tamamlanmadan sonraki modüle geçilmeyecektir.  
Eksik veya yarım bırakılmış geliştirme kabul edilmeyecektir.

---

## 2. Ürün Omurgası

Meridyen aşağıdaki beş temel ürün modülü üzerine inşa edilecektir.

### FAZ 1 — Smart Measurement (Akıllı Ölçüm)

| Alan | Değer |
|------|--------|
| Durum | **Closed** |
| Rol | Referans mimari |
| Release | Web v438 / Backend v437 · etiket `release/smart-measurement-closed-v438` |
| Kapanış | `docs/features/AI_AR_AKILLI_OLCUM_FAZ1_KAPANIS.md` |

Bu modül üzerinde yalnızca:

- bakım,
- hata düzeltme,
- performans iyileştirmesi

yapılacaktır. Yeni özellik geliştirilmez.

### FAZ 2 — Smart Quantity Takeoff (Akıllı Metraj)

Bu modül Smart Measurement tarafından üretilen ölçülerden otomatik metraj oluşturacaktır.

**İlk kapsam:**

- Boya
- Alçı
- Macun
- Seramik
- Fayans
- Parke
- Süpürgelik
- Kapı
- Pencere
- Mutfak Dolabı
- Tezgâh
- Tavan

Metraj kuralları **genişletilebilir mimaride** tasarlanacaktır.  
Bu modül tamamlanmadan sonraki faz başlatılmayacaktır.

### FAZ 3 — Supplier Intelligence (Tedarikçi Hafızası)

Bu modül tedarikçilerin operasyonel performansını yönetecektir.

**Kapsam:**

- Uzmanlık Alanları
- Başarı Oranı
- Ortalama Süre
- Ortalama Maliyet
- Garanti Dönüş Oranı
- Tamamlanan İş Sayısı
- Bölgesel Yetkinlik
- Operasyon Kapasitesi

Bu modül ERP değildir.  
Operasyon karar destek modülüdür.

> UI etiketi notu: Kullanıcıya görünen yüzeylerde “hafıza / Google / API” diline düşülmez; operasyon dili korunur (`URUN_STANDARDI_TEKNOLOJI_GORUNMEZ.md`).

### FAZ 4 — Digital Twin (3D Dijital İkiz)

Bu modül şunları tek dijital model altında birleştirecektir:

- Telefon taramaları
- Ölçüler
- Oda bilgileri
- Yapı elemanları
- Hasarlar
- Fotoğraflar
- Operasyon geçmişi

### FAZ 5 — Repair Knowledge Library (Onarım Bilgi Kütüphanesi)

Bu modül kurumsal operasyon bilgisini standartlaştıracaktır.

Her onarım tipi için:

- Standart İş Akışı
- Standart Metraj Kuralları
- Standart Malzemeler
- Kalite Kontrol Adımları
- Kontrol Listeleri
- Fotoğraf Referansları
- Garanti Bilgileri

Bu modül kurumsal bilgi hafızası olacaktır.

---

## 3. Geliştirme Kuralları

Her geliştirme yalnızca kendi kapsamı içerisinde yapılacaktır.  
Başka modüllerde değişiklik yapılmayacaktır.

Aşağıdaki modüllere ihtiyaç olmadıkça dokunulmayacaktır:

- CRM
- Finans
- Dashboard
- Layout
- Authentication
- Storage
- Field Survey
- Diğer ürün modülleri

Kapsam dışı değişiklik tespit edilirse geliştirme durdurulacaktır.

---

## 4. Branch Kuralı

Her ürün modülü:

- ayrı feature branch,
- ayrı commit geçmişi,
- ayrı teslim raporu,
- ayrı release,
- ayrı rollback planı

ile geliştirilecektir.

Bir branch kapanmadan yeni geliştirme branch'i açılmayacaktır.

---

## 5. Deploy Kuralı

Deploy yalnızca ilgili modülü içerecektir.  
Deploy paketine kapsam dışı dosya eklenmeyecektir.

Her deploy öncesinde:

- Git Diff
- Deploy Dosya Listesi
- Migration Kontrolü
- Rollback Planı

hazırlanacaktır.

---

## 6. Repository Kuralı

Git Repository tek doğruluk kaynağıdır.  
Canlı ortamda repository dışında kod bulunmayacaktır.  
Repository ile canlı ortam her release sonunda birebir aynı olacaktır.

---

## 7. Geliştirme Başlamadan Önce Zorunlu Kontrol

Her yeni geliştirmeye başlamadan önce aşağıdaki üç soruya **yazılı cevap** verilecektir.

1. Bu geliştirme ürün yol haritasındaki hangi faza aittir?
2. Bu geliştirme başka bir modülü etkiliyor mu?  
   Evet ise: hangi modüller, neden etkileniyor, hangi dosyalar değişecek — ayrıntılı açıklanacaktır.
3. Bu geliştirme aşağıdaki beş ürün sütunundan hangisini güçlendiriyor?
   - Smart Measurement
   - Smart Quantity Takeoff
   - Supplier Intelligence
   - Digital Twin
   - Repair Knowledge Library

Bu üç soruya cevap verilmeden geliştirme başlatılmayacaktır.

---

## 8. Ürün Hedefi

Meridyen; dosya takip eden bir yazılım olmayacaktır.

Meridyen:

- ölçen,
- metraj üreten,
- kurumsal bilgi yöneten,
- tedarikçi hafızası oluşturan,
- ve dijital operasyon modeli geliştiren

kurumsal bir **Operasyon Yönetim Platformu** olacaktır.

---

Bu doküman bundan sonraki tüm geliştirmelerin resmi ürün standardıdır.

**Kaynak onay:** Mustafa — 2026-08-01  
**Cursor kuralı:** `.cursor/rules/urun-yol-haritasi.mdc`

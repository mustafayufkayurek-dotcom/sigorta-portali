# RFQ — UAVT / MAKS Adres Hiyerarşisi Entegrasyonu

**Proje:** Meridyen Assistance — Sigorta Hasar & Acil Yardım Operasyon Platformu  
**Talep eden:** Meridyen Assistance / Safran Birleşik Hizmetler  
**Tarih:** 2026-06-30  
**Versiyon:** Taslak v1  
**İletişim:** *(Mustafa — e-posta / telefon eklenecek)*

---

## 1. Amaç

Operasyon panelinde (müşteri, tedarikçi, hasar dosyası, acil yardım) **Netgsm benzeri kademeli adres seçimi** sağlamak:

**İl → İlçe → Mahalle → Cadde/Sokak → Dış Kapı No → İç Kapı No (Daire)**

- Veri kaynağı tercihen **UAVT / MAKS (NVİ)** resmi hiyerarşisi olmalıdır.
- Veri yoksa veya eşleşme bulunamazsa **serbest metin fallback** desteklenmelidir.
- Mevcut sistemde **il / ilçe / mahalle** kısmen çalışmaktadır; sokak ve kapı numarası seviyesi hedeflenmektedir.

---

## 2. Kapsam

### 2.1 Fonksiyonel gereksinimler

| # | Gereksinim | Zorunlu |
|---|------------|---------|
| G1 | İl listesi (81 il, güncel idare yapısı) | Evet |
| G2 | İlçe listesi (il koduna bağlı) | Evet |
| G3 | Mahalle / köy listesi (ilçe koduna bağlı) | Evet |
| G4 | CSBM listesi — cadde, sokak, bulvar, meydan (mahalle koduna bağlı) | Evet |
| G5 | Dış kapı numarası listesi (CSBM koduna bağlı) | Evet |
| G6 | İç kapı / daire numarası listesi (dış kapı koduna bağlı) | Evet |
| G7 | Seçilen adres için **UAVT adres kodu** (ve varsa koordinat) dönüşü | Evet |
| G8 | Adres metninin tek satır özet formatı (fatura / evrak uyumlu) | Evet |
| G9 | “Adresimi bulamıyorum” — kademeli seçim + serbest metin birlikte | Evet |
| G10 | Türkçe karakter / Title Case uyumlu metin alanları | Evet |

### 2.2 Teknik gereksinimler

| # | Gereksinim | Zorunlu |
|---|------------|---------|
| T1 | REST veya GraphQL **HTTPS API** | Evet |
| T2 | JSON yanıt formatı | Evet |
| T3 | OAuth2 / API Key veya entegratörün önerdiği güvenli kimlik doğrulama | Evet |
| T4 | Rate limit ve kota politikası dokümante edilmeli | Evet |
| T5 | Sandbox / test ortamı | Evet |
| T6 | OpenAPI (Swagger) veya eşdeğer API dokümantasyonu | Evet |
| T7 | Webhook veya periyodik sync ile idari değişiklik bildirimi (ilçe birleşme vb.) | Tercih |
| T8 | IP allowlist veya mTLS desteği | Tercih |

### 2.3 Entegrasyon noktaları (Meridyen)

Tek bir **Adres Seçim Bileşeni** aşağıdaki modüllerde kullanılacaktır:

- Müşteri kartı (bireysel / kurumsal)
- Tedarikçi kartı
- Yeni hasar dosyası
- Acil yardım dosyası
- Gelen kutusundan dosya açma (sigortalı adresi ön-dolum + manuel düzeltme)

**Tahmini kullanım:** *(doldurulacak — örn. ayda X adres sorgusu, Y aktif kullanıcı)*

---

## 3. Mevcut altyapı (teknik bağlam)

Teklif verirken dikkate alınması gereken mevcut durum:

- **Backend:** NestJS, PostgreSQL (Prisma)
- **Frontend:** Next.js (React)
- **Mevcut lokasyon API:** `GET /locations/neighborhoods?provinceName&districtName` (mahalle — Overpass cache)
- **Adres alanları (DB):** `city`, `district`, `neighborhood`, `streetName`, `buildingNo`, `doorNo`, `address` (açık adres)
- **Alternatif (geçici):** OpenStreetMap / Overpass genişletmesi değerlendiriliyor; UAVT teklifleri karşılaştırma için isteniyor

---

## 4. Teklifte istenen bilgiler

Lütfen aşağıdaki başlıklarda **ayrı ayrı fiyatlandırın**:

### 4.1 Lisans / abonelik

- Kurulum / entegrasyon bedeli (tek seferlik)
- Aylık / yıllık platform veya API lisans bedeli
- Sorgu başı (per-call) ücret varsa kademeli tablo
- Dahil sorgu kotası ve aşım birim fiyatı
- Kullanıcı / uygulama / ortam (prod + test) sınırları

### 4.2 Hizmet kapsamı

- UAVT / MAKS veri erişimi **NVİ yetkili entegratör** statüsü (belge / referans)
- API uç noktalarının tam listesi ve örnek istek/yanıt
- Veri güncelleme sıklığı (sokak / kapı no değişiklikleri)
- SLA: uptime, yanıt süresi (p95), destek kanalı ve mesai saatleri
- KVKK: veri işleme sözleşmesi, loglama, saklama süresi, yurt içi barındırma

### 4.3 Proje teslimi

- Entegrasyon süresi (takvim günü / hafta)
- Meridyen tarafında yapılacak iş vs entegratör tarafında yapılacak iş ayrımı
- Eğitim / devreye alma desteği
- Garanti süresi ve hata giderme taahhüdü

### 4.4 Referans

- Benzer sektörden (sigorta, asistans, telekom, e-ticaret) en az **2 referans proje**
- Canlı ortamda kaç yıldır çalıştığı

---

## 5. Değerlendirme kriterleri

| Kriter | Ağırlık |
|--------|---------|
| UAVT hiyerarşi kapsamı (G1–G7 tam uyum) | %30 |
| Toplam maliyet (3 yıl TCO) | %25 |
| API kalitesi, dokümantasyon, sandbox | %20 |
| SLA ve destek | %15 |
| Entegrasyon süresi ve referans | %10 |

---

## 6. Sorulacak net sorular (checklist)

Entegratöre e-posta ile birlikte gönderilebilir:

1. **UAVT adres kodu** her seçim seviyesinde mi dönüyor, yalnızca tam adres seçilince mi?
2. Site / plaza / iş merkezi gibi **özel yapı adları** destekleniyor mu?
3. Kırsal mahallelerde sokak/kapı kapsam oranı nedir? (il bazında örnek rapor istenebilir)
4. Aynı API üzerinden **adres doğrulama** (girilen metin → UAVT eşleştirme) var mı?
5. **Koordinat (lat/lng)** dönüşü var mı? Harita pinleme için gerekli.
6. Meridyen verisini NVİ’ye geri yazma gerekir mi, yoksa salt okunur mu?
7. Fiyatlandırmada **test ortamı** dahil mi?
8. Sözleşme minimum süresi ve fesih koşulları?

---

## 7. Zaman çizelgesi (talep tarafı)

| Adım | Hedef tarih |
|------|-------------|
| RFQ gönderimi | 2026-07-01 |
| Tekliflerin alınması | 2026-07-15 |
| Demo / POC görüşmesi | 2026-07-22 |
| Karar | 2026-07-31 |
| POC entegrasyon (1 form) | 2026-08–09 |
| Tüm formlara yayılım | 2026-09–10 |

*(Tarihler Mustafa onayı ile güncellenecek.)*

---

## 8. Ekler (teklif verene gönderilecek)

- [ ] Örnek ekran görüntüsü: Netgsm adres adımı (referans UX)
- [ ] Meridyen adres alan şeması (`ADDRESS_FIELD` sabitleri)
- [ ] Tahmini aylık sorgu hacmi
- [ ] Teknik iletişim kişisi

---

## 9. E-posta şablonu (kopyala-yapıştır)

**Konu:** RFQ — UAVT Adres Hiyerarşisi API Entegrasyonu (Meridyen Assistance)

Merhaba,

Meridyen Assistance olarak sigorta hasar ve acil yardım operasyon platformumuzda **kademeli adres seçimi** (il → ilçe → mahalle → sokak → dış kapı → daire) entegrasyonu planlıyoruz. Veri kaynağı olarak **UAVT / MAKS** uyumlu çözüm arıyoruz.

Ekteki RFQ dokümanındaki kapsam, teknik gereksinimler ve fiyatlandırma kalemleri doğrultusunda **15 Temmuz 2026** tarihine kadar teklifinizi rica ederiz.

Kısa demo ve sandbox erişimi teklifle birlikte paylaşılabilirse değerlendirmemizi hızlandırır.

Saygılarımızla,  
*(İsim / unvan / iletişim)*

---

*Bu doküman iç kullanım ve tedarikçi RFQ amaçlıdır. Fiyat teklifleri gizli tutulacaktır.*

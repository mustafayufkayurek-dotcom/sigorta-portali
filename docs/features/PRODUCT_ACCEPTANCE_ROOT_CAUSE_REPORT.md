# Product Acceptance — Root Cause Report

| Alan | Değer |
|------|--------|
| Tarih | 2026-08-02 |
| Ortam | Production (`app.meridyen-tr.com`, backend v439) |
| Kapsam | Field Survey Briefs hata analizi + Smart Takeoff ayrıştırma |
| Kod değişikliği | **Yapılmadı** |
| Deploy | **Yapılmadı** |

**İlgili önceki analiz:** Product Acceptance Bug Investigation (2026-08-02 ~20:47)

---

## 1. 500 Hatasının Gerçek Nedeni

### 1.1 Gözlemlenen kullanıcı akışı

Kullanıcı dosya sayfasında **«Saha Keşif Ölçüsü» → «Fotoğraf Çek / Ölçü Gir»** akışını kullanmış. Bu akış **Field Survey Briefs** modülüne aittir; Smart Takeoff değildir.

### 1.2 Production log kanıtı — `scan` endpoint

| Alan | Değer |
|------|--------|
| **Method / Path** | `POST /api/v1/claim-files/8432702a-e52c-4e6e-9609-3cb9d65d4106/field-survey-briefs/scan` |
| **HTTP status** | **500** |
| **Frontend mesajı** | Nest global filter → `"Internal server error"` |
| **Exception** | `NoSuchBucket: The specified bucket does not exist` |
| **Katman** | Infrastructure — AWS SDK S3 `PutObjectCommand` |
| **Stack (özet)** | `StorageService.uploadToS3` → `FieldSurveyBriefsService.uploadPhoto` → `FieldSurveyBriefsService.scanPhoto` → `FieldSurveyBriefsController.scan` |
| **Zaman** | 2026-08-02 14:55:19, 14:56:31 (UTC) |

### 1.3 Production log kanıtı — `pdf` endpoint

| Alan | Değer |
|------|--------|
| **Method / Path** | `GET .../field-survey-briefs/{id}/pdf` |
| **HTTP status** | **500** |
| **Exception** | `TypeError [ERR_INVALID_CHAR]: Invalid character in header content ["Content-Disposition"]` |
| **Katman** | HTTP response header (Express `res.set`) |
| **Stack (özet)** | `FieldSurveyBriefsController.pdf` satır 73 |
| **Zaman** | 2026-08-02 14:55:41, 14:55:55, 14:55:56, 14:56:01 |

### 1.4 İki ayrı 500 kök nedeni

| # | Hata | Kök neden sınıfı |
|---|------|------------------|
| A | Fotoğraf tarama 500 | **Ops/infra** — S3 bucket mevcut değil |
| B | PDF indirme 500 | **Kod** — Content-Disposition header'ında ASCII-dışı karakter |

**Smart Takeoff API'sinden 500 kaydı yok** — production loglarında `smart-takeoff/*` path'ine ait hata veya çağrı bulunmamaktadır.

---

## 2. NoSuchBucket Çözümü

### 2.1 Production yapılandırması (log kanıtı)

Backend startup logu:

```
StorageService: S3 provider initialized (endpoint=http://minio:9000, bucket=meridyen-files)
```

Container env (secret olmayan):

| Değişken | Production değeri |
|----------|-------------------|
| `STORAGE_PROVIDER` | `s3` |
| `S3_BUCKET` | `meridyen-files` |
| `S3_ENDPOINT` | `http://minio:9000` |

Repo referansı (`.env.production.example`):

| Değişken | Örnek değer |
|----------|-------------|
| `S3_BUCKET` | `hasar-documents` |

Kod varsayılanı (`storage.service.ts`):

| Değişken | Default |
|----------|---------|
| `S3_BUCKET` | `sigorta-hasar` |

### 2.2 Kök neden analizi

| Kontrol | Sonuç |
|---------|--------|
| Bucket adı production'da ne? | `meridyen-files` |
| Bucket MinIO'da var mı? | **Hayır** — AWS SDK `NoSuchBucket` döndürüyor |
| Uygulama startup'ta bucket oluşturuyor mu? | **Hayır** — `StorageService` içinde `CreateBucket` / ensure logic yok |
| `existsInS3` upload öncesi çağrılıyor mu? | **Hayır** — `uploadPhoto` doğrudan `storage.upload()` çağırıyor |
| Credential hatası mı? | **Hayır** — credential hatası `AccessDenied` olurdu; mesaj açıkça bucket yok diyor |

**Kök neden:** Production `.env` içinde `S3_BUCKET=meridyen-files` tanımlı, ancak MinIO instance'ında bu bucket **hiç oluşturulmamış** (veya farklı isimle oluşturulmuş, örn. `hasar-documents`).

### 2.3 Etkilenen modüller (aynı StorageService)

| Modül | Upload kullanımı | Smart Takeoff ile ilişki |
|-------|------------------|--------------------------|
| Field Survey Briefs | `scan` → `uploadPhoto` | **Bağımsız** |
| Smart Measures | `photo` upload | **Takeoff girdisi** — aynı S3 hatası SM fotoğrafını da kırar |
| Entity documents, expenses vb. | Çeşitli | Platform geneli |

### 2.4 Önerilen minimum çözüm (ops — kod değişikliği zorunlu değil)

**Seçenek A (tercih — hızlı):** MinIO'da `meridyen-files` bucket'ını oluştur:

```bash
# MinIO console veya mc ile (production ops)
mc mb local/meridyen-files
# veya mevcut bucket policy'yi doğrula
```

**Seçenek B:** Production `.env` içinde `S3_BUCKET` değerini MinIO'da **gerçekten var olan** bucket adıyla hizala (ör. `hasar-documents`).

**Doğrulama:** Upload sonrası `POST field-survey-briefs/scan` → 200; backend logunda `NoSuchBucket` yok.

**Opsiyonel kod iyileştirmesi (ayrı bugfix PR — bu raporda uygulanmadı):** Startup'ta bucket existence check + anlamlı hata mesajı; deploy script'ine bucket bootstrap adımı.

---

## 3. PDF Header Çözümü

### 3.1 Kök neden

`FieldSurveyBriefsController.pdf`:

```typescript
'Content-Disposition': `attachment; filename="${filename}"`,
```

`FieldSurveyBriefsService.generatePdf` dosya adı üretimi:

```typescript
const safeTitle = brief.title.replace(/[^\w\u00C0-\u024F\s-]/g, '').trim().slice(0, 40) || 'kesif-olcusu';
filename: `tahmini-kesif-olcusu-${cf.fileNo}-${safeTitle}.pdf`
```

Production test dosyası verisi:

| Alan | Değer |
|------|--------|
| `fileNo` | `15598774220001` (ASCII — sorun değil) |
| `title` | `Keşif Ölçüsü` |

**Problem:** `safeTitle` regex'i Türkçe karakterleri **koruyor** (`\u00C0-\u024F` aralığı). Üretilen filename:

```
tahmini-kesif-olcusu-15598774220001-Keşif Ölçüsü.pdf
```

Node.js HTTP header'ları yalnızca ASCII kabul eder. `ş`, `ö`, `ü`, `İ` gibi karakterler `Content-Disposition` içinde **ERR_INVALID_CHAR** üretir.

### 3.2 Projede mevcut çözüm deseni (kullanılmamış)

Aynı problem daha önce Smart Measures ve Repair Reports'ta çözülmüş:

- `smart-measures.controller.ts` → `toContentDispositionAttachment()`
- `repair-reports.controller.ts` → yorum: *"Node Content-Disposition header ASCII-only; Türkçe dosya adı kırıyordu (PDF 500)"*

Field Survey Briefs bu helper'ı **kullanmıyor** — regresyon / copy-paste eksikliği.

### 3.3 Önerilen minimum kod düzeltmesi (ayrı bugfix — bu oturumda uygulanmadı)

`field-survey-briefs.controller.ts` içinde `smart-measures.controller.ts` ile aynı `toContentDispositionAttachment()` desenini kullan:

```typescript
'Content-Disposition': toContentDispositionAttachment(filename),
```

Alternatif: ortak utility'ye taşımak (refactor — minimum kapsamda controller içi kopya yeterli).

**Doğrulama:** `GET .../field-survey-briefs/{id}/pdf` → 200 + PDF blob; Türkçe title'lı kayıtlarda header hatası yok.

---

## 4. Smart Takeoff'un Gerçekten Çalışıp Çalışmadığı

### 4.1 Production kanıt özeti

| Kontrol | Sonuç |
|---------|--------|
| Smart Takeoff route'ları deploy'da map edildi | ✅ (v439 startup log) |
| Production'da `smart-takeoff/*` API çağrısı | ❌ Logda yok |
| Production'da `smart-takeoff/*` hata | ❌ Logda yok |
| `takeoffRun` kayıt (platform geneli / test dosyası) | **0** |
| `smartMeasureElement` (test dosyası) | **0** |
| `fieldSurveyBrief` (test dosyası) | **3** (manuel kayıt — scan olmadan) |

### 4.2 SmartTakeoffPanel — render ve network

| Soru | Cevap |
|------|--------|
| Production'da render oluyor mu? | **Kod olarak evet** — `hasar-dosyalari/[id]/page.tsx` → `activeGroup === 'raporlar'` → `<SmartTakeoffPanel />` mount edilir |
| Kullanıcı test sırasında Raporlar sekmesine gitti mi? | **Muhtemelen hayır** — smart-takeoff network çağrısı logda yok |
| Panel açıldığında hangi API çağrılır? | `GET /api/v1/claim-files/{id}/smart-takeoff/runs` |
| Bu çağrı 500 verir mi? | **Beklenmez** — DB sorgusu; S3 kullanmaz; boş liste döner |
| `POST smart-takeoff/runs` çalışıyor mu? | **Doğrulanmadı** — hiç çağrılmamış |
| Neden koşum oluşmuyor? | Test dosyasında **0 Smart Measure** → `createRun` 400 döner: *"Metraj üretilecek uygun akıllı ölçüm bulunamadı..."* |

### 4.3 Smart Takeoff değerlendirme sonucu

| Durum | Açıklama |
|-------|----------|
| **Deploy edildi mi?** | Evet — v439, migration uygulandı |
| **Production'da uçtan uca çalıştı mı?** | **Hayır — doğrulanamadı** |
| **Smart Takeoff kodu 500 veriyor mu?** | Kanıt yok — test edilmemiş |
| **Bloklayıcı (dolaylı)** | SM fotoğraf upload da aynı S3 bucket'a bağlı — SM oluşturulamazsa Takeoff girdisi de oluşmaz |

**Sonuç:** Smart Takeoff capability teknik olarak deploy'da; ancak production Product Acceptance açısından **PASS değil** — E2E hiç koşulmamış.

---

## 5. Yanlış Test Senaryosu Kullanılıp Kullanılmadığı

### 5.1 Evet — capability karışıklığı var

| Capability | UI giriş noktası | Backend modül | Smart Takeoff'u besler mi? |
|------------|------------------|---------------|----------------------------|
| **Field Survey Briefs** | Dosya üstü — «Saha Keşif Ölçüsü» | `field-survey-briefs` | **HAYIR** — bağımsız keşif PDF/WhatsApp modülü |
| **Smart Measure (Akıllı Ölçüm)** | Mobil / SM API; web'de Raporlar → SmartMeasureList | `smart-measures` | **EVET** — Takeoff girdisi |
| **Smart Takeoff (Akıllı Metraj)** | Raporlar sekmesi → SmartTakeoffPanel | `smart-takeoff` | N/A — SM'den tüketir |

### 5.2 Doğru Smart Takeoff Product Acceptance akışı

```
Akıllı Ölçüm kaydı (SM element — kapı/pencere/tavan/süpürgelik)
        ↓
Raporlar sekmesi → SmartTakeoffPanel
        ↓
«Metraj Koşumu Oluştur» (POST smart-takeoff/runs)
        ↓
Operasyon İş Kalemleri → Açıklama → Override
```

### 5.3 Kullanıcının test ettiği akış (yanlış capability)

```
Dosya sayfası → «Saha Keşif Ölçüsü» → «Fotoğraf Çek / Ölçü Gir»
        ↓
POST field-survey-briefs/scan
        ↓
S3 NoSuchBucket → 500 Internal Server Error
```

**Açık hüküm:** Product Acceptance sırasında Smart Takeoff yerine **Field Survey Briefs** test edilmiş. Bu, Smart Takeoff'un çalışmadığı anlamına gelmez; **yanlış giriş noktası** seçilmiştir. Ancak gözlemlenen 500 gerçek ve ayrıca düzeltilmelidir (Field Survey + SM upload infra).

---

## 6. Product Acceptance Tekrarına Kadar Minimum Aksiyonlar

### 6.1 Ops (deploy gerekli — infra)

| # | Aksiyon | Sahip | Blocker kaldırır |
|---|---------|-------|------------------|
| 1 | MinIO'da `meridyen-files` bucket oluştur **veya** `S3_BUCKET` env'i mevcut bucket ile hizala | Ops | Field Survey scan + SM photo upload |
| 2 | Bucket oluşturma sonrası `POST field-survey-briefs/scan` smoke | Ops/QA | 500-A |
| 3 | G3 test dosyasında en az 1 **Smart Measure** elementi olduğunu doğrula (mobil/API) | Mustafa | Takeoff girdisi |

### 6.2 Bugfix (minimal kod — ayrı BUILD oturumu, bu raporda commit yok)

| # | Aksiyon | Dosya | Blocker kaldırır |
|---|---------|-------|------------------|
| 4 | `toContentDispositionAttachment()` kullan | `field-survey-briefs.controller.ts` | PDF 500-B |
| 5 | (Opsiyonel) Paylaşılan helper extract | Ortak util veya import | Tekrar önleme |

### 6.3 Product Acceptance tekrar checklist

| # | Adım | Beklenen |
|---|------|----------|
| 6 | **Field Survey Briefs** ayrı smoke: scan + PDF | 200 (FSB capability) |
| 7 | **Smart Measure** smoke: en az 1 ölçü kaydı | SM listesi dolu |
| 8 | **Smart Takeoff** E1–E8: Raporlar sekmesi | Panel görünür, koşum oluşur |
| 9 | DB doğrulama: `takeoffRun` > 0, E8 rule seed | PASS |
| 10 | Capability Acceptance Report güncelle | Review Gate |

### 6.4 Yapılmayacaklar (bu analiz kapsamında)

- Yeni feature · refactor · migration · schema değişikliği · UI redesign · yeni endpoint
- Commit · deploy · manifest güncelleme (bu oturum)

---

## Özet tablo

| Konu | Kök neden | Smart Takeoff mu? | Minimum fix |
|------|-----------|-------------------|-------------|
| Scan 500 | `NoSuchBucket` — `meridyen-files` yok | **Hayır** (FSB) | Ops: bucket oluştur |
| PDF 500 | Content-Disposition Türkçe karakter | **Hayır** (FSB) | Kod: ASCII helper |
| Takeoff doğrulanamadı | Yanlış UI + 0 SM + API hiç çağrılmadı | **Evet** | Doğru E2E + SM verisi |
| SM fotoğraf | Aynı S3 bucket | **Dolaylı** (girdi) | Ops: bucket oluştur |

---

## Doğrulama kaydı

```
Rapor: PRODUCT_ACCEPTANCE_ROOT_CAUSE_REPORT
Tarih: 2026-08-02
500-A: NoSuchBucket (meridyen-files) — FSB scan
500-B: Content-Disposition ERR_INVALID_CHAR — FSB pdf
Smart Takeoff API: production'da test edilmedi (0 run)
Yanlış test senaryosu: EVET (FSB ≠ SQT)
Kod/deploy: YAPILMADI
```

# Smart Takeoff — Product Acceptance Realignment Report

| Alan | Değer |
|------|--------|
| Tarih | 2026-08-02 |
| Amaç | Product Acceptance sürecini capability bazlı düzeltmek |
| Tetikleyici | [Root Cause Report](./PRODUCT_ACCEPTANCE_ROOT_CAUSE_REPORT.md) — yanlış capability test edildi |
| Kod / deploy | **Yapılmadı** |

**Stratejik kural (bundan sonra):** Capability A (Field Survey Briefs) ile Capability B (Smart Takeoff) **tamamen bağımsız** değerlendirilir. Biri FAIL iken diğeri otomatik FAIL sayılmaz.

---

## 1. Capability Ayrımı

### Capability A — Field Survey Briefs (FSB)

| Alan | Değer |
|------|--------|
| Modül | `field-survey-briefs` |
| UI girişi | Dosya sayfası üstü — «Saha Keşif Ölçüsü» |
| Kullanıcı aksiyonu | «Fotoğraf Çek / Ölçü Gir» |
| Kapsam | Fotoğraf · ölçü girişi · scan · OCR/AI · PDF · WhatsApp paylaşım · S3/MinIO depolama |
| Smart Takeoff ile ilişki | **YOK** — bağımsız capability |
| Acceptance Gate | **FSB Acceptance Gate** (ayrı) |

### Capability B — Smart Takeoff (SQT)

| Alan | Değer |
|------|--------|
| Modül | `smart-takeoff` (+ girdi: `smart-measures`) |
| UI girişi | Dosya → **Raporlar** sekmesi → SmartTakeoffPanel |
| Kullanıcı aksiyonu | «Metraj Koşumu Oluştur» |
| Kapsam | Smart Measure okuma · Rule Engine · Takeoff Run · Takeoff Items · Explanation · Override · RuleVersion · Operasyon İş Kalemleri |
| Field Survey ile ilişki | **YOK** — FSB giriş noktası kabul edilmez |
| Acceptance Gate | **SQT Acceptance Gate** (ayrı) |

### Paylaşılan altyapı (Acceptance'ı birleştirmez)

| Altyapı | Etki |
|---------|------|
| S3/MinIO (`meridyen-files`) | FSB scan **ve** SM fotoğraf upload etkilenir |
| S3 hatası | FSB Acceptance'ı bloke eder; **SQT Acceptance otomatik FAIL değildir** |
| S3 hatası + 0 SM | SQT koşumu oluşturulamaz — bu **SQT test ön koşulu**, FSB hatası değil |

---

## 2. Yanlış Acceptance Noktaları

### 2.1 Taranan dokümanlar

| Doküman | Karışıklık var mı? | Sorun |
|---------|-------------------|--------|
| `PRODUCT_ACCEPTANCE_ROOT_CAUSE_REPORT.md` | Kısmen düzeltilmiş | §6.1 madde 1–2 FSB; madde 3 SM — doğru ayrım; özet tabloda SM/S3 dolaylı SQT satırı netleştirilmeli |
| `SMART_TAKEOFF_CAPABILITY_ACCEPTANCE_REPORT.md` | Hayır (SQT odaklı) | E1–E8 doğru akış; FSB riski yok |
| `SMART_TAKEOFF_PRODUCT_ACCEPTANCE_READY.md` | Hayır | G3 = SM ölçülü dosya — doğru |
| `SMART_TAKEOFF_BUILD_FINALIZATION_REPORT.md` | Hayır | E2–E8 SQT checklist — doğru |
| `SMART_TAKEOFF_CONTROLLED_DEPLOY_EXECUTION_REPORT.md` | Hayır | E1–E8 SQT — doğru |
| `SMART_TAKEOFF_STAGING_OPERATION_PLAN.md` (Faz 5) | Hayır | Raporlar → SmartTakeoffPanel — doğru |
| Önceki canlı gözlem / bug investigation | **Evet** | «Fotoğraf Çek» FSB akışı SQT FAIL gerekçesi sayıldı |
| Kullanıcı test oturumu (2026-08-02) | **Evet** | FSB ekranı SQT giriş sanıldı |

### 2.2 Yanlış kabul edilen noktalar (düzeltilmeli)

| # | Yanlış varsayım | Gerçek |
|---|-----------------|--------|
| Y1 | «Fotoğraf Çek / Ölçü Gir» = Smart Takeoff girişi | **FSB** capability girişi |
| Y2 | FSB scan 500 → Smart Takeoff FAIL | **FSB FAIL**; SQT ayrı gate |
| Y3 | FSB PDF 500 → Smart Takeoff FAIL | **FSB FAIL**; SQT ayrı gate |
| Y4 | Dosya sayfası ana ekran hatası = Takeoff çalışmıyor | FSB ve SQT farklı UI mount noktaları |
| Y5 | Lifecycle «Fotoğraf → … → Override» tek zincir | İki ayrı lifecycle — aşağıda |

### 2.3 Geriye dönük düzeltme hükmü

2026-08-02 Product Acceptance oturumunda gözlemlenen **Internal Server Error**, Smart Takeoff Capability Acceptance için **geçersiz test kanıtıdır**. Geçerli kanıt yalnızca FSB Capability Acceptance içinde değerlendirilir.

---

## 3. Doğru Acceptance Akışı

### Capability A — Field Survey Briefs

```
Dosya sayfası
  → «Saha Keşif Ölçüsü»
  → «Fotoğraf Çek / Ölçü Gir»
  → POST field-survey-briefs/scan (fotoğraf + AI)
  → Ölçü düzenle / kaydet
  → POST field-survey-briefs
  → (opsiyonel) GET .../pdf
  → FSB Acceptance
```

### Capability B — Smart Takeoff

```
Smart Measure kaydı (kapı/pencere/tavan/süpürgelik)
  ↓
Dosya → Raporlar sekmesi
  ↓
SmartTakeoffPanel (GET smart-takeoff/runs)
  ↓
«Metraj Koşumu Oluştur» (POST smart-takeoff/runs)
  ↓
Operasyon İş Kalemleri tablosu
  ↓
Explanation drawer
  ↓
Override drawer + audit
  ↓
SQT Acceptance
```

**FSB akışı SQT zincirine dahil edilmez.**

---

## 4. Güncellenmiş Acceptance Checklist (özet)

| Gate | Checklist ID | Adet | Bağımsız |
|------|--------------|------|----------|
| FSB Acceptance | F1–F6 | 6 | ✅ |
| SQT Acceptance | S1–S8 | 8 | ✅ |

Detay: Bölüm 5 ve 6.

---

## 5. Field Survey Acceptance (Capability A)

**Gate adı:** Field Survey Briefs Acceptance Gate  
**Ön koşul:** Production v439+ · oturum · `claim_file.update`  
**Blocker'lar (bilinen):** NoSuchBucket · PDF Content-Disposition  
**Smart Takeoff ile ilişki:** Yok

### FSB Checklist

| ID | Senaryo | Adımlar | Beklenen | Sonuç |
|----|---------|---------|----------|--------|
| **F1** | Modal erişimi | Dosya aç → «Saha Keşif Ölçüsü» | Modal açılır | ☐ |
| **F2** | Fotoğraf scan | «Fotoğraf Çek / Ölçü Gir» → fotoğraf | `POST .../scan` → **200**; ölçü alanları dolar | ☐ |
| **F3** | Manuel ölçü | Scan olmadan ölçü gir → kaydet | `POST .../field-survey-briefs` → **200** | ☐ |
| **F4** | Liste | Dosya sayfası | Kayıt listede görünür | ☐ |
| **F5** | PDF | Kayıt → PDF | `GET .../pdf` → **200**; dosya iner (Türkçe title) | ☐ |
| **F6** | Paylaşım (opsiyonel) | WhatsApp paylaş | Link oluşur | ☐ |

### FSB bilinen blocker çözümü (Acceptance öncesi — ops/kod, ayrı oturum)

| Blocker | Minimum aksiyon | Sahip |
|---------|-----------------|-------|
| NoSuchBucket | MinIO `meridyen-files` bucket oluştur veya env hizala | Ops |
| PDF header | `toContentDispositionAttachment()` — FSB controller | Bugfix oturumu |

### FSB Acceptance kararı

| Karar | Koşul |
|-------|--------|
| **PASS** | F2 + F3 + F5 PASS (F1, F4 zorunlu) |
| **FAIL** | F2 veya F5 kritik FAIL |
| **SQT etkisi** | **Yok** — SQT gate bağımsız devam eder |

---

## 6. Smart Takeoff Acceptance (Capability B)

**Gate adı:** Smart Takeoff Capability Acceptance Gate  
**Ön koşul:** Production v439+ · migration uygulandı · **SM ölçülü test dosyası (G3)** · test kullanıcı (G4)  
**Blocker'lar:** G3/G4 eksik · E2E tamamlanmamış · (FSB hataları **blocker değil**)  
**Field Survey ile ilişki:** Yok — FSB test edilse bile SQT sonucunu etkilemez

### SQT Checklist (Operation Plan Faz 5 — düzeltilmiş)

| ID | Senaryo | Adımlar | Beklenen | Ön koşul | Sonuç |
|----|---------|---------|----------|----------|--------|
| **S1** | Panel erişimi | G3 dosya → **Raporlar** | SmartTakeoffPanel görünür | G4 oturum | ☐ |
| **S2** | Koşum oluştur | «Metraj Koşumu Oluştur» | Run #1; 4+ iş kalemi | G3: ≥1 SM (kapı vb.) | ☐ |
| **S3** | Hesaplama | Tablo satırları | displayName, miktar, birim doğru | S2 | ☐ |
| **S4** | Açıklama | «Açıklama» drawer | Adımlar + humanReadableText | S2 | ☐ |
| **S5** | Override | «Düzelt» → miktar + sebep | quantityFinal güncellenir | S2 | ☐ |
| **S6** | Audit | DB/API | `takeoff_manual_overrides` active=true | S5 | ☐ |
| **S7** | Persist | Sayfa yenile | Koşum listelenir | S2 | ☐ |
| **S8** | RuleVersion | S2 sonrası DB | `s1.2026.08.02.1` + 4 kural | S2 | ☐ |

**Eski E1–E8 etiketleri → S1–S8** (FSB F* ile karışmaması için yeniden adlandırıldı).

### SQT negatif senaryo (opsiyonel)

| Senaryo | Beklenen |
|---------|----------|
| SM ölçüsüz dosya → koşum oluştur | Anlamlı Türkçe 400 mesajı |
| Yetkisiz kullanıcı → POST runs | 403 |

### SQT Acceptance kararı

| Karar | Koşul |
|-------|--------|
| **PASS** | S1–S8 PASS; kritik S2/S3/S5 FAIL yok |
| **FAIL** | S2 veya S3 veya S5 FAIL |
| **FSB etkisi** | **Yok** — FSB gate bağımsız |

### SQT mevcut durum (2026-08-02)

| Metrik | Değer |
|--------|--------|
| Deploy | ✅ v439 |
| Otomasyon | ✅ 59/59 |
| Production E2E | ⏳ PENDING — G3/G4 + doğru akış |
| FSB hatası nedeniyle SQT FAIL | **Geçersiz** — realignment sonrası iptal |

---

## 7. Review Gate Önerisi

### 7.1 İki bağımsız gate

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│  FSB Acceptance Gate        │     │  SQT Acceptance Gate        │
│  (Capability A)             │     │  (Capability B)             │
├─────────────────────────────┤     ├─────────────────────────────┤
│  F1–F6 checklist            │     │  S1–S8 checklist            │
│  Blocker: S3, PDF header    │     │  Blocker: G3/G4, SM verisi  │
│  Karar: FSB ACCEPTED / FAIL │     │  Karar: SQT ACCEPTED / FAIL │
└─────────────────────────────┘     └─────────────────────────────┘
         │                                    │
         └────────── bağımsız ────────────────┘
```

### 7.2 Gate kuralları

| Kural | Açıklama |
|-------|----------|
| **R1** | FSB FAIL → SQT gate **açık kalır** (ertelenmez, otomatik FAIL olmaz) |
| **R2** | SQT FAIL → FSB gate **etkilenmez** |
| **R3** | SQT Accepted için FSB Accepted **gerekmez** |
| **R4** | FSB Accepted için SQT Accepted **gerekmez** |
| **R5** | KNOWN_GOOD v439 güncellemesi → **SQT Accepted** sonrası (deploy zaten yapıldı) |
| **R6** | Platform Knowledge → her capability **kendi Accepted** anında |

### 7.3 Önerilen Review Gate sırası

| Sıra | Gate | Sorumlu | Bağımlılık |
|------|------|---------|------------|
| 1 | FSB Acceptance (F1–F6) | Mustafa + Ops | S3 bucket fix |
| 2 | SQT Acceptance (S1–S8) | Mustafa | G3/G4 + SM verisi |
| 3 | SQT KNOWN_GOOD manifest onayı | Ops | SQT Accepted |
| 4 | SQT Platform Knowledge kapanış | Mustafa | SQT Accepted |
| 5 | FSB Platform Knowledge kapanış | Mustafa | FSB Accepted (ayrı) |

### 7.4 Doküman güncelleme notu (gelecek operasyon kayıtları)

Aşağıdaki raporlarda **FSB/SQT ayrımı** korunmalı; FSB hataları SQT bölümüne yazılmamalı:

- `SMART_TAKEOFF_CAPABILITY_ACCEPTANCE_REPORT.md` — yalnızca S1–S8
- Yeni: FSB acceptance sonuçları ayrı kayıt (bu realignment raporu FSB checklist kaynağı)
- `PRODUCT_ACCEPTANCE_ROOT_CAUSE_REPORT.md` — referans; karışıklığı çözdü

**Bu oturumda mevcut dokümanlar değiştirilmedi** — realignment bu raporda tanımlandı.

---

## Doğrulama kaydı

```
Gate: Product Acceptance Strategic Realignment
Tarih: 2026-08-02
Capability A: Field Survey Briefs — bağımsız (F1–F6)
Capability B: Smart Takeoff — bağımsız (S1–S8)
Yanlış test: FSB ekranı SQT giriş sanıldı — GEÇERSİZ
Cross-fail yasağı: AKTİF
Kod/deploy: YAPILMADI
Sonraki: FSB gate + SQT gate ayrı ayrı koşulacak
```

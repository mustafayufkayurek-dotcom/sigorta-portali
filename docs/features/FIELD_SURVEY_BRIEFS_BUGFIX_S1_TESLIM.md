# Field Survey Briefs — Bugfix Sprint S1 Teslim

| Alan | Değer |
|------|--------|
| Capability | **Field Survey Briefs** (Capability A) |
| Sprint | Bugfix S1 |
| Tarih | 2026-08-02 |
| Branch | `feature/smart-quantity-takeoff-s1` (mevcut) |
| Smart Takeoff | **Kapsam dışı** — etkilenmedi |
| Push / deploy | **Yapılmadı** |

---

## 1. Root Cause

### Bug 1 — NoSuchBucket (`POST .../field-survey-briefs/scan`)

| Alan | Değer |
|------|--------|
| **Sınıflandırma** | **B — Configuration** |
| Production exception | `NoSuchBucket: The specified bucket does not exist` |
| Katman | AWS SDK S3 `PutObjectCommand` → `StorageService.uploadToS3` |

**Kök neden:** Production ortamında `STORAGE_PROVIDER=s3` ve `S3_BUCKET=meridyen-files` yapılandırılmış; MinIO instance'ında bu isimde bucket **provision edilmemiş**. Repo örneği (`hasar-documents`) ile production env **uyumsuz**.

| Kaynak | Bucket adı |
|--------|------------|
| Production env | `meridyen-files` |
| `.env.production.example` | `hasar-documents` |
| Kod varsayılanı | `sigorta-hasar` |

**Kod vs operasyon ayrımı:**

| Tip | Bulgu |
|-----|--------|
| **Operasyon (gerekli)** | MinIO'da `meridyen-files` bucket oluştur **veya** production `S3_BUCKET` mevcut bucket ile hizala |
| **Kod** | `StorageService` upload öncesi bucket existence check yapmıyor; startup'ta bucket oluşturmuyor — **tasarım gereği** (diğer modüller de aynı) |

**Bugfix S1 kararı:** Ops değişikliği gerektiği için **kod değişikliği yapılmadı**. NoSuchBucket çözümü production ops adımına bırakıldı.

### Bug 2 — PDF Content-Disposition (`GET .../field-survey-briefs/:id/pdf`)

| Alan | Değer |
|------|--------|
| **Sınıflandırma** | **C — Kod** |
| Production exception | `ERR_INVALID_CHAR: Invalid character in header content ["Content-Disposition"]` |
| Katman | Express `res.set` — HTTP header |

**Kök neden:** `FieldSurveyBriefsController.pdf` ham Türkçe filename'i (`Keşif Ölçüsü`) doğrudan `Content-Disposition` header'ına yazıyordu. Node.js header'ları ASCII-only kabul eder. Smart Measures controller'da aynı problem daha önce `toContentDispositionAttachment()` ile çözülmüştü; FSB endpoint bu deseni kullanmıyordu.

---

## 2. Yapılan Değişiklik

| Bug | Değişiklik |
|-----|------------|
| NoSuchBucket | **Kod değişikliği yok** — Configuration/ops çözümü dokümante edildi |
| PDF header | `toFieldSurveyPdfContentDisposition()` eklendi; PDF endpoint güncellendi |

**PDF düzeltme detayı:**
- `filename=` kısmı ASCII-safe (Türkçe karakter transliterasyon + NFKD)
- `filename*=UTF-8''` ile orijinal UTF-8 ad korunur (RFC 5987)
- Smart Measure yaklaşımı ile aynı desen; Smart Measure dosyası **değiştirilmedi**

---

## 3. Etkilenen Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `field-survey-briefs.controller.ts` | PDF `Content-Disposition` helper kullanımı |
| `field-survey-briefs-content-disposition.util.ts` | **Yeni** — header helper |
| `field-survey-briefs-content-disposition.util.spec.ts` | **Yeni** — unit test |

**Toplam:** 3 dosya (1 controller + 1 util + 1 spec)

---

## 4. Etkilenmeyen Capability'ler

| Capability / modül | Etki |
|--------------------|------|
| **Smart Takeoff** | ❌ Dokunulmadı — 59/59 regresyon PASS |
| Smart Measures | ❌ Dokunulmadı |
| Rule Engine / Override / Explanation | ❌ |
| Migration / Prisma schema | ❌ |
| StorageService (global) | ❌ |
| UI | ❌ |
| Production env / MinIO | ❌ (deploy yasak) |

---

## 5. Test Sonuçları

| Test | Sonuç |
|------|--------|
| `field-survey-briefs-content-disposition.util.spec.ts` | **2/2 PASS** |
| Smart Takeoff regresyon (`modules/smart-takeoff`) | **59/59 PASS** |
| `pnpm run build` (backend) | **PASS** |

**Not:** Scan endpoint integration testi production MinIO bucket gerektirir — bu sprintte ops adımı bekleniyor (F1 checklist).

---

## 6. Risk Analizi

| Risk | Seviye | Azaltma |
|------|--------|---------|
| NoSuchBucket production'da devam | **Yüksek** | Ops: bucket oluştur (F1) — kod deploy sonrası scan hâlâ fail olur bucket yoksa |
| PDF fix deploy edilmeden production'da devam | Orta | Backend deploy (Review Gate sonrası) |
| Helper drift (SM vs FSB ayrı kopya) | Düşük | Bilinçli — refactor kapsam dışı; desen aynı |
| Smart Takeoff regresyon | **Yok** | 59/59 doğrulandı |

---

## 7. Review Gate Önerisi

### FSB Bugfix S1 Review Gate

| Kriter | Durum |
|--------|--------|
| PDF kod fix | ✅ Tamamlandı |
| NoSuchBucket kod fix | N/A — ops gerekli |
| Smart Takeoff regresyon | ✅ 59/59 |
| Build | ✅ PASS |
| Kapsam dışı ihlal | ✅ Yok |

**Öneri:** Bugfix S1 **KOŞULLU ONAY** — PDF fix merge/deploy için uygun; NoSuchBucket için **ops adımı zorunlu** (F1).

### Product Acceptance devam (FSB F1–F6)

| Adım | Sorumlu | Blocker |
|------|---------|---------|
| F1 Bucket doğrulama | Ops | MinIO `meridyen-files` oluştur veya env hizala |
| F2–F6 | QA/Mustafa | F1 sonrası |
| F4 PDF | QA | Backend deploy (PDF fix) sonrası |

### Smart Takeoff

**Bağımsız** — S1–S8 checklist FSB bugfix'ten etkilenmez.

---

## Doğrulama kaydı

```
Sprint: Field Survey Briefs Bugfix S1
NoSuchBucket: B Configuration — kod değişikliği yok, ops gerekli
PDF: C Kod — Content-Disposition fix uygulandı
Tests: 2/2 FSB + 59/59 SQT regresyon PASS
Deploy: YAPILMADI
Smart Takeoff: ETKİLENMEDİ
```

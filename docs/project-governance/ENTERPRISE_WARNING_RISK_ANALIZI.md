# WARNING Risk Analizi — Enterprise Stabilizasyon

**Tarih:** 2026-07-22  
**Kapsam:** Matristeki WARNING modülleri (FAIL/PASS/PENDING bu belgede derinlenmez)  
**Kural:** Commit yok · Revert yok · Deploy yok · Kod uygulanmadı  
**Canlı referans:** web v392 / backend v390  
**Kaynak kanıt:** kod + `KNOWN_GOOD_IMAGES.json` + inbox/canlı-kabul

## Risk türü sözlüğü

| Kod | Anlam |
|-----|--------|
| **T** | Gerçek teknik risk (yanlış davranış / veri / güvenlik sınıfı) |
| **UT** | Eksik kullanıcı doğrulaması (Mustafa canlı kabul ⏳) |
| **SM** | Eksik smoke (rota manifest’te yok veya kısmi) |
| **TS** | Eksik otomatik / senaryo testi |
| **KQ** | Kod kalitesi (sessiz catch, churn, bakım) |
| **WIP** | Geçici çalışma notu / local dirty (ürün arızası değil) |

Bir madde birden fazla türe sahip olabilir; **öncelik en ağır türe** göre verilir.

---

## 1. Login (`/giris`)

| Alan | İçerik |
|------|--------|
| **Risk türleri** | UT, SM (auth login smoke credential), KQ (hafif) |
| **1. Tanım** | Kabuk freeze’li giriş ekranı; otomatik auth smoke production credential olmadığı için sürekli FAIL görünüyor. |
| **2. Kök neden** | `post-deploy-smoke` varsayılan `LOGIN_*`; canlı şifre agent ortamında yok. Checklist #1 Mustafa ⏳. |
| **3. Kullanıcı etkisi** | Normal kullanıcı girişi çalışıyorsa etki düşük; agent “smoke FAIL” diye yanlış alarm üretiyor. |
| **4. Çözüm** | Auth smoke’u “credential yoksa SKIP/PARTIAL” olarak ayır; Mustafa tek seferlik giriş doğrulaması. |
| **5. Süre** | 0,5–1 gün |
| **6. Öncelik** | **Orta** (yanlış alarm / süreç; ürün arızası kanıtı yok) |

---

## 2. Operasyon Merkezi (`/panel/operasyon` + gelen kutusu)

| Alan | İçerik |
|------|--------|
| **Risk türleri** | UT, TS (T1–T7), KQ, WIP (breadcrumb) |
| **1. Tanım** | Liste smoke’ta var; gelen kutusu senaryo testleri (T1–T7) açık; sessiz catch’ler var. |
| **2. Kök neden** | `OPERASYON_GELEN_KUTUSU.md` T1–T7 ⏳; ihbar konuları `.catch(() => {})`; local breadcrumb dirty. |
| **3. Kullanıcı etkisi** | Prefill / müşteri eşleme / hasar-acil açılış hataları “komik eksik” sınıfı — testte yakalanırsa utanç. |
| **4. Çözüm** | T1–T7 kontrol listesini tek oturumda kapat; sessiz catch → toast; breadcrumb WIP’i dil sınıfına bağla (ayrı commit kararı sonra). |
| **5. Süre** | 2–3 gün (test + küçük yamalar) |
| **6. Öncelik** | **Yüksek** |

---

## 3. Hasar Dosyaları (liste)

| Alan | İçerik |
|------|--------|
| **Risk türleri** | UT, SM (detay yok), WIP (büyük indent churn) |
| **1. Tanım** | Liste smoke PASS; detay ve onarım raporu smoke’ta yok; local’de büyük whitespace dirty. |
| **2. Kök neden** | Hassas modül; checklist detay ⏳; WIP çoğunlukla format/indent (ürün farkı belirsiz). |
| **3. Kullanıcı etkisi** | Liste açılır; asıl risk detayda (aşağı #5). Liste WARNING’i çoğu **süreç/WIP**. |
| **4. Çözüm** | Dirty diff’i “gerçek değişiklik vs format” diye ayır (uygulama değil, triage); liste için WARNING’i UT+WIP olarak düşür. |
| **5. Süre** | Triage 0,5 gün; gerçek fix ayrı |
| **6. Öncelik** | **Orta** (liste) — detay Kritik/Yüksek |

---

## 4. Acil Yardım

| Alan | İçerik |
|------|--------|
| **Risk türleri** | SM, UT, T (dil kalan), WIP, KQ |
| **1. Tanım** | `/panel/acil-yardim` smoke’ta yok; detayda «Asistans» UI metinleri kaldı; dirty WIP. |
| **2. Kök neden** | Manifest smoke listesi hasar ağırlıklı; dil tutarsızlığı kısmi F1; sessiz/şablon catch’ler. |
| **3. Kullanıcı etkisi** | Yanlış firma dili kafa karıştırır; smoke eksikliği regresyonu geç yakalatır. |
| **4. Çözüm** | Smoke’a `/panel/acil-yardim` ekle (karar sonrası); kalan Asistans UI tarama; catch→toast. |
| **5. Süre** | 1–2 gün |
| **6. Öncelik** | **Yüksek** |

---

## 5. Dosya Detay (hasar `[id]` + acil `[id]`)

| Alan | İçerik |
|------|--------|
| **Risk türleri** | T (potansiyel), UT, SM, TS, KQ, WIP |
| **1. Tanım** | En hassas yüzey; smoke’ta yok; finans-subtabs sessiz catch yoğun; VendorDiscovery’de Google kaynak etiketi kalmış olabilir. |
| **2. Kök neden** | Detay deep-link smoke yok; hata yutuluyor; checklist #23 ⏳; UX kilit dokümanları var ama otomatik kapı yok. |
| **3. Kullanıcı etkisi** | Kaydet/aksiyon sessizce başarısız → “kaydettim sandım” sınıfı; en yüksek utanç riski. |
| **4. Çözüm** | Kritik aksiyonlarda toast zorunlu; detay smoke (auth’lu); vendor kaynak etiketini ürün diline çek; dirty churn triage. |
| **5. Süre** | 3–5 gün |
| **6. Öncelik** | **Kritik** |

---

## 6. Hasar Operasyon Planlayıcısı

| Alan | İçerik |
|------|--------|
| **Risk türleri** | UT, SM, TS, KQ (hafif) |
| **1. Tanım** | Canlıda hasar detay `?grup=operasyon`; ayrı smoke yok; paralel isteklerde null fallback. |
| **2. Kök neden** | UX standardı dokümanda; otomatik test/smoke yok; API yoksa sessiz boş veri. |
| **3. Kullanıcı etkisi** | Adım verisi boş kalırsa “çalışmıyor” hissi; sahte başarı yoksa iyi, ama görünür hata eksik olabilir. |
| **4. Çözüm** | Boş API → kullanıcıya net empty/error; smoke’a planlayıcı deep-link (auth); senaryo checklist. |
| **5. Süre** | 1,5–2 gün |
| **6. Öncelik** | **Yüksek** |

---

## 7. Tedarikçi Yönetimi

| Alan | İçerik |
|------|--------|
| **Risk türleri** | T (etiket kalan), UT (AK-001 / dış arama), SM (liste var), WIP, KQ |
| **1. Tanım** | Liste smoke var; dış arama checklist ⏳; VendorDiscovery `SOURCE_LABELS` hâlâ Google; sessiz catch. |
| **2. Kök neden** | Banner temizlendi, badge/label kalmış; AK-001 ürün teyidi; catch→console. |
| **3. Kullanıcı etkisi** | Yasak teknoloji etiketi testte “komik”; kaydet hatası sessiz kalabilir. |
| **4. Çözüm** | SOURCE_LABELS ürün dili; catch toast; Mustafa dış arama + kart notu teyidi. |
| **5. Süre** | 1–2 gün |
| **6. Öncelik** | **Yüksek** |

---

## 8. Finans

| Alan | İçerik |
|------|--------|
| **Risk türleri** | UT, SM, WIP (indent), KQ |
| **1. Tanım** | `/panel/finans*` smoke’ta yok; checklist alt sayfalar ⏳; masraflar dirty churn. |
| **2. Kök neden** | Smoke kapsamı dar; B1 envanter eski; local format gürültüsü. |
| **3. Kullanıcı etkisi** | Regresyon geç yakalanır; şu an kanıtlı kritik teknik bug yok. |
| **4. Çözüm** | Smoke’a `/panel/finans` (+ masraflar); kullanıcı kabul turu; churn triage. |
| **5. Süre** | 1–2 gün (süreç) + bug çıkarsa ekstra |
| **6. Öncelik** | **Orta** |

---

## 9. Ayarlar

| Alan | İçerik |
|------|--------|
| **Risk türleri** | UT, SM (kısmi), WIP, KQ |
| **1. Tanım** | Smoke yalnız `/panel/ayarlar/tanimlar`; hub/entegrasyonlar smoke’ta yok; entegrasyonlar admin’de Google Places bilinçli. |
| **2. Kök neden** | Admin ayar ≠ operasyon UI; checklist #3–15 ⏳; dirty entegrasyonlar sayfası. |
| **3. Kullanıcı etkisi** | Operasyon kullanıcısına Google sızması düşük (admin); hub kırılırsa ayar erişimi etkilenir. |
| **4. Çözüm** | Smoke’a `/panel/ayarlar` hub; entegrasyon Google etiketini “admin istisna” olarak belgeye kilitle; WIP triage. |
| **5. Süre** | 1 gün |
| **6. Öncelik** | **Orta** |

---

## 10. Raporlar

| Alan | İçerik |
|------|--------|
| **Risk türleri** | UT, WIP (breadcrumb), SM (hub var / alt yok) |
| **1. Tanım** | Hub smoke var; alt raporlar smoke’ta ayrı yok; checklist ⏳; dirty yalnızca dil. |
| **2. Kök neden** | WARNING çoğunlukla **eksik kullanıcı doğrulama + WIP notu**. |
| **3. Kullanıcı etkisi** | Düşük — teknik arıza kanıtı yok. |
| **4. Çözüm** | Mustafa kısa kabul; breadcrumb dil sınıfı ile kapat; WARNING’i düşür. |
| **5. Süre** | 0,5 gün |
| **6. Öncelik** | **Düşük** |

---

## 11. Eksper Portalı

| Alan | İçerik |
|------|--------|
| **Risk türleri** | UT, SM, KQ, WIP |
| **1. Tanım** | Shell freeze’li; smoke yok; özet yüklemede boş catch; checklist #27 ⏳. |
| **2. Kök neden** | Portal smoke manifest’e hiç girmedi; sessiz fallback. |
| **3. Kullanıcı etkisi** | Eksper özet boş kalırsa “bozuk portal”; shell bozulursa freeze ihlali. |
| **4. Çözüm** | Smoke `/panel/eksper-portal`; catch→empty state mesajı; Mustafa kabul. |
| **5. Süre** | 1–1,5 gün |
| **6. Öncelik** | **Yüksek** |

---

## 12. CRM

| Alan | İçerik |
|------|--------|
| **Risk türleri** | UT, SM, TS, KQ |
| **1. Tanım** | Smoke yok; B5 “tam kapsam” ertelenmiş; prefetch sessiz catch; Hafıza etiketi kapanmış. |
| **2. Kök neden** | Ürün derinliği bilinçli ertelenmiş + test/smoke eksik. |
| **3. Kullanıcı etkisi** | CRM kullanılmıyorsa düşük; kullanılıyorsa boş panel / sessiz hata. |
| **4. Çözüm** | Smoke ekle veya “bilinçli kapsam dışı” diye matriste SKIP; catch toast. |
| **5. Süre** | 0,5–1 gün (süreç) |
| **6. Öncelik** | **Orta** (kapsam kararıyla Düşük’e inebilir) |

---

## Özet tablo (tür × öncelik)

| Modül | T | UT | SM | TS | KQ | WIP | Öncelik |
|-------|---|----|----|----|----|-----|---------|
| Login | | ✓ | ✓ | | ✓ | | Orta |
| Operasyon + Gelen Kutusu | | ✓ | | ✓ | ✓ | ✓ | Yüksek |
| Hasar Liste | | ✓ | | | | ✓ | Orta |
| Acil Yardım | ✓ | ✓ | ✓ | | ✓ | ✓ | Yüksek |
| Dosya Detay | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **Kritik** |
| Planlayıcı | | ✓ | ✓ | ✓ | ✓ | | Yüksek |
| Tedarikçi | ✓ | ✓ | | | ✓ | ✓ | Yüksek |
| Finans | | ✓ | ✓ | | ✓ | ✓ | Orta |
| Ayarlar | | ✓ | ✓ | | ✓ | ✓ | Orta |
| Raporlar | | ✓ | | | | ✓ | Düşük |
| Eksper Portalı | | ✓ | ✓ | | ✓ | ✓ | Yüksek |
| CRM | | ✓ | ✓ | ✓ | ✓ | | Orta |

---

## Öncelikli düzeltme planı — SUPERSEDED

Ekran bazlı Dalga A/B/C **kaldırıldı**.  
Güncel yürütme planı: **`ENTERPRISE_DALGA_PLANI.md`** (akış bazlı Dalga 1–4).

| Eski öneri | Yeni karşılık |
|------------|----------------|
| Dosya Detay önce | Dalga 2 (Dalga 1 form/kaydet kapısından sonra) |
| Tedarikçi / il-ilçe / sessiz catch | **Dalga 1** |
| Operasyon / Gelen Kutusu / Planlayıcı / Acil / Eksper | **Dalga 2** |
| CRM / Finans / Ayarlar / Raporlar | **Dalga 3** |
| Dil / freeze / smoke / E2E | **Dalga 4** |

*Risk analizi maddeleri (tür × öncelik tablosu) geçerlidir; yalnızca sıra modeli değişti.*

---

## Analiz sonucu (bu aşama)

| Soru | Cevap |
|------|--------|
| WARNING’lerin hepsi teknik bug mı? | **Hayır.** Çoğu UT + SM + WIP karışımı. |
| Gerçek teknik sınıf nerede? | Özellikle **Dosya Detay**, **Tedarikçi etiket kalanı**, **Acil dil kalanı**, sessiz catch. |
| Feature Freeze’e hemen alınacaklar? | **Henüz karar yok** — seninle birlikte; öneri: Dashboard/Login/Portal shell zaten freeze; detay/operasyon freeze’i A dalgası sonrası. |

**Genel program durumu değişmedi:** 🔴 NOT READY (analiz tamam; düzeltme uygulanmadı)

*Sonraki adım (senin onayın): Dalga A’dan hangi maddeyle kodlamaya geçelim — yoksa önce Feature Freeze aday listesini mi kilitleyelim?*

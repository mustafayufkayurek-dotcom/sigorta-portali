# Faz 2 — Smart Quantity Takeoff (Akıllı Metraj)

# İş Analizi

| Alan | Değer |
|------|--------|
| Doküman türü | İş Analizi (BA) |
| Faz | **FAZ 2** |
| Modül | Smart Quantity Takeoff |
| Sürüm | **Revizyon 1** — kilitli |
| Durum | **ONAYLANDI / KİLİTLİ** (2026-08-02) |
| Tarih | 2026-08-02 |
| Ürün sahibi kararı | **ONAY** — Mimari Tasarım’a geçilebilir |
| Kilit kuralı | Bundan sonra yalnız hata düzeltmesi; yeni fonksiyon eklenmez |
| Mimari bağ | `SMART_QUANTITY_TAKEOFF_MIMARI.md` bu BA’ya birebir bağlıdır |
| Kısıt (BA aşaması) | Kod / migration / commit / deploy / branch **yok** idi; uygulama hâlâ kapalı |

**Bağımlılık:** Faz 1 Smart Measurement = **Closed** (`release/smart-measurement-closed-v438`).

**Ürünün gerçek amacı:** Ölçüyü **Operasyon İş Kalemlerine** dönüştürmek.  
Metraj nihai çıktı değil; operasyonun **ara çıktısıdır**.

---

## Zorunlu başlangıç kontrolü (3 soru)

### 1) Bu geliştirme ürün yol haritasındaki hangi faza aittir?

**FAZ 2 — Smart Quantity Takeoff (Akıllı Metraj).**

Kaynak: `docs/project-governance/URUN_GELISTIRME_YOL_HARITASI.md`.

### 2) Bu geliştirme hangi modülü geliştirmektedir? Başka modüllere etkisi var mı?

**Geliştirilen modül:** Smart Quantity Takeoff.

**Birincil girdi:** Smart Measurement ölçü / Evidence Chain verisi (**salt okuma**).

| Modül | Etki | Açıklama |
|-------|------|----------|
| Smart Measurement | Salt okunur bağımlılık | Ölçü ve versiyonlar girdidir. SM şema/UI/API yazılmaz; Faz 1 Closed korunur. |
| Hasar dosyası (ClaimFile) | İnce entegrasyon (plan) | Operasyon iş kalemleri dosya bağlamında gösterilir. Layout/Dashboard redesign yok. |
| Field Survey | Yok | Birleştirilmez; dokunulmaz. |
| CRM / Finans / Dashboard / Layout / Auth / Storage | Yok (v1) | İhtiyaç + ayrı onay olmadan yok. |
| Faz 3 / 4 / 5 | Bu fazda uygulanmaz | Kavramsal referans: §21 (stratejik temel). Kod birleşmesi yok. |

### 3) Bu geliştirme hangi ürün sütununu güçlendirmektedir?

**Smart Quantity Takeoff.**

---

## Kavramsal Zincir (zorunlu ürün dili)

Dokümanda yalnızca “Metraj” ile yetinilmez. Ürün dili aşağıdaki zincirdir:

```
Ölçü
  ↓
Metraj
  ↓
Operasyon İş Kalemi
  ↓
Operasyon Süreci
```

| Kavram | Anlam |
|--------|--------|
| **Ölçü** | Smart Measurement’dan gelen kanıtlı fiziksel veri (örn. kapı 2100×900 mm). |
| **Metraj** | Ölçüden türetilen ara miktar çıktısı (örn. 1,89 m² yüzey). Nihai iş listesi değildir. |
| **Operasyon İş Kalemi** | Sahada / ofiste yapılacak somut iş satırı (Boya, Astar, Macun, Zımpara, Son Kat Boya…). |
| **Operasyon Süreci** | İş kalemlerinin sıralı / yönetilebilir operasyon akışı (planlama, atama, takip — sonraki fazlarla genişler). |

### Örnek — Tek kapı ölçüsünden birden fazla operasyon kalemi

```
Ölçü: Kapı 2100 × 900 mm
  ↓
Metraj (ara): yüzey ≈ 1,89 m²
  ↓
Operasyon İş Kalemleri (örnek set):
  • Astar          → miktar (kurala göre)
  • Macun          → miktar
  • Zımpara        → miktar / adet işlem
  • Boya (1. kat)  → örn. 1,89 m²
  • Boya (2. kat)  → örn. +1,89 m² → toplam boya 3,78 m²
  • Son kat boya   → kurala göre
  ↓
Operasyon Süreci: bu kalemlerin dosya üzerinde yürütülmesi
```

**Vurgu:** Aynı ölçü → birden çok Operasyon İş Kalemi.  
Metraj, bu kalemleri besleyen ara katmandır; tek başına ürünün bitiş çizgisi değildir.

---

## 1. Modülün Amacı

Hasar / onarım dosyasında saha **ölçülerinden** yola çıkarak:

1. ara **metraj** üretmek,
2. bundan **Operasyon İş Kalemleri** türetmek,
3. her kalemi **açıklanabilir**, **versiyonlu kural** ve **kanıt** ile bağlamak.

Elle Excel / kişiye özel varsayımları azaltmak; ölçüyü kurumsal operasyon diline çevirmek.

**Tek cümle:** Ölçüyü, açıklanabilir Operasyon İş Kalemlerine dönüştüren karar ve hesap motoru.

---

## 2. İş Problemleri

1. **Ölçü ≠ operasyon:** Ham ölçü (mm) doğrudan iş emri değildir; arada metraj ve iş kalemi katmanı gerekir.  
2. **Tek ölçü → çok iş:** Kapı ölçüsü boya, astar, macun, zımpara vb. birden fazla kalem üretebilir; bugün bu bağlantı kişiye bağlıdır.  
3. **Tutarsızlık:** Aynı ölçüden farklı personel farklı kalem / miktar üretir.  
4. **Açıklanamayan sonuç:** “Neden 3,78 m²?” sorusuna sistem cevap veremezse güven oluşmaz.  
5. **Kanıt kopukluğu:** İş kalemi ↔ ölçü fotoğrafı / versiyon bağı kopuksa itiraz maliyeti artar.  
6. **Kural evrimi:** Kurallar değişince eski dosyaların sessizce yeniden hesaplanması geçmişi bozar.  
7. **Manuel gerçeklik:** Sahada düzeltme gerekir; iz bırakmayan düzeltme Evidence Chain’i öldürür.  
8. **Ölçek ve sonraki fazlar:** Standart iş kalemi dili olmadan tedarikçi hafızası, dijital ikiz ve onarım kütüphanesi zayıf kalır.

---

## 3. Kullanıcı Senaryoları

### US-01 — Ölçüden operasyon iş kalemleri

Dosyada Akıllı Ölçüm kayıtları vardır. Kullanıcı üretimi tetikler. Sistem: Ölçü → Metraj (ara) → Operasyon İş Kalemi listesi (birim, miktar, kural, kanıt).

### US-02 — Explainable Calculation (neden bu miktar?)

Kullanıcı bir kalemde “neden 3,78 m²?” der. Sistem adım adım gösterir: ölçü → ara metraj → katman/çarpan → sonuç (bkz. §14.2).

### US-03 — Tek ölçüden çok kalem

Kapı ölçüsünden Astar, Macun, Zımpara, Boya katları vb. birden fazla kalem üretilir; her biri kendi kural ve açıklamasına sahiptir.

### US-04 — Rule Version ile yeniden üretim

Kullanıcı bilinçli olarak yeniden koşum alır. Yeni run, o anki aktif Rule Version’ı kalıcı bağlar. Eski run’lar otomatik bozulmaz / sessizce yeniden yazılmaz.

### US-05 — Manual Override

Kullanıcı bir kalem miktarını düzeltir; sebep zorunlu; kim / ne zaman kaydı oluşur. Motor (AI/kural) sonucu silinmez; Evidence Chain korunur.

### US-06 — Kural yok

Rule Library’de eşleşmeyen eleman/iş için sessiz uydurma yok; “kural yok / manuel” durumu.

### US-07 — Rol

Finans/CRM’e yazılmaz (v1). ClaimFile erişim modeli SM ile uyumlu.

### US-08 — Paylaşım

İş kalemi / metraj özeti PDF veya dosya içi görünüm; kanıt referanslı (v1 veya hemen sonrası).

---

## 4. Dünya Örnekleri ve Sektör Analizi

| Alan | Gözlem |
|------|--------|
| İnşaat metraj / takeoff | Çoğu araç çizimden miktar (BOQ) üretir; “operasyon iş kalemi + açıklanabilir kural zinciri” zayıf kalır. |
| Sigorta estimating | Birim fiyat odaklı; saha AR ölçüsü → çoklu iş kalemi + kanıt zinciri nadiren ürün omurgasıdır. |
| AR measure uygulamaları | Mesafe ölçer; operasyon süreci üretmez. |
| ERP | Stok/fatura; ölçü→iş kalemi karar motoru değildir. |

**Sektör boşluğu:** Kanıtlı ölçü → açıklanabilir kural → operasyon iş kalemi zincirinin tek operasyon platformunda birleşmesi.

---

## 5. Rakip Çözümler

| Tip | Güçlü yan | Meridyen boşluğu (fırsat) |
|-----|-----------|---------------------------|
| Genel takeoff | Çizimden hızlı miktar | Dosya + SM Evidence Chain + Operasyon İş Kalemi dili yok |
| Sigorta estimating | Fiyat kütüphanesi | Yerel SM + açıklanabilir operasyon zinciri yok |
| Mobil AR | Hızlı ölçü | Rule Engine / Rule Library / override audit yok |
| ERP | Maliyet | Ölçüden iş kalemi üretmez |

Konumlandırma: **Ölçü → Metraj (ara) → Operasyon İş Kalemi → (süreç)** + Explainable + Versioned Rules + Audit’li Override.

---

## 6. Meridyen'in Farkı

1. Smart Measurement referans mimarisi (mm, version, FileAsset, status) üzerine kurulu.  
2. Metrajı nihai değil **ara çıktı** kabul eden ürün dili.  
3. Tek ölçüden **çoklu Operasyon İş Kalemi**.  
4. Rule Engine = yalnız formül değil; **operasyon bilgisi üreten karar motoru**.  
5. **Rule Library** ile yüzlerce kuralın merkezi yönetimine açık omurga.  
6. **Explainable Calculation** temel prensip.  
7. **Rule Versioning** — geçmiş dosyalar açıklanabilir kalır.  
8. **Manual Override** — AI/kural sonucu silinmeden, tam audit.  
9. Faz 3/4/5 için bozmayan kavramsal zemin (§21).  
10. Teknoloji görünmez; UI operasyon dili.

---

## 7. Fonksiyonel Gereksinimler

| ID | Gereksinim |
|----|------------|
| FR-01 | SM ölçülerinden Takeoff Run oluşturulabilmeli |
| FR-02 | Zincir: Ölçü → Yapı Elemanı → Kural → Operasyon İş Kalemi → Birim → Miktar → Kanıt Referansı |
| FR-03 | Aynı ölçüden birden fazla Operasyon İş Kalemi üretilebilmeli |
| FR-04 | Metraj ara çıktı olarak saklanabilir / gösterilebilir; nihai liste iş kalemleridir |
| FR-05 | Her kalem Explainable Calculation sunabilmeli (ölçü, kural, formül adımları) |
| FR-06 | Her Run, kullandığı **Rule Version** bilgisini kalıcı saklamalı |
| FR-07 | Eski dosyalar yeni kurallarla **otomatik** yeniden hesaplanmamalı |
| FR-08 | Manual Override: miktar/kalem düzeltmesi + zorunlu sebep + kim + ne zaman |
| FR-09 | Motor/AI sonucu silinmemeli; override ayrı katman; Evidence Chain korunmalı |
| FR-10 | Rule Library’de kuralı olmayan durum sessiz uydurulmamalı |
| FR-11 | ClaimFile tenant / erişim kontrolü SM ile aynı çizgide |
| FR-12 | Soft arşiv / iptal; sert sessiz silme yok |
| FR-13 | Audit: run oluşturma, override, (bilinçli) yeniden koşum |
| FR-14 | (Tercih) PDF / yazdırılabilir özet — kalem + açıklama özeti |

---

## 8. Fonksiyonel Olmayan Gereksinimler

| ID | Gereksinim |
|----|------------|
| NFR-01 | Deterministik: aynı ölçü + aynı Rule Version → aynı motor çıktısı |
| NFR-02 | Rule Version değişince eski run’lar bozulmadan açıklanabilir kalsın |
| NFR-03 | Performans: tipik dosyada (&lt;100 eleman / makul kalem sayısı) saniyeler içinde |
| NFR-04 | SM / Field Survey / CRM / Finans’a kapsam dışı müdahale yok |
| NFR-05 | Repo SSOT |
| NFR-06 | Explainability verisi kullanıcı dilinde; ham stack trace yok |
| NFR-07 | Güvenlik: 401/403 |
| NFR-08 | Genişleme: yeni eleman / iş kalemi / ölçü türü / kural / çıktı türü — çekirdek rewrite olmadan |
| NFR-09 | Override ve motor çıktısı birlikte saklanabilir; audit kaybı kabul edilmez |

---

## 9. Domain Modeli

| Kavram | Anlam |
|--------|--------|
| Ölçü / Ölçü Versiyonu | SM Evidence Chain girdisi |
| Yapı Elemanı | Kapı, pencere, duvar segmenti, tavan vb. |
| Metraj (ara) | Ölçüden türetilen miktar ara çıktısı |
| Operasyon İş Kalemi | Yapılacak iş satırı (Boya, Astar, Macun…) |
| Operasyon Süreci | İş kalemlerinin yönetildiği akış (v1’de sınırlı; genişleme §21) |
| Rule Engine | Karar + hesap motoru (yalnız formül değil) |
| Rule Library | Merkezi kural kataloğu (yüzlerce kurala ölçek) |
| Kural (Rule) | Yapı elemanı (+ bağlam) → iş kalemi(leri) + birim + hesap |
| Rule Version | Kural setinin zaman damgalı sürümü |
| Takeoff Run | Bir dosyada belirli Rule Version ile üretilmiş koşum |
| Explanation | Kalemin adım adım hesap özeti |
| Manual Override | Kullanıcı düzeltmesi + sebep + audit; motor çıktısı korunur |
| Kanıt Referansı | Kalem → ölçü versiyon(lar)ı / dosya kanıtı |
| Birim / Miktar | m², m.tül, adet vb. |

---

## 10. Veri Modeli

> ER / Prisma kesinleşmesi **Mimari Tasarım** aşamasındadır. Burada iş varlıkları.

**Önerilen varlıklar (kavramsal):**

1. **TakeoffRun** — claimFileId, status, **ruleVersionId** (zorunlu/kalıcı), createdBy, createdAt, note  
2. **TakeoffLineItem** (Operasyon İş Kalemi satırı) — runId, operationItemCode, displayName, unit, quantityEngine, quantityFinal, sourceMeasureVersionIds[], ruleId, explanationJson/steps, override flag  
3. **TakeoffMetrajSnapshot** (opsiyonel ara) — runId, derived quantities (ara metraj)  
4. **Rule / RuleVersion** — Rule Library üyesi; expression/params; version; active  
5. **ManualOverride** — lineItemId, previousQuantity, newQuantity, reason, userId, at; **engineQuantity korunur**  
6. **ExplanationStep** — sıra, girdi, işlem, ara sonuç, çıktı (veya line item içinde yapı)

**İlkeler:**

- SM tablolarına yazmama  
- Run ↔ Rule Version kalıcı bağ  
- Otomatik toplu recompute yok  
- Motor sonucu silinmez  
- Para / cari / stok yok (Finans değil)

---

## 11. Metraj Kuralları ve Operasyon İş Kalemi Kuralları

> Formül katsayıları Mimari + ürün onayında netleşir. Burada iş niyeti.

### 11.1 Metrajın rolü

Metraj, ölçü ile Operasyon İş Kalemi arasındaki **ara miktar dilimidir**.  
Örn. kapı 2100×900 → 1,89 m² yüzey metrajı → boya katlarına girdi.

### 11.2 İlk yapı elemanı kapsamı → tipik operasyon kalemleri (örnek)

| Yapı elemanı / alan | Ara metraj (ör.) | Örnek Operasyon İş Kalemleri |
|---------------------|------------------|------------------------------|
| Kapı | m² / adet | Astar, Macun, Zımpara, Boya katları, Son kat |
| Pencere | adet / cam m² | (ürün kurallarına göre) cam, çerçeve işleri… |
| Duvar boya alanı | m² | Astar, Macun, Boya, Son kat |
| Alçı / Macun alanları | m² | Alçı, Macun kalemleri |
| Seramik / Fayans / Parke | m² + fire | Kaplama + fire kalemleri |
| Süpürgelik | m.tül | Süpürgelik döşeme |
| Mutfak Dolabı / Tezgâh | m.tül / adet | İlgili montaj / yüzey kalemleri |
| Tavan | m² | Tavan boya / kaplama kalemleri |

v1’de hangi kalem setlerinin aktif olacağı ürün onayında kilitlenir; Rule Library omurgası yüzlerce kurala açıktır (§14.1).

### 11.3 Ortak ilkeler

- Girdi SM mm ile uyumlu  
- Fire / düşüm / katman parametrik  
- Eksik ölçüde uydurma yok  
- Bir ölçü → N iş kalemi doğal kabul

---

## 12. Ölçü Türleri

| Tür | Kullanım |
|-----|----------|
| Uzunluk (mm) | Süpürgelik, tezgâh, cephe |
| Genişlik × yükseklik | Kapı, pencere → ara alan metrajı |
| Alan (türetilmiş metraj) | Boya ve kaplama iş kalemlerinin girdisi |
| Adet | Kapı/pencere/unite |
| Hacim | İlk kapsamda zorunlu değil; genişleme başlığı (§15) |

---

## 13. Desteklenecek Yapı Elemanları

**v1 omurga (ölçü/eleman tarafı — yol haritası ile uyumlu):**

1. Boya (alan) · 2. Alçı · 3. Macun · 4. Seramik · 5. Fayans · 6. Parke  
7. Süpürgelik · 8. Kapı · 9. Pencere · 10. Mutfak Dolabı · 11. Tezgâh · 12. Tavan  

**Not:** “Boya / Alçı / Macun” hem alan girdisi hem Operasyon İş Kalemi olarak Rule Library’de ayrışır (aynı kelime; farklı kavramsal katman).

**v1 dışı örnek elemanlar:** çatı, tesisat, elektrik, komple mutfak imalat detayı, cephe giydirme — §17.  
**Rule Library örnek kural aileleri (uygulama değil, omurga):** Kapı Boyama, PVC Boyama, Lake Boyama, Metal Boyama, Ahşap Boyama, Yangın Kapısı, Cam Bölme, Asma Tavan, Alçıpan, Parke, Seramik vb. (§14.1).

---

## 14. Hesaplama Motoru (Rule Engine)

Rule Engine **yalnız formül motoru değildir**.  
Operasyon bilgisini de üreten **karar motorudur**.

### 14.1 Ana akış

```
Ölçü
  ↓
Yapı Elemanı
  ↓
Kural  (Rule Library’den, Rule Version ile)
  ↓
Operasyon İş Kalemi
  ↓
Birim
  ↓
Miktar
  ↓
Kanıt Referansı
```

### 14.2 Explainable Calculation (temel prensip)

Sistem yalnız sonucu değil, **nasıl oluştuğunu** da üretir.

**Örnek:**

```
Kapı
  ↓
2100 × 900 mm
  ↓
1,89 m²          ← ara metraj
  ↓
2 Kat Boya
  ↓
3,78 m²          ← Operasyon İş Kalemi miktarı (boya)
```

Her Operasyon İş Kalemi geriye dönük açıklayabilmelidir:

- hangi **ölçüden**,  
- hangi **kuraldan**,  
- hangi **formül / adımlardan** oluştuğunu.

### 14.3 Rule Library (ürün mimarisi kavramı — kod tasarımı yok)

**Rule Library**, yüzlerce operasyon kuralının gelecekte **merkezi** yönetileceği katalog omurgasıdır.

Örnek kural aileleri (illustrative):

- Kapı Boyama · PVC Boyama · Lake Boyama · Metal Boyama · Ahşap Boyama  
- Yangın Kapısı · Cam Bölme · Asma Tavan · Alçıpan · Parke · Seramik · …

Bu aşamada tablo şeması / API tasarımı yapılmaz; yalnızca ürün mimarisi kavramı tanımlanır.

### 14.4 Rule Versioning

- Her **Takeoff Run**, kullandığı **Rule Version** bilgisini **kalıcı** saklar.  
- Eski dosyalar yeni kurallarla **otomatik yeniden hesaplanmaz**.  
- Her dosya / run, oluşturulduğu (koşulduğu) tarihteki Rule Version ile ilişkilidir.  
- Böylece geçmiş operasyonlar tamamen açıklanabilir kalır.  
- Bilinçli yeniden koşum = yeni Run + o anki Version (eski Run arşivde kalır).

### 14.5 Manual Override

```
AI / kural sonucu (engine)
  ↓
Kullanıcı düzeltmesi
  ↓
Sebep (zorunlu)
  ↓
Kim yaptı
  ↓
Ne zaman yaptı
  ↓
Audit
```

- Motor sonucu **silinmez**.  
- Evidence Chain **korunur**.  
- Final görünen miktar = override varsa düzeltilmiş; açıklamada hem motor hem override görünür.

---

## 15. Genişleyebilir Mimari

Amaç: sistemi yeniden tasarlamadan büyütmek.

### 15.1 Genişleme başlıkları

| Başlık | Anlam |
|--------|--------|
| **Yeni Yapı Elemanları** | Örn. yangın kapısı, cam bölme — Rule Library’ye eleman + kurallar |
| **Yeni Operasyon İş Kalemleri** | Örn. özel astar tipi, ek zımpara geçişi |
| **Yeni Ölçü Türleri** | Örn. hacim, açı, eğim (SM/gelecek girdiler) |
| **Yeni Hesaplama Kuralları** | Yeni formül / parametre / katman setleri (yeni Rule Version) |
| **Yeni Çıktı Türleri** | PDF, tedarikçi özeti, süreç şablonu (Faz 3–5’e hazır; v1 zorunlu değil) |

### 15.2 Teknik olmayan omurga ilkeleri

1. Rule Library + Rule Version = büyüme ekseni.  
2. SM okuma adaptörü ↔ Rule Engine ayrık.  
3. Explainable + Override modeli değişmeden kalır.  
4. Faz 5 Onarım Bilgi Kütüphanesi kuralları besleyebilir — v1’de birleşmez.  
5. Bugünkü v1’i şişirmeden geleceğe referans bırakılır (§21).

---

## 16. Riskler

| Risk | Etki | Azaltma |
|------|------|---------|
| Metrajı nihai sanmak | Yanlış ürün | Kavramsal zincir zorunlu dil |
| Tek kalem varsayımı | Eksik operasyon | 1 ölçü → N kalem zorunlu senaryo |
| Açıklamasız miktar | Güven kaybı | Explainable Calculation |
| Sessiz recompute | Geçmiş bozulur | Rule Version + otomatik recompute yasağı |
| Override’ın izsiz olması | Evidence ölümü | Sebep + kim + ne zaman; motor silinmez |
| Rule Library’nin erken kodu | Kapsam şişmesi | Bu BA’da yalnız kavram; kod yok |
| Finans / Field Survey sızıntısı | Faz kayması | Kapsam dışı listesi |
| Faz 3–5’i şimdi yapmak | Gecikme | §21 referans; uygulama yok |

---

## 17. Kapsam Dışı Konular

- Field Survey birleştirme  
- CRM, Finans, Dashboard, Layout, Auth, Storage  
- Smart Measurement’a yeni özellik (yalnız okuma)  
- Birim fiyat, teklif, hakediş, stok, ERP  
- Supplier Intelligence skor motoru (Faz 3 uygulama)  
- 3D Digital Twin birleştirme (Faz 4 uygulama)  
- Repair Knowledge Library içerik üretimi (Faz 5 uygulama)  
- LiDAR / drone / BIM import  
- Bluetooth lazer / OCR  
- Rule Library’nin tam kurumsal yönetim UI’si (ileride)  
- Bu revizyonda kod / migration / branch / commit / deploy  

---

## 18. Faz Planı

| Adım | Çıktı | Kapı |
|------|-------|------|
| A. İş Analizi | Bu doküman (Revizyon 1) | **Yeniden ürün sahibi onayı** ← buradayız |
| B. Ürün Tasarımı | Ekran/akış (iş kalemi, explanation, override) | Onay |
| C. Teknik Mimari | ER, API, Rule Engine/Library omurgası | Onay |
| D. Domain / ER / API / UI | Tasarım paketleri | Onay |
| E. Geliştirme | Ayrı feature branch | Yaşam döngüsü |
| F. Test → Docs → Review → Preview | Kalite | |
| G. Deploy | Yalnız bu modül | Diff + liste + migration + rollback |
| H. Teslim | Teslim raporu | Faz 2 Closed |

**Alt sürüm önerisi (onay sonrası, ürün tasarımında netleşir):**

- **2.1** Kapı/pencere — çoklu iş kalemi + explanation  
- **2.2** Alan boya/alçı/macun + katman  
- **2.3** Kaplamalar (seramik/fayans/parke) + fire  
- **2.4** Dolap/tezgâh + override UX + PDF  

---

## 19. Başarı Kriterleri

1. İlk kapsam yapı elemanları için kural seti tanımlı ve çalışır.  
2. En az bir gerçek dosyada Ölçü → Metraj (ara) → Operasyon İş Kalemi üretilir.  
3. **Temel kalite kriteri:** Aynı ölçü verisinden birden fazla operasyon iş kalemi üretilebilmeli ve her iş kalemi hangi ölçü, hangi kural ve hangi hesaplama adımıyla oluştuğunu geriye dönük olarak açıklayabilmelidir.  
4. Her Takeoff Run Rule Version taşır; eski run otomatik bozulmaz.  
5. Manual Override izlenebilir; motor sonucu silinmez.  
6. SM / Field Survey / CRM / Finans’a kapsam dışı diff yok.  
7. Deploy yalnız bu modül (+ zorunlu ince mount).  
8. Repo ≡ canlı (SSOT).  
9. Operasyon dili; yasak teknoloji etiketleri yok.  
10. Ürün sahibi production kontrolü ile Faz 2 Closed.

---

## 20. Ürün Sahibi Onayı

**Karar (2026-08-02):** **ONAY** — İş Analizi tamamlandı ve **kilitlendi**.  
**Sonraki:** Mimari Tasarım → `SMART_QUANTITY_TAKEOFF_MIMARI.md` (ayrı onay).  
BA’ya yeni fonksiyon eklenmez; yalnız hata düzeltmesi.

```
Ürün sahibi: Mustafa
Karar: ONAY
Tarih: 2026-08-02
Not: Mimari Tasarım aşamasına geçilebilir; BA kilitli
```

---

## 21. Ek Stratejik Temel — Faz 3 / 4 / 5 (uygulanmaz, referans)

İş Analizi yalnız bugünkü ihtiyacı değil; gelecek fazların **doğal inşa zeminini** tarif eder.  
Aşağıdakiler **bugün kodlanmaz**; mimariyi bozmayacak şekilde kavramsal referanstır.

| Gelecek faz | Bu BA’dan devralınacak omurga |
|-------------|-------------------------------|
| **Faz 3 — Supplier Intelligence** | Standart Operasyon İş Kalemi dili + miktar + süre/maliyet bağlama noktası; tedarikçi performansı aynı kalem kodlarıyla ölçülebilir. |
| **Faz 4 — Digital Twin** | Ölçü + metraj ara + iş kalemi + kanıt referansı, dijital modeldeki elemana bağlanabilir kimlikler bırakır. |
| **Faz 5 — Repair Knowledge Library** | Rule Library ile hizalı: standart iş akışı, standart metraj/iş kalemi şablonları, kalite adımları — kütüphane kuralları Engine’i besler. |

**Denge:** Bugünkü v1’i gereksiz karmaşıklaştırmadan; yarınki modüller mevcut zincir üzerine oturur.

```
Bugün (Faz 2 omurgası):
  Ölçü → Metraj → Operasyon İş Kalemi → (Explainable, Versioned, Audited)

Yarın:
  Faz 3: İş kalemi → tedarikçi karar desteği
  Faz 4: İş kalemi + ölçü → dijital ikiz bağları
  Faz 5: Rule Library ↔ Onarım Bilgi Kütüphanesi
```

---

## Ek A — Bu aşamada yapılmayanlar (teyit)

- [x] Kod yazılmadı  
- [x] Migration yapılmadı  
- [x] Branch açılmadı  
- [x] Commit oluşturulmadı  
- [x] Deploy yapılmadı  
- [x] Mimari Tasarım’a geçilmedi  

---

## Ek B — Revizyon değişiklik özeti (Revizyon 1)

Ayrıntılı rapor ürün sahibi teslim mesajında sunulur. Özet:

| Rev# | Konu | Dokümanda |
|------|------|-----------|
| R1 | Ölçü→Metraj→İş Kalemi→Süreç; metraj ara çıktı | Kavramsal Zincir, §1, §11 |
| R2 | Rule Engine karar motoru akışı | §14 |
| R3 | Rule Library | §14.1 / §14.3 |
| R4 | Explainable Calculation | §14.2, US-02, FR-05 |
| R5 | Rule Versioning | §14.4, FR-06/07, veri modeli |
| R6 | Manual Override + audit | §14.5, US-05, FR-08/09 |
| R7 | Beş genişleme başlığı | §15.1 |
| R8 | Çoklu kalem + geriye dönük açıklama başarı kriteri | §19 madde 3 |
| Stratejik | Faz 3/4/5 referans zemini | §21 |

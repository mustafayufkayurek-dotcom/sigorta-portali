---
**Belge:** Meridyen Kriz Kurtarma Protokolü — Talimat  
**Sürüm:** v1 (DONMUŞ)  
**Onay:** Mustafa — 2026-06-24 — 10/10  
**Revizyon kuralı:** Yeni bölüm eklenmez. Değişiklik yalnızca v1.1, v1.2 … ile yapılır; v1 arşivlenir.
---

Sen benim Meridyen yazılım projemdeki sohbet geçmişime erişebilen asistanımsın.

**21, 22 ve 23 Haziran 2026** tarihlerinde alınmış stratejik kararlar ve canlıya alınan sayfalar kaybolmuş görünüyor. Bu kriz dönemini belgelemek için yalnızca **Paket 1 — Meridyen Kriz Kurtarma Protokolü** üreteceksin.

---

## İstenen çıktı formatı — Bölüm 0 (belgenin en başı, ZORUNLU)

# MERIDYEN_21_22_23_HAZIRAN_KURTARMA_PAKETI_v1

**Hazırlayan:** ChatGPT  
**Kapsam:** 21–24 Haziran 2026 geri kazanım dönemi  
**Paket:** 1 / 3  
**Belge türü:** Meridyen resmi kriz kurtarma kaydı (referans doküman)

## 0. ALTIN KURAL

Bu belge Meridyen projesinin **resmi kriz kurtarma kaydıdır**.

Bu belgede yer alan kabul edilmiş kararlar;

- yeni geliştirme gerekçesiyle **değiştirilemez**,
- eski sürümlere **döndürülemez**,
- alternatif tasarım önerisiyle **yeniden tartışılamaz**.

Bir kararın değiştirilmesi gerekiyorsa önce:

1. Regresyon kanıtı oluşturulur.
2. Kök neden bulunur.
3. Mustafa onayı alınır.
4. Yeni karar kayıt altına alınır.

**Bu dört adım tamamlanmadan hiçbir kabul edilmiş karar değiştirilemez.**

> Karar değişecekse → önce karar kaydı değişir → sonra kod değişir.  
> Kod değişti diye karar değişmez.

**Kod–karar çelişkisi:** Bu belgede yer alan kararlar ile mevcut kod çelişirse, kod doğru kabul edilmez. Önce referans karar doğrulanır, sonra kod karar ile hizalanır.

> Bu belge `00_PROJE_ANAYASASI.md` ve `00_CALISMA_YASASI.md` ile uyumlu olmak zorundadır.

---

### Kapsam sınırı

| Dahil | Hariç |
|-------|-------|
| 21–23 Haziran 2026 kararları | Proje başlangıcından önceki dönem |
| 24 Haziran geri kazanım bağlantıları | Operasyon Merkezi vizyonu (Paket 2) |
| CRM, Login, Navigasyon, ULC, Ayarlar | Hasar / Acil Yardım genel stratejisi (Paket 2) |
| Kanonik sürüm geri kazanımı | Eksper yaklaşımı (Paket 2) |
| Canlı doğrulama sonuçları | Cursor aktarım paketi (Paket 3) |

### Etiket zorunluluğu

Her madde şu etiketlerden birini taşımalı:

- **KANITLI** — Sohbet, paket adı, rapor, kabul belgesi veya screenshot referansı var
- **TAHMİN** — Mantıksal çıkarım; kanıt zayıf
- **BİLİNMİYOR** — Kaynak yok; boş bırak, uydurma

**Kural:** Kanıt yoksa yazma. Tahmin gerekiyorsa **TAHMİN** etiketi koy.

### Karar Kanıtı zorunluluğu (kriz sonrası — zorunlu)

"Kaynak" sütunu tek başına yeterli değildir. Her karar için ayrıca **Kanıt Türü** belirtilmelidir.

İzin verilen kanıt türleri (modüle göre):

| Modül / Alan | Beklenen Kanıt Türü |
|---|---|
| Login | Screenshot + Canlı doğrulama |
| CRM | Screenshot + Route + Kabul raporu |
| Navigasyon | Screenshot + Route doğrulama |
| ULC | Backend deploy + Route doğrulama |
| Mail / Bildirim | Screenshot |
| Tanımlar Merkezi | Screenshot |
| Ayarlar | Screenshot + Route |
| Kullanıcı ve Yetki | Screenshot + Kabul raporu |
| Guard / Karar koruma | Karar dosyası + Checklist |

Kanıt türü yoksa satır **BİLİNMİYOR** etiketiyle boş bırakılır; uydurulmaz.

### Nihai Karar Durumu zorunluluğu (kriz sonrası — zorunlu)

Her modül bölümünün **en sonunda** tek satırlık özet zorunludur:

```
**Nihai Karar Durumu:** [Geri kazanıldı | Kısmen geri kazanıldı | Canlı deploy bekliyor | Doğrulama bekliyor | Admin kabul testi bekliyor | Kayıp | Bilinmiyor]
```

### Özellikle ara (kanıt öncelikli)

1. **21 Haziran** — D-serisi referansları (D265, D301, D303, D305, D310, D314, D232, D240, D248, D249)
2. **22 Haziran** — Login regresyon, Operasyon Zekası V8, Navigasyon, Evrak standart motoru, Ayarlar reorganizasyon tasarımı
3. **23 Haziran** — Ayarlar canonical sahiplik, Mail/Bildirim Merkezi, Navigasyon tek sahiplik, Tanımlar Merkezi, Kullanıcı ve Yetki, Karar koruma guard, Kanonik sürüm geri kazanımı
4. **24 Haziran bağlantıları** — Güvenli geri kazanım, CRM UX, ULC canlıya alma, operasyonel audit paketleri
5. Her karar için: **canlı durumu** (canlı / kabul bekliyor / kayıp / bilinmiyor)

### Bilinen paket referansları (doğrulama için kullan)

22 Haziran:
- `AUTH_DOGRULAMA_VE_TEST_ERISIMI_01`
- `LOGIN_REGRESYON_DUZELTME_01`
- `LOGIN_REGRESYON_CANLIYA_ALMA_V2`
- `OPERASYON_ZEKASI_13_CANLIYA_ALMA`
- `OPERASYON_ZEKASI_NAVIGASYON_DUZELTME_01_CANLIYA_ALMA`
- `EVRAK_TURLERI_*`, `EVRAK_STANDART_MOTORU_*`
- `AYARLAR_MODULU_02_REORGANIZASYON_TASARIMI`

23 Haziran:
- `ALTYAPI_VE_DISK_TEMIZLIK_UYGULAMA_01`
- `AYARLAR_MODULU_03`, `AYARLAR_MODULU_05_CANONICAL_SAHIPLIK_UYGULAMASI`
- `AYARLAR_BILDIRIM_SAHIPLIK_TEMIZLIGI_01`
- `MAIL_BILDIRIM_MERKEZI_TEKLESTIRME_01`, `MAIL_BILDIRIM_MERKEZI_UX_TEMIZLIK_01`
- `IHBAR_KONULARI_CANONICAL_UYGULAMA_01`
- `NAVIGASYON_TEK_SAHIPLIK_UYGULAMA_01`, `NAVIGASYON_TEK_SAHIPLIK_CANLIYA_ALMA`
- `TANIMLAR_MERKEZI_DASHBOARD_DONUSUMU_01`
- `KULLANICI_VE_YETKI_BILGI_MIMARISI_DUZENLEME_01`
- `KARAR_KORUMA_GUARD_SISTEMI_01`, `MUSTAFA_CALISMA_MODELI_KARARI_01`
- `LOGIN_KARAR_KORUMA_AUDITI_01`
- `AYARLAR_VE_LOGIN_KANONIK_SURUM_GERI_KAZANIMI_01`
- `AYARLAR_VE_LOGIN_KANONIK_SURUM_GERI_KAZANIMI_UYGULAMA_01`
- `MUSTAFA_REHBERLI_CANLI_DENETIM_TURU_01`

24 Haziran devam:
- `GUVENLI_GERI_KAZANIM_UYGULAMA_01`
- `GUVENLI_GERI_KAZANIM_CANLIYA_ALMA_01`
- `CRM_UX_GERI_KAZANIM_01`, `CRM_ILISKI_YONETIMI_MVP1_UYGULAMA_01`
- `KULLANICI_YASAM_DONGUSU_GERI_KAZANIM_01`, `ULC_CANLIYA_ALMA_01`
- `MERIDYEN_FONKSIYONEL_TAMLIK_AUDITI_01`
- `OPERASYONEL_FONKSIYON_AUDITI_01`

---

## İstenen çıktı formatı (Bölüm 0'dan itibaren)

## 1. Acil Kurtarma Özeti (max 10 madde, yalnız KANITLI)

## 2. Gün Gün Karar Tablosu

| Tarih | Etiket | Karar | Paket / Referans | Kapsam (sayfa/modül) | Canlı durumu | Kanıt Türü | Kaynak |
|-------|--------|-------|------------------|----------------------|--------------|------------|--------|

**Kanıt Türü sütunu zorunludur.** Örnek değerler: `Screenshot + Canlı doğrulama`, `Screenshot + Route + Kabul raporu`, `Backend deploy + Route doğrulama`, `Screenshot`, `Karar dosyası + Checklist`.

## 3. Modül Bazlı Kurtarma Durumu

Her modül için ayrı alt bölüm:

### Login
### CRM
### Navigasyon
### Ayarlar
### Mail / Bildirim Merkezi
### Kullanıcı Yaşam Döngüsü (ULC)
### Kullanıcı ve Yetki
### Tanımlar Merkezi
### Karar Koruma (Guard)

Her modülde zorunlu alt başlıklar:
- KANITLI kararlar (her biri için **Kanıt Türü** belirt)
- Canlı doğrulama durumu
- Kayıp / regresyon riski
- 24 Haziran geri kazanım bağlantısı
- **Nihai Karar Durumu** (modül bölümünün son satırı — zorunlu)

Örnek modül kapanış satırı:
`**Nihai Karar Durumu:** Geri kazanıldı`

## 4. Canlıya Alınan Sayfalar Envanteri

| Route / Sayfa | Karar tarihi | Paket | Canlı durumu | Kanıt Türü | Etiket | Not |
|---------------|--------------|-------|--------------|------------|--------|-----|

## 5. 21 Haziran — Sınırlı Kanıt Bölümü

21 Haziran için workspace kanıtı sınırlı. Bu bölümde:
- Yalnız KANITLI veya açıkça TAHMİN etiketli maddeler
- D-serisi referans zinciri
- Her satırda Kanıt Türü (varsa)

## 6. Çelişkiler ve Açık Sorular

- Kanıtlı çelişkiler
- Doğrulanması gereken maddeler (max 10 soru)

## 7. Paket 2'ye Devredilenler

Bu belgede **işlenmeyecek** ama Paket 2'de ele alınacak konuların listesi.

## 8. Geri Kazanım Sonrası Kontrol Durumu (ZORUNLU — belgenin son bölümü)

Bu tablo, belgeyi okuyan kişinin modül son durumunu **tek bakışta** görmesini sağlar. Paket 2'ye devredilmez; bu belgede kalır.

Durum simgeleri:
- ✅ = Geri kazanıldı / onaylandı
- ⚠️ = Kısmen geri kazanıldı veya canlı deploy / admin kabul bekliyor
- ⏳ = Doğrulama bekliyor
- ❌ = Kayıp veya regresyon tespit edildi
- ❓ = Bilinmiyor

| Modül | Son Durum |
|-------|-----------|
| Login | |
| Navigasyon | |
| CRM | |
| Ayarlar | |
| Mail / Bildirim Merkezi | |
| Tanımlar Merkezi | |
| Kullanıcı ve Yetki | |
| ULC (Kullanıcı Yaşam Döngüsü) | |
| Karar Koruma (Guard) | |

Örnek doldurma (kanıtlara göre güncelle):

| Modül | Son Durum |
|-------|-----------|
| Login | ✅ Geri kazanıldı |
| Navigasyon | ✅ Geri kazanıldı |
| CRM | ⚠️ UX temizliği canlı deploy bekliyor |
| Tanımlar Merkezi | ⏳ Doğrulama bekliyor |
| Mail Merkezi | ⏳ Doğrulama bekliyor |
| Kullanıcı ve Yetki | ⏳ Doğrulama bekliyor |
| ULC | ⚠️ Admin kabul testi bekliyor |

---

### Kurallar

1. **21 Haziran öncesi ve genel strateji hafızasına girme** — Paket 2'ye bırak.
2. **Cursor/Codex aktarım bloğu üretme** — Paket 3'e bırak.
3. Kanıtsız madde ekleme.
4. Her tablo satırında **Etiket** ve **Kanıt Türü** zorunlu (kanıt yoksa BİLİNMİYOR).
5. Her modül bölümünde **Nihai Karar Durumu** satırı zorunlu.
6. **Bölüm 0 (ALTIN KURAL)** ve **Bölüm 8** atlanamaz.
7. Çıktıyı tek seferde, kopyalanabilir belge olarak ver.
8. Belge sonuna ekle: *"Paket 1 tamamlandı. Bu belge Meridyen resmi kriz kurtarma kaydıdır. Sırada MERIDYEN_STRATEJIK_KARAR_ENVANTERI_v1 (Paket 2) var."*
9. **Bu belgede yer alan kararlar ile mevcut kod çelişirse, kod doğru kabul edilmez.** Önce referans karar doğrulanır, sonra kod karar ile hizalanır.

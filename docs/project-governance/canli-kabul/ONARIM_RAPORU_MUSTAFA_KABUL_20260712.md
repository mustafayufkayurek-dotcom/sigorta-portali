# Onarım Raporu — Mustafa Kabul Durumu (12 Temmuz 2026)

**Kaynak:** Mustafa'nın orijinal notları + 4'erli grup test geri bildirimi (Grup 1–5).  
**Canlı referans:** Web **v292** (12 Temmuz 2026) · Backend v279 · Rollback web v291  
**B-1 (Rapora Git akışı):** İptal — dokunulmayacak.

## Altın kural (kalıcı)

1. Agent **«canlıya alındı» / «tamamlandı»** demez; yalnızca Mustafa **OLMUŞ / OLMAMIŞ / YANLIŞ / YENİ TALEP** yazar.
2. Toplu 41 madde testi **deploy + footer sürüm doğrulaması** sonrası; madde madde.
3. PASS için: doğru ekran + footer sürümü + ekran görüntüsü veya açık cümle.

---

## Grup 1

| # | Durum | Not |
|---|--------|-----|
| 1 | **YENİ TALEP** | Üst bant: yalnızca kalın dosya no; `Hasar …` ikinci numara gizlensin; alt satır sigortalı ad soyad; `RPT-…` kalksın; Taslak/Satış/Kâr sağ üstte belirgin; detaydan sigortalı ad kalksın |
| 2 | **YAPILMIŞ** | Hasar nedeniyle uyumlu hızlı onarım |
| 2 ek | **YENİ TALEP** | Hızlı Onarım Türü yan yana (alt alta değil) |
| 3 | **YAPILMIŞ** | Hasar Türü(leri) → Hasar Türü |
| 4 | **YAPILMIŞ** | Hızlı Onarım Kalemleri → Hızlı Onarım Türü |

## Grup 2

| # | Durum | Not |
|---|--------|-----|
| 5 | **OLMAMIŞ** | Modal «Eşleşen kalem bulunamadı»; eski tanımlar silinmiş — geri getir veya yeniden listele (Mustafa kararı) |
| 6 | **YAPILMIŞ** | Satır ekleme |
| 7 | **YAPILMIŞ** | Mavi satır ekle kalktı |
| 8 | **YAPILMIŞ** | Düzenle/Sil ikonları |

## Grup 3

| # | Durum | Not |
|---|--------|-----|
| 9 | **YAPILMIŞ** | Kaydet butonu sadeleştirme |
| 10 | **OLMAMIŞ** | Fotoğraf yüklenemedi devam ediyor |
| 10 ek | **YENİ TALEP** | Yüklenen resim görünsün; orta/küçük boy; galeride sonraki resim; tip etiketi (Tespit/Onarım/Onarım Sonrası) |
| 11 | **YAPILMIŞ** / **TEST YAPILAMADI** | Etiketler tamam; köşe yazısı ve portal yansıması test edilemedi |
| 12 | **YAPILMIŞ** | Alt bant baloncuk ortalama |

## Grup 4

| # | Durum | Not |
|---|--------|-----|
| 13 | **YAPILMIŞ** | Sigortalı raporda; 1. madde revizyonları ayrı bekliyor |
| 14 | **OLMAMIŞ** | Dosya Eksperi raporda Atanmamış; müşteri kartında eksper var |
| 15 | **OLMAMIŞ** | Kaydet/İptal sağa çekilmedi (Mustafa beklentisi) |
| 16 | **BEKLEMEDE** | Yasal notlar — Mustafa yeniden maddeleştirecek |

## Grup 5

| # | Durum | Not |
|---|--------|-----|
| 17 | **YAPILMIŞ** | Dosya Bütçesi; Dahili kalktı |
| 18 | **YAPILMIŞ** | Tedarikçi kıyaslama |
| 18 ek | **YENİ TALEP** | Dosya Bütçesi başlık/satır/Genel Toplam ortalı |
| 19 | **YENİ TALEP UYGULANDI (v292)** | Çubuk+nokta şerit; sağ üst Taslak/Satış/Kâr rozetlerinin **altında**; Dosya Bilgileri'nden kaldırıldı — Mustafa PASS |
| 20 | **OLMAMIŞ** | = 14, Dosya Bilgileri eksper |

---

## Grup 6 (12 Temmuz 2026)

| # | Durum | Not |
|---|--------|-----|
| 21 | **OLMAMIŞ** | İhbar Tarihi boş (`—`); mailin gelme tarihi yansıtılmamış. Hasar Tarihi kalkmış görünüyor |
| 22 | **EKSİK / YENİ TALEP** | Tab/İleri işlem biten satırın **başına** gidiyor; **yeni satır** açılıp oranın başına gelmeli. Boş satırda işlem yapılmadan kaydedilirse satır **silinmeli**, raporda boş kalmasın |
| 23 | **YAPILMIŞ** | Satırda kaydet + Enter ile satır ekleme ✓ |
| 24 | **YAPILMIŞ** | Tedarikçi fiyat davranışı ✓ |

---

## Grup 7 (12 Temmuz 2026)

| # | Durum | Not |
|---|--------|-----|
| 25 | **YAPILMIŞ** | Satır eklerken sayfa yenilenmiyor ✓ |
| 26 | **YENİ TALEP (detaylı)** | İş grubu bitince hafızadaki tedarikçi maliyetiyle karşılaştır; uyumlu/uyumsuz onay sor; uyumsuzda WhatsApp pazarlık. Test edilemedi — uygulama bekliyor |
| 27 | **YAPILMIŞ** | Önceki satır mahal kaybolmuyor ✓ |
| 28 | **YAPILMIŞ** | Mahal + iş grubu sıralama ✓ |
| 28 ek | **YENİ TALEP** | Tablo başlıkları sabit, satırlar kaydırılabilir (sticky header) |

---

## Grup 8 (12 Temmuz 2026)

| # | Durum | Not |
|---|--------|-----|
| 29 | **YAPILMIŞ** | Mahal/Bölge ` - ` formatı ✓ |
| 30 | **YAPILMIŞ / YENİ TALEP** | Tespit sütunu var; başlık **«Tespit Alanı»** olmalı; seçim **zorunlu** |
| 31 | **YAPILMIŞ** | Kayıtta yeni satır mahal silinmiyor ✓ |
| 32 | **YAPILMIŞ** | İleri/Tab kaydet butonuna gitmiyor ✓ |

---

## Grup 9 (12 Temmuz 2026)

| # | Durum | Not |
|---|--------|-----|
| 33 | **İPTAL + YENİ TALEP** | Satırdaki «Tedarikçi Karşılaştır» kalksın. Tedarikçi atamada maliyet/kalite ile bölgesel öneri sırası. WhatsApp zorunlu şablon (tedarikçi atayınca); Ayarlar’da WhatsApp mesaj şablonları; kime ne gideceği belirli; SMS ile sınırlama yok |
| 34 | **YAPILMIŞ** | Satırda kaydet emaresi ✓ |
| 35 | **YAPILMIŞ** | + Kalem Ekle’de satır sıfırlanmıyor ✓ |
| 36 | **YAPILMIŞ** | Kategori seçince alt bant kaydet belirginleşmesi ✓ |

---

## Grup 10 (12 Temmuz 2026)

| # | Durum | Not |
|---|--------|-----|
| 37 | **YAPILMIŞ** | Kaydetme hatırlatma pop-up ✓ |
| 38 | **YAPILMIŞ** | Kaydet/İptal sabit + sayaç ✓ |
| 38 ek | **YENİ TALEP** | Sol: Süre + Kayıt/İptal · Orta: Finansal Özet · Sağ: Kaydet/İptal. Süre üstü başlık: **«Rapor Oluşturma Analizi»** (disiplin) |
| 39 | **NOT ALINDI** | Yazım süresi hesaplanıyor; personel sayfası analizi **bu etap bitince Mustafa'ya hatırlatılacak** |
| 40 | **YAPILMIŞ / EKSİK** | Düzen var; 38 ek ile tamamlanacak |

---

## Grup 11 (12 Temmuz 2026) — son madde

| # | Durum | Not |
|---|--------|-----|
| 41 | **YENİ TALEP UYGULANDI (v292)** | Revizyon geçmişi sağ üst (rozetler altı); sayfa yenileme düzeltildi — Mustafa PASS |

---

## Tüm gruplar tamamlandı (12 Temmuz 2026)

Mustafa geri bildirimi Grup 1–11 bitti.

### Güncel kalan liste (YAPILMIŞ çıkarıldı)

**Deploy sonrası sizden PASS istenecek:** 1, 5, 10, 14, 15, 20, 21, 22 (v291) · **19, 41** (v292 revizyon yerleşimi)

**Henüz kodlanmayan / ek talep:** 2 ek, 18 ek, 26, 28 ek, 30 ek, 33, 38 ek

**Beklemede:** 16 (siz yazacaksınız), 39 (personel analizi — hatırlatılacak), 11 portal testi

---

## Deploy notu (12 Temmuz 2026)

- **Canlı:** Web **v292** · Backend **v279**
- **Rollback:** Web v291 · Backend v278

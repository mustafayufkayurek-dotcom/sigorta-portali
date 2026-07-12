# Onarım Raporu — 42 Madde Doğrulama Rehberi

**Güncelleme:** 12 Temmuz 2026 · Canlı hedef: **web v290** / **backend v279**  
**Uygulanacak:** **41 madde** (B-1 İPTAL)

---

## Önemli: İki farklı ekran

| Ekran | URL | Kaç madde burada? |
|-------|-----|-------------------|
| **Dosya detay** | `/panel/hasar-dosyalari/[id]` | ~12 madde (Dosya Bilgileri, Rapora Git, revizyon şeridi, eksper…) |
| **Rapor editörü** | `/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]` | **~29 madde** (Tespit sütunu, tablo UX, alt bant Kaydet/İptal, foto, yasal not…) |

**42 maddenin 30+’u yalnızca «Rapora Git» sonrası rapor sayfasındadır.** Dosya detayda «hiçbir şey yok» hissi, rapor sayfasına girilmemesinden kaynaklanır.

**Kontrol:** Ctrl+Shift+R → dosya aç → **Rapora Git →** tablo ve alt koyu bant.

---

## Bölüm A — 19 madde

| ID | Nerede doğrulanır | Beklenen |
|----|-------------------|----------|
| A-1 | Dosya detay → Dosya Bilgileri | Hasar Nedeni burada |
| A-2 | Dosya detay / yeni dosya | Hızlı onarım hasar nedeniyle uyumlu |
| A-3 | Dosya detay | «Hasar Türü» (tekil) |
| A-4 | Dosya detay | «Hızlı Onarım Türü» (Kalem yok) |
| A-5 | Rapor editörü + PDF | Hızlı onarım türü ekran ve PDF |
| A-6 | Rapor → Onarım Kalemleri | Enter + «+ Kalem Ekle» |
| A-7 | Rapor tablo | Mavi «Satır Ekle» yok |
| A-8 | Rapor → İşlem | İkon düzenle/sil |
| A-9 | Rapor alt bant | Gereksiz bölüm içi Kaydet yok |
| A-10 | Rapor → Fotoğraflar | Yükleme çalışır |
| A-11 | Rapor + portallar | Tespit/Onarım/Onarım Sonrası etiketleri |
| A-12 | Rapor alt bant | Baloncuk metinleri ortalı |
| A-13 | Rapor + PDF | Sigortalı bilgileri |
| A-14 | Dosya Bilgileri + rapor başlığı | Doğru eksper, sorumlu değil |
| A-15 | Rapor alt bant | Kaydet/İptal sağda |
| A-16 | Rapor → Yasal Notlar | Şablon chip’leri |
| A-17 | Rapor → Dosya Bütçesi | «Dahili» yok |
| A-18 | Rapor → Tdr Fiyatı / İşlem | Tedarikçi adı + karşılaştır |
| A-19 | Dosya Bilgileri içi | Yatay revizyon şeridi |

## Bölüm B — 23 madde

| ID | Durum | Nerede |
|----|-------|--------|
| **B-1** | **İPTAL** | Rapora Git doğrudan link kalır |
| B-2 | Uygula | Dosya Bilgileri → Dosya Eksperi |
| B-3 | Uygula | Dosya Bilgileri → İhbar Tarihi |
| B-4 | Uygula | Rapor tablo Tab |
| B-5 | Uygula | Rapor satır Kaydet + Enter |
| B-6 | Uygula | Rapor Tdr Fiyatı modal |
| B-7 | Uygula | Rapor satır ekleme |
| B-8 | Uygula | Rapor tedarikçi hafıza |
| B-9 | Uygula | Rapor mahal koruma |
| B-10 | Uygula | Rapor sıralama Tespit→Mahal→Grup |
| B-11 | Uygula | Rapor mahal «Kelime1 - Kelime2» |
| B-12 | Uygula | Rapor **Tespit** sütunu |
| B-13 | Uygula | Rapor kayıtta mahal silinmesin |
| B-14 | Uygula | Rapor Tab trap |
| B-15 | Uygula | Rapor VendorQuoteModal |
| B-16 | Uygula | Rapor satır kaydet emaresi |
| B-17 | Uygula | Rapor + Kalem Ekle koruma |
| B-18 | Uygula | Rapor sabit alt bant |
| B-19 | Uygula | Rapor idle kaydet modal |
| B-20 | Uygula | Rapor Kaydet/İptal + sayaçlar |
| B-21 | Uygula | Rapor sessionStorage süre |
| B-22 | Uygula | Rapor alt bant grid |
| B-23 | Uygula | Rapor foto + dosya revizyon |

## Grup C — Operasyon (6 madde)

| ID | Nerede |
|----|--------|
| C-1 | Operasyon → dosya tıklama |
| C-2 | Dosya Bilgileri ihbar konusu |
| C-3 | Giriş oturumu |
| C-4 | Gelen kutu VAM/CAM |
| C-5–C-6 | Panel tabloları sütun |

---

## Repo durumu (12 Temmuz)

Kod denetimi: **41/41 madde repoda uygulanmış** (B-1 hariç). Kısmi: A-5 PDF (v290 ile tamamlandı), A-4 seed etiketi (v290).

Canlı doğrulama için **v290 no-cache build** gerekir (v289 deploy’da Docker build cache kullanıldı).

---

## Pass formatı

`B-12 PASS` · `A-5 HAYIR: PDF’te hızlı onarım yok`

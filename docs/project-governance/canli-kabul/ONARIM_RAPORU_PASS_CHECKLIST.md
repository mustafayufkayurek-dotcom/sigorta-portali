# Onarım Raporu — Pass / Hayır Kontrol Listesi

**Tarih:** 11 Temmuz 2026  
**Canlı referans:** Web **v277** (backend v276) · Logo deploy: `e0bd4fc` / `v277-sidebar-logo-fix`  
**Kaynak:** Transcript `ea5defe4` satır ~12749 (19 madde), ~12821 (23 madde) · commit `6c9bfbc` (v273) · v270–v276 deploy notları  
**Manifest:** `deploy/manifests/KNOWN_GOOD_IMAGES.json`

Tek tur canlı kabul: her madde için **Pass ☐** veya **Hayır ☐** işaretle. Sorun varsa kısa not ekle.

---

## Bölüm A — İlk Geri Bildirim (19 Madde)

*Kaynak: 11 Temmuz 2026 öğleden sonra · v270 + v271 + v272 deploy*

| # | Madde | Ekran Yolu | Beklenen Davranış | Pass ☐ | Hayır ☐ |
|---|-------|------------|-------------------|--------|---------|
| 1 | Hasar Nedeni Dosya Bilgileri Alanına Taşınsın | `/panel/hasar-dosyalari/[id]` → Dosya Bilgileri | Hasar Nedeni rapor gövdesinde değil; Dosya Bilgileri kartında görünür | ☐ | ☐ |
| 2 | Hasar Nedeni İle Orantılı Hızlı Onarım Türü | `/panel/hasar-dosyalari/[id]` → Dosya Bilgileri / yeni dosya | Dahili Su / Harici Su gibi anlamsız ayrım yok; seçilen hasar nedeniyle uyumlu hızlı onarım türü listelenir; etiket «Hızlı Onarım Türü» biçiminde | ☐ | ☐ |
| 3 | «Hasar Türü(leri)» → «Hasar Türü» | `/panel/hasar-dosyalari/[id]` | Etiket tekil «Hasar Türü»; Title Case | ☐ | ☐ |
| 4 | «Hızlı Onarım Kalemleri» → «Hızlı Onarım Türü» | `/panel/hasar-dosyalari/[id]` | «Kalem» ifadesi yok; «Hızlı Onarım Türü» kullanılır | ☐ | ☐ |
| 5 | Hızlı Onarım Türü ve Kapsamları Rapora Yansır | `/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]` | Dosyada seçilen hızlı onarım türü ve kapsam rapor/PDF’te eksiksiz görünür | ☐ | ☐ |
| 6 | Yeni Satır Ekleme UX (Enter + İnce Link) | `/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]` → Onarım Kalemleri | Mavi «Satır Ekle» yok; **Enter** ile satır kaydı; altta **+ Kalem Ekle** linki; akış kopmaz | ☐ | ☐ |
| 7 | Mavi «Satır Ekle» Butonu Kaldırılsın | Aynı | Tabloda mavi «Satır Ekle» / «Ekle» butonu görünmez | ☐ | ☐ |
| 8 | Düzenle / Sil Profesyonel Tasarım | Aynı → İşlem sütunu | Metin «Düzenle/Sil» yerine ikon tabanlı ghost butonlar (kalem, çöp, tik, geri al) | ☐ | ☐ |
| 9 | Kaydet Butonu Sadeleştirme | Aynı → alt bant | Bölüm içi gereksiz Kaydet yok; alt bant **Kaydet** yalnızca kaydedilmemiş değişiklik varken görünür | ☐ | ☐ |
| 10 | Fotoğraf Yükleme Hatası Giderilsin | Aynı → Fotoğraflar | JPEG/PNG/HEIC yüklenir; «Yüklenemedi» hatası olmadan önizleme gelir | ☐ | ☐ |
| 11 | Fotoğraf Etiketleri ve Portal Yansıması | Aynı + `/panel/eksper-portal/*` + sigorta portalı | Etiketler **Tespit**, **Onarım**, **Onarım Sonrası**; mümkünse resmin sağ köşesinde; eksper/sigorta sayfalarında görünür; dosya sorumlusu silerse portallardan da kalkar | ☐ | ☐ |
| 12 | Alt Bant Baloncuk Metinleri Ortalı | Aynı → alt bant | Durum baloncukları içindeki metinler dikey/yatay ortalı | ☐ | ☐ |
| 13 | Sigortalı Bilgileri Rapora Yansır | Aynı + PDF | Sigortalı adı, iletişim vb. rapor ekranı ve PDF’te eksiksiz | ☐ | ☐ |
| 14 | Dosya Eksperi Doğru Kişi | Aynı → Dosya Bilgileri / rapor başlığı | Atanan eksper görünür; dosya sorumlusu eksper alanında **görünmez** | ☐ | ☐ |
| 15 | Kaydet ve İptal Sağa Hizalı | Aynı → alt bant | Kaydet / İptal butonları bantın sağında | ☐ | ☐ |
| 16 | Yasal Notlar Hazır Şablonları | Aynı → Yasal Notlar ve Uyarılar | Boş alan yerine şablon chip’leri (Kdv, Garanti, Muafiyet, Ön Tespit vb.) tıklanınca metne eklenir | ☐ | ☐ |
| 17 | «İş Grubu Bazlı Kar» → «Dosya Bütçesi»; «Dahili» Kaldır | Aynı → Dosya Bütçesi | Başlık «Dosya Bütçesi»; yanında «Dahili» etiketi yok | ☐ | ☐ |
| 18 | Tedarikçi İsmi ve Alternatif Fiyat Kıyaslama | Aynı → Tdr Fiyatı sütunu | Maliyet girilen tedarikçi adı görünür; alternatif teklif karşılaştırma ve tercih edilen tedarikçi seçilebilir | ☐ | ☐ |
| 19 | Profesyonel Revizyon Akışı | Aynı → Revize Et + Dosya Bilgileri | Onaylı raporda **Revize Et** modalı (neden, açıklama, etkilenen bölümler); revizyon geçmişi Dosya Bilgileri alanında (v276 yatay şerit) | ☐ | ☐ |

---

## Bölüm B — Dosya Sorumlusu İkinci Tur (23 Madde)

*Kaynak: 11 Temmuz 2026 akşam · commit `6c9bfbc` (v273) + v276 revizyon geçmişi*

| # | Madde | Ekran Yolu | Beklenen Davranış | Pass ☐ | Hayır ☐ |
|---|-------|------------|-------------------|--------|---------|
| 1 | Rapora Git Akışı Önceki Haline | `/panel/hasar-dosyalari/[id]` (Finans özeti, üst bant) | «Rapora Git» tab değiştirmez; doğrudan `/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]` sayfasına gider | ☐ | ☐ |
| 2 | Dosya Eksperi Dosya Bilgilerinde | `/panel/hasar-dosyalari/[id]` → Dosya Bilgileri | Dosya Eksperi alanı görünür (`assignedInspectorVendor` adı) | ☐ | ☐ |
| 3 | Hasar Tarihi Kaldır; İhbar Tarihi Fallback | Aynı | Hasar Tarihi alanı yok; İhbar Tarihi boşsa mailin geldiği tarih (`claim.createdAt`) gösterilir | ☐ | ☐ |
| 4 | Tedarikçi Fiyatında Tab Arama Alanına Atmamalı | `/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]` | Tab/İleri odak sıradaki hücreye gider; global arama alanına sıçramaz | ☐ | ☐ |
| 5 | Satırda Kaydet + Enter İle Satır Ekleme | Aynı → Onarım Kalemleri | Her satırda Kaydet; Enter yeni satır ekler / mevcut satırı kaydeder | ☐ | ☐ |
| 6 | Tedarikçi Fiyatı Alan Davranışı Düzgün | Aynı → Tdr Fiyatı | Fiyat girişi modal/popover ile tutarlı; alan genişliği ve odak kaybı olmadan çalışır | ☐ | ☐ |
| 7 | Satır Eklemede Sayfa Yenilenmesin | Aynı | + Kalem Ekle / Enter sonrası tam sayfa yenileme yok; scroll ve odak korunur | ☐ | ☐ |
| 8 | Tedarikçi Fiyat Hafızası | Aynı → Tdr Fiyatı | Daha önce girilen tedarikçi/fiyat önerileri hatırlanır ve seçilebilir | ☐ | ☐ |
| 9 | Yeni İş Eklerken Önceki Mahal/Bölge Korunsun | Aynı | Yeni satır eklenince bir üst satırdaki Mahal/Bölge değeri silinmez | ☐ | ☐ |
| 10 | Mahal/Bölge ve İş Grubu Bazlı Sıralama | Aynı → tablo | Satırlar mahal/bölge ve iş grubuna göre gruplanır/sıralanır; aynı alanda çalışırken kopukluk azalır | ☐ | ☐ |
| 11 | Mahal/Bölge Formatı: Kelimeler Arası «-» | Aynı → Mahal/Bölge | İki kelimeli girişler «Alt Kat - 5 No'lu Daire» biçiminde tire ile kaydedilir/gösterilir | ☐ | ☐ |
| 12 | Tespit Sütunu (Kategori Yanı) | Aynı | Kategori yanında **Tespit** sütunu; «Sigortalı Konut», «Alt Kat - 5 No'lu Daire» gibi rapor yazarken eklenebilir; sıralama tespit → mahal/bölge | ☐ | ☐ |
| 13 | Kaydedilmemiş Satır Kaydında Mahal/Bölge Silinmesin | Aynı | Satır kaydı sırasında yeni satırın mahal/bölgesi sıfırlanmaz | ☐ | ☐ |
| 14 | Mahal/Bölge Sonrası Tab Sıradaki Satıra Gitsin | Aynı | Yeni mahal/bölge girip Tab/Enter → yan hücre / alt satır; alt bant Kaydet’e odak gitmez | ☐ | ☐ |
| 15 | Tedarikçi Karşılaştır Geniş Modal | Aynı → Tdr Fiyatı | Dar hücre popover yerine anlaşılır **VendorQuoteModal**; alternatif teklifler okunaklı | ☐ | ☐ |
| 16 | Satır Bitince Kaydetme Emaresi | Aynı → satır İşlem | Satır tamamlanınca tik/kaydet ikonu veya görsel geri bildirim net | ☐ | ☐ |
| 17 | + Kalem Ekle Önceki Satırı Sıfırlamasın | Aynı | Alttaki **+ Kalem Ekle** tıklanınca üstteki düzenlenen satır verisi korunur | ☐ | ☐ |
| 18 | Kategori Seçince Alt Kaydet Belirginleşmesin | Aynı → alt bant | Kategori/mahal seçimi alt bant Kaydet’i gereksiz vurgulamaz; sabit görünüm | ☐ | ☐ |
| 19 | Rapor Bitince Kaydetme Hatırlatma Pop-up | Aynı | Rapor yazımı bittiğinde kaydetmeyi hatırlatan modal *(deploy dışı — Bölüm C)* | ☐ | ☐ |
| 20 | Sabit Kaydet/İptal + Kayıt/İptal Sayaçları | Aynı → alt bant | Kategori/mahal girince ekstra Kaydet/İptal çıkmaz; butonlar sabit; yanında kaç kez kaydedildi / iptal edildi sayısı | ☐ | ☐ |
| 21 | Rapor Yazım Süresi Hesaplansın | Aynı *(sessionStorage)* | Süre ölçümü başlar; personel analitiği henüz yok *(deploy dışı — Bölüm C)* | ☐ | ☐ |
| 22 | Alt Bant: Kaydet/İptal Sağda; Finansal Özet Ortada | Aynı → koyu alt bant | Kaydet/İptal sağda; finansal özet ortalanmış; düzensiz dağılım yok | ☐ | ☐ |
| 23 | Fotoğraf Yükleme Yenilemesiz; Revizyon Geçmişi Dosya Bilgilerinde | Aynı + Dosya Bilgileri | Fotoğraf yükleme sonrası tam sayfa yenileme yok; revizyon geçmişi sayfa dibinde değil **Dosya Bilgileri** içinde (v276) | ☐ | ☐ |

---

## Bölüm C — Bilinen Eksikler (Deploy Dışı)

Bu maddeler kontrol listesinde işaretlenebilir ancak **v277 öncesi deploy kapsamı dışındadır**:

| Konu | Madde | Durum | Not |
|------|-------|-------|-----|
| Analytics | B-21 | ⏳ Sonra | `sessionStorage` `report-write-started-at` yazılır; backend/BI ve personel sayfası raporu yok (`BACKLOG.md`) |
| Kaydet hatırlatma pop-up | B-19 | ⏳ Sonra | Rapor yazımı bitince modal henüz uygulanmadı |
| Finans tek kaynak | — | ⏳ Sonra | Finans özeti `FinansRaporOzeti` dosya detay, Finans sekmesi ve rapor alt bandında ayrı kopyalar; tek kaynak refaktörü bekliyor |

---

## Test Notları

- **Hesap:** Meridyen **Dosya Sorumlusu** (hasar/onarım raporu yazan rol)
- **Önbellek:** Her kontrol turu öncesi **Ctrl+Shift+R** (sert yenileme)
- **Örnek rota:** Operasyon → dosya aç → Dosya Bilgileri → Onarım Raporu düzenle
- **Yanıt formatı:** `A-6 PASS` · `B-14 HAYIR: Tab alt banda gidiyor` · `B-19 N/A deploy dışı`

**Deploy referans özeti**

| Sürüm | Kapsam |
|-------|--------|
| v270 | Madde A 1–5, 7, 10–15, 17 |
| v271 | Mahal/Bölge Title Case (ek) |
| v272 | Madde A 6, 8, 9, 16, 18, 19 |
| v273 (`6c9bfbc`) | Madde B 1–18, 20, 22–23 (çoğu) |
| v276 | Revizyon geçmişi Dosya Bilgileri içinde (B-23) |
| v277 | Sidebar logo (bu checklist dışı) |

# MERIDYEN_21_22_23_HAZIRAN_KURTARMA_PAKETI_v1

**Hazırlayan:** Cursor agent (Codex kanıt sentezi)  
**Kapsam:** 21–24 Haziran 2026 geri kazanım dönemi  
**Paket:** 1 / 3  
**Belge türü:** Meridyen resmi kriz kurtarma kaydı (referans doküman)  
**Kaynak paket:** `2026-06-22/.../21_22_23_HAZIRAN_KARAR_ENVANTERI_VE_CANLI_VARLIK_DOGRULAMA_01/`  
**Son güncelleme:** 2026-06-24

---

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

**Kod–karar çelişkisi:** Bu belgede yer alan kararlar ile mevcut kod çelişirse, kod doğru kabul edilmez. Önce referans karar doğrulanır, sonra kod karar ile hizalanır.

> Bu belge `00_PROJE_ANAYASASI.md` ve `00_CALISMA_YASASI.md` ile uyumlu olmak zorundadır.

---

## 1. Acil Kurtarma Özeti (yalnız KANITLI)

1. **KANITLI** — 22 Haziran login regresyonu `LOGIN_REGRESYON_DUZELTME_01` ve `LOGIN_REGRESYON_CANLIYA_ALMA_V2` paketleriyle giderildi ve canlıya alındı.
2. **KANITLI** — 22 Haziran navigasyon düzeltmesi `OPERASYON_ZEKASI_NAVIGASYON_DUZELTME_01_CANLIYA_ALMA` ile canlıya alındı.
3. **KANITLI** — 23 Haziran navigasyon tek sahiplik `NAVIGASYON_TEK_SAHIPLIK_UYGULAMA_01` uygulandı; canlıya alma paketi mevcut.
4. **KANITLI** — 23 Haziran Mail/Bildirim Merkezi tekleştirme `MAIL_BILDIRIM_MERKEZI_TEKLESTIRME_01` uygulandı.
5. **KANITLI** — 23 Haziran Ayarlar canonical sahiplik `AYARLAR_MODULU_05_CANONICAL_SAHIPLIK_UYGULAMASI` uygulandı.
6. **KANITLI** — 23 Haziran kanonik sürüm geri kazanımı `AYARLAR_VE_LOGIN_KANONIK_SURUM_GERI_KAZANIMI_01` ve uygulama paketi tamamlandı (kabul bekliyor notu var).
7. **KANITLI** — 23 Haziran Karar Koruma Guard `KARAR_KORUMA_GUARD_SISTEMI_01` hazırlandı.
8. **KANITLI** — 24 Haziran güvenli geri kazanım ve CRM/ULC paketleri devam eden geri kazanım zincirine bağlandı.
9. **KANITLI** — 24 Haziran canlı doğrulama turunda HTTP route kontrolü: `/giris`, `/panel`, `/panel/crm`, `/panel/ayarlar/tanimlar` → 200.
10. **KANITLI** — Canlı oturum screenshot kanıtı 24 Haziran turunda üretilemedi; birçok alan `KANIT_YOK` veya `KISMEN_VAR` sınıfında kaldı.

---

## 2. Gün Gün Karar Tablosu

| Tarih | Etiket | Karar | Paket / Referans | Kapsam | Canlı durumu | Kanıt Türü | Kaynak |
|-------|--------|-------|------------------|--------|--------------|------------|--------|
| 21 Haz | TAHMİN | ULC sözleşmeleri korunmalı | D265/D301/D303/D305/D310/D314 | ULC | Bilinmiyor | Backend deploy + Route doğrulama | Karar listesi §21 |
| 21 Haz | TAHMİN | Ayarlar sahiplikleri sadeleşmeli | D232/D240/D248/D249 | Ayarlar | Bilinmiyor | Screenshot + Route | Karar listesi §21 |
| 22 Haz | KANITLI | Login regresyon giderildi | LOGIN_REGRESYON_DUZELTME_01 | Login | Canlıya alındı | Screenshot + Canlı doğrulama | Karar listesi §22 |
| 22 Haz | KANITLI | Login canlıya alındı | LOGIN_REGRESYON_CANLIYA_ALMA_V2 | Login | Canlı | Screenshot + Canlı doğrulama | Karar listesi §22 |
| 22 Haz | KANITLI | Operasyon Zekası V8 canlı | OPERASYON_ZEKASI_13_CANLIYA_ALMA | Dashboard/Operasyon | Canlı | Screenshot + Route | Karar listesi §22 |
| 22 Haz | KANITLI | Navigasyon düzeltme canlı | OPERASYON_ZEKASI_NAVIGASYON_DUZELTME_01_CANLIYA_ALMA | Navigasyon | Canlı | Screenshot + Route doğrulama | Karar listesi §22 |
| 22 Haz | KANITLI | Evrak standart motoru MVP1 | EVRAK_STANDART_MOTORU_* | Evrak | Kısmen | Screenshot | Karar listesi §22 |
| 22 Haz | KANITLI | Ayarlar reorganizasyon tasarımı | AYARLAR_MODULU_02_REORGANIZASYON_TASARIMI | Ayarlar | Tasarım | Karar dosyası + Checklist | Karar listesi §22 |
| 23 Haz | KANITLI | Ayarlar canonical sahiplik | AYARLAR_MODULU_05_CANONICAL_SAHIPLIK_UYGULAMASI | Ayarlar | Uygulandı | Screenshot + Route | Karar listesi §23 |
| 23 Haz | KANITLI | Mail merkezi tekleştirme | MAIL_BILDIRIM_MERKEZI_TEKLESTIRME_01 | Mail/Bildirim | Uygulandı | Screenshot | Karar listesi §23 |
| 23 Haz | KANITLI | Navigasyon tek sahiplik | NAVIGASYON_TEK_SAHIPLIK_UYGULAMA_01 | Navigasyon | Canlı oturum bekliyor notu | Screenshot + Route doğrulama | Karar listesi §23 |
| 23 Haz | KANITLI | Tanımlar Merkezi dashboard | TANIMLAR_MERKEZI_DASHBOARD_DONUSUMU_01 | Tanımlar | Uygulandı | Screenshot | Karar listesi §23 |
| 23 Haz | KANITLI | Kullanıcı ve Yetki mimarisi | KULLANICI_VE_YETKI_BILGI_MIMARISI_DUZENLEME_01 | Kullanıcı ve Yetki | Uygulandı | Screenshot + Kabul raporu | Karar listesi §23 |
| 23 Haz | KANITLI | Karar koruma guard | KARAR_KORUMA_GUARD_SISTEMI_01 | Guard | Hazır | Karar dosyası + Checklist | Karar listesi §23 |
| 23 Haz | KANITLI | Kanonik sürüm geri kazanımı | AYARLAR_VE_LOGIN_KANONIK_SURUM_GERI_KAZANIMI_UYGULAMA_01 | Login/Ayarlar | Kabul bekliyor | Screenshot + Route | Karar listesi §23 |
| 24 Haz | KANITLI | CRM UX geri kazanım | CRM_UX_GERI_KAZANIM_01 | CRM | Devam | Screenshot + Route + Kabul raporu | Karar listesi §24 |
| 24 Haz | KANITLI | ULC canlıya alma | ULC_CANLIYA_ALMA_01 | ULC | Admin kabul eksik | Backend deploy + Route doğrulama | Karar listesi §24 |

---

## 3. Modül Bazlı Kurtarma Durumu

### Login

- **KANITLI:** Regresyon düzeltme ve canlıya alma paketleri tamamlandı.
- **KANITLI:** Kanonik sürüm geri kazanım paketleri uygulandı; kabul bekliyor notu var.
- **Canlı doğrulama:** 24 Haziran turunda canlı oturum screenshot alınamadı → `KANIT_YOK`.
- **24 Haziran bağlantısı:** `GUVENLI_GERI_KAZANIM_*`, kanonik sürüm paketleri.

**Nihai Karar Durumu:** Kısmen geri kazanıldı — paket kanıtı var, bu tur canlı oturum kanıtı yok.

### CRM

- **KANITLI:** `CRM_UX_GERI_KAZANIM_01`, `CRM_ILISKI_YONETIMI_MVP1_UYGULAMA_01` devam paketleri.
- **Canlı doğrulama:** `/panel/crm` HTTP 200; menü/ekran screenshot bu turda yok → `KISMEN_VAR`.
- **Regresyon riski:** Kritik — bağımsız modül kararı canlı menü ile doğrulanmadı.

**Nihai Karar Durumu:** Kısmen geri kazanıldı — route var, canlı UX doğrulama bekliyor.

### Navigasyon

- **KANITLI:** Tek sahiplik uygulama + canlıya alma paketleri.
- **Canlı doğrulama:** Canlı menü screenshot alınamadı → `KANIT_YOK`.

**Nihai Karar Durumu:** Kısmen geri kazanıldı — kod/paket kanıtı var, canlı menü kanıtı eksik.

### Ayarlar

- **KANITLI:** Reorganizasyon, canonical sahiplik, bildirim sahipliği ayrıştırma paketleri.
- **Canlı doğrulama:** Route 200; ekran davranışı screenshot yok.

**Nihai Karar Durumu:** Kısmen geri kazanıldı.

### Mail / Bildirim Merkezi

- **KANITLI:** Tek merkez, iki sekme, SMTP içinde test maili UX temizliği.
- **Canlı doğrulama:** Canlı ekran screenshot yok → `KANIT_YOK`.

**Nihai Karar Durumu:** Doğrulama bekliyor.

### Kullanıcı Yaşam Döngüsü (ULC)

- **KANITLI:** `KULLANICI_YASAM_DONGUSU_GERI_KAZANIM_01`, `ULC_CANLIYA_ALMA_01`.
- **Canlı doğrulama:** Backend hizalaması yapıldı; admin/gerçek kullanıcı akışı eksik → `KISMEN_VAR`.

**Nihai Karar Durumu:** Admin kabul testi bekliyor.

### Kullanıcı ve Yetki

- **KANITLI:** Bilgi mimarisi düzenleme paketi — Kullanıcılar, Roller, Ekran Erişim İzinleri tek aile.
- **Canlı doğrulama:** Canlı menü/buton screenshot yok → `KANIT_YOK`.

**Nihai Karar Durumu:** Doğrulama bekliyor.

### Tanımlar Merkezi

- **KANITLI:** Dashboard/rehber dönüşüm paketi.
- **Canlı doğrulama:** `/panel/ayarlar/tanimlar` HTTP 200; dashboard davranışı screenshot yok → `KISMEN_VAR`.

**Nihai Karar Durumu:** Doğrulama bekliyor.

### Karar Koruma (Guard)

- **KANITLI:** Guard sistemi, çalışma modeli kararı, login karar koruma auditi hazır.
- **Canlı doğrulama:** Bu tur checklist PASS kanıtı yok → `KANIT_YOK`.

**Nihai Karar Durumu:** Sistem hazır — canlı checklist doğrulaması bekliyor.

---

## 4. Canlıya Alınan Sayfalar Envanteri

| Route / Sayfa | Karar tarihi | Paket | Canlı durumu | Kanıt Türü | Etiket | Not |
|---------------|--------------|-------|--------------|------------|--------|-----|
| `/giris` | 22 Haz | LOGIN_REGRESYON_CANLIYA_ALMA_V2 | HTTP 200 | Route doğrulama | KANITLI | Oturum screenshot eksik |
| `/panel` | 22–23 Haz | Çoklu | HTTP 200 | Route doğrulama | KANITLI | |
| `/panel/crm` | 24 Haz | CRM_UX_GERI_KAZANIM_01 | HTTP 200 | Route doğrulama | KISMEN_VAR | Menü kanıtı yok |
| `/panel/ayarlar/tanimlar` | 23 Haz | TANIMLAR_MERKEZI_* | HTTP 200 | Route doğrulama | KISMEN_VAR | |
| `/panel/ayarlar/dosya-konulari` | 23 Haz | IHBAR_KONULARI_CANONICAL_* | HTTP 200 | Route doğrulama | KISMEN_VAR | Redirect screenshot yok |

---

## 5. 21 Haziran — Sınırlı Kanıt Bölümü

21 Haziran için workspace paket çıktısı **sınırlı**. Aşağıdaki satırlar sonraki günlerde referans alınan D-serisi zincirinden **TAHMİN** ile izlenmiştir.

| Referans | Karar | Etiket | Kanıt Türü |
|----------|-------|--------|------------|
| D265/D301/D303/D305/D310/D314 | ULC sözleşmeleri korunmalı | TAHMİN | Backend deploy + Route doğrulama |
| D232/D240/D248/D249 | Ayarlar sahiplik sadeleştirme | TAHMİN | Screenshot + Route |

---

## 6. Çelişkiler ve Açık Sorular

### Kanıtlı çelişkiler

- Paket kanıtları "canlıya alındı / uygulandı" derken 24 Haziran canlı doğrulama turu çoğu alanda `KANIT_YOK` — **kod/paket PASS ≠ canlı kullanıcı PASS**.

### Doğrulanması gereken maddeler

1. Login kurumsal standardı canlı oturumda hâlâ geçerli mi?
2. CRM sol menüde bağımsız modül olarak görünüyor mu?
3. Navigasyon tek sahiplik canlı menüde uygulanıyor mu?
4. Mail Merkezi iki sekme + SMTP test maili canlıda doğru mu?
5. ULC admin ve gerçek kullanıcı akışı tamamlandı mı?
6. Kullanıcılar/Roller/Ekran İzinleri menüden açılıyor mu?
7. Tanımlar Merkezi dashboard/rehber davranışı canlıda var mı?
8. Guard checklist canlı oturumda PASS alıyor mu?
9. Hasar / Acil Yardım / Finans operasyon akışları canlıda çalışıyor mu?
10. Kanonik sürüm geri kazanımı Mustafa kabulü aldı mı?

---

## 7. Paket 2'ye Devredilenler

- Operasyon Merkezi vizyonu
- Hasar modülü genel stratejisi
- Acil Yardım genel stratejisi
- Eksper yaklaşımı
- Uzun dönem ürün kararları ve değiştirilemez kararlar listesi
- Regresyon geçmişi envanteri (21 Haziran öncesi)

---

## 8. Geri Kazanım Sonrası Kontrol Durumu

| Modül | Son Durum |
|-------|-----------|
| Login | ⚠️ Kısmen — paket kanıtı var, canlı oturum kanıtı eksik |
| Navigasyon | ⚠️ Kısmen — uygulama paketi var, canlı menü kanıtı yok |
| CRM | ⚠️ Kısmen — route 200, menü/ekran kanıtı yok |
| Ayarlar | ⚠️ Kısmen — canonical paketler uygulandı, ekran kanıtı eksik |
| Mail / Bildirim Merkezi | ⏳ Doğrulama bekliyor |
| Tanımlar Merkezi | ⏳ Doğrulama bekliyor |
| Kullanıcı ve Yetki | ⏳ Doğrulama bekliyor |
| ULC | ⚠️ Admin kabul testi bekliyor |
| Karar Koruma (Guard) | ⏳ Canlı checklist doğrulaması bekliyor |

---

*Paket 1 tamamlandı. Bu belge Meridyen resmi kriz kurtarma kaydıdır. Sırada MERIDYEN_STRATEJIK_KARAR_ENVANTERI_v1 (Paket 2) var.*

**Derleme notu:** Cursor agent, Codex workspace kanıt paketlerinden sentezledi. Mustafa onayı bekleniyor.

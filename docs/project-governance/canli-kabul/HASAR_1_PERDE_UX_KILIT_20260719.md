# Hasar 1. Perde UX Kilit — 2026-07-19

> **DEPRECATED / SUPERSEDED (2026-07-19)**  
> Bu belge silinmedi; geri dönüş için korunur.  
> Güncel bağlayıcı standart: `HASAR_OPERASYON_PLANLAYICISI_UX_STANDARDI_20260719.md`  
> Piksel referans: `docs/project-governance/ui-reference/HASAR_OPERASYON_PLANLAYICISI_FINAL_REFERANS.png`  
> Lokal rota (eski): `/dev/hasar-operasyon-kontrol-merkezi` — korunur, yeni iş burada yapılmaz.

**Durum:** DEPRECATED — önceki lokal UX referansı (piksel 26/27)  
**Değerlendirme aşaması:** Yalnız UX; canlıya alma sonra  
**Ürün sahibi:** Mustafa  
**Kapsam:** Yalnızca lokal UX önizleme (mock). Business logic / API / gerçek state modeli / DB değişmez.

## Referans rota

`/dev/hasar-operasyon-kontrol-merkezi`

- Kaynak: `apps/web/src/app/dev/hasar-operasyon-kontrol-merkezi/page.tsx`
- Production’da `notFound()` koruması zorunlu kalır.
- Banner: `1. Perde Kilitli · Referans`
- Component listesi: `HASAR_1_PERDE_UX_COMPONENT_LISTESI_20260719.md`
- Modül standardı: `HASAR_MODULU_PERDE_UX_STANDARDI_20260719.md`

## UX referansı kabul edildi — piksel referans 26/27

Mustafa: 1. Perde ekranı UX referansı kabul edildi. Yeni tasarım üretilmez; komponentler yeniden yorumlanmaz. Piksel kaynak gerçek:

| Kanıt | Dosya | Viewport |
|-------|-------|----------|
| Piksel kaynak | `26-viewport-aktif-rozet-20260719.png` | 1600×1100 |
| Desktop | `27-desktop-referans-20260719.png` | 1600×1100 |
| Tablet | `28-tablet-referans-20260719.png` | ~900×1100 |
| Mobil | `29-mobil-referans-20260719.png` | ~390×844 |

Klasör: `docs/project-governance/canli-kabul/ekran-goruntuleri/hasar-1-perde-operasyon-kontrol-20260718/`

### Renk notu (referans kazanır)

Mustafa kırmızı vurgudan bahsetmiş olabilir; **referans görselde Bugünkü Görev mavi çerçevelidir**. Kırmızı yalnız menü badge / Önemli not etiketi gibi mevcut kullanımlarda kalır. Çelişkide **referans görsel kazanır** — Bugünkü Görev mavi çerçeve korunur.

## Hasar Modülü Perde UX Standardı (kalıcı — madde 9)

Bu ekran Hasar Modülünün **referans UX standardıdır**. Aynı tasarım dili tüm perdelerde zorunludur:

| Perde | Operasyon kapsamı |
|-------|-------------------|
| 1. Perde | Randevu Operasyon Merkezi *(bu kilit / referans)* |
| 2. Perde | Tespit Operasyonu |
| 3. Perde | Tedarikçi Operasyonu |
| 4. Perde | Dijital Onay |
| 5. Perde | Rapor Aşaması |
| 6. Perde | Finans / Dosya Kapat |

**Korunacak kabuk (her perde):** Kart yapısı · Drawer standardı (popup yok) · Renk hiyerarşisi · SVG ikon dili · Alt Operasyon Şeridi · Zorunlu İşlemler · Notlar & Hatırlatmalar · 6’lı grid + Bugünkü Görev yerleşim dili.

**Kural:** Her perde yalnız kendi operasyonunu gösterir. Yeni perde bu referanstan türetilir. Farklı tasarım dili yok. Kısa özet: `HASAR_MODULU_PERDE_UX_STANDARDI_20260719.md`.

### Hedef operasyon zinciri (sonraki perdeler — UI’da kart eklenmez)

Ürün zinciri hedefi (1→6): Randevu → Tespit → Tedarikçi → Dijital Onay → Rapor → Finans / Dosya Kapat.  
1. Perde mock’unda Finans / Dosya Kapat kartı **eklenmez**; referanstaki 6’lı grid + Bugünkü Görev korunur. Zincir sonraki perdelerde ayrı ekran/kapsam ile gelir.

## Renk kuralları (kilitli)

| Renk | Anlam | Kullanım |
|------|--------|----------|
| Yeşil | Tamamlandı / başarılı / onaylandı | Tamamlanan kartlar, başarı metinleri, `Sonraki Aşamaya Geç` (açıkken) |
| Turuncu | İşlem bekliyor / operatör aksiyonu | Bekleyen durum rozetleri, düzenle modu, Sigortalı Onayı beklerken |
| Mavi | Yalnız aktif odak | Bugünkü Görev çerçeve, aktif kart + aktif işlem butonu + seçili aşama (şerit) + zorunlu aktif satır |
| Gri | Pasif / gelecek | Gelecek kartlar, pasif butonlar |

### Ek kısıtlar

- Bugünkü Görev dışında mavi çerçeve yok (aktif kart / zorunlu aktif satır hariç).
- Aktif olmayan kartlar: beyaz zemin + ince gri çerçeve.
- Aktif olmayan kartlardaki aksiyon butonları: gri-outline / nötr (mavi değil).
- Aynı anda yalnız **1** kart aktif; Alt Operasyon Şeridi aktif adımı ile ilgili kart eşzamanlı aktif olur.
- Tüm kartlar aynı anda mavi görünmez.

## UX maddeleri (kilit özeti)

1. Bugünkü Görev kompakt (~%20).
2. Sonraki Adım alanı: **Şimdi Yap** + dinamik CTA (varsayılan **Tespitçiyi Ata**).
3. Aktif / tamamlanan / bekleyen / gelecek kart hiyerarşisi (yukarıdaki renkler).
4. Randevu Bilgileri → Sigortalı Onayı (`randevuOnayDone`).
5. Hızlı İşlemler: Ara, WhatsApp, Not Ekle, Dosya Ekle, Hatırlatma, Dosya Notu.
6. Kart davranışı: tamamlanınca ana buton pasif + Düzenle/Değiştir; düzenlemede ana buton aktif; kaydet → yeşil; Sonraki Aşamaya Geç `stagePassed` false iken açık kalır.

### Son 3 dokunuş (2026-07-19 — kilitli)

7. **Aktif Görev rozeti:** Aktif kartın sol üst köşesinde mavi rozet — metin `Aktif Görev` (Title Case; ALL CAPS / `uppercase` CSS yok).
8. **Zorunlu ↔ kart senkronu:** Zorunlu İşlemler aktif satırı, orta alan aktif kartı ve şerit aynı adımı gösterir; aktif satırda soft blue glow (`anim-pulse` + mavi çerçeve/ring).
9. **Ana işlem SVG ikonları:** Randevu (takvim), Tespitçi (kişi), Tedarikçi (bina), Mesaj (chat), Dijital Onay (belge), Rapor (rapor). Aktif mavi butonda net; pasif outline butonda muted. Emoji yok.

## Değişiklik yasağı

Bu kilit altında **yapılmaz** (açık Mustafa onayı olmadan):

- Business logic, API, gerçek state modeli, DB / migration
- Production panel / deploy ile bu ekranı canlıya taşıma
- Renk hiyerarşisini veya aktif-kart kuralını bozan “estetik” redesign
- Onaysız 2–6. Perde kapsamına sızma veya 1. Perde’ye Finans/Dosya Kapat kartı ekleme
- Farklı tasarım dili ile yeni perde üretme

İzinli: lokal mock UX düzeltmesi (yalnız bu rota), kanıt yenileme, kilit / standart belgesi güncelleme (onaylı).

## Kanıt yolu

`docs/project-governance/canli-kabul/ekran-goruntuleri/hasar-1-perde-operasyon-kontrol-20260718/`

- Piksel kaynak: `26-viewport-aktif-rozet-20260719.png`
- Desktop: `27-desktop-referans-20260719.png`
- Tablet: `28-tablet-referans-20260719.png`
- Mobil: `29-mobil-referans-20260719.png`
- Capture: `apps/web/scripts/capture-hasar-operasyon-kontrol-merkezi-20260718.mjs`
- `EVIDENCE.json`

## 2–6. Perde’ye geçiş notu

1. Perde UX bu belge ile kilitlenmiştir (referans kabul + madde 9 standardı dahil).  
2–6. Perde çalışmaları **yeni kapsam / yeni onay** ile başlar; aynı UX standardından türetilir; 1. Perde referans ekranı bozulmadan üzerine inşa edilir.  
1. Perde mock sayfasına dokunmak = kilit ihlali riski → önce Mustafa onayı.

# EPIC-05 — Production Geri Bildirim (2026-07-17)

**Ortam:** Local (`web :3001`, `backend :3000`)  
**Deploy:** Yok (talimat yok)  
**Commit/Push:** Yok

## Özet

| Madde | Sonuç |
|-------|--------|
| Google Alternatifleri telefon | Kök neden giderildi: Text Search + Place Details telefon çıkarımı; telefonsuz aday listelenmez |
| Matbu logo | Resmi `/meridyen-logo-original.png`; görüntülemede kırık host rewrite |
| Matbu iş özeti | İç alış/satış etiketleri matbuya sızmaz |
| Kaydet Ve Kapat | Kodda mevcut; desktop’ta görünür (kanıt) |
| Dijital onay | Aşağıda açıklama |

---

## 1) Google / Places telefon — kök neden ve düzeltme

### Kök neden
- Places **Text Search** yanıtında `nationalPhoneNumber` çoğu zaman boş kalıyor (place_id geliyor, telefon gelmiyor).
- Kod yalnızca `nationalPhoneNumber` okuyordu; `internationalPhoneNumber` yoktu.
- Telefonsuz POI’ler (cami, kanyon vb.) aynı listede kalıyordu → UI’da «Telefon Bilgisi Bulunamadı».

### Düzeltme (`vendor-discovery.service.ts`)
1. Field mask’a `internationalPhoneNumber` eklendi.
2. Telefon: `nationalPhoneNumber || internationalPhoneNumber`.
3. Telefonsuz adaylar için **Place Details** çağrısı ile telefon tamamlanır.
4. Alternatif listede **telefonu olmayan aday gösterilmez** (havuz genişletilip filtre sonrası max 5).

### Local kanıt notu
Local backend’de Google Places anahtarı **yapılandırılmamış** (`ALTERNATIVE_SERVICE_NOT_CONFIGURED`).  
Bu yüzden `google-with-phone.png` canlı aday listesi yerine operasyonel boş/kapalı mesajını gösterir. Production’da anahtar açıkken telefonsuz adaylar listelenmez.

**Dosya:** `google-with-phone.png`

---

## 2) Matbu logo + terminoloji

### Logo
- Yeni evrak: `document-branding` resmi PNG’yi absolute `APP_URL/meridyen-logo-original.png` ile yazar (kırık relative upload yolu kullanılmaz).
- `/evrak/[token]` görüntülemede `prepareTrustedDocumentHtml` meridyen-logo `src` değerini `/meridyen-logo-original.png` yapar (eski kırık host’lar düzelir).
- Kanıt: `logoSrc=/meridyen-logo-original.png`, `logoNaturalWidth=1024`.

### İş özeti
- Cost entry açıklamalarından **Alış Fiyatı / Satış Fiyatı / kâr** etiketleri filtrelenir.
- Yoksa dosya notu; o da yoksa `{Hizmet Türü} Hizmeti Tamamlandı.`
- Toplam tutar: yalnızca **gelir** (müşteri satış bedeli); alış+satış toplamı değil.

### Telefon / Tedarikçi
- `customerPhone` ve `assignedVendor.name` (+ varsa vendor phone) doldurulur.
- Seed dosyada bu alanlar boş → formda `—` (veri yok; mapping hatası değil).

**Dosya:** `matbu-logo-fixed.png`  
Alış/satış sızıntısı: **yok** (`hasAlisLeak: false`).

---

## 3) Dijital onay — nasıl çalışır (bugün)

1. Operasyon panelinde **Matbu Evrak** oluşturulur (`file-documents` → `matbu_evrak`).
2. Sistem `publicToken` üretir (varsayılan ~30 gün).
3. Müşteri linki: `/evrak/[token]` (WhatsApp ile de gönderilir).
4. Müşteri formu görür → **Onayla** → ad soyad yazar → `digitallyApprovedAt` + imza kaydı.
5. Acil dosyada **zorunlu checklist** matbu dijital onayını bekler (`matbuEvrakDigitallyApproved`).
6. Onay sonrası aynı token tekrar açılırsa «daha önce onaylandı» gösterilir.

### Bilinen boşluklar
- Eski (düzeltmeden önce üretilmiş) matbu HTML’leri alış/satış sızıntısı taşıyorsa **yeniden oluşturmak** gerekir; görüntüleme yalnızca logo `src` rewrite yapar, metin içeriğini değiştirmez.
- Local’de Places anahtarı yoksa Google Alternatifleri aday döndürmez (yapılandırma mesajı).
- Seed / eksik dosya verisinde telefon veya tedarikçi boş kalabilir; bu form alanı mapping’i değil veri eksikliğidir.

---

## 4) Kaydet Ve Kapat

- `acil-yardim/[id]/page.tsx` içinde Dosya Bütçesi kartında mevcut (`data-testid="fiyat-kaydet-ve-kapat"`).
- Desktop 1440’ta görünür; gizli class / breakpoint yok.
- **Dosya:** `butce-kaydet-ve-kapat.png` — metin: `Kaydet Ve Kapat`, `visible: true`.

Matbu sayfasına bu buton eklenmedi (talimat: invent etme).

---

## Değişen dosyalar

1. `apps/backend/src/modules/vendor-discovery/vendor-discovery.service.ts` — telefon çıkarımı + Details + filtre
2. `apps/backend/src/modules/file-documents/file-documents.service.ts` — matbu özet / tutar / tedarikçi
3. `apps/backend/src/common/utils/document-branding.ts` — resmi logo yolu
4. `apps/web/src/utils/sanitize-html.ts` — evrak logo rewrite
5. `apps/web/scripts/capture-epic05-prod-feedback-20260717.mjs` — kanıt scripti
6. Bu klasör: ekran görüntüleri + `EVIDENCE.json` + `RAPOR.md`

## Test

- Backend / web `tsc --noEmit`: PASS
- Capture script: Kaydet Ve Kapat görünür; matbu logo yüklenir; alış sızıntısı yok
- Alternative-search local: `ALTERNATIVE_SERVICE_NOT_CONFIGURED` (Places key yok)

## Sonraki adım (Mustafa)

- Places anahtarı production’da açıkken Google Alternatifleri listesini doğrula (telefonsuz aday olmamalı).
- Eski matbuları müşteriye göndermeden önce yeniden oluştur.
- Deploy istenirse ayrıca onay.

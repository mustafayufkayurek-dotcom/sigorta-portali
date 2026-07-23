# Ürün Kararı — Dosya Sorumlusu Merkezi = Ortak Operasyon Yönetimi

**Durum:** Mimari onaylı · kilitli (Mustafa — 2026-07-23)  
**Kaynak kural:** `.cursor/rules/dosya-sorumlusu-ortak-operasyon.mdc`  
**Yüzey:** Mevcut `/panel` Dosya Sorumlusu Merkezi (yeni ekran / yeni modül yok)

---

## Temel cümle

Dosya Sorumlusu Merkezi yalnız Hasar’a özel bir ekran değildir.  
**Meridyen Operasyon Platformunun ortak operasyon yönetim ekranıdır.**

---

## Ne yapılır

- Geliştirmeler **Hasar Dosyaları** ve **Acil Yardım Dosyaları** başta olmak üzere mevcut operasyon akışlarında **ortak** kullanılacak şekilde tasarlanır.
- Aynı ekran iskeleti korunur; değişen yalnız **gelen veri** ve **iş kurallarıdır**.
- Hasar ile Acil Yardım arasında tasarım dili ayrışmaz.
- Mevcut ürün mimarisi korunur; mevcut iş kuralları değiştirilmez — ortak operasyon yönetimi güçlendirilir.

## Ne yapılmaz

- Yeni modül oluşturma
- Yeni ekran / yeni ürün kurgusu
- Yeni tasarım üretme
- Hasar’a özel ayrı bir «sorumlu merkezi» ile Acil’e özel ayrı ekran
- Bekleyen Operasyonlar’ı yalnız «uyarı listesi» olarak küçültmek
- **Admin / Yönetim / varsayılan operasyon / saha dashboard’larının amacı, yerleşimi veya davranışını değiştirmek**

### Ekran izolasyonu (kilitli)

| Yüzey | Bu geliştirme |
|-------|----------------|
| Dosya Sorumlusu Merkezi (`office_staff`) | ✅ UX burada |
| Yönetim Dashboard (`management`) | ❌ dokunulmaz |
| Varsayılan operasyon dashboard (`default`) | ❌ dokunulmaz |
| Saha Operasyon Merkezi (`field_staff`) | ❌ dokunulmaz |

Ortak component / util kullanılabilir; **başka dashboard’a davranış sızdırılmaz**.
`PendingOperationsPanel` yalnız `office_staff` layout’unda mount edilir.

---

## Bekleyen Operasyonlar

### Rol (kilitli)

**Uyarı listesi değildir.**  
Dosya Sorumlusunun **günlük operasyon yönetim alanıdır** — mevcut ortak operasyon ekranı mantığı içinde yaşar.

### Uygulama notu (local · 2026-07-23)

- Yüzey: mevcut `/panel` Dosya Sorumlusu Merkezi (`PendingOperationsPanel`)
- Öncelik motoru: `pending-operations-priority` + `working-time-sla`
- Kaynak birleşimi: mevcut pending-actions + onay gecikmeleri + finans kuyruğu
- **UI:** günlük görev merkezi — yalnız ilk 5 kritik; **Tümünü Gör** ikinci seviye
- Satır: bekleyen işlem · iş günü · neden kritik · operasyon aksiyonu (Onay Talep Et, Eksperi Hatırlat…)
- KPI tekrarı yok; gelir/akış sade ipucu
- Yerel önizleme: `?demo=bekleyen-operasyonlar` (yalnız localhost)

### Ortak altyapı (aynı mantık)

Örnekler; hepsi aynı Bekleyen Operasyonlar altyapısında yönetilir:

- Sigorta şirketi onayı gecikmesi  
- Eksper rapor gecikmesi  
- Tedarikçi teklif gecikmesi  
- Finansa aktarım bekleyen dosya  
- Müşteri evrak bekleyen dosya  
- (ve benzeri: asistans bekleyen işlem vb.)

### Öncelik sıralaması

Yalnız süreye göre **değildir**. Öncelik şunlara göre hesaplanır:

1. **Şirket gelirine etki**  
2. **Operasyon akışına etki**  
3. **SLA / süre** (çalışma günü + çalışma saati ile)

### SLA ve kritiklik

| Seviye | Anlam |
|--------|--------|
| Yeşil | Normal |
| Sarı | Yaklaşan gecikme |
| Kırmızı | Kritik gecikme |

- SLA hesabı **çalışma günleri ve çalışma saatleri** dikkate alınarak yapılır.
- Kritik seviyeye ulaşan işlemler ekranda **görsel öncelik** kazanır.
- Gerektiğinde Dosya Sorumlusundan **aksiyon alınması** istenir.

---

## Uygulama disiplini

1. Önce mevcut Dosya Sorumlusu Merkezi ve ilgili liste/detay yüzeyleri incelenir.
2. Ortak bileşen / ortak veri modeli tercih edilir; kopya ekran açılmaz.
3. Feature Freeze (DASH-D) altındaki kabuğa dokunulacaksa uygulama başlangıcı için Mustafa onayı alınır.
4. Canlıya alma: yalnızca onaylı kapsam; Dalga 2 / alakasız WIP karışmaz.

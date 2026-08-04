# Ürün Notu — Performans Yönetimi: Onay Mesajlaşması

**Tarih:** 2026-08-04  
**Başlangıç:** 2026-08-05 (yarın)  
**Durum:** Not alındı — yarın başlanacak. Kod henüz yazılmadı.

## Karar (Mustafa)

Bekleyen Onaylar akışında **çift yönlü mesaj** olacak:

1. **Yönetici** mesaj yazabilsin.
2. **Personel** cevap yazabilsin.

Tek yönlü “yalnız yönetici notu” değil — karşılıklı yazışma.

## Bağlam (bugün tamamlanan / devam eden UI)

- Performans Yönetimi KPI pencereleri: ikon sağ üst, başlık/değer ortalı.
- Bekleyen Onaylar: personel, dosya, bedel, gecikme süresi, talep sayısı.
- Dosya tıklanınca: talep edilmiş mi, tarih/saat, kaç defa talep.
- Lokal önizleme: `/dev/performans-onay-tasarim`
- Panel: `/panel/personel-yonetimi` (+ `?tasarim=1` örnek veri)

## Yarın yapılacak (kapsam B)

- Onay detay panelinde mesaj listesi + yazma alanı (yönetici ve personel).
- Kayıt / okuma API (mevcut atama / bildirim altyapısına mümkün olduğunca bağlan).
- Personelin kendi ekranından da görebilmesi / cevap verebilmesi.
- Migration ihtiyacı çıkarsa → önce Mustafa onayı.

## Yapılmayacak (şimdilik)

- Genel şirket içi chat / WhatsApp tarzı ayrı mesajlaşma ürünü.
- Deploy — yarın iş bitince ayrıca onay.

## Tahmini süre

Karşılıklı yazışma (kapsam B): yaklaşık **1+ gün** (UI + API + personel tarafı görünürlük).

# Yönetim Dashboard MASTER — Lokal Teslim Notu (2026-07-20)

## Referans (bağlayıcı)
- `00-referans-master-v3-20260720-2215.png` — **güncel** (`Ekran_Resmi_2026-07-20_22.15.21`)
- `00-referans-master-v2-20260720.png` — önceki MASTER
- Üst/alt «Tasarım Düzeltme Talimatı» panelleri **ürün UI değildir** (yalnızca ölçü/stil).

## Lokal kanıt
- Route: `/panel` (yalnız management layout)
- Viewport: `01-lokal-viewport-1440x900.png`
- Full page: `02-lokal-fullpage.png`

## Yerleşim (talimat)
A Header + dönem filtreleri + Yönetim Özeti  
B 6 KPI (yükseklik 84px, değer 20px, hover `scale(1.03)`)  
C Yönetici Özeti (hücre 72px + Detayları Gör →)  
D 3 grafik (280px; donut legend % + ₺; Kâr çizgisi yeşil)  
E Departman (420px sticky + Toplam) | Personel (avatar + yeşil başarı + Tüm Personeli Gör) | Hızlı İşlemler (48px dolu buton: mavi/mor/yeşil/sarı/turuncu) + SLA (160px / Hedef %85 / Detayları Gör)  
F Footer: Son Güncelleme + 5 dk yenileme notu  

## Veri
Referans önizleme (`reference-preview.ts`) — görsel kabul için. API bağlanınca gerçek kaynağa geçilir.

Commit / push / deploy ayrı onay ister.

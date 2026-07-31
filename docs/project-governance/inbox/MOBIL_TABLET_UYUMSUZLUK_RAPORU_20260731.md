# Cep / Tablet Uyumsuzluk Raporu

**Tarih:** 31 Temmuz 2026  
**Kapsam:** Panel web — telefon + tablet (kod taraması)  
**Deploy:** Bu rapordaki A+B maddeleri local uygulandı — **tek paket onayından sonra** canlıya alınacak.  
**Kaynak şikâyet:** Mobilde Operasyon alt menü; Hasar Dosyaları “web tasarımı gibi değil”; yerleşim bozulmaları.

---

## Yönetici özeti

Parça hotfix’ler (menü, profil, çıkış) yeterli regresyon kapısı olmadan canlıya alındı.  
Sonuç: bir düzeltme diğer ekranı / kabuğu etkiledi; liste ekranlarında mobilde **daraltılmış masaüstü tablosu** hissi sürüyor.

**İyi örnekler (korunacak):** Tedarikçiler (mobil kart), CRM master-detail, panel kabuğu `MOBILE_SHELL_LOCK` (local v423 accordion + fixed menü — henüz canlıda değilse sonraki pakette).

---

## Öncelik matrisi

| # | Ekran | Sorun | Ciddiyet | Kullanıcı etkisi |
|---|--------|--------|----------|------------------|
| 1 | Hasar Dosyaları | Tablet (≥768px) 14 kolonlu masaüstü tablo (~1740px minWidth); telefon kartı sade | **KRİTİK** | “Web tasarımı olmayan ekran” şikâyeti |
| 2 | Operasyon | KPI `grid-cols-4` telefonda; mobil kart yok, yalnız yatay tablo | **KRİTİK** | Okunmaz KPI + kaydırmalı tablo |
| 3 | Müşteriler | Mobil kart yok | **YÜKSEK** | Daraltılmış tablo |
| 4 | Hasar header | Aksiyonlar wrap yok (Revizyon / Rapor / Yeni) | **YÜKSEK** | Üst bar taşması |
| 5 | Operasyon araç çubuğu | `flex-nowrap` + yoğun kontroller | **YÜKSEK** | Yatay kaydırma zorunlu |
| 6 | Yönetim Dashboard | Departman tablosu `min-w-[980px]` | **YÜKSEK** | Yatay “excel” görünümü |
| 7 | Finans KDV | `min-w-[1000px]` | **YÜKSEK** | Aynı pattern |
| 8 | Hasar loading | Skeleton tablo (kart yok) | **ORTA** | İlk yüklemede kötü his |
| 9 | Hasar mobil kart | Konu / öncelik / tedarikçi eksik | **ORTA** | Yarım ekran hissi |
| 10 | Mgmt personel tablosu | `min-w-[640px]` | **ORTA** | Tablet sıkışıklığı |
| 11 | Topbar ikon sırası | Arama + bildirim + profil + burger | **ORTA** | Dar telefonda sıkışma |
| 12 | CRM liste metrikleri | `grid-cols-3` dar | **ORTA** | Okunabilirlik |
| 13 | CRM / Tedarikçi kart | — | **DÜŞÜK** | Referans alınacak |

---

## Detay — Hasar Dosyaları (şikâyet odağı)

**Dosya:** `apps/web/src/app/panel/hasar-dosyalari/page.tsx`

- Telefon: `md:hidden` kart listesi var ama alan seti masaüstünden zayıf.
- Tablet: `hidden md:block` → tam tablo + `panelTableLayoutStyle` geniş minWidth + `whitespace-nowrap`.
- Kullanıcı iPhone’da bile “masaüstü tabloyu yana kaydır” deneyimine düşebiliyor (breakpoint / viewport).

**Düzeltme yönü (onay sonrası):**  
Kart görünümünü `lg:` sınırına çekmek **veya** tablet kompakt kolon seti; header `flex-wrap`; mobil kart alanlarını zenginleştirmek; loading skeleton’u kart/tablo ayırmak.

---

## Detay — Operasyon

**Dosya:** `apps/web/src/app/panel/operasyon/page.tsx`

- `grid-cols-4` KPI bandı telefonda okunmaz.
- Hasar’daki gibi mobil kart satırı yok.

**Düzeltme yönü:** `grid-cols-2 sm:grid-cols-4 xl:grid-cols-8` + mobil kart liste.

---

## Detay — Yönetim Dashboard (gönderilen ekran)

Gönderilen görüntü: KPI 2 kolon, dönem chip’leri kaydırılabilir — **kabul edilebilir yoğunluk**.  
Asıl risk alt bölümlerdeki geniş tablolar (`MgmtDepartmentTable` vb.) ve Safari alt çubuğunun içerik kesmesi (safe-area).

---

## Kabuk / menü (ayrı paket maddeleri — birleştirilecek)

| Madde | Durum |
|--------|--------|
| Profil dropdown overflow clip | Canlı v420 |
| Logout şifre kilidi | Canlı v421 |
| Mobil Operasyon alt link (hep açık) | Canlı v422 — **yanlış UX** |
| Accordion + fixed menü paneli (`MOBILE_SHELL_LOCK`) | **Local hazır (v423 adayı)** — canlıya tek pakette |
| Kalıcı kural | `.cursor/rules/mobil-kabuk-kilit.mdc` |

---

## Ortak kök neden

1. Liste ekranlarında varsayılan: **masaüstü tablo + overflow-x** = “mobil web değil, dar masaüstü”.  
2. İyi örnek (Tedarikçi kart) tüm listelere yayılmamış.  
3. Parça deploy + dar regresyon listesi (yalnız kabuk) → içerik ekranları kaçtı.

---

## Önerilen ortak canlı paketi (onayınla)

**A — Kabuk (zorunlu, hazır/local):**  
Mobil menü accordion + fixed panel (v423).

**B — Liste mobil standardı (KRİTİK/YÜKSEK):**  
1. Operasyon KPI 2 kolon + mobil kart  
2. Hasar tablet/kart + header wrap  
3. Müşteriler mobil kart  

**C — Dashboard / Finans (YÜKSEK, sonraki dilim veya aynı paket):**  
Departman / KDV geniş tablo alternatifleri.

Sıra önerisi: önce **A+B** birlikte local doğrulama → senin mobil/tablet kabulün → **tek web-only deploy**.

---

## Bundan sonraki süreç kilidi

1. Cep/tablet regresyon kapısı olmadan parça deploy yok.  
2. Liste ekranı değişince: telefon kart **veya** bilinçli kompakt kolon — “sadece overflow-x” kabul değil.  
3. Teslimatta kontrol: Login · Logout · Profil · Mobil Menü · Operasyon alt · Hasar liste · Dashboard.

**Deploy durumu bu rapor için:** Beklemede — senin paket onayı.

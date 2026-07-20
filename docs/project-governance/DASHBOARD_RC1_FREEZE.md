# Meridyen Dashboard RC1 — Resmi Kabul, Dondurma (Freeze) ve Geliştirme Politikası

**Tarih:** 15 Temmuz 2026  
**Durum:** **Frozen** · RC1 ACCEPTED · Architecture LOCKED · Design System LOCKED  
**Canlı (web):** `v357-dashboard-rc1-freeze` · image `sigorta-web:…-v357-amd64` · commit `65734ac`  
**Canlı (backend):** `v356` · image `app-backend:…-v356-amd64`  
**Kapanış raporu:** `docs/project-governance/canli-kabul/DASHBOARD_RC1_RELEASE_KAPANIS_20260715.md`  
**Doğrulama:** Role / Brand / Responsive / Theme / Shared Components — **PASS**  
**Kaynak checklist:** `docs/project-governance/canli-kabul/ONAYLI_UI_CHECKLIST.md`  
**Production ürün kabulü:** `docs/project-governance/PRODUCTION_URUN_KABULU.md` (kullanıcı kabul eder; Cursor prod login/credential istemez)  
**Yeni odak:** EPIC-02 – Hasar Dosyası Enterprise UX

---

## Durum

Dashboard RC1 kullanıcı tarafından kabul edilmiştir ve **Frozen** işaretlenmiştir (canlı web **v357**).

Yapılan teknik doğrulamalar sonucunda:

- Dashboard mimarisi kabul edilmiştir.
- Design System kabul edilmiştir.
- Ortak Component yapısı kabul edilmiştir.
- Rol standardizasyonu kabul edilmiştir.
- Responsive davranış kabul edilmiştir.
- Tema sistemi kabul edilmiştir.
- Ortak BrandLogo yapısı kabul edilmiştir.

Dashboard artık Meridyen'in resmi Dashboard standardıdır.

---

## 1. Dashboard Freeze

Bu politika ile birlikte Dashboard geliştirmesi dondurulmuştur.

Dashboard bundan sonra yeniden tasarlanmayacaktır.

Aşağıdakiler kalıcı mimari karar olarak kabul edilmiştir:

- Header
- Sidebar
- Dashboard Layout
- KPI Yerleşimi
- Grid
- Typography
- Spacing
- Theme Mimarisi
- Design Token Yapısı
- Ortak Dashboard Shell

---

## 2. Ortak Dashboard Standardı

Bütün panel kullanıcıları aynı Dashboard mimarisini kullanacaktır.

Fark yalnızca:

- Widget görünürlüğü
- Yetki
- Veri
- Rol bazlı aksiyonlar

olacaktır.

- Yeni Header oluşturulmayacaktır.
- Yeni Sidebar oluşturulmayacaktır.
- Yeni Dashboard Layout oluşturulmayacaktır.

---

## 3. Portal Politikası

Eksper, Sigorta ve gelecekte oluşturulacak diğer portal Dashboard'ları aynı Dashboard Shell'i kullanacaktır.

Yeni portal oluşturulduğunda:

- Admin Dashboard referans alınacaktır.
- Yeni Dashboard tasarımı yapılmayacaktır.

---

## 4. Ortak Component Zorunluluğu

Dashboard ile ilgili bütün yeni geliştirmeler mevcut ortak component yapısı üzerinden yapılacaktır.

- Aynı component yeniden yazılmayacaktır.
- Yeni kopyalar oluşturulmayacaktır.
- Tekrar eden component kabul edilmeyecektir.

---

## 5. Marka Standardı

Meridyen kurumsal logosu tek marka kaynağıdır.

Hiçbir ekranda:

- AI tarafından oluşturulmuş logo
- Yeniden çizilmiş logo
- Farklı font
- Farklı renk
- Farklı oran

kullanılmayacaktır.

Header, Sidebar, Login, Loading, Splash, Favicon, E-posta ve PDF aynı kurumsal marka standardını kullanacaktır.

Tek bileşen: `BrandLogo` · tek asset: `/meridyen-logo-original.png` (`constants/brand.ts`).

---

## 6. KPI Prensibi

- KPI kartları büyütülmeyecektir.
- Dashboard ekran hâkimiyeti korunacaktır.
- KPI kartları yalnızca özet bilgi sunacaktır.
- Dashboard hiçbir zaman KPI ekranına dönüşmeyecektir.

---

## 7. Sidebar Prensibi

Sidebar ölçüleri kalıcıdır.

| Durum | Genişlik |
|-------|----------|
| Expanded | **260 px** |
| Collapsed | **72 px** |

Kaynak: Enterprise Sol Menü referans 2026-07-20 (Mustafa). Bu standart değiştirilmeyecektir.

---

## 8. Yeni Geliştirme Kuralları (İzinli)

Dashboard üzerinde bundan sonra yalnızca aşağıdaki geliştirmelere izin verilir:

- Bug Fix
- Widget ekleme
- Veri kaynağı geliştirmesi
- Yetki geliştirmesi
- Performans iyileştirmesi
- Güvenlik iyileştirmesi
- Erişilebilirlik iyileştirmesi
- Kullanıcı geri bildirimi doğrultusunda küçük UX geliştirmeleri

---

## 9. Yasaklı Geliştirmeler

Aşağıdaki değişiklikler yeni mimari kararı (Mustafa onayı) olmadan yapılamaz:

- Yeni Dashboard Layout
- Yeni Sidebar
- Yeni Header
- KPI yapısını değiştirmek
- Yeni Theme mimarisi
- Rol bazlı farklı Dashboard tasarlamak
- Ortak componentleri kopyalamak
- Dashboard Shell'i değiştirmek

---

## 10. Yeni Modül Politikası

Bundan sonra geliştirilecek:

- Hasar
- Operasyon
- Finans
- CRM
- Personel
- Mobil
- Gelecekteki Portal Modülleri

Dashboard RC1 standardını kullanacaktır.

Yeni modüller Dashboard tasarlamayacaktır; mevcut Dashboard standardını kullanacaktır.

---

## 11. Geliştirme Süreci

Yeni geliştirme süreci aşağıdaki sırayı takip edecektir:

```
İhtiyaç
  ↓
Teknik Talimat
  ↓
Kod
  ↓
Gerçek Local Doğrulama
  ↓
Gerçek Browser
  ↓
Gerçek DOM
  ↓
PASS / FAIL
  ↓
Kullanıcı Onayı
  ↓
Commit
  ↓
Push
  ↓
Deploy
  ↓
Health Check
  ↓
Smoke Test
```

Bu sıra değiştirilmeyecektir. Commit / push / deploy yalnızca kullanıcı onayı sonrası yapılır.

---

## 12. Kalıcı Mimari Karar

Meridyen Dashboard artık tek bir ekran değildir.

Meridyen Dashboard; Kurumsal Dashboard Standardıdır.

- Bundan sonra Dashboard yeniden tasarlanmayacaktır.
- Dashboard yalnızca geliştirilecektir.

Bu karar Meridyen Platform Mimarisi'nin kalıcı kararı olarak kabul edilmiştir.

---

## 13. Yeni Odak

Dashboard RC1 tamamlanmıştır.

Bundan sonraki geliştirme odağı aşağıdaki sıraya taşınacaktır:

1. Hasar Dosyası
2. Operasyon Dosyası
3. CRM
4. Finans
5. Personel
6. Mobil Deneyim

Dashboard üzerinde yalnızca doğrulanmış hata düzeltmeleri ve küçük fonksiyonel geliştirmeler yapılacaktır.

**Yeni geliştirme Epic'i:** EPIC-02 – Hasar Dosyası Enterprise UX  
(Inbox yönlendirme: `docs/project-governance/inbox/EPIC-02_HASAR_DOSYASI.md`)

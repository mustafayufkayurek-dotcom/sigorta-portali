# Dosyalarım Ekranı — Kod Tabanı Eşlemesi

- KPI kartları: Bu ekranda yok. Ana Eksper Paneli'ndeki KPI'lar `apps/web/src/app/panel/eksper-portal/page.tsx` içindedir; Dosyalarım facelift kapsamına alınmadı.
- Filtre alanı: Görsel filtre bileşeni yok. Kuyruk filtresi `apps/web/src/app/panel/eksper-portal/dosyalar/page.tsx` içindeki URL `queue` parametresi ile çalışır.
- Tablo/liste: Masaüstü tablo `apps/web/src/app/panel/eksper-portal/dosyalar/page.tsx`; mobil liste `apps/web/src/components/portal/PortalMobileFileList.tsx`.
- Durum badge'leri: Ortak `StatusBadge` kullanılmıyor. Dosyalarım için ortak görsel yardımcı `apps/web/src/utils/enterprise-list-facelift.ts` içindeki `enterpriseStatusBadgeClass`.
- İkon kütüphanesi: Proje standardı `lucide-react`. Hasar türü ikonları `damageTypeIcon` ile bu kütüphaneden seçilir.
- Sigorta şirketi görünümü: Logo kullanılmaz. `insuranceCompanyAvatar`, şirket adına göre deterministik kısaltma ve renk sınıfı üretir.

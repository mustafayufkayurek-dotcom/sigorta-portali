# Hasar 1. Perde — Kullanılan Component Listesi — 2026-07-19

**Kaynak:** `apps/web/src/app/dev/hasar-operasyon-kontrol-merkezi/page.tsx`  
**Referans:** `26-viewport-aktif-rozet-20260719.png`  
**Not:** Yeni React paketi yok. Tüm UI yerel fonksiyon/komponent + Tailwind.

## Sayfa

| Ad | Tür | Rol |
|----|-----|-----|
| `HasarOperasyonKontrolMerkeziPreviewPage` | default export | Ana ekran; production’da `notFound()` |

## Yerel komponentler

| Ad | Rol |
|----|-----|
| `DosyaBaglamBar` | Drawer üstü dosya bağlam şeridi (Dosya No, Hasar Türü, …) |
| `OpStatusCard` | 6’lı grid operasyon kartı (durum, ana buton, Düzenle, Sonraki Aşama) |
| `AktifGorevRozet` | Aktif kart sol üst mavi rozet — `Aktif Görev` |
| `Pill` | Durum rozeti (green / orange / red / blue / gray) |
| `StagePassButton` | `Sonraki Aşamaya Geç` / kilitli |
| `DrawerShell` | Sağ drawer kabuğu (overlay + aside; popup yok) |
| `ActionBtnIcon` | Kart ana buton SVG ikonu |
| `QuickIcon` | Hızlı İşlemler ikonları |
| `IconPhone` | Telefon SVG |
| `IconWa` | WhatsApp SVG |

## Yardımcı fonksiyonlar (UI state, mock)

| Ad | Rol |
|----|-----|
| `cardUiState` | Kart UI: bekliyor / devam / tamamlandi / sonraki_asama |
| `cardFocus` | Odak: active / done / waiting / future |
| `actionIconKindForLabel` | Buton etiketinden ikon türü |
| `buildGuide` | Alt şerit 6 adım (done / active / future) |
| `filterAndSortTespitci` | Tespitçi drawer filtre/sıra (mock) |
| `parseTrDate` | TR tarih parse (mock sıralama) |

## Sayfa içi bölümler (inline, ayrı export yok)

- Kilit banner (`1. Perde Kilitli · Referans`)
- Sol menü (lg+)
- Üst başlık + Drawer Standardı notu
- Dosya Özeti
- Bugünkü Görev (mavi çerçeve) + Şimdi Yap
- 6’lı operasyon grid: Randevu, Tespitçi, Tedarikçi, WhatsApp, Dijital Onay, Rapor
- Hızlı İşlemler
- Zorunlu İşlemler
- Notlar & Hatırlatmalar
- Alt Operasyon Şeridi + Sonraki Perdeye Geç (Kilitli)
- Drawer içerikleri: tespitçi / tedarikçi / whatsapp / dijital-onay / randevu

## Stil kuralları (sayfa `<style>`)

| Sınıf | Anlam |
|-------|--------|
| `anim-pulse` | Aktif kart / zorunlu aktif satır soft blue glow |
| `anim-amber` | Turuncu soft glow (bekleyen vurgu) |
| `t-fast` | Buton geçiş 180ms |
| `t-card` | Kart hover lift |
| `drawer-enter` | Drawer slide-in |

## Renk / ikon dili (özet)

- Mavi: aktif odak (Bugünkü Görev çerçeve, aktif kart, aktif buton, şerit aktif)
- Turuncu: İşlem Bekliyor
- Yeşil: tamamlanan / başarı CTA
- Gri: pasif / gelecek
- İkon: stroke SVG (`ActionBtnIcon` / `QuickIcon`); emoji yok

## Responsive (korunan)

| Kırılım | Davranış |
|---------|----------|
| `< lg` | Sol menü gizli |
| `sm` / `md` | Dosya özeti kolonları, padding |
| `xl` | Ana 9 + sağ 3 kolon; grid 3 sütun |
| `sm:grid-cols-2` | Tablet: 2 sütun kart |
| `grid-cols-1` | Mobil: tek sütun |

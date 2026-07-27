# Ürün Kararı — Portal Operasyon Dili (Eksper / Sigorta)

**Tarih:** 2026-07-23  
**Durum:** Kilitli  
**Sahip:** Mustafa

## Temel kural

Eksper Portalı ve Sigorta Portalı **aynı tasarım dilini** (kabuk, header, tablo, spacing) kullanır.  
**Operasyon dili rol bazlıdır** — aynı ekran kalıbı, farklı bakış açısı.

## Eksper Portalı

Eksper ekranlarında dil, **eksperin bakış açısını** yansıtır.

| Kullanma | Kullan |
|----------|--------|
| Atanmış Dosyalar | Dosyalarım |
| Atanmış Dosya | Dosyam / Dosyalarım |
| Size atanan dosyalar | İhbarını Yaptığım Dosyalar / İşlem Yaptığım Dosyalar |

Örnek menü / başlık dili:

- Dosyalarım
- İhbarını Yaptığım Dosyalar
- İşlem Yaptığım Dosyalar

## Sigorta Şirketi Portalı

«Atanmış Dosyalar» kavramı **Sigorta Şirketi Portalına aittir.**  
Sigorta ekranlarında bu ifade kullanılır.

## Uygulama

1. Nav, KPI, badge, boş durum, breadcrumb — rol diline uyumlu olmalı.
2. Kod değişkeni (`assignedCount` vb.) teknik kalabilir; **kullanıcıya görünen metin** kurala uyar.
3. Yeni portal ekranı eklenirken önce bu tabloya bakılır.

## Kapsam dışı

- Hasar Dosya Sorumlusu / Yönetim / Saha panelleri bu kararla değişmez.
- Tasarım kabuğu (PortalPageHeader, DashboardShell) mevcut onaylı UI ile uyumlu kalır.

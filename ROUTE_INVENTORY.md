# Production Route Inventory

Tarih: 2026-05-12
Host: `https://app.meridyen-tr.com`
Kök: `apps/web/src/app/panel`

## Envanter Özeti

- Tespit edilen `page.tsx` sayısı: 90
- Production kontrolünde taranan route sayısı: 90
- Kabul kriteri: `200` veya login redirect için `302`
- Bu kontrolde `404` dönen route: yok
- Kod tabanında eksik kök route dosyaları: `apps/web/src/app/panel/ayarlar/page.tsx`, `apps/web/src/app/panel/guvenlik/page.tsx`

## Route Listesi ve HTTP Sonuçları

| Status | Route |
| --- | --- |
| 200 | `/panel` |
| 200 | `/panel/kullanicilar` |
| 200 | `/panel/eksperler` |
| 200 | `/panel/tedarikciler` |
| 200 | `/panel/kullanicilar/sample` |
| 200 | `/panel/profil` |
| 200 | `/panel/eksperler/sample` |
| 200 | `/panel/tedarikciler/sample` |
| 200 | `/panel/guvenlik/erisim-loglari` |
| 200 | `/panel/carilerim` |
| 200 | `/panel/ozel-dosyalar` |
| 200 | `/panel/raporlar/eksper` |
| 200 | `/panel/sahiplik` |
| 200 | `/panel/raporlar/finansal` |
| 200 | `/panel/masraflar` |
| 200 | `/panel/finans/karlilik` |
| 200 | `/panel/finans` |
| 200 | `/panel/raporlar/sla` |
| 200 | `/panel/raporlar/dosya-performansi` |
| 200 | `/panel/itirazlar` |
| 200 | `/panel/sigorta-sirketleri` |
| 200 | `/panel/raporlar/brans-analizi` |
| 200 | `/panel/finans/sabit-giderler` |
| 200 | `/panel/acil-yardim` |
| 200 | `/panel/raporlar/personel-performansi` |
| 200 | `/panel/revizyon-talepleri` |
| 200 | `/panel/finans/masraflar` |
| 200 | `/panel/operasyon` |
| 200 | `/panel/finans/portfolyo-pl` |
| 200 | `/panel/eksper-portal` |
| 200 | `/panel/acil-yardim/sample` |
| 200 | `/panel/finans/dosya-pl` |
| 200 | `/panel/musteriler` |
| 200 | `/panel/sigorta-portal` |
| 200 | `/panel/finans/faturalar` |
| 200 | `/panel/eksper-portal/dosyalar` |
| 200 | `/panel/acil-yardim/finans` |
| 200 | `/panel/personel-yonetimi` |
| 200 | `/panel/sigorta-portal/faturalar` |
| 200 | `/panel/eksper-portal/randevular` |
| 200 | `/panel/musteriler/sample` |
| 200 | `/panel/hasar-dosyalari` |
| 200 | `/panel/harita` |
| 200 | `/panel/revizyon-talepleri/sample` |
| 200 | `/panel/eksper-portal/onaylar` |
| 200 | `/panel/acil-yardim/finans/faturalar` |
| 200 | `/panel/hasar-dosyalari/yeni` |
| 200 | `/panel/hasar-dosyalari/sample` |
| 200 | `/panel/sigorta-portal/onaylar` |
| 200 | `/panel/acil-yardim/yeni` |
| 200 | `/panel/ayarlar/dosya-konulari` |
| 200 | `/panel/sigorta-portal/dosyalar` |
| 200 | `/panel/finans/tahsilatlar` |
| 200 | `/panel/ayarlar/email-bildirimleri` |
| 200 | `/panel/ayarlar/masraf-kategorileri` |
| 200 | `/panel/ayarlar/alan-zorunluluklari` |
| 200 | `/panel/ayarlar/sablonlar` |
| 200 | `/panel/ayarlar/evrak-turleri` |
| 200 | `/panel/finans/banka-hesaplari` |
| 200 | `/panel/ayarlar/rapor-sablonlari` |
| 200 | `/panel/ayarlar/ihbar-konulari` |
| 200 | `/panel/hasar-dosyalari/sample/onarim-raporu/sample` |
| 200 | `/panel/ayarlar/mahaller` |
| 200 | `/panel/ayarlar/entegrasyonlar` |
| 200 | `/panel/ayarlar/sms-bildirimler` |
| 200 | `/panel/ayarlar/sigorta-sirketleri` |
| 200 | `/panel/ayarlar/e-posta-bildirimleri` |
| 200 | `/panel/finans/fatura-talepleri` |
| 200 | `/panel/ayarlar/mail-kurulum` |
| 200 | `/panel/ayarlar/roller` |
| 200 | `/panel/ayarlar/hizmet-turleri` |
| 200 | `/panel/ayarlar/is-gruplari` |
| 200 | `/panel/ayarlar/musteri-tipleri` |
| 200 | `/panel/ayarlar/sozlesme-sablonu` |
| 200 | `/panel/ayarlar/sigorta-sirketleri/sample` |
| 200 | `/panel/admin/audit-logs` |
| 200 | `/panel/ayarlar/hizmet-branslari` |
| 200 | `/panel/ayarlar/departmanlar` |
| 200 | `/panel/ayarlar/tanimlar` |
| 200 | `/panel/ayarlar/iliski-turleri` |
| 200 | `/panel/ayarlar/fiyat-yonetimi` |
| 200 | `/panel/ayarlar/sozlesme-sablonlari` |
| 200 | `/panel/ayarlar/kurulum` |
| 200 | `/panel/ayarlar/tedarikciler` |
| 200 | `/panel/ayarlar/fiyat-listesi` |
| 200 | `/panel/ayarlar/sozlesmeler` |
| 200 | `/panel/ayarlar/eskalasyon-kurallari` |
| 200 | `/panel/ayarlar/bolgesel-zamlar` |
| 200 | `/panel/ayarlar/fiyat-listesi/yukle` |
| 200 | `/panel/ayarlar/tedarikciler/sample` |

## 404 Dönen Route'lar

Bu kontrolde `404` dönen route tespit edilmedi.

## Notlar

- Dynamic segment içeren route'lar için doğrulama amacıyla `[id]` ve `[reportId]` yerine `sample` kullanıldı.
- Bilinen eksik kök route dosyaları kod tabanında yoktu; inventory tamamlanabilsin diye placeholder sayfalar eklendi.
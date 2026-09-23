# Sisteme giremedim / hata aldım — 3 madde

Teknik bilgi gerekmez. Tarihi ve saati not edin. Aşağıdaki sırayla bakın.

## 1. Önce telefona bakın

Telegram’da kırmızı haber var mı?

- Varsa: yazılımın kendisi düşmüş veya disk dolmuş demektir. Dosyaya inmeye gerek yok; haber zaten özet.
- Yoksa: tek kişi takılmış olabilir. 2. maddeye geçin.

## 2. Sunucuda şu klasöre bakın

Adres: `/opt/app/logs`

O saatteki son satırlara bakın. Arayın: `HATA`, `CRITICAL`, `failed`, `unhealthy`.

| Dosya | Ne söyler |
|--------|-----------|
| `healthcheck.log` | Kutular ayakta mı (web, yazılım, veritabanı) |
| `api-monitor.log` | Giriş kapısı cevap veriyor mu |
| `backup-wrapper.log` / `offsite-backup.log` | Gece yedek gitti mi |

Bu üçünde o saat boş ve yeşilse, büyük ihtimalle şifre / kod / tarayıcı işidir; sunucu sağlamdır.

## 3. Hâlâ anlaşılmadıysa son 100 satır

Sunucuda (işleten kişi yazar):

`docker logs sigorta-backend --tail 100`

Kırmızı veya `error` geçen satır, o anki kırılmadır. Ekran görüntüsü + saat yeter; şifre göndermeyin.

Personel «şifre reddedildi» diyorsa bu kayıtta olmayabilir. O zaman kutu ayaktadır; şifre veya giriş kodu mailidir.

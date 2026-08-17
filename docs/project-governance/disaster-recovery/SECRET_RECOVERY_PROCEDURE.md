# Secret Recovery Procedure — Meridyen

**Tarih:** 2026-08-17  
**Kural:** Şifre, API key, token, private key **yazılmaz**. Yalnızca nereden alınır / nasıl yenilenir.

Canlı kopya bugün: VPS `/opt/app/.env.production`, `rclone.conf`, `/etc/letsencrypt`, isteğe bağlı `.env.telegram`. GitHub ve B2 `config/` bu değerleri tutmaz.

---

## Backblaze B2

| | |
|--|--|
| Ne için | Offsite `db/` ve `uploads/` indirme + yeni VPS’te offsite cron |
| Hesap sahibi | Canlı hesabın e-posta/üyeliği **operatör kaydında** tutulur (bu fazda panelden okunmadı). VPS kaybında B2 web paneline **ayrı şifre/2FA** gerekir. |
| Bucket | Kod/doküman adı: `meridyen-backups`. Remote biçimi: `RCLONE_REMOTE` (değer yazılmaz). Prefix: `db/`, `uploads/`, `monthly/`. |
| Key oluşturma | 1) https://secure.backblaze.com 2) Application Keys 3) **yeni** key: bucket read+write (eski VPS key’i iptal edilebilir) 4) `rclone.conf` içinde `type=b2`, `account` = keyID, `key` = applicationKey 5) bölüm adı varsayılan kod: `b2-offsite` |
| Doğrulama | `rclone lsd` + `rclone ls …/db/` — dump adı görünür, içerik rapora yapıştırılmaz |
| Kayıpsa | Panel login yoksa Backblaze hesap kurtarma (kayıtlı e-posta). Master key kasada yoksa **DR durur**. |

---

## GitHub

| | |
|--|--|
| Ne için | Kod: `release/production-v505-clean` / tag `production-v505-2026-08-17` (`04d52b8`) |
| Repo | `https://github.com/mustafayufkayurek-dotcom/sigorta-portali.git` |
| Erişim | GitHub hesabı (2FA). Deploy key veya PAT **yeni VPS’e özel** üretilir; eski VPS anahtarı iptal. |
| Checkout | `git clone --branch release/production-v505-clean` sonra `git checkout production-v505-2026-08-17` |
| Yapılmayan | `release/production-v505` (hassas history). Laptop WIP. |

---

## Domain / DNS

| | |
|--|--|
| Alan | `app.meridyen-tr.com` / `www.app.meridyen-tr.com` (nginx) |
| Sağlayıcı | Registrar **bu fazda doğrulanmadı (Eksik — operatör not eder: firma adı + panel URL).** |
| Erişim | Registrar hesap (2FA). A kaydı yeni VPS IPv4. |
| Kesim | Eski IP’yi silmeden çift sunucu split-brain olmasın (tam kayıp senaryosunda eski IP zaten yok). |
| TTL | Ölçülmedi; kesim öncesi düşürmek RTO’yu kısaltır. |

---

## SMTP

| | |
|--|--|
| Ne için | Uygulama mail + `backup-notify.py` |
| Kaynak | `.env.production` (`SMTP_*`) **ve** restore sonrası DB `mail_config` (Ayarlar → E-posta) |
| Sağlayıcı | Canlı host adı env’de; **firma adı bu fazda panelle doğrulanmadı.** |
| Yenileme | Sağlayıcı panelinden uygulama şifresi / SMTP user. Dump gelmişse `mail_config` zaten DB’de olabilir; env ile çakışmayı Ayarlar ekranından kontrol et (değer rapora yazma). |
| Kayıpsa | Panel login + yeni uygulama şifresi. Onay mailleri durur; çekirdek login DB’ye bağlıdır. |

---

## Telegram Bot

| | |
|--|--|
| Ne için | Sistem alarmları, backup notify, hatırlatmalar |
| Yeniden oluşturma | Telegram → `@BotFather` → yeni bot **veya** mevcut bot token sıfırlama. Chat: `TELEGRAM_CHAT_ID` (Meridyen Sistem Alarmları grubu — ID env’de; grup hâlâ duruyorsa ID aynı kalabilir). |
| Yerleşim | `.env.production` ve/veya `/opt/app/.env.telegram` |
| Kayıpsa | BotFather hesabı (Mustafa/operatör Telegram). Eski token sızmış sayılır, **revoke**. |

---

## PayTR

| | |
|--|--|
| Ne için | Online kart (`PAYTR_MERCHANT_*`) |
| Erişim | https://www.paytr.com mağaza paneli (üye işyeri). |
| Yenileme | Panel → entegrasyon / mağaza anahtarları. Bildirim URL kalıbı: `https://app.meridyen-tr.com/api/v1/webhooks/payments/paytr` |
| Canlı mod | `PAYTR_TEST_MODE` canlı değeri VPS’teydi; tahmin etme. Panel “canlı” ise env’yi panele göre doldur. |
| Kayıpsa | Tahsilat durur; hasar/acil operasyon çalışabilir. |

---

## Logo API

| | |
|--|--|
| Ne için | Muhasebe entegrasyonu (`LOGO_API_*`) |
| Erişim | Logo sunucusu / REST hesabı (`LOGO_API_BASE_URL` canlıda iç ağ veya VPN olabilir). |
| Yenileme | Logo yöneticisinden client id/secret/user. Yeni VPS IP allowlist gerekebilir (**doğrulanmadı**). |
| Kapalıysa | `LOGO_INTEGRATION_ENABLED=false` ile çekirdek DR bloklanmaz. |

---

## OpenAI API

| | |
|--|--|
| Ne için | STT, fiş/belge okuma, sınıflandırma |
| Erişim | https://platform.openai.com → API keys (hesap 2FA). |
| Yenileme | Eski key revoke, yeni key `.env.production` `OPENAI_API_KEY`. |
| Yoksa | İlgili özellik düşer; login/yedek/DR çekirdeği çalışır. |

---

## Sentry

| | |
|--|--|
| Ne için | Hata izleme (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`) |
| Erişim | https://sentry.io ilgili org/proje. |
| Yenileme | Proje Settings → Client Keys (DSN). Web DSN **build-time** — image rebuild. |
| Canlıda set mi | Bu fazda VPS env okunmadı. DSN yoksa Sentry sessiz kapalı. |

---

## SSL

| | |
|--|--|
| Ne için | `app.meridyen-tr.com` 443 |
| Eski pem | `/etc/letsencrypt/live/app.meridyen-tr.com/` — B2’de yok. |
| Yeniden üretim | DNS A kaydı yeni IP’de oturunca: Certbot HTTP-01 (compose `certbot` + webroot `/var/www/certbot`) veya `certbot certonly --webroot`. nginx `fullchain.pem` / `privkey.pem` yolları snapshot `nginx.conf` ile aynı kalır. |
| Yenileme | Compose certbot 12s döngü `certbot renew`. |

---

## Postgres / JWT / Redis / MinIO (özet)

Bunlar “sağlayıcı paneli” değil, **yeni VPS’te üretilen veya dump ile gelen** değerlerdir. Ayrıntı: `SECRET_AND_CONFIG_INVENTORY.md`.

- Postgres şifresi dump rolü ile uyumlu olmalı.  
- JWT yeni üretilebilir (yeniden login).  
- Redis / MinIO root yeni üretilebilir (MinIO nesne kaybı ayrı).

---

## Operatör dolduracak kutu (değer yazma)

Tatbikat öncesi kâğıt/kasa (vault) satırları — bu dosyaya yapıştırılmaz:

```
B2 hesap e-posta / 2FA cihazı:
GitHub 2FA cihazı:
Registrar adı / panel:
SMTP panel:
PayTR üye işyeri:
Logo iletişim:
OpenAI hesap:
Sentry org:
Telegram BotFather hesabı:
```

# Secret Vault Kurulum Listesi — Meridyen

**Tarih:** 2026-08-17  
**Kaynak:** `SECRET_VAULT_DESIGN.md` (1Password Business veya Bitwarden Cloud).  
**Yasak:** Gerçek değer, key, token, şifre **bu dosyaya ve git’e yazılmaz.** `.env` oluşturulmaz.

Durum sütunu operasyon takibidir (`☐` / `☑`). FAZ D sonrası hepsi boş başlar: kasa henüz doldurulmadı.

| Kayıt | Saklanacak yer | Durum |
|-------|----------------|-------|
| Backblaze B2 Key ID | Vault (VPS dışı SaaS kasa) | ☐ |
| Backblaze B2 Application Key | Vault | ☐ |
| rclone config bilgisi (dosya ek veya remote + bölüm adı) | Vault | ☐ |
| Production domain bilgisi (`app.meridyen-tr.com`) | Vault | ☐ |
| DNS erişimi (registrar panel / 2FA cihazı) | Vault | ☐ |
| SMTP erişimi (panel + kullanıcı adı; parola kasada) | Vault | ☐ |
| Telegram bot bilgisi (BotFather hesabı + sohbet hedefi) | Vault | ☐ |
| PayTR erişimi (üye işyeri paneli) | Vault | ☐ |
| Logo entegrasyon bilgisi (API hesabı / iç ağ notu) | Vault | ☐ |
| OpenAI API bilgisi (platform hesabı) | Vault | ☐ |
| Sentry erişimi (org / proje) | Vault | ☐ |
| SSL yenileme bilgisi (Let’s Encrypt + DNS önkoşulu; pem zorunlu değil) | Vault | ☐ |

Ek (çekirdek DR, aynı kasa — değer yok):

| Kayıt | Saklanacak yer | Durum |
|-------|----------------|-------|
| GitHub erişimi (2FA / yedek kod) | Vault | ☐ |
| VPS sağlayıcı paneli (yeni sunucu açmak) | Vault | ☐ |

## İşleme kuralı

1. Değerleri Cursor sohbetine, e-postaya, bu markdown’a yapıştırma.  
2. Canlı VPS’ten kasaya aktarım: ekrana bakarak kasa UI.  
3. Tüm satırlar `☑` olmadan **gerçek RTO tatbikatı başlamaz** (`RECOVERY_DRILL_PLAN.md` Ön Koşullar).

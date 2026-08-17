# Secret Vault Tasarımı — Meridyen

**Tarih:** 2026-08-17  
**Amaç:** Production secret’ın yalnız VPS’te kalmasını bitirmek.  
**Bu faz:** Kod yok. Vault kurulumu yok. Yalnız seçim ve kayıt listesi.

---

## Alternatifler (kısa)

| Seçenek | Uygunluk | Neden |
|---------|----------|--------|
| **1Password Business** veya **Bitwarden Cloud (Teams)** | **Önerilen** | VPS dışında, 2FA, acil erişim, Mustafa teknik olmadan kullanır. Ayrı sunucu istemez. |
| AWS Secrets Manager | Uygun değil (şimdi) | AWS hesabı, IAM, uygulama entegrasyonu. Yeni bulut operasyonu. Çekirdek DR’yi ağırlaştırır. |
| HashiCorp Vault | Uygun değil | Kendi kümesi. Aynı VPS’e konursa felakette yine gider. İşletme maliyeti yüksek. |

**Öneri:** VPS’ten bağımsız **SaaS şifre kasası** (1Password Business **veya** Bitwarden Teams). İkisi de kabul; kurulacak ürün Mustafa’nın hesap/ödeme tercihi. Self-host Bitwarden **önerilmez** (ikinci VPS = ikinci felaket yüzeyi).

Kasayı production Docker’a bağlama. Uygulama hâlâ `.env.production` okur. Vault = **insan kurtarma kopyası** + yeni key üretme yeri.

---

## Saklanacak kayıtlar (değer bu belgeye yazılmaz)

Vault’ta her kayıt: ad, not (nerede kullanılır), ek dosya varsa şifreli ek.

**Erisim / altyapı**

- GitHub hesap + 2FA yedek kodları  
- B2 hesap + application key (keyID ayrı alan)  
- `rclone.conf` tam dosya (ek) **veya** B2 key + remote adı  
- Registrar / DNS panel  
- VPS sağlayıcı panel (yeni sunucu açmak için)  
- SSH: yeni sunucu kurulunca yeni anahtar; eski VPS key’sini “tarihçe” diye tutmaya gerek yok  

**Uygulama env (`.env.production` şablonu + canlı değerler)**

- `POSTGRES_*`  
- `JWT_SECRET`  
- `REDIS_PASSWORD`  
- MinIO root  
- `SMTP_*`  
- `TELEGRAM_*`  
- `PAYTR_*`  
- `LOGO_API_*`  
- `OPENAI_API_KEY`  
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`  
- `RCLONE_REMOTE` / `B2_BUCKET`  
- `.env.telegram` (ayrı kayıt)  

**SSL:** Let’s Encrypt pem **kasa zorunluluğu değil** (yeniden üretilir). İsteğe bağlı arşiv.

**Postgres dump şifresi:** Dump ile uyum için `POSTGRES_PASSWORD` kasada **güncel** tutulur.

---

## Erişim yetkileri

| Rol | Yetki |
|-----|--------|
| Mustafa (ürün sahibi) | Kasa **sahibi**. Acil geçiş (emergency / inheritance) açık. |
| Teknik operatör (varsa, tek kişi) | Vault grubu “Meridyen Production”. Yazma sınırlı: env güncelleme. |
| Geliştirme / laptop | Production secret **yok**. Yalnızca `.env.example`. |
| GitHub / Chat / e-posta | Secret yapıştırma yok. |

Paylaşım: “herkese açık vault linki” yok. 2FA zorunlu.

VPS kaybında sıra: Mustafa (veya yedek kişi) kasayı açar → B2 key + GitHub → runbook.

---

## Yedekleme prensibi

1. **3 yer kuralı (secret için):** (a) canlı VPS env, (b) SaaS vault, (c) Mustafa’nın kasa **acil kit** / basılı 2FA yedek (kilitli, ofis dışı).  
2. Vault sağlayıcısı production VPS ile **aynı disk/sağlayıcı olmasın**.  
3. Key rotasyonu: VPS key sızması veya ayrılan kişi → B2/GitHub/SMTP yeni key, kasayı güncelle, eski key iptal.  
4. Dump ve tar **vault’a konmaz** (B2 zaten offsite). Vault yalnızca erişim.  
5. Kasa dışı: Slack/WhatsApp’a `.env` atma.  
6. Çeyrekte bir: “kasadan B2 `ls`” tatbikatı (indirerek bucket’ı şişirmeden `ls` yeter).

---

## Uygulama adımları (onay sonrası — bu faz değil)

1. 1Password veya Bitwarden hesap.  
2. Vault “Meridyen Production”.  
3. Canlı VPS’ten değerleri **ekrana bakarak** kasaya işle (Cursor/production log’a yazma).  
4. İkinci kişi acil erişim.  
5. `SECRET_RECOVERY_PROCEDURE.md` içindeki “operatör kutusu”nu kasa kayıt adlarıyla doldur.

Bu adımlar yapılmadan FAZ B runbook’u **metin olarak tam**, **uygulama olarak kilitli** kalır.

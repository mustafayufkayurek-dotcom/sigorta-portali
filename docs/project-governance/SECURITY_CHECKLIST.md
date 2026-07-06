# Meridyen — Siber Güvenlik Checklist (Katmanlı Savunma)

**Amaç:** Bilinen saldırı vektörlerine karşı sunucu + uygulama + operasyon kontrollerini tek yerde toplamak.  
**İlişkili:** [DEPLOY_GUVENLIK_PROTOKOLU.md](./DEPLOY_GUVENLIK_PROTOKOLU.md)

> %100 güvenlik mümkün değildir. Amaç: tespit süresini kısaltmak, etkiyi sınırlamak, geri dönüşü garantilemek.

---

## 1. Kimlik doğrulama ve oturum (Auth/JWT)

| Kontrol | Durum | Not |
|---------|-------|-----|
| JWT access token kısa ömür (15m) | Kod | `JWT_ACCESS_EXPIRES_IN=15m` |
| Refresh token DB'de, logout'ta silinir | Kod | |
| Token blacklist (Redis) logout sonrası | Kod | Redis düşerse **fail-open** — bilinçli risk |
| bcrypt password hash | Kod | |
| Register endpoint public değil | Kod | `user.create` permission gerekir |
| Login / forgot / reset / refresh rate limit | Kod + Nginx | NestJS `@Throttle` + nginx `auth_limit` |
| reCAPTCHA (opsiyonel) | Env | `RECAPTCHA_SECRET_KEY` doluysa login'de doğrulanır |
| Swagger production'da kapalı | Env | `ENABLE_SWAGGER` unset veya `false` |
| JWT secret ≥ 32 byte rastgele | Sunucu | `openssl rand -hex 32` |

**Mustafa (sunucu):** `.env.production` içinde zayıf/default JWT_SECRET kullanmayın. Refresh token çalınması senaryosu için HTTPS zorunlu.

---

## 2. Yetkilendirme (RBAC / IDOR)

| Kontrol | Durum | Not |
|---------|-------|-----|
| Global JwtAuthGuard + PermissionsGuard | Kod | |
| Sigorta kullanıcısı scope filtresi | Kod | `insuranceCompanyIds` list endpoint'te |
| Saha personeli dosya sahipliği + 48s kapanış | Kod | |
| `PERMISSION_FALLBACK_ENABLED` | Env | **Production'da `false` veya unset** — açıksa DB boşken rol default yetkileri devreye girer |
| Public endpoint envanteri | Kod | health, auth, public token linkler, webhooks, widget proxy |

**Backlog:** Tüm `findOne` endpoint'lerinde rol bazlı scope denetimi tek tek audit edilmeli (IDOR regresyon riski).

---

## 3. Ağ ve TLS (Nginx / Firewall)

| Kontrol | Durum | Not |
|---------|-------|-----|
| HTTP → HTTPS 301 | Nginx | |
| TLS 1.2 + 1.3 | Nginx | |
| HSTS (2 yıl, preload) | Nginx | |
| Security headers (XFO, XCTO, Referrer, Permissions-Policy, COOP, CORP) | Nginx | CSP bilinçli eklenmedi — Next.js inline script kırılma riski |
| API rate limit (600/dk + burst) | Nginx | |
| Auth rate limit (5/dk) | Nginx | login, forgot, reset, refresh |
| PostgreSQL / Redis / MinIO API dış port kapalı | Compose | yalnızca `expose`, nginx 80/443 |
| MinIO console localhost bind | Compose | `127.0.0.1:9001` — SSH tüneli ile |
| UFW: 22, 80, 443 dışında kapalı | **Sunucu** | Aşağıdaki komut listesi |
| fail2ban ssh + nginx limit_req | **Sunucu** | Öneri — bölüm 8 |

---

## 4. Docker ve gizli bilgiler

| Kontrol | Durum | Not |
|---------|-------|-----|
| `.env.production` gitignore | Repo | |
| `.env.production.example` placeholder | Repo | Gerçek secret yok |
| Compose proje adı `-p sigorta-hasar-sistemi` | Script | Yanlış ağ → 502 |
| `docker image prune -af` yasak | Protokol | Rollback image kaybı |
| Korunan image manifest | `KNOWN_GOOD_IMAGES.json` | |
| Container root hardening | Backlog | Non-root user, read-only FS — henüz yok |

**Mustafa:** `.env.production` dosya izinleri `chmod 600`, sahip root veya deploy kullanıcısı.

---

## 5. Dosya yükleme ve XSS

| Kontrol | Durum | Not |
|---------|-------|-----|
| FileValidationPipe (mime, boyut, uzantı) | Kod | `UPLOAD_VALIDATION_ENABLED=false` ile kapatılabilir — prod'da açık |
| Çift uzantı engeli | Kod | |
| Prisma parametreli sorgular | Kod | `$queryRaw` tagged template — SQL injection düşük risk |
| Frontend HTML sanitize (DOMPurify) | Kod | `sanitizeHtml()` şablon önizlemelerinde |
| Uploads nginx üzerinden proxy | Nginx | Auth'suz public `/uploads/` — signed URL tercih edilmeli (backlog) |

**Saldırı vektörü:** MIME spoofing — magic byte doğrulama yok (P2 backlog).

---

## 6. Ödeme (PayTR) ve webhooks

| Kontrol | Durum | Not |
|---------|-------|-----|
| PayTR callback HMAC doğrulama | Kod | `verifyCallback()` |
| Public checkout token (UUID) | Kod | Enumeration nginx rate limit ile sınırlı |
| PayTR webhook IP allowlist | **Backlog** | Nginx geo/IP filtresi veya uygulama katmanı |
| Graph webhook clientState doğrulama | Kod | Operation inbox |
| ONLINE_CARD_COLLECTION_ENABLED flag | Env | Kapalıyken link oluşturma devre dışı |

---

## 7. Yedekleme, audit, operasyon

| Kontrol | Durum | Not |
|---------|-------|-----|
| Gece DB yedeği (`backup.sh`) | Script + cron | |
| Deploy öncesi DB yedeği | `pre-deploy-safety.sh` | |
| Yedek sağlık doğrulama | `verify-backup-health.sh` | gzip + min boyut |
| Audit log hassas alan maskeleme | Kod | `audit-log.sanitizer.ts` |
| Deploy smoke + hash doğrulama | Script | |
| Yedek off-site kopya | **Sunucu** | Disk yangını / ransomware senaryosu |

### Cron örnekleri (sunucu `crontab -e`)

```cron
# Her gece 02:00 DB yedeği
0 2 * * * /opt/app/scripts/backup.sh >> /var/log/meridyen-backup.log 2>&1

# Her sabah 06:30 yedek sağlık kontrolü (başarısızsa mail/alert hook ekleyin)
30 6 * * * /opt/app/scripts/verify-backup-health.sh >> /var/log/meridyen-backup-health.log 2>&1

# SSL yenileme certbot container içinde; ek kontrol (opsiyonel)
0 8 * * 1 certbot certificates 2>&1 | logger -t meridyen-ssl
```

---

## 8. fail2ban ve firewall (sunucu — önerilen)

### UFW başlangıç checklist

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH          # veya: ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status verbose
```

### fail2ban (nginx + ssh)

```bash
apt install fail2ban -y
```

`/etc/fail2ban/jail.local` örneği:

```ini
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
port     = http,https
logpath  = /var/log/nginx/error.log
maxretry = 10
```

Nginx limit_req 429 logları fail2ban filtresi ile birleştirilir. Kurulum sonrası: `fail2ban-client status`.

---

## 9. SSH / deploy yüzeyi

| Risk | Önlem |
|------|--------|
| root SSH + parola | Ed25519 key-only, `PasswordAuthentication no` |
| Deploy scriptlerinde sabit IP | `deploy-env.sh` — key rotation planı |
| rsync tek yönlü | Kısmi sync yasak — protokol |
| Sunucuda git credential | Kullanmayın; rsync + docker build |

---

## 10. Bilinçli kabul / backlog (P2)

- JWT blacklist Redis fail-open
- `/uploads/` public proxy (signed URL migration)
- Weather widget public SSRF yüzeyi (yalnızca wttr.in)
- Strict CSP header (Next.js uyumluluk testi gerekir)
- Container non-root, seccomp, AppArmor
- WAF (Cloudflare vb.)
- Penetrasyon testi (yıllık)
- Secret rotation otomasyonu
- 2FA / MFA (admin hesapları)

---

## Hızlı deploy öncesi güvenlik (5 dk)

1. `bash scripts/verify-backup-health.sh`
2. `bash scripts/pre-deploy-safety.sh ETİKET`
3. `.env.production`: `PERMISSION_FALLBACK_ENABLED` kapalı mı?
4. `ENABLE_SWAGGER` kapalı mı?
5. Rollback tag manifest'te mevcut mu?

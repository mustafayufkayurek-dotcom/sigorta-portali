# SSH Sertleştirme — Bakım Penceresi Planı

**Amaç:** Sunucuda parola ile SSH girişini kapatmak, root doğrudan girişi kısıtlamak, fail2ban ile brute-force riskini azaltmak — **kilitlenme olmadan**.

**Sunucu:** `root@94.138.216.18` (`/opt/app`)  
**Mevcut durum (v225 sonrası audit):** UFW aktif (22/80/443), fail2ban sshd jail kurulu, `PasswordAuthentication` muhtemelen açık, root SSH açık.

**İlişkili:** [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)

---

## 1. Bakım penceresi önerisi

| | |
|---|---|
| **Süre** | 30–45 dk (Pazar veya akşam 22:00–23:00 — düşük trafik) |
| **Katılımcı** | Mustafa (SSH anahtarı olan kişi) |
| **Canlı etki** | SSH oturumu açıkken yapılırsa uygulama **kesintisiz** devam eder |
| **Rollback süresi** | ≤5 dk (hosting panel / VNC / rescue console) |

**Ön koşul:** Hosting sağlayıcıda **KVM / rescue / serial console** erişimi test edilmiş olmalı (DigitalOcean, Hetzner vb. panel).

---

## 2. Ön hazırlık (pencereden 1–2 gün önce)

### 2.1 SSH anahtarı doğrula

Mustafa Mac'inden **yeni bir terminal** aç (mevcut oturumu kapatma):

```bash
# Parola sormadan bağlanmalı
ssh -o BatchMode=yes -o PreferredAuthentications=publickey root@94.138.216.18 "echo SSH_KEY_OK"
```

- `SSH_KEY_OK` görürsen → devam.
- Hata alırsan → önce anahtar ekle:

```bash
ssh-copy-id root@94.138.216.18
# veya ~/.ssh/id_ed25519.pub içeriğini sunucuda:
#   mkdir -p ~/.ssh && chmod 700 ~/.ssh
#   echo 'PUBKEY_BURAYA' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
```

### 2.2 Yedek admin erişim yolu

- [ ] Hosting panelinden **root parola sıfırlama / rescue mode** yolunu not et
- [ ] İkinci bir kişi veya ikinci cihazdan aynı anahtar test edildi
- [ ] Canlı deploy yok — bakım günü deploy planlama

### 2.3 Sunucu snapshot (önerilir)

Hosting panelinden **sunucu snapshot / backup** al — SSH config geri dönüşü için.

### 2.4 Mevcut sshd ayarını kaydet

```bash
ssh root@94.138.216.18
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%Y%m%d)
grep -E '^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|ChallengeResponseAuthentication|KbdInteractiveAuthentication|UsePAM|Port)' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/* 2>/dev/null
```

---

## 3. Bakım penceresi — adım adım (sıra önemli)

> **Altın kural:** Her `sshd` değişikliğinden sonra **yeni bir terminal** ile test et; eski oturumu kapatma.

### Adım 1 — İkinci oturum aç (5 dk)

```bash
# Terminal A: mevcut oturum (açık kalsın)
# Terminal B: yeni bağlantı testi
ssh root@94.138.216.18
```

### Adım 2 — sshd drop-in dosyası (tercih edilen)

Ana dosyayı bozmamak için:

```bash
cat > /etc/ssh/sshd_config.d/99-meridyen-hardening.conf <<'EOF'
# Meridyen SSH sertleştirme — 2026
PermitRootLogin prohibit-password
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
MaxAuthTries 3
LoginGraceTime 30
EOF
```

> `prohibit-password`: root yalnızca **anahtar** ile; parola ile root yok.

### Adım 3 — Config test + yumuşak reload

```bash
sshd -t && systemctl reload sshd
# Ubuntu'da servis adı ssh veya sshd olabilir:
systemctl reload ssh 2>/dev/null || systemctl reload sshd
```

### Adım 4 — Yeni terminal ile doğrula (KRİTİK)

```bash
# Terminal C (BatchMode = parola soramaz)
ssh -o BatchMode=yes root@94.138.216.18 "echo HARDENING_OK && whoami"
```

- `HARDENING_OK` + `root` → başarılı.
- Başarısız → **Terminal A hâlâ açık** → drop-in dosyasını sil ve reload:

```bash
rm /etc/ssh/sshd_config.d/99-meridyen-hardening.conf
systemctl reload sshd
```

### Adım 5 — fail2ban nginx jail (opsiyonel, aynı pencere)

```bash
cat >> /etc/fail2ban/jail.local <<'EOF'

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
port     = http,https
logpath  = /var/log/nginx/error.log
maxretry = 15
findtime = 600
bantime  = 3600
EOF
systemctl restart fail2ban
fail2ban-client status
```

### Adım 6 — Son audit

```bash
cd /opt/app
bash scripts/server-security-audit.sh
```

Beklenen: SSH uyarıları kaybolur veya azalır; fail2ban OK.

### Adım 7 — Terminal A'yı kapat

Tüm testler geçtikten sonra eski oturumu kapat.

---

## 4. Rollback (kilitlenme senaryosu)

| Yöntem | Ne yap |
|--------|--------|
| **Rescue / KVM console** | Hosting panel → rescue → mount disk → `99-meridyen-hardening.conf` sil veya `PasswordAuthentication yes` |
| **Snapshot geri yükle** | Panelden snapshot restore |
| **Açık oturum varsa** | Drop-in sil + `systemctl reload sshd` |

Rescue modunda tipik:

```bash
mount /dev/sda2 /mnt   # partition adını panelden doğrula
rm /mnt/etc/ssh/sshd_config.d/99-meridyen-hardening.conf
reboot
```

---

## 5. Bakım sonrası checklist

- [ ] Mac'ten `ssh root@94.138.216.18` anahtar ile giriyor
- [ ] Parola ile giriş **reddediliyor** (beklenen)
- [ ] `server-security-audit.sh` SSH uyarısı yok
- [ ] fail2ban `sshd` jail aktif
- [ ] Canlı site: https://app.meridyen-tr.com/giris açılıyor
- [ ] Deploy scriptleri (`rsync` + `ssh`) Mustafa Mac'inden çalışıyor

---

## 6. İsteğe bağlı — deploy kullanıcısı (ileriki faz)

Root SSH'ı tamamen kapatmak için (P2):

1. `deploy` kullanıcısı oluştur, `authorized_keys` ekle
2. `sudo` ile docker / `/opt/app` yetkisi
3. `PermitRootLogin no`
4. Deploy scriptlerinde `REMOTE_HOST=deploy@94.138.216.18`

Bu faz **ayrı pencere** — önce anahtar-only root stabil olsun.

---

## 7. Mustafa için tek sayfa özet

```
ÖNCE:  ssh BatchMode test + hosting console erişimi + snapshot
GÜN:   22:00 Pazar, 30 dk
ADIM:  drop-in config → sshd -t → reload → YENİ terminal test
SONRA: fail2ban nginx jail + security-audit
ASLA:  İlk test geçmeden eski SSH oturumunu kapatma
```

**Onay sonrası:** Bu planı uygulamak için bakım günü/saatini Mustafa seçer; agent veya Mustafa adım adım komutları çalıştırır.

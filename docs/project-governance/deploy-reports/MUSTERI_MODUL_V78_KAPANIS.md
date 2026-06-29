# Müşteri Modülü — Canlı Kapanış Raporu (v76–v79)

**Tarih:** 29 Haziran 2026  
**Kapsam:** Web-only (backend değişmedi — `v43`)  
**Canlı:** https://app.meridyen-tr.com  
**Mustafa ekran kontrolü:** PASS (29 Haziran 2026)

---

## Bilinen iyi sürüm

| Bileşen | Image |
|---------|--------|
| Web (aktif) | `sigorta-web:dalga2-agreement-hr-01-v79-amd64` |
| Backend (sabit) | `app-backend:dalga2-agreement-hr-01-v43-amd64` |
| Web rollback −1 | `sigorta-web:dalga2-agreement-hr-01-v78-amd64` |
| Web rollback −2 | `sigorta-web:dalga2-agreement-hr-01-v77-amd64` |

Manifest: `deploy/manifests/KNOWN_GOOD_IMAGES.json`

---

## Sürüm geçmişi

| Tag | Özet |
|-----|------|
| v76 | Yeşil tema, SlidePanel form, harita/GPS, İlişki Özeti ayrımı |
| v77 | Yeni Müşteri butonu + header ikonu yeşil (`btn-primary-emerald`) |
| v78 | Kurumsal sol / Bireysel sağ, telefon tam genişlik, doğum tarihi kaldırıldı |
| v79 | Veri kaybı önlemleri (liste/drawer hata yönetimi) + güvenlik script hizalama |

**Migration:** Yok — yalnızca frontend.

---

## Rollback (≤5 dk)

```bash
ssh root@94.138.216.18
cd /opt/app

# Web-only geri dönüş (önerilen)
bash scripts/rollback-production.sh web-only

# Bir önceki web sürümü
bash scripts/rollback-production.sh web-only-prev

# Manuel
bash scripts/rollback-production.sh custom \
  app-backend:dalga2-agreement-hr-01-v43-amd64 \
  sigorta-web:dalga2-agreement-hr-01-v77-amd64
```

---

## Deploy öncesi alınması gereken önlemler (standart)

```bash
# Sunucuda
bash scripts/pre-deploy-safety.sh musteri-v78
bash scripts/capture-live-baseline.sh pre-musteri-v78

# Yerelden
bash scripts/verify-critical-paths.sh --remote
```

---

## Deploy sonrası doğrulama

```bash
bash scripts/post-deploy-smoke.sh | tee docs/project-governance/canli-kabul/otomatik/smoke-musteri-v78.log
bash scripts/verify-critical-paths.sh --remote
```

**Kritik rotalar:** `/panel/musteriler`, `/panel/tedarikciler`, `/api/v1/customers`

---

## Kritik dosyalar (hash doğrulama)

`deploy/manifests/CRITICAL_PATHS.txt` içinde müşteri modülü dosyaları kayıtlı:

- `apps/web/src/app/panel/musteriler/page.tsx`
- `apps/web/src/app/panel/musteriler/[id]/page.tsx`
- `apps/web/src/utils/customer-form-helpers.ts`
- `apps/web/src/components/ContactPhoneField.tsx`
- `apps/web/src/components/ui/PhoneContactActions.tsx`
- `apps/web/src/components/LocationPickerModal.tsx`
- `apps/web/src/app/globals.css`

---

## Veri kaybı önlemleri (kod)

| Risk | Önlem |
|------|--------|
| Liste API hatasında sessiz boş ekran | Toast + mevcut liste korunur |
| Drawer detay hatasında sessiz null | Hata mesajı + Tekrar Dene |
| Kısmi rsync | CRITICAL_PATHS hash doğrulama zorunlu |
| Image kaybı | pre-deploy-safety KEEP_IMAGES v76–v78 |

---

## Sonraki modüle geçiş koşulu

- [x] Mustafa PASS — Müşteriler
- [x] KNOWN_GOOD_IMAGES güncel
- [x] Rollback script v78/v43 ile hizalı
- [x] Smoke + kritik path listesi müşteri rotalarını kapsıyor
- [x] Git safety snapshot (`safety/pre-musteri-v79-20260629` — commit `41f4b3c`)

**Sıradaki modül:** Tedarikçiler (aynı güvenlik paketi uygulanacak)

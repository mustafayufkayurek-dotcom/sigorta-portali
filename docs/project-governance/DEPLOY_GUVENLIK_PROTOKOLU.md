# Deploy Güvenlik Protokolü

**Amaç:** Sayfa kaybı, eski UI'ya dönüş, kısmi sync, yanlış build context, migration felaketleri ve rollback image kaybını önlemek.

**Son bilinen iyi sürüm:** Web **v348** + Backend **v349** (`deploy/manifests/KNOWN_GOOD_IMAGES.json`)  
**Etiket:** `v349-guvenlik-finans-api-guard` (backend) — web sonraki: `v350-logo-sidebar-topbar`  
**Güncelleme:** 14 Temmuz 2026

**Rollback tag'leri:** Web **v346** + Backend **v348** (manifest `rollbackImages`)

**Siber güvenlik checklist:** [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) — auth, firewall, yedek, PayTR, IDOR envanteri.

**Canlıya alınmamış envanter:** [CANLIYA_ALINMAMIS_ENVANTER.md](./CANLIYA_ALINMAMIS_ENVANTER.md)

---

## Altın kurallar (asla ihlal edilmez)

1. **Ürün kararı > kod.** Canlıda Mustafa'nın onayladığı ekran geri alınamaz.
2. **Kısmi rsync yasak** — tek dosya hotfix ancak kritik hash doğrulaması sonrası.
3. **Build context = `/opt/app/apps/`** — `source/` değil.
4. **Backend deploy = DB yedeği zorunlu.**
5. **Web-only deploy** açıkça etiketlenir; backend image değişmez.
6. **Rollback image'ları silinmez** — koruma listesi `KNOWN_GOOD_IMAGES.json` manifest'inden okunur (`scripts/read-known-good-manifest.sh`).
7. **`docker image prune -af` yasak** — yalnızca dangling prune (`docker image prune -f`); tam prune rollback tag'lerini siler (v221 olayı).
8. **Deploy sonrası smoke test PASS olmadan "canlıya alındı" denmez.**

---

## Deploy öncesi checklist

| # | Adım | Komut |
|---|------|--------|
| 1 | Disk + docker | `bash scripts/pre-deploy-check.sh` |
| 2 | Disk bakım (güvenli) | `bash scripts/server-disk-maintenance.sh` |
| 3 | Yedek sağlığı | `bash scripts/verify-backup-health.sh` |
| 4 | Güvenlik paketi | `bash scripts/pre-deploy-safety.sh v248-etiket` |
| 5 | Kritik dosya uyumu | `bash scripts/verify-critical-paths.sh --remote` |
| 6 | Baseline al | `bash scripts/capture-live-baseline.sh pre-v248` |
| 7 | Scope netliği | Web-only mu, full mu? Migration var mı? |

---

## Deploy sırası (standart — web-only)

**502 önleme:** Her zaman `-p sigorta-hasar-sistemi` kullanın. `docker compose up` proje adı olmadan çalıştırılırsa web yanlış ağda kalır → nginx 502.

```bash
# Önerilen (yerelden tek komut):
bash scripts/deploy-web-production.sh v248-etiket

# Manuel:
# 1) Yerelden sunucuya
rsync -avz apps/web/ root@94.138.216.18:/opt/app/apps/web/

# 2) Sunucuda
ssh root@94.138.216.18
cd /opt/app
bash scripts/pre-deploy-safety.sh v248-xxx
docker build -f Dockerfile.web -t sigorta-web:dalga2-agreement-hr-01-v248-amd64 \
  --build-arg NEXT_PUBLIC_API_URL=https://app.meridyen-tr.com/api/v1 .
# override güncelle → web image tag
bash scripts/restart-web-production.sh   # compose -p sigorta-hasar-sistemi + routing doğrulama
bash scripts/verify-nginx-web-routing.sh # zorunlu PASS
```

**Asla kullanmayın:**
```bash
docker compose -f docker-compose.prod.yml up -d web   # ❌ yanlış ağ → 502
docker stop sigorta-web && docker rm sigorta-web && docker compose ...  # ❌ -p olmadan
docker image prune -af   # ❌ rollback image'larını siler
```

**Backend + migration:** pre-deploy-safety DB yedeği → build backend → `prisma migrate deploy` → smoke.

**Full deploy (web + backend — v248 örneği):**
```bash
bash scripts/pre-deploy-safety.sh v248-etiket
# backend build → app-backend:dalga2-agreement-hr-01-v248-amd64
# web build     → sigorta-web:dalga2-agreement-hr-01-v248-amd64
# prisma migrate deploy (migration varsa)
bash scripts/restart-web-production.sh   # -p sigorta-hasar-sistemi
bash scripts/post-deploy-smoke.sh
```

Deploy sonrası manifest güncelle: `deploy/manifests/KNOWN_GOOD_IMAGES.json` — `images`, `rollbackImages`, `mustPassSmokeRoutes`, `updatedAt`.

---

## Deploy sonrası

```bash
bash scripts/verify-nginx-web-routing.sh   # sunucuda — 502 önleme (ZORUNLU)
bash scripts/post-deploy-smoke.sh
bash scripts/verify-critical-paths.sh --remote
```

Mustafa ekran kontrolü (Cmd+Shift+R) — özellikle:
- Kullanıcı Davet Et
- Ayarlar hub / Tanımlar Merkezi
- Yönetim Merkezi dashboard (admin)
- Hasar dosyası detay — sigortalı / adres / ihbar alanları
- Son değiştirilen sayfa

Smoke hedef rotalar: manifest `mustPassSmokeRoutes` (v248'de 28 rota).

---

## Rollback (≤5 dk)

Tag'ler manifest'ten okunur (`scripts/rollback-production.sh`):

| Mod | Backend | Web |
|-----|---------|-----|
| `default` | `rollbackImages.backendPrevious` (**v247**) | `rollbackImages.webPrevious` (**v247**) |
| `web-only` | `images.backend` (**v248**) | `rollbackImages.webPrevious` (**v247**) |
| `custom` | Manuel tag | Manuel tag |

```bash
ssh root@94.138.216.18
cd /opt/app
bash scripts/rollback-production.sh              # v247/v247
bash scripts/rollback-production.sh web-only     # backend v248, web v247
```

Override yedekleri: `/opt/app/backups/override_*`

---

## Disk bakım kuralları

`scripts/server-disk-maintenance.sh`:

- `MIN_FREE_GB` varsayılan **5 GB** (`pre-deploy-check.sh` ile aynı)
- Korunan image'lar: manifest `images.*` + `rollbackImages.*` + çalışan container image'ları
- Prune öncesi `docker image inspect` ile doğrulama (eksikse uyarı)
- **Yalnızca** `docker image prune -f` (dangling) + `docker builder prune`
- **`docker image prune -af` kullanılmaz**

Korunan tag listesi tek kaynak: `deploy/manifests/KNOWN_GOOD_IMAGES.json`

---

## Regresyon önleme — tek kaynak

| Konu | Tek kaynak dosya |
|------|------------------|
| Bilinen iyi / rollback image'lar | `deploy/manifests/KNOWN_GOOD_IMAGES.json` |
| Image okuyucu | `scripts/read-known-good-manifest.sh` |
| Ayarlar menü + hub kartları | `apps/web/src/config/settings-nav.ts` |
| Tanımlar geri linki | `apps/web/src/utils/settings-definition-nav.ts` |
| Sol menü | `apps/web/src/app/panel/layout.tsx` |
| Kritik hash listesi | `deploy/manifests/CRITICAL_PATHS.txt` |
| Canlı kabul checklist | `docs/project-governance/canli-kabul/CHECKLIST.md` |

Yeni ayar sayfası eklerken **yalnızca `settings-nav.ts`** güncellenir; layout'a ikinci liste yazılmaz.

---

## Git / repo güvenliği

Canlı kod ile yerel disk uyumlu olsa bile **commit edilmemiş** değişiklikler olabilir. Her büyük deploy öncesi:

```bash
git checkout -b safety/pre-deploy-YYYYMMDD
git add -A && git commit -m "chore: deploy öncesi güvenlik snapshot"
```

Bu commit canlıyı etkilemez; kayıp ve geri dönüş için sigorta görevi görür.

---

## Yasaklar

- `--delete` rsync ile tüm `apps/web` silmeden önce baseline almadan sync
- `docker image prune -af` bilinen iyi tag'ler korunmadan
- Eski worktree'den (d272, d278) dosya kopyalama Mustafa onayı olmadan
- Hub'ı kaldırıp `/panel/kullanicilar`'a redirect etme (geri alınmış karar)
- Emoji'li eski ayarlar menüsünü geri getirme

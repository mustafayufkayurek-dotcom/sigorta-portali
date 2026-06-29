# Deploy Güvenlik Protokolü

**Amaç:** Sayfa kaybı, eski UI'ya dönüş, kısmi sync, yanlış build context ve migration felaketlerini önlemek.

**Son bilinen iyi sürüm:** Web `v78` + Backend `v43` (`deploy/manifests/KNOWN_GOOD_IMAGES.json`)

---

## Altın kurallar (asla ihlal edilmez)

1. **Ürün kararı > kod.** Canlıda Mustafa'nın onayladığı ekran geri alınamaz.
2. **Kısmi rsync yasak** — tek dosya hotfix ancak kritik hash doğrulaması sonrası.
3. **Build context = `/opt/app/apps/`** — `source/` değil.
4. **Backend deploy = DB yedeği zorunlu.**
5. **Web-only deploy** açıkça etiketlenir; backend image değişmez.
6. **Rollback image'ları silinmez** (v28 web, v27/v26 backend).
7. **Deploy sonrası smoke test PASS olmadan "canlıya alındı" denmez.**

---

## Deploy öncesi checklist

| # | Adım | Komut |
|---|------|--------|
| 1 | Disk + docker | `bash scripts/pre-deploy-check.sh` |
| 2 | Güvenlik paketi | `bash scripts/pre-deploy-safety.sh v30-etiket` |
| 3 | Kritik dosya uyumu | `bash scripts/verify-critical-paths.sh --remote` |
| 4 | Baseline al | `bash scripts/capture-live-baseline.sh pre-v30` |
| 5 | Scope netliği | Web-only mu, full mu? Migration var mı? |

---

## Deploy sırası (standart)

```bash
# 1) Yerelden sunucuya — tercihen tam apps/web veya apps/backend klasörü
rsync -avz apps/web/ root@94.138.216.18:/opt/app/apps/web/

# 2) Sunucuda
ssh root@94.138.216.18
cd /opt/app
bash scripts/pre-deploy-safety.sh v30-xxx
docker build -f Dockerfile.web -t sigorta-web:TAG --build-arg NEXT_PUBLIC_API_URL=https://app.meridyen-tr.com/api/v1 .
# override güncelle → compose up -d --no-deps web
```

**Backend + migration:** pre-deploy-safety DB yedeği → build backend → `prisma migrate deploy` → smoke.

---

## Deploy sonrası

```bash
bash scripts/post-deploy-smoke.sh
bash scripts/verify-critical-paths.sh --remote
```

Mustafa ekran kontrolü (Cmd+Shift+R) — özellikle:
- Kullanıcı Davet Et
- Ayarlar hub / Tanımlar Merkezi
- Son değiştirilen sayfa

---

## Rollback (≤5 dk)

```bash
ssh root@94.138.216.18
cd /opt/app
bash scripts/rollback-production.sh              # v29/v27
bash scripts/rollback-production.sh web-only     # web v28
```

Override yedekleri: `/opt/app/backups/override_*`

---

## Regresyon önleme — tek kaynak

| Konu | Tek kaynak dosya |
|------|------------------|
| Ayarlar menü + hub kartları | `apps/web/src/config/settings-nav.ts` |
| Tanımlar geri linki | `apps/web/src/utils/settings-definition-nav.ts` |
| Sol menü | `apps/web/src/app/panel/layout.tsx` |
| Kritik hash listesi | `deploy/manifests/CRITICAL_PATHS.txt` |

Yeni ayar sayfası eklerken **yalnızca `settings-nav.ts`** güncellenir; layout'a ikinci liste yazılmaz.

---

## Git / repo güvenliği

Canlı kod ile yerel disk uyumlu olsa bile **~80 dosya commit edilmemiş** durumda. Her büyük deploy öncesi:

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

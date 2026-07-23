# Deploy Özeti — v393 Dalga 1 Route Gate

**Tarih:** 2026-07-23  
**Kapsam:** **web-only** · Migration **yok** · Backend değişmedi (v390)  
**Commit:** `ed1ef40`  
**Etiket:** `v393-dalga1-route-gate`  
**Dalga 2:** dahil edilmedi  

---

## Build numarası / image

| | |
|--|--|
| Web image | `sigorta-web:dalga2-agreement-hr-01-v393-amd64` |
| Backend image | `app-backend:dalga2-agreement-hr-01-v390-amd64` (değişmedi) |
| Rollback web | `v392` |
| Rollback backend | `v390` |
| Compose | `-p sigorta-hasar-sistemi` |

---

## Deploy öncesi kapılar

| Kapı | Sonuç |
|------|--------|
| Typecheck | **PASS** |
| Build | **PASS** |
| Smoke route-gate | **PASS** (PARTIAL: çıkış sonrası URL — Login dalgası notu) |
| Migration | **Yok** (D1’de prisma değişikliği yok) |
| Environment | Health 200 · giris 200 · disk %79 · override ok |

---

## Deploy sonrası doğrulama

| Kontrol | Sonuç |
|---------|--------|
| Live web image | **v393** · healthy |
| nginx → web | **PASS** |
| `/api/v1/health` | **PASS** (`status:ok`) |
| `/giris` · `/panel` | **200** |
| `pnpm smoke:route-gate` | **PASS** FAIL=0 PARTIAL=1 |
| `post-deploy-smoke` login | **FAIL beklenen** — `LOGIN_*` yok (önceki deploy’larla aynı) |

---

## Değişen dosyalar (canlıya alınan — Dalga 1)

### Yeni
- `apps/web/src/utils/api-error.ts`
- `apps/web/src/utils/report-caught-error.ts`
- `apps/web/src/utils/fetch-province-districts.ts`
- `apps/web/src/utils/in-flight-guard.ts`
- `apps/web/src/utils/panel-route-access.rules.json`
- `scripts/smoke-route-gate.sh`
- `scripts/lib/route-gate-smoke.mjs`
- Enterprise governance docs + Feature Freeze kuralı

### Güncellenen (özet)
- `layout.tsx` · `panel-access.ts` — Route Gate
- `ClaimNewForm` · `EmergencyCaseNewForm` · Customer picker/select
- `GeographicRegionScopePanel` · kullanıcılar/tedarikçiler ilçe fetch
- `VendorDiscoveryPanel` · `SearchableSelect` · `ToastContext`
- `api-client.ts` · `ErrorBoundary` · `LocationPickerModal` (Haritada Aç)
- `post-deploy-smoke.sh` · `deploy-web-production.sh`

### Bilinçli hariç (rsync öncesi stash)
- Sigorta portal WIP / OperationReference*
- Hasar/acil detay whitespace
- Backend `users.service.ts`
- Raporlar / operasyon / carilerim vb. kirli WIP

---

## Bilinen riskler

1. **Çıkış sonrası eski URL** smoke PARTIAL — Login dalgasında; Dalga 1 açılmaz  
2. **post-deploy login smoke** yerel credential olmadan FAIL görünür — health/nginx/route-gate PASS  
3. Feature Freeze aktif — D1 akışlarına regresyon yasak  
4. Stash’te Dalga 2 dışı WIP duruyor — `git stash list` ile geri alınabilir  

---

## Rollback

```bash
bash scripts/rollback-production.sh web-only
# web → v392, backend → v390 kalır
```

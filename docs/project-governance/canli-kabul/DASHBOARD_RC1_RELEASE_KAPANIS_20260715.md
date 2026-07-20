# Dashboard RC1 — Release Kapanış (2026-07-15)

**Durum:** Dashboard RC1 **Frozen** (canlı web v357)  
**Kapsam:** Doğrulama + doküman kapanış — yeniden deploy yok · EPIC-02 kodu yok

| Alan | Değer |
|------|--------|
| Production web | `sigorta-web:dalga2-agreement-hr-01-v357-amd64` (healthy) |
| Production backend | `app-backend:dalga2-agreement-hr-01-v356-amd64` (healthy) |
| Feature commit | `65734ac6a2ab642a6b35b2a1efddd11d2fd7691f` |
| Tag (hedef) | `v357-dashboard-rc1-freeze` |
| Compose project | `sigorta-hasar-sistemi` |
| Freeze politika | `docs/project-governance/DASHBOARD_RC1_FREEZE.md` |
| Production ürün kabulü | `docs/project-governance/PRODUCTION_URUN_KABULU.md` — kullanıcı kabul eder; Cursor prod login/credential istemez |

## Smoke / Health (kapanış turu)

| Kontrol | Sonuç |
|---------|--------|
| Health (`/api/v1/health`) | **PASS** — `"status":"ok"` |
| Unauth route smoke (`post-deploy-smoke.sh`) | **PASS** — `/giris` + panel route’ları 200 |
| Auth login smoke | **FAIL** — sunucu `/opt/app` + local `.env*` içinde `LOGIN_EMAIL` / `LOGIN_PASSWORD` yok; varsayılan seed credential production’da geçersiz |
| Authenticated dashboard tık/href | **YAPILAMADI** (login yok) |

**Smoke özeti:** **PARTIAL** (health + route PASS · auth FAIL)

## KNOWN_GOOD / panel-build-info

Protokol: auth smoke **PASS** sonrası güncelleme.

Bu kapanış turunda **güncellenmedi** (hâlâ v356 etiketi). Canlı web fiilen v357; metadata auth PASS sonrası v357 + rollback v356 yapılacak.

## Freeze

- Dashboard kabuğu / layout / KPI yerleşimi / brand — **Frozen**
- Yeni odak: EPIC-02 – Hasar Dosyası (`inbox/EPIC-02_HASAR_DOSYASI.md`)
- Açık dashboard görevleri kapatıldı; yeni dashboard görevi açılmadı

## Kalan tek engel (metadata)

Production `LOGIN_EMAIL` + `LOGIN_PASSWORD` verilirse: authenticated smoke (Login → Dashboard → Kritik Operasyonlar / Son Aktiviteler / Kritik Uyarılar → Logout) → PASS sonrası `KNOWN_GOOD_IMAGES.json` + `panel-build-info.ts` → v357 commit/push.

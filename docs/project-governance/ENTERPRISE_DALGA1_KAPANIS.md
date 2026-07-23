# Dalga 1 — Kapanış Raporu (PASS)

**Tarih:** 2026-07-23  
**Durum:** ✅ **PASS — KAPANDI** (Mustafa kapanış onayı: 2026-07-23)  
**Feature Freeze:** ✅ AKTİF (`ENTERPRISE_FEATURE_FREEZE.md` · D1-*)  
**Dalga 2:** Kilitli — yeni görev + kapsam onayı olmadan uygulama yok  
**Push / deploy / canlı:** Yapılmadı

---

## Kapanış özeti

Dalga 1 (kritik kullanıcı akışı + Route Gate güvenliği) tamamlandı ve Mustafa tarafından onaylandı.

| Paket | Onay | Sonuç |
|-------|------|--------|
| Form / seçim / il-ilçe / hasar konusu / kaydet / sessiz catch / runtime / çift kayıt | Onaylandı | PASS |
| Route Gate (exact `/panel`, portal allowlist, Yetkiniz Bulunmamaktadır) | Onaylandı | PASS |
| Kalıcı Route Gate smoke seti | Onaylandı | PASS (matrix) |
| Feature Freeze’e alma | Onaylandı | AKTİF |

---

## Kalıcı smoke seti (bundan sonra zorunlu)

**Komutlar:**
```bash
pnpm smoke:route-gate
# veya
bash scripts/smoke-route-gate.sh
```

**Entegre:** `scripts/post-deploy-smoke.sh` sonunda otomatik çağrılır.

### Senaryo kapsaması

| # | Senaryo | Nasıl doğrulanır |
|---|---------|------------------|
| 1 | Yetkili → yetkili sayfa | Matrix RG-01…04 |
| 2 | Yetkisiz → korunan sayfa | Matrix RG-05…08 |
| 3 | Portal → Personel | Matrix RG-09…12 |
| 4 | Personel → Portal | Matrix RG-13…16 |
| 5 | Doğrudan URL | Matrix RG-17…19 |
| 6 | Browser Refresh | Matrix RG-20…21 |
| 7 | Back / Forward | NAV sequence |
| 8 | Deep Link | Portal child path’ler |
| 9 | Oturum süresi dolmuş / oturumsuz | API 401 (Smoke B) |
| 10 | Geçersiz token | API 401 (Smoke B) |
| 11 | Çıkış sonrası eski URL | **PARTIAL (not)** — Login dalgasında; Dalga 1 açılmaz |

**Tek kaynak:** `apps/web/src/utils/panel-route-access.rules.json`  
**Runner:** `scripts/lib/route-gate-smoke.mjs`

---

## PARTIAL notu (kapanış kararı)

**«Çıkış sonrası eski URL»** smoke maddesi PARTIAL olarak kayıtlı kalır.  
Login / oturum modülünün ilgili dalgasında ele alınır.  
**Dalga 1 bu madde için yeniden açılmaz.**

---

## Sonraki adım

- **Dalga 1:** Kapalı (PASS) + Feature Freeze.  
- **Dalga 2:** Yalnızca hazırlık (`ENTERPRISE_DALGA2_HAZIRLIK.md`) — uygulama için yeni onay gerekir.  
- Deploy/push yok.

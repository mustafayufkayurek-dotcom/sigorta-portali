# Dalga 4 — B1 Finans UX (D276) Uygulama Planı

**Karar:** Mustafa — 28 Haziran 2026  
**Branch:** `safety/pre-inventory-20260628`  
**Deploy tipi:** Web-only (backend v27 sabit)  
**Güvenlik:** `DEPLOY_GUVENLIK_PROTOKOLU.md`

---

## Mevcut durum (d266 / canlı v29)

| Bileşen | Durum |
|---------|--------|
| `/panel/finans` | Finans Özeti dashboard — modül kartları + işlem tablosu |
| Alt sayfalar | tahsilatlar, faturalar, masraflar, sabit-giderler, karlılık, banka-hesaplari, dosya-pl, portfolyo-pl, fatura-talepleri |
| `/panel/carilerim` | 253 satır — müşteri/dosya listesi (ayrı route) |
| Masraflar D276G | Akıllı masraf yakalama — **canlıda olabilir** (ayrı paket) |

## D276 hedefi (ARCHIV)

- Finans navigasyonu olgunlaştırması
- Carilerim UX iyileştirmesi
- 10 dosyalık patch (layout **dokunulmadan** — d278/d266 nav korunur)
- **D276G masraflar ile çift uygulama yapılmamalı**

## Dalga 4 kapsam önerisi (minimal, güvenli)

### Faz 1 — Analiz (bu oturum)
1. Projects/sigorta-hasar-sistemi finans dosyaları ile d266 diff
2. Layout/layout.tsx **hariç** taşınabilir dosya listesi
3. Mustafa'ya önizleme (yerel) — deploy yok

### Faz 2 — Uygulama
- Yalnızca `apps/web/src/app/panel/finans/**` ve `carilerim/page.tsx`
- Ayarlar/panel layout **dokunulmaz**
- settings-nav / layout tek kaynak kuralı geçerli

### Faz 3 — Deploy
1. `pre-deploy-safety.sh finans-b1-v30`
2. `verify-critical-paths.sh --remote`
3. Web build `sigorta-web:dalga2-agreement-hr-01-v30-amd64`
4. `post-deploy-smoke.sh` + Mustafa PASS

### Rollback
`rollback-production.sh web-only` → v29

---

## Adım 2 (paralel — Mustafa)

`docs/project-governance/canli-kabul/ekran-goruntuleri/` altına kısa screenshot turu — Finans dahil satır 13.

---

## Sonraki aksiyon (agent)

Projects kaynağından finans diff raporu üret → onay → patch uygula.

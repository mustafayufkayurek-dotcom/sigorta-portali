# Canlı Kabul Checklist

**Güncelleme:** 29 Haziran 2026  
**Canlı:** https://app.meridyen-tr.com  
**Bilinen iyi sürüm:** Web v78 + Backend v43 (`deploy/manifests/KNOWN_GOOD_IMAGES.json`)

Durum kodları: `⏳ Bekliyor` | `🤖 Otomatik PASS` | `✅ Mustafa PASS` | `❌ FAIL`

| # | Modül | Route | Otomatik | Mustafa | Not |
|---|-------|-------|----------|---------|-----|
| 1 | Login | `/giris` | 🤖 PASS | ⏳ | HTTP 200 |
| 2 | Kullanıcılar | `/panel/kullanicilar` | 🤖 PASS | ⏳ | Route 200 |
| 3 | Ayarlar hub | `/panel/ayarlar` | 🤖 PASS | ⏳ | |
| 4 | Tanımlar Merkezi | `/panel/ayarlar/tanimlar` | 🤖 PASS | ⏳ | |
| 5 | Masraf kategorileri | `/panel/ayarlar/masraf-kategorileri` | 🤖 PASS | ⏳ | v26 |
| 6 | İş grupları | `/panel/ayarlar/is-gruplari` | 🤖 PASS | ⏳ | v27 |
| 7 | Dosya konuları | `/panel/ayarlar/dosya-konulari` | 🤖 PASS | ⏳ | v28 |
| 8 | Evrak türleri | `/panel/ayarlar/evrak-turleri` | 🤖 PASS | ⏳ | v28 |
| 9 | Mahaller | `/panel/ayarlar/mahaller` | 🤖 PASS | ⏳ | v29 |
| 10 | Hizmet türleri | `/panel/ayarlar/hizmet-turleri` | 🤖 PASS | ⏳ | v29 |
| 11 | Navigasyon | `/panel` | 🤖 PASS | ⏳ | Route 200 |
| 12 | CRM | `/panel/crm` | ⏳ | ⏳ | Smoke'a henüz eklenmedi |
| 13 | Finans | `/panel/finans` | 🤖 PASS | ⏳ | B1 adayı |
| 14 | Müşteriler | `/panel/musteriler` | 🤖 PASS | ✅ | v76–v78: yeşil tema, SlidePanel, İlişki Özeti, form UX |
| 15 | Tedarikçiler | `/panel/tedarikciler` | 🤖 PASS | ⏳ | Sıradaki modül |
| 16 | Mail / hoş geldin | davet akışı | ❌ | ⏳ | Smoke login — gerçek test şifresi gerekli |

**Otomatik log:** `otomatik/smoke-musteri-v78.log` (hedef)

---

## Dalga 3 ilerleme

- [x] Adım 1 — Git safety snapshot (müşteri modülü — devam ediyor)
- [x] Adım 2 — Mustafa PASS — Müşteriler (29 Haziran 2026)
- [ ] Adım 3 — B paketi öncelik kararı

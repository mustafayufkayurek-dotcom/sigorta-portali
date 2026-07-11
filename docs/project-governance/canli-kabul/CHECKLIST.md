# Canlı Kabul Checklist

**Güncelleme:** 10 Temmuz 2026  
**Canlı:** https://app.meridyen-tr.com  
**Bilinen iyi sürüm:** Web **v248** + Backend **v248** (`deploy/manifests/KNOWN_GOOD_IMAGES.json`)  
**Etiket:** `v248-dashboard-delta-hasar-detay`  
**Rollback:** Web v247 + Backend v247  
**Smoke rotaları:** manifest `mustPassSmokeRoutes` ile senkron

Durum kodları: `⏳ Bekliyor` | `🤖 Otomatik PASS` | `✅ Mustafa PASS` | `❌ FAIL`

| # | Modül | Route | Otomatik | Mustafa | Not |
|---|-------|-------|----------|---------|-----|
| 1 | Login | `/giris` | 🤖 PASS | ⏳ | HTTP 200; logo/karşılama — `CANLI_YEREL_KONTROL_OTURUMU.md` |
| 2 | Kullanıcılar | `/panel/kullanicilar` | 🤖 PASS | ⏳ | Route 200 |
| 3 | Ayarlar hub | `/panel/ayarlar` | 🤖 PASS | ⏳ | |
| 4 | Tanımlar Merkezi | `/panel/ayarlar/tanimlar` | 🤖 PASS | ⏳ | |
| 5 | Masraf kategorileri | `/panel/ayarlar/masraf-kategorileri` | 🤖 PASS | ⏳ | v26 |
| 6 | İş grupları | `/panel/ayarlar/is-gruplari` | 🤖 PASS | ⏳ | v27 |
| 7 | Dosya konuları | `/panel/ayarlar/dosya-konulari` | 🤖 PASS | ⏳ | v28 |
| 8 | Evrak türleri | `/panel/ayarlar/evrak-turleri` | 🤖 PASS | ⏳ | v28 |
| 9 | Mahaller | `/panel/ayarlar/mahaller` | 🤖 PASS | ⏳ | v29 |
| 10 | Hizmet türleri | `/panel/ayarlar/hizmet-turleri` | 🤖 PASS | ⏳ | v29 |
| 11 | Müşteri tipleri | `/panel/ayarlar/musteri-tipleri` | 🤖 PASS | ⏳ | Smoke listesinde |
| 12 | Eksper–sigorta ilişkileri | `/panel/ayarlar/eksper-sigorta-iliskileri` | 🤖 PASS | ⏳ | Smoke listesinde |
| 13 | Saha tespit kolları | `/panel/ayarlar/saha-tespit-kollari` | 🤖 PASS | ⏳ | Smoke listesinde |
| 14 | Tedarikçi hizmet kolları | `/panel/ayarlar/tedarikci-hizmet-kollari` | 🤖 PASS | ⏳ | Smoke listesinde |
| 15 | Entegrasyonlar | `/panel/ayarlar/entegrasyonlar` | 🤖 PASS | ⏳ | Google Places, M365, PayTR ayarları |
| 16 | Navigasyon / panel | `/panel` | 🤖 PASS | ⏳ | Route 200; sidebar v233+ |
| 17 | Yönetim Merkezi dashboard | `/panel` (admin) | 🤖 PASS | ⏳ | v248 — Finans Özeti + Operasyon + Haftalık Performans |
| 18 | Finans Merkezi | `/panel/finans` | 🤖 PASS | ⏳ | v248 dashboard mockup; alt sayfalar ayrı kabul |
| 19 | Carilerim | `/panel/carilerim` | 🤖 PASS | ⏳ | Smoke listesinde |
| 20 | Raporlar | `/panel/raporlar` | 🤖 PASS | ⏳ | Smoke listesinde |
| 21 | Müşteriler | `/panel/musteriler` | 🤖 PASS | ✅ | v76–v78: yeşil tema, SlidePanel, İlişki Özeti, form UX |
| 22 | Tedarikçiler | `/panel/tedarikciler` | 🤖 PASS | ⏳ | Dış kaynak arama Faz 2–3 canlı |
| 23 | Hasar dosyası detay | `/panel/hasar-dosyalari/[id]` | ⏳ | ⏳ | v248 — sigortalı/adres/ihbar alanları; manuel smoke |
| 24 | Operasyon gelen kutusu | `/panel/operasyon/gelen-kutusu` | 🤖 PASS | ⏳ | T1–T7 test paketi — `inbox/OPERASYON_GELEN_KUTUSU.md` |
| 25 | Harita | `/panel/harita` | 🤖 PASS | ⏳ | v125+ pinler; Mustafa manuel test ⬜ |
| 26 | Personel özlük | `/panel/personel-ozluk` | 🤖 PASS | ⏳ | Smoke listesinde |
| 27 | Eksper portal | `/panel/eksper-portal` | 🤖 PASS | ⏳ | Alt: `/dosyalar`, `/randevular` |
| 28 | Sigorta portal | `/panel/sigorta-portal` | 🤖 PASS | ⏳ | Alt: `/dosyalar`, `/dosya-akisi` |
| 29 | CRM | `/panel/crm` | ⏳ | ⏳ | Route 200; smoke listesinde yok — tam kapsam eksik |
| 30 | Mail / hoş geldin | davet akışı | ❌ | ⏳ | Smoke login — gerçek test şifresi gerekli |
| 31 | Statik kılavuz PDF | `/docs/01-personel-kullanim-kilavuzu.pdf` vb. | 🤖 PASS | ⏳ | Smoke listesinde (4 PDF + logo) |

**Otomatik log:** `otomatik/smoke-v248.log` (hedef — `post-deploy-smoke.sh` çıktısı)

**İlgili envanter:** `docs/project-governance/CANLIYA_ALINMAMIS_ENVANTER.md`

---

## İlerleme

### Dalga 3 (29 Haziran 2026)
- [x] Adım 1 — Git safety snapshot (müşteri modülü)
- [x] Adım 2 — Mustafa PASS — Müşteriler (29 Haziran 2026)
- [x] Adım 3 — B paketi öncelik kararı (Finans dashboard → v248’de kısmen kapandı)

### Dalga 5–6 (v248 sonrası — açık)
- [ ] Mustafa test oturumu — `BACKLOG.md` (harita, mobil, rol bazlı ihbar, deep link)
- [ ] Operasyon gelen kutusu T1–T7 PASS
- [ ] v248 dashboard + hasar detay Mustafa PASS
- [ ] Screenshot klasörü — `canli-kabul/ekran-goruntuleri/`

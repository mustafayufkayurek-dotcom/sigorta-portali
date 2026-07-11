# Deploy Geçmişi — Canlı Durum Özeti

**Tek kaynak (image):** `deploy/manifests/KNOWN_GOOD_IMAGES.json`  
**Açık işler:** `CANLIYA_ALINMAMIS_ENVANTER.md`  
**Son güncelleme:** 11 Temmuz 2026 sabah

> Her deploy sonrası: bu dosyaya **yeni satır** + manifest `label` / `description` güncelle. Sohbet değil, bu dosya “son ne alındı?” cevabıdır.

---

## Canlı durum (11 Temmuz 2026 sabah)

| Servis | Sürüm | Durum |
|--------|-------|--------|
| **Web** | `sigorta-web:dalga2-agreement-hr-01-v248-amd64` | healthy |
| **Backend** | `app-backend:dalga2-agreement-hr-01-v249-amd64` | healthy |
| **Rollback** | Web **v247** / Backend **v248** | manifest `rollbackImages` |
| **Etiket** | `v249-inbound-ingest-fix` | |

---

## Son deploy kronolojisi

### v246 — Full (önceki oturum)

- 403 / erişim düzeltmeleri (dosya sorumlusu)
- Hasar dosyası görünürlük + otomatik ofis ataması
- Bireysel tedarikçi `firstName` hatası
- İş grubu ekleme yetkisi
- Gelen kutusu v245 özellikleri

### v247 — Full

- Global arama (mailler, acil dosyalar, sigortalı adı)
- Operasyon tablosu **Sigortalı Adı Soyadı** sütunu
- Bitişik dosya no eşleştirme (`50663701` ↔ `5066 3701`)

### v248 — Full (10 Temmuz 2026)

- **Dashboard iskeleti** — Finans Özeti + Operasyon Özeti + Haftalık Performans bölümleri *(onaylı mockup şablonu birebir değil — bkz. envanter P1)*
- Yan menü yenilemesi (daralt/genişlet, Finans Merkezi)
- Hasar detay paneli: sigortalı adı, hasar adresi, ihbar içeriği
- Yeni dosyada `insuredName` kaydı düzeltmesi
- HASAR Graph delta otomatik kurtarma (sync state not found → delta sıfırla + yeniden tara)
- Operational access grants + 2 migration
- Oturum güvenliği, IDOR scope, sidebar UX (v232–v234 commit’leri)

### v249 — Backend-only (10 Temmuz 2026, v248 sonrası)

- Inbound ingest build fix (`ef87cdb` — kullanılmayan job parametresi)
- Web **v248 sabit** kaldı

### Operasyonel (deploy değil, canlıda uygulandı)

- HASAR gelen kutusu delta manuel sıfırlama + senkron → `50663701` Aynur Yar ve `50663630` Ayla Belgin mailleri çekildi

---

## Canlıda VAR (tekrar deploy gerekmez)

**Platform:** Ayarlar anayasası, kullanıcı davet, KVKK modal, Tanımlar hub, sol menü + kılavuz

**Operasyon / hasar:** Gelen kutusu çekirdek, dosya açma modal, global arama, operasyon sigortalı sütunu, bitişik dosya no, hasar detay paneli, 403 düzeltmeleri

**Finans:** Finans Merkezi sayfası, v248 dashboard **iskelet** kartları, PayTR kod yolu (`/odeme/[token]`)

**Diğer:** Harita pinleri, tedarikçi dış kaynak arama, personel özlük, eksper/sigorta/broker portalları, MinIO, müşteri modülü UX

---

## Canlıda YOK / henüz yapılmadı

### Deploy bekleyen kod

| # | Konu | Durum |
|---|------|--------|
| — | Repoda olup canlıda olmayan kod | **Boş** — son gap v249’da kapandı |

### Ürün — onaylı şablon implementasyonu (kod iskeleti canlı, UI şablonu değil)

| # | Konu | Mockup / not |
|---|------|----------------|
| P1 | Admin **Yönetim Merkezi** şablonu birebir UI | `docs/design-mockups/admin-yonetim-merkezi-dashboard-mockup.png` |
| P2 | **Dosya sorumlusu** dashboard şablonu birebir UI | Ayrı mockup / doğrulama gerekir |

### Ops işi (kod deploy değil)

| # | Konu | Dosya |
|---|------|-------|
| D2 | Eski hasar dosyalarına ofis ataması backfill | `scripts/backfill-orphan-claim-office-assignments.sql` |

### Veri düzeltmesi (deploy değil)

- `2026 YB 13237` — sigortalı adı boş; panelden veya SQL ile manuel güncelleme (eski kayıt)

### Kabul / test eksik (A paketi)

A1 screenshot, A2 BACKLOG 13 madde, A3 gelen kutusu T1–T7, A4 giriş logo, A5 davet maili, A6 harita — ayrıntı: `CANLIYA_ALINMAMIS_ENVANTER.md`

### Gelecek faz (B paketi)

PayTR canlı mod, CRM derinliği, gelen kutusu F2–F3, saha keşif, e-imza — ayrıntı: envanter B maddeleri

---

## Özet cümle

Son büyük **kod** paketi **v248 (web) + v249 (backend)** canlıda: hasar detay, HASAR delta kurtarma, global arama, 403 ve gelen kutusu düzeltmeleri dahil. **Deploy bekleyen yeni kod yok.** Onaylı **dashboard şablonunun tam UI implementasyonu (P1/P2)** açık. Sırada: şablon paketi → Mustafa PASS → ops backfill (D2).

---

## Deploy sonrası güncelleme şablonu

```markdown
### vNNN — Web-only | Backend-only | Full (TARİH)
- Madde 1
- Madde 2
Rollback: ...
```

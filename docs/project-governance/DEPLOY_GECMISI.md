# Deploy Geçmişi — Canlı Durum Özeti

**Tek kaynak (image):** `deploy/manifests/KNOWN_GOOD_IMAGES.json`  
**Açık işler:** `CANLIYA_ALINMAMIS_ENVANTER.md`  
**Son güncelleme:** 11 Temmuz 2026 akşam

> Her deploy sonrası: bu dosyaya **yeni satır** + manifest `label` / `description` güncelle. Sohbet değil, bu dosya “son ne alındı?” cevabıdır.

---

## Canlı durum (11 Temmuz 2026 — v281 web)

| Servis | Sürüm | Durum |
|--------|-------|--------|
| **Web** | `sigorta-web:dalga2-agreement-hr-01-v281-amd64` | healthy |
| **Backend** | `app-backend:dalga2-agreement-hr-01-v276-amd64` | healthy |
| **Rollback** | Web **v280** / Backend **v276** | manifest `rollbackImages` |
| **Etiket** | `v281-light-mode-logo-scale` | |

---

## Son deploy kronolojisi

### v281 — Web-only (11 Temmuz 2026 gece)

- **Koyu mod kapalı** — test aşaması `PANEL_FORCE_LIGHT_MODE`
- Logo ölçeği **v274/ade5d73** seviyesine döndü (5rem şişirme geri alındı)
- Commit: `6d6d0a0`

### v280 — Web-only (11 Temmuz 2026 gece)

- Logo şeridi **koyu temada da beyaz** — dar menü yanıltıcı koyu şerit kaldırıldı
- Geniş menü logo **5.25rem** belirgin; dar küre h-11
- Commit: `b98076c`

### v279 — Web-only (11 Temmuz 2026 gece)

- Sidebar logo **ölçeklendirme** — ade5d73 cilası: dar menü beyaz kart + büyük küre; geniş menü 4.5rem logo
- v278 ölçek regresyonu geri alındı
- Backend **v276 sabit**; migration yok
- Commit: `f52f9cd`

### v278 — Web-only (11 Temmuz 2026 gece)

- **S2 dar menü logo:** `meridyen-globe-square.png` geri — v277 SVG ihlali geri alındı (`ONAYLI_UI_CHECKLIST`)
- Backend **v276 sabit**; migration yok
- Smoke: login FAIL (yerel credential — bilinen); routing PASS; web healthy
- Commit: `4ef1981`

### v277 — Web-only (11 Temmuz 2026 gece)

- **Sidebar logo:** dar menü `MeridyenGlobeAnimated` SVG; geniş menü `meridyen-logo-original.png`
- **Koyu tema:** geniş logo için beyaz zemin (JPEG şeffaf değil)
- Backend **v276 sabit**; migration yok
- Pre-deploy: disk/routing PASS; nginx → web PASS
- Smoke: login FAIL (yerel credential — bilinen, v274 ile aynı); diğer rotalar PASS; web container healthy v277
- Commit: `e0bd4fc`

### v276 — Full (11 Temmuz 2026 akşam)

- **İhbar konusu:** canonical only; gelen kutusu `claimSubjectId` bağlama
- **Logo:** sidebar beyaz kutu kaldırıldı
- **E-posta 404:** panel URL + `/claim-files/*` redirect
- **Onarım raporu:** yatay revizyon geçmişi (Dosya Bilgileri içinde)
- **Sürüm etiketi:** `panel-build-info.ts` → v276
- Migration yok
- Commit: `1fafa1b`
- Disk: eski image temizliği sonrası deploy (korunan: v275, v274 web, v272 backend)

### v275 — Full (11 Temmuz 2026 akşam)

- Operasyon dosya tıklama **500** düzeltmesi (`claim?.latestRepairReport`)
- **İhbar konusu** eşlemesi (`resolveClaimIhbarKonusu`); API claimSubject dahil
- Mail terminoloji normalizasyonu (Cam Kırılması, Dahili Su vb.)
- Sidebar nav aktif/hover kontrastı; sütun sıra ↑↓ ve genişlik iyileştirmesi
- Migration yok
- Commit: `9d26122`

### v274 — Web-only (11 Temmuz 2026 akşam)

- Koyu tema **tablo zebra kontrastı** — dosyalar okunur
- **Sidebar logo** kalıcı CSS: `rounded-xl`, ölçek, dar menü küre çipi
- Backend **v272 sabit**; migration yok
- Smoke: login FAIL (yerel credential — bilinen); routing PASS; web healthy
- Commit: `ade5d73`

### v273 — Web-only (11 Temmuz 2026 akşam)

- Onarım raporu dosya sorumlusu **23 madde UX** geri bildirimi
- Rapora Git doğrudan rapor sayfası; Dosya Bilgileri eksper/ihbar; tablo satır UX; Tespit sütunu; tedarikçi modal/hafıza; alt bant; revizyon geçmişi taşıma
- Backend **v272 sabit**; migration yok
- Smoke: login FAIL (yerel credential — bilinen); routing PASS; web healthy
- Commit: `6c9bfbc`

### v251 — Web-only (11 Temmuz 2026)

- Sidebar kabuğu cilası: **Menüyü Daralt** + **rol kılavuzu** alt bölümde sabit
- Logo: küre + MERİDYEN / ASİSTANCE (beyaz kutu kaldırıldı)
- Yuvarlak köşeler (12px), içerik kaydırması menüyü kesmez
- Backend **v249 sabit**

### v250 — Web-only (11 Temmuz 2026)

- **P1 şablon:** Lacivert sidebar (tam logo / küre, Menüyü Daralt, rehber kartı)
- **Admin Yönetim Merkezi:** Admin rozeti, kırmızı Yeni Acil, Pazartesi Toplantısı
- Operasyon 6 kompakt kart + yüzde, Ekip Yoğunluğu grafiği
- Günün Akışı şeridi + büyük Gider Dağıtımı kartı
- Alt sıra: Kritik Uyarılar | Finans Darboğazları | Personel Yük (progress bar)
- Backend **v249 sabit** — migration yok
- Mustafa onayı: 11 Temmuz 2026

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

**Finans:** Finans Merkezi sayfası, v250 **Yönetim Merkezi** şablonu (admin), PayTR kod yolu (`/odeme/[token]`)

**Diğer:** Harita pinleri, tedarikçi dış kaynak arama, personel özlük, eksper/sigorta/broker portalları, MinIO, müşteri modülü UX

---

## Canlıda YOK / henüz yapılmadı

### Deploy bekleyen kod

| # | Konu | Durum |
|---|------|--------|
| — | Repoda olup canlıda olmayan kod | **Boş** — son gap v250’de kapandı |

### Ürün — şablon sonrası açık işler

| # | Konu | Mockup / not |
|---|------|----------------|
| P2 | **Dosya sorumlusu** dashboard şablonu birebir UI | Ayrı mockup / doğrulama gerekir |
| P1 | Admin şablon — Mustafa canlı screenshot PASS | `canli-kabul/ekran-goruntuleri/p1-v250/` |

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

Son büyük **kod** paketi **v250 (web-only) + v249 (backend)** canlıda: P1 sidebar + admin dashboard şablonu dahil. **Deploy bekleyen yeni kod yok.** Sırada: canlı screenshot PASS (P1), dosya sorumlusu şablonu (P2), ops backfill (D2).

---

## Deploy sonrası güncelleme şablonu

```markdown
### vNNN — Web-only | Backend-only | Full (TARİH)
- Madde 1
- Madde 2
Rollback: ...
```

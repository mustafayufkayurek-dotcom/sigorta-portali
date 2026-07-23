# Route Gate Teslim — Dalga 1 (onaylı güvenlik)

**Tarih:** 2026-07-23  
**Durum:** Local doğrulama tamam — kullanıcı kabulü bekleniyor  
**Push / deploy / canlı:** Yapılmadı

## Özet

Kök delik: `/panel` kuralı `roles: []` iken **tüm `/panel/*` alt path’lerini gölgeliyordu**. Portal kullanıcıları ise route gate’ten tamamen muaftı.

Düzeltme: `/panel` exact-only; eşleşmeyen path deny; portal allowlist; yetkisiz erişimde URL korunarak **Yetkiniz Bulunmamaktadır** ekranı.

---

## Açılan / kapatılan route sayıları

| Metrik | Sayı | Açıklama |
|--------|------|---------|
| Eski açık kural sayısı | 24 | `layout.tsx` ROUTE_ACCESS |
| Yeni açık kural sayısı | 33 | `PANEL_ROUTE_ACCESS` |
| Yeni kayıtlı (explicit) route | **+10** | Önceden catch-all ile “açık” görünenler artık rollerle kayıtlı |
| Davranışsal kapatma | **Catch-all deliği** | `/panel` artık alt path açmaz; eşleşmeyen path → deny |
| Portal cross-access kapatma | Tüm personel path’leri | Expert/sigorta yalnızca kendi allowlist’i |

### Yeni kayıtlı (+10 — yetkili roller için açık kalır)

1. `/panel/eksper-portal`  
2. `/panel/sigorta-portal`  
3. `/panel/pazartesi-toplantisi`  
4. `/panel/itirazlar`  
5. `/panel/ozel-dosyalar`  
6. `/panel/eksperler` (legacy → müşteriler)  
7. `/panel/masraflar` (legacy → finans)  
8. `/panel/sigorta-sirketleri` (legacy → ayarlar)  
9. `/panel/kullanicilar-kurtarma-adayi`  
10. `/panel/admin/audit-logs`

### Kapatılan güvenlik delikleri (yetkisiz)

- Portal → personel ekranları (finans, müşteriler, ayarlar, …)  
- Personel → diğer portal ağacı (expert ↔ sigorta)  
- Tanımsız `/panel/*` path’ler (ör. `/panel/bildirimler` sayfası yoksa deny UI)  
- `/panel` prefix catch-all

---

## Yetki matrisi (özet)

| Rol | Ana home | Tipik açık | Tipik kapalı |
|-----|----------|------------|--------------|
| admin | `/panel` | Ayarlar, kullanıcılar, tüm ops | — |
| manager | `/panel` | Ops, pazartesi, personel | Ayarlar hub, kullanıcılar |
| office_staff | `/panel` | Ops, müşteri, CRM, portal (staff) | Kullanıcılar, ayarlar hub |
| field_staff | `/panel` | Hasar dosyaları, carilerim | Finans, ayarlar |
| finance / accountant | `/panel/finans` | Finans, rapor, ops (kurala göre) | Ayarlar hub |
| expert | `/panel/eksper-portal` | Eksper portal + profil | Personel paneli |
| insurance_company_user | `/panel/sigorta-portal` | Sigorta portal + profil | Personel paneli |

Acil yardım: mevcut `canAccessAcilYardimRoute` (departman / delegation) korundu.

---

## Yeni koruma kuralları

1. `/panel` yalnızca **exact** eşleşir; alt path gölgelemez.  
2. Eşleşmeyen path → **deny** (önceki: allow).  
3. Portal rolleri: **allowlist** (`eksper-portal/*` veya `sigorta-portal/*` + `profil` + `/panel` home redirect).  
4. Yetkisiz: **Yetkiniz Bulunmamaktadır** — URL korunur (deep link / refresh / back). Sert `replace` yok.  
5. Güvenli home link: rol bazlı (`getSafePanelHomePath`).  
6. API yetkisi değişmedi; gate yalnızca frontend UI.

---

## Etkilenen ekranlar / dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `apps/web/src/utils/panel-access.ts` | `PANEL_ROUTE_ACCESS`, portal allowlist, `hasPanelRouteAccess`, `getSafePanelHomePath` |
| `apps/web/src/app/panel/layout.tsx` | Gate bağlama; portal muafiyeti kaldırıldı; deny UI metni |

Feature Freeze kabuk (sidebar/logo/dashboard layout) yetkili kullanıcıda değiştirilmedi.

---

## Doğrulama

| Kontrol | Sonuç |
|---------|--------|
| Typecheck | **PASS** |
| Build | **PASS** |
| Lint (`panel-access.ts`, `layout.tsx`) | **PASS** (0 error; 1 pre-existing hooks warning) |
| Smoke (production) | **SKIP** — deploy yok |
| Local smoke | Kullanıcı kabulü: deep link deny UI + yetkili ekranlar |

---

## Bilinen riskler

1. `allowedScreens === null` iken (ör. sözleşme 403 erken dönüş) gate hâlâ kapalı kalabilir — lockout önleme.  
2. `/panel/bildirimler` sayfası yok; deep link artık deny UI (önce catch-all + 404 karışımı).  
3. Pazartesi sayfasındaki kendi `router.replace` (management dışı) duruyor; management dışı layout gate ile de kesilir.  
4. Staff’ın portal sayfalarına erişimi (admin/office) NAV ile aynı — manager bilerek eklenmedi.

---

## Kabul checklist

- [ ] Admin: ayarlar / kullanıcılar açılıyor  
- [ ] Field: hasar açılıyor, finans’ta «Yetkiniz Bulunmamaktadır»  
- [ ] Expert: portal açılıyor, `/panel/finans` deny; `/panel` → portal redirect  
- [ ] Sigorta: portal açılıyor, müşteriler deny  
- [ ] Deny ekranında geri + panele dön; URL değişmeden kalıyor  
- [ ] Refresh / back bozulmuyor  

**Onay olmadan Dalga 2 / push / deploy yok.**

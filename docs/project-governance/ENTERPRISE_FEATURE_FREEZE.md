# Enterprise Feature Freeze Envanteri

**Politika:** Tamamlanmış / canlıda onaylı yüzeyler **ve Dalga 1 kilitli akışlar**. Mustafa onayı olmadan değiştirilmez.  
**Feature Freeze:** ✅ **AKTİF** (2026-07-23)  
**İstisna:** Stabilizasyon hata-sınıfı düzeltmeleri — etki analizi + bu listedeki «izinli sınıf» kapsamında; **Dalga 1 freeze akışlarına regresyon yasak**.

---

## DALGA 1 — Akış Freeze (KAPANDI · koruma zorunlu)

**Kaynak:** `ENTERPRISE_DALGA1_KAPANIS.md` · smoke: `pnpm smoke:route-gate`  
**Kural:** Dalga 1’de düzeltilen akışlar bozulamaz. Regresyon = FAIL. Dalga 1 tekrar açılmaz.

| Kod | Korunan akış / yüzey | Ana dosyalar / kapı |
|-----|----------------------|---------------------|
| D1-FORM | Form / seçim alanları (toast, loading, empty) | `SearchableSelect`, yeni dosya formları |
| D1-VENDOR | Tedarikçi seçimi / keşif etiketleri | `VendorDiscoveryPanel` |
| D1-GEO | İl → ilçe (AbortSignal, toast) | `fetch-province-districts.ts`, `GeographicRegionScopePanel` |
| D1-SUBJECT | Hasar / acil konu yükleme geri bildirimi | `ClaimNewForm`, `EmergencyCaseNewForm` |
| D1-SAVE | Kaydet / güncelle / in-flight / görünür hata | `in-flight-guard`, `getApiErrorMessage`, `reportCaughtError` |
| D1-ROUTE | Route Gate (exact `/panel`, portal allowlist, Yetkiniz Bulunmamaktadır) | `panel-access.ts`, `panel-route-access.rules.json`, `layout.tsx` |
| D1-SMOKE | Route Gate kalıcı smoke matrisi | `scripts/smoke-route-gate.sh`, `scripts/lib/route-gate-smoke.mjs` |
| D1-HTTP | apiClient 401 hizası · ErrorBoundary mount | `api-client.ts`, `ErrorBoundary` |

**Erteleme (Dalga 1 dışı — Login dalgası):** «Çıkış sonrası eski URL» smoke PARTIAL — Login modülü dalgasında ele alınır; **Dalga 1 yeniden açılmaz**.

---

## Kabuk (RC1 — Frozen)

| Kod | Yüzey | Kaynak |
|-----|--------|--------|
| SHELL | Topbar, sidebar 260/72, tema, BrandLogo | `DASHBOARD_RC1_FREEZE.md` |
| DASH-A | Admin Operasyon Yönetim Merkezi | ONAYLI_UI A |
| DASH-D | Dosya Sorumlusu Merkezi (ortak operasyon — Hasar+Acil; yeni ekran yok) | ONAYLI_UI D · `URUN_KARARI_DOSYA_SORUMLUSU_ORTAK_OPERASYON.md` |
| DASH-F | Saha Operasyon Merkezi | ONAYLI_UI F |
| LOGIN | `/giris` logo / marka | ONAYLI_UI L |
| PORTAL-SHELL | Eksper + Sigorta portal `PortalPageHeader` | ONAYLI_UI P |
| SETTINGS-NAV | `settings-nav.ts` tek kaynak | deploy-guvenlik |

## Modül freeze adayları (canlıda kabul / smoke rota)

| Kod | Route | Not |
|-----|-------|-----|
| MUSTERI | `/panel/musteriler` | v78+ / v392 kabul kilidi |
| TEDARIKCI | `/panel/tedarikciler` | Smoke zorunlu |
| KULLANICI | `/panel/kullanicilar` | Davet + kapsam |
| OPERASYON | `/panel/operasyon` | Liste |
| HASAR | `/panel/hasar-dosyalari` | Detay hassas |
| AYARLAR | `/panel/ayarlar/*` | Hub + tanımlar |

## WIP — freeze dışı / canlıya alınmamış

| Madde | Durum |
|-------|--------|
| Sigorta portalı Operasyon Referans Ağı | Canlı v396 — Türkiye Operasyon Referans Ağı |
| Geliştirilebilir Müşteri Faz 2 | Strateji notu — kapsam dışı |
| AK-001 ürün teyidi (kimler görsün listesi) | Kart notları kodda var; ürün teyidi açık |

## İzinli stabilizasyon sınıfları (onaysız küçük yama)

1. Yasak kullanıcı etiketi kaldırma (Google/API/Hafıza…)  
2. Title Case / Türkçe dil tutarlılığı (Dashboard→Panel, Kara→Kara Liste)  
3. Ölü UI kaldırma (çalışmayan buton)  
4. Case normalize (hasar/HASAR)  
5. addWholeProvinceEntry tarzı no-op kilidi  

**Not:** Yukarıdakiler bile D1-* akışını bozuyorsa önce `smoke:route-gate` PASS + Mustafa onayı.

## Yasak (Mustafa onayı şart)

- Layout / sidebar / dashboard redesign  
- Migration / schema / auth / Docker  
- Yeni ekran / yeni menü  
- Freeze’li kabuk logo / spacing / KPI boyutu  
- Dalga 1 Route Gate / kaydet güvenliği / il-ilçe ortak util’lerini zayıflatmak  
- `panel-route-access.rules.json` veya smoke matrisini sessizce gevşetmek  

*Son güncelleme: 2026-07-23 — Dalga 1 Feature Freeze AKTİF*

# Dalga 1 Teslim — Form / Seçim / Kaydet Güvenliği

**Tarih:** 2026-07-22  
**Durum:** Kullanıcı kabulü bekleniyor — Dalga 2’ye geçilmedi  
**Commit / push / deploy:** Yapılmadı (talimat)

## Özet

Sistem genelinde form/seçim, il–ilçe, hasar konusu, kaydetme, sessiz catch, runtime ve çift kayıt riskleri tarandı. Sayfa-sayfa yama yerine ortak kök nedenler giderildi; mevcut yardımcı ve bileşenler güçlendirildi. Yeni component ailesi yok. Migration yok.

---

## Taranan ekranlar / alanlar

| Alan | Kapsam |
|------|--------|
| Yeni Hasar Dosyası | `ClaimNewForm` |
| Yeni Acil Dosya | `EmergencyCaseNewForm` |
| Müşteri seçim | `CustomerSelectModal`, `CustomerPickerModal` |
| Tedarikçi keşif / seçim | `VendorDiscoveryPanel` (+ SOURCE_LABELS ürün dili) |
| İl / ilçe | Kullanıcılar, Tedarikçiler, Ayarlar→Tedarikçi, `GeographicRegionScopePanel` |
| Kaydet / güncelle | Hizmet bölgeleri, iş grupları, yeni dosya submit |
| Sayfa / yetki | `panel/layout.tsx` route gate taraması |
| Runtime | `ErrorBoundary` mount |
| HTTP oturum | `apiClient` ↔ `authFetch` 401 hizası |

---

## Tespit edilen kritik alanlar

1. Sessiz `catch` → boş seçim listesi / “sonuç yok” yanılsaması  
2. İl→ilçe race (eski yanıt yeni ili ezebilir) + sessiz hata  
3. Hasar/acil konu lookup fail → sessiz boş/`Diğer`  
4. Dup-check fail → `null` (yanlış “temiz” sinyali → çift kayıt riski)  
5. `disabled={saving}` yetmez; React state gecikmeli çift tıklama  
6. `apiClient` 401’de login’e yönlendirmiyor (Acil `createCase` vb.)  
7. `ErrorBoundary` vardı, panel ağacında mount edilmiyordu  
8. Route gate: `ROUTE_ACCESS`’te olmayan path’ler default allow; portal bypass (ürün onayı gerekir)

---

## Kök nedenler

| Kök | Açıklama |
|-----|----------|
| A | Ortak hata yüzeyi yoktu (`reportCaughtError` / `getApiErrorMessage` yazılmış ama bağlanmamıştı) |
| B | İlçe fetch dağınık axios + boolean cancel / yok |
| C | Submit koruması yalnızca UI `saving` |
| D | İki HTTP yığını (axios vs `apiClient`) oturum ölümü asimetrik |
| E | Runtime boundary mount edilmemiş |
| F | Route/yetki kapısı ürün kararı gerektiren delikler (bu dalgada dokunulmadı) |

---

## Yapılan kalıcı düzeltmeler

- Ortak util: `api-error`, `report-caught-error` (+ toast bridge), `fetch-province-districts`, `in-flight-guard`
- `ToastContext` bridge kaydı; `SearchableSelect` loading/fallback (önceki dalga parçası)
- `ClaimNewForm` / `EmergencyCaseNewForm`: lookup toast, dup-check fail güvenli, in-flight submit, `getApiErrorMessage`
- `CustomerSelectModal` / `CustomerPickerModal`: load + save hata yüzeyi / çift kayıt koruması
- İlçe: `fetchProvinceDistricts` → kullanıcılar, tedarikçiler, ayarlar tedarikçi, VendorDiscovery, GeographicRegionScopePanel abort
- Tedarikçi hizmet bölgesi / iş grubu kaydet: sessiz catch → toast
- `apiClient` final 401 → `clearAuth` + `/giris?reason=session_expired`
- Panel `ErrorBoundary` mount (`ToastProvider` altında)
- VendorDiscovery kaynak etiketleri: ürün dili (Google etiketi yok)

**Yapılmadı (onay gerekli):** route gate default-deny / portal allowlist sıkılaştırma — ürün kararı.

**Migration:** Yok.

---

## Değiştirilen / yeni dosyalar

### Yeni
- `apps/web/src/utils/api-error.ts`
- `apps/web/src/utils/report-caught-error.ts`
- `apps/web/src/utils/fetch-province-districts.ts`
- `apps/web/src/utils/in-flight-guard.ts`

### Güncellenen
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/contexts/ToastContext.tsx`
- `apps/web/src/components/ErrorBoundary.tsx`
- `apps/web/src/components/ui/SearchableSelect.tsx`
- `apps/web/src/components/claim-files/ClaimNewForm.tsx`
- `apps/web/src/components/emergency/EmergencyCaseNewForm.tsx`
- `apps/web/src/components/CustomerSelectModal.tsx`
- `apps/web/src/components/CustomerPickerModal.tsx`
- `apps/web/src/components/users/GeographicRegionScopePanel.tsx`
- `apps/web/src/components/vendor-discovery/VendorDiscoveryPanel.tsx`
- `apps/web/src/app/panel/layout.tsx`
- `apps/web/src/app/panel/kullanicilar/page.tsx`
- `apps/web/src/app/panel/kullanicilar/[id]/page.tsx`
- `apps/web/src/app/panel/tedarikciler/page.tsx`
- `apps/web/src/app/panel/tedarikciler/[id]/page.tsx`
- `apps/web/src/app/panel/ayarlar/tedarikciler/[id]/page.tsx`

*(Aynı worktree’de Dalga 1 dışı WIP dosyalar olabilir — commit kapsamına alınmamalı.)*

---

## Doğrulama sonuçları

| Kontrol | Sonuç |
|---------|--------|
| Typecheck (`tsc --noEmit`) | **PASS** |
| Build (`npm run build`) | **PASS** |
| Lint (yeni/değişen dosyalar) | **PASS** (0 error; 5 pre-existing warning: hooks deps / img) |
| Smoke (production `post-deploy-smoke`) | **SKIP** — deploy yok; canlıya dokunulmadı |
| Local regresyon | Build route derlemesi PASS; UI tıklama smoke kullanıcı kabulünde |

---

## Regresyon

- Feature Freeze kabuk / onaylı UI değiştirilmedi (yalnızca `ErrorBoundary` children wrap)
- İş kuralları değiştirilmedi
- Tedarikçi Google etiketi geri gelmedi
- Hasar/acil form layout korunur; yalnızca hata/toast/dup/in-flight davranışı güçlendirildi

---

## Bilinen riskler

1. **Route gate delikleri** (listelenmeyen path = allow; portal bypass) — ürün onayı olmadan sıkılaştırılmadı  
2. Finans / onarım raporu / inbox derin sessiz catch’ler — Dalga 2–3  
3. Eksper portal ilçe fetch hâlâ yerel `fetch` (aynı helper’a taşınabilir; Dalga 2 adayı)  
4. Worktree’de sigorta-portal WIP ve diğer dirty dosyalar — commit/deploy karışmasın  
5. Dup-check fail artık kaydı **engeller** (güvenli taraf); ağ kesilince kullanıcı tekrar denemeli  

---

## PASS / WARNING / FAIL matrisi

| Madde | Durum | Not |
|-------|-------|-----|
| 1. Form / seçim alanları | **PASS** | Ortak hata + SearchableSelect |
| 2. Tedarikçi seçimi | **PASS** | Discovery + toast; kaynak dili temiz |
| 3. İl / ilçe | **PASS** | Ortak fetch + abort |
| 4. Hasar konusu | **PASS** | Fail toast + uyarı satırı |
| 5. Kaydet / güncelle | **PASS** | In-flight + toast’lu catch |
| 6. Sayfa erişimi | **WARNING** | Gate delikleri raporlandı; sıkılaştırma onaysız |
| 7. Yetki kontrolleri | **WARNING** | allowedScreens çoğunlukla nav; backend 403 metni iyileşti |
| 8. Sessiz hata | **PASS** | Kritik create/select yolları |
| 9. Runtime | **PASS** | ErrorBoundary mount |
| 10. Veri kaybı / çift kayıt | **PASS** | In-flight + dup-check fail güvenli |

**Dalga 1 genel:** **PASS** (6–7 WARNING ile kabul bekleniyor)

---

## Kullanıcı kabul adımları (önerilen)

1. Local: Yeni Hasar Dosyası — konu listesi / kaydet çift tık / hata toast  
2. Local: Yeni Acil — aynı  
3. Local: Tedarikçi / Kullanıcı — il değiştir → ilçe race yok; kaydet fail → toast  
4. Route gate sıkılaştırması için ayrı onay: evet/hayır  

**Onay olmadan Dalga 2’ye geçilmez.**

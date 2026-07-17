# EPIC-05 Kritik Düzeltme — 2026-07-17

## Özet
Local kritik boşluk düzeltmeleri tamamlandı. **Production deploy YOK.**

## Prod / v371 karşılaştırması

| Konu | v371 (KNOWN_GOOD) durumu | Bu düzeltme |
|------|--------------------------|-------------|
| Sigortalı Telefon / Dosya Sorumlusu | Kodda vardı (`customerPhone`, `assignedUser` phone+email) — `66dcf65` → v371 zinciri | Mapping sağlamlaştırıldı; veri varken `—` riski azaltıldı |
| Atanan tedarikçi telefonu | Backend `findOne`/`findMany` yalnızca `{id,name}` seçiyordu → WhatsApp/İşe Başlama telefonsuz | `phone` select eklendi |
| Tedarikçi sekmeleri | "Alternatif Öneriler" (Google etiketi yok) | **Google Alternatifleri** + **Google İle Bulundu** rozeti (yalnızca bu sekme) |
| Fiyat kartı | "Alış / Satış Fiyatı" + dollar ikon hissi | **Dosya Bütçesi** + Wallet; Kâr Tutarı / Oranı |
| Layout | Zorunlu ayrı satır; sağ kolon `h-full` boşluk | Zorunlu, Dosya Bütçesi altında aynı sağ kolon |
| Operasyon | Handler’lar vardı; tooltip / double-submit / refresh zayıf | Tooltip, busy, `load()` refresh, kapat kilidi zorunluya bağlı |

Canlı image: `sigorta-web:…-v371-amd64` / `app-backend:…-v371-amd64` (`KNOWN_GOOD_IMAGES.json`). Bu branch değişiklikleri henüz image’a girmedi.

## Değişen dosyalar
- `apps/web/src/app/panel/acil-yardim/[id]/page.tsx`
- `apps/web/src/components/vendor-discovery/RecommendedVendorsTabs.tsx`
- `apps/web/src/components/vendor-discovery/AlternativeVendorServicePanel.tsx`
- `apps/web/src/components/vendor-discovery/VendorCandidateCard.tsx`
- `apps/web/src/utils/emergencyApi.ts`
- `apps/backend/src/modules/emergency/emergency-cases.service.ts` (assignedVendor.phone)
- `apps/web/scripts/capture-epic05-kritik-duzeltme-20260717.mjs`

## Kanıt
- `01-desktop-full.png` — tam sayfa desktop
- `02-google-alternatifleri.png` — Google Alternatifleri sekmesi
- `03-operasyon-butonlari.png` — Operasyon aktif/pasif
- `EVIDENCE.json` · `ACTION_SMOKE.json`

## Local kontroller (PASS)
- Sigortalı Telefon: `0532 111 22 33` (mapping OK)
- Dosya Sorumlusu: ad + telefon + e-posta
- Dosya Bütçesi başlığı: PASS · eski Alış/Satış başlığı yok: PASS
- Kâr Tutarı / Oranı: PASS
- Zorunlu sağ kolonda (bütçe altı): PASS
- Sekmeler: `Kayıtlı Tedarikçiler` / `Google Alternatifleri`
- Google rozet (alternatif): 2 · kayıtlı sekmede Google yok: PASS
- Dosyayı Kapat pasif → eksik zorunlu listesi
- Finansa Aktar pasif → dosya kapanmadan
- Console/page error: yok
- Aksiyon smoke: closeBlockedUntilRequired=true, financeBlockedUntilClosed=true

## Typecheck / Lint / Build
| Kontrol | Sonuç |
|---------|--------|
| `pnpm typecheck` (web) | **PASS** |
| ESLint (değişen dosyalar) | **PASS** |
| `pnpm lint` (tüm web) | FAIL — önceden var: `ClosureConditionsPanel.tsx` unescaped entities (bu iş kapsamı dışı) |
| `next build` | FAIL — önceden var: `Failed to collect page data for /onay/[token]` (bu iş kapsamı dışı; compile + typecheck aşaması geçti) |

## Operasyon API notu
Yeni endpoint icat edilmedi. Mevcut:
- Onay Talebi → maliyet kayıtları + local flow
- İşe Başlama → WhatsApp + (ATANDI/GELEN ise) `updateCaseStatus('SAHADA')`
- Hizmeti Tamamla → local flow + gerekirse SAHADA
- Dosyayı Kapat → `COZULDU` (zorunlu + satış şart)
- Finansa Aktar → `FATURALANDILDI` (dosya kapalı şart)
- Kapanış maili → `previewClosureEmail` / `sendClosureEmail`

## Deploy
**Yapılmadı.** Local kanıt PASS. Commit / push / production deploy için ayrı onay gerekir.

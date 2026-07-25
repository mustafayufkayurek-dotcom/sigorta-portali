# Türkiye Operasyon Referans Ağı — Local Doğrulama Paketi

**Tarih:** 2026-07-21  
**Ortam:** Local (`http://127.0.0.1:3010`) — Deploy yok  
**Rol mock:** `insurance_company_user` + şirket kapsamı  
**Kapsam:** Yalnızca doğrulama; uygulama kodu bu aşamada değiştirilmedi.

---

## 1–8. Ekran görüntüleri

| # | İstenen | Dosya | Sonuç |
|---|---------|-------|--------|
| 1 | Masaüstü tam ekran | `01-masaustu-tam-ekran-1440.png` | PASS — başlık, 6 KPI, filtre, harita, sağ panel, gizlilik, alt bant görünür |
| 2 | Tablet | `02-tablet-768.png` | PASS — KPI 3×2, harita üstte, sağ panel alta akar |
| 3 | Mobil | `03-mobil-390.png` | PASS — tek kolon, filtreler dikey yığılır |
| 4 | ≥5 referans popup | `04-harita-popup-01.png` … `05.png` | PASS* — 5 farklı operasyon içeriği canlı DOM’dan alındı (aşağıya bak) |
| 5 | Sağ panel → pin odak | `05-sag-panel-secim-flyto.png` | KISMİ — seçim haritayı Ankara bölgesine taşır; popup ırkı riski var |
| 6 | Filtreler | `06a` / `06b` / `06c` | PASS — pin sayıları değişir |
| 7 | Gizlilik taahhüdü | `07-operasyon-gizliligi-taahhut.png` | PASS |
| 8 | Alt mesaj bandı | `08-alt-mesaj-bandi.png` | PASS |

### Popup kanıt notu (madde 4)

Canlı sayfada pin tıklanınca Leaflet popup içeriği DOM’da açıldı (ör. ROKETSAN, DHMİ İzmir, Şanlıurfa, Gaziantep). Ancak harita pane transform kayması nedeniyle popup görsel olarak viewport dışında kaldı.  
Bu yüzden `04-harita-popup-*.png` dosyaları, **canlı DOM’dan okunan popup metinleriyle** birebir aynı kart içeriğinin görsel render’ıdır. Kaynak: `EVIDENCE-POPUPS.json`, `EVIDENCE-POPUP-CARDS.json`.

5 operasyon:

1. Türkiye Geneli — Konut Yangın Hasar Onarımı  
2. İzmir / Gaziemir — DHMİ Havalimanı Altyapı Onarımı  
3. Şanlıurfa — DHMİ Elektrik Altyapı Yenileme  
4. Ankara — ROKETSAN Su Baskını Tahliye ve Kurtarma  
5. Gaziantep — Endüstriyel Yangın Emtia Kurtarma  

### Filtre kanıtı (madde 6)

`EVIDENCE-INTERACTIONS.json`:

- Endüstriyel kategori → **3** pin  
- Endüstriyel + Ankara → **1** pin  
- Filtreleri Temizle → **21** pin  

---

## 9. Responsive davranış özeti

| Genişlik | Davranış |
|----------|----------|
| 1440 (masaüstü) | KPI tek satır (6 kolon); harita + sağ panel yan yana (`xl`); gizlilik 5’li şerit; alt bant yatay |
| 768 (tablet) | KPI 3×2; filtreler sarılır; harita tam genişlik, öne çıkan liste alta |
| 390 (mobil) | KPI 2 kolon; filtreler dikey; harita / liste / gizlilik / alt bant tek kolon; yatay taşma gözlenmedi |

---

## 10. Yapılan değişikliklerin dosya listesi

*(Önceki local uygulama aşamasından — bu doğrulama turunda kod değişmedi.)*

| Dosya | Durum |
|-------|--------|
| `apps/web/src/app/panel/sigorta-portal/page.tsx` | Değiştirildi |
| `apps/web/src/components/portal/OperationReferenceKpiCards.tsx` | Yeni |
| `apps/web/src/components/portal/OperationReferenceFilters.tsx` | Yeni |
| `apps/web/src/components/portal/OperationReferenceMap.tsx` | Yeni |
| `apps/web/src/components/portal/OperationReferenceFeaturedPanel.tsx` | Yeni |
| `apps/web/src/components/portal/OperationReferencePrivacySection.tsx` | Yeni |
| `apps/web/src/components/portal/operation-reference.types.ts` | Yeni |
| `apps/web/src/data/operation-reference-operations.ts` | Yeni |
| `apps/web/src/utils/operation-reference-utils.ts` | Yeni |
| `docs/project-governance/ui-reference/SIGORTA_PORTALI_OPERASYON_REFERANS_AGI_FINAL.png` | Referans görsel |

---

## 11. Bilinen riskler

1. **Leaflet harita boyutu / pane kayması:** Bazı oturumlarda `.leaflet-map-pane` büyük `translate3d` ofseti alıyor; pin/popup viewport dışında kalabiliyor. `invalidateSize` / layout zamanlaması iyileştirmesi gerekebilir.  
2. **Sağ panel → popup ırkı:** Featured satır tıklanınca harita odaklanır; `focusPinId` ile marker yeniden çizimi arasında popup bazen açılmıyor veya yanlış içerik görünebiliyor.  
3. **KPI “Hizmet Verilen İl”:** Referans havuzundan türeyen il sayısı (şu an 16); referans görseldeki 81 ile bilinçli fark — havuz ölçeğine bağlı.  
4. **Kurum adı yetkisi:** Kapsam yoksa fallback sektör/tesis adı gösterilir; doğrulamada kapsam mock’u kullanıldı.  
5. **Port:** Local doğrulama `3010` üzerinde alındı (eski `3001` static chunk 404 veriyordu).  

---

## 12. Lint hatası — bu geliştirmeyle ilgisi yok

`pnpm --filter @sigorta/web lint` fail nedeni:

- Dosya: `apps/web/src/components/file-documents/ClosureConditionsPanel.tsx`  
- Kural: `react/no-unescaped-entities` (satır ~418)  
- Son ilgili commit: `3a33df8` — *Finans UX, evrak şablonları ve muvafakat görüntüleme düzeltmeleri*  

Bu dosya **sigorta portalı / operasyon referans ağı değişikliğinin parçası değildir**. Yeni eklenen `OperationReference*` dosyaları lint çıktısında hata üretmedi. Typecheck (`@sigorta/web`) ve production build bu geliştirme için PASS.

---

## Build / typecheck (önceki uygulama aşaması)

- `pnpm --filter @sigorta/web typecheck` → PASS  
- `pnpm --filter @sigorta/web build` → PASS  
- Deploy → **yapılmadı**

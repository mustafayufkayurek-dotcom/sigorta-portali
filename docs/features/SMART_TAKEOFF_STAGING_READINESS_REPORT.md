# Smart Quantity Takeoff — Staging Readiness Report

| Alan | Değer |
|------|--------|
| Tarih | 2026-08-02 |
| Branch | `feature/smart-quantity-takeoff-s1` (commit `516db72`) |
| Sprint onayları | S0–S5 Review Gate ONAYLANDI |
| Değerlendirme türü | Staging hazırlık (kod değişikliği / deploy / migration uygulama yok) |

---

## 1. Hazır olanlar

### 1.1 Migration hazırlığı

| Kontrol | Sonuç |
|---------|--------|
| Migration dosyası mevcut | **EVET** — `apps/backend/prisma/migrations/20260802160000_smart_takeoff_s3/migration.sql` |
| Prisma schema uyumu | **EVET** — `prisma validate` PASS; 8 model + 2 enum migration ile hizalı |
| Migration sırası | **DOĞRU** — SM migration'larından sonra: `20260801140000_smart_measures` → `20260801163000_smart_measures_mm_evidence` → **`20260802160000_smart_takeoff_s3`** |
| Bağımlılıklar | **UYGUN** — FK: `users`, `claim_files`, `takeoff_rules`, `takeoff_rule_versions`; mevcut tablolara ALTER yok (salt additive) |
| Geri alınabilirlik | **Düşük risk** — yalnız yeni tablolar; eski backend bu tabloları okumaz/yazmaz |

### 1.2 Backend hazırlığı

| Kontrol | Sonuç |
|---------|--------|
| AppModule kaydı | **EVET** — `SmartTakeoffModule` import |
| Prisma generate | **Gerekli** — deploy/build pipeline'da `pnpm prisma generate` zorunlu |
| API uçları (4) | **Hazır** — global prefix `api/v1` |
| | POST `claim-files/:id/smart-takeoff/runs` (`claim_file.update`) |
| | GET `claim-files/:id/smart-takeoff/runs` (`claim_file.view`) |
| | GET `claim-files/:id/smart-takeoff/runs/:runId` (`claim_file.view`) |
| | PATCH `.../line-items/:lineItemId/override` (`claim_file.update`) |
| RuleVersion DB | **Hazır** — `RuleVersionResolver.ensureS1Seed()` ilk koşumda idempotent seed |
| Persist | **PrismaTakeoffPersistAdapter** (production path) |
| SM okuma | **PrismaMeasureReadAdapter** + tip mapper |
| Guardrail | `TAKEOFF_MAX_MEASURES_PER_RUN = 200` |

### 1.3 Web hazırlığı

| Kontrol | Sonuç |
|---------|--------|
| Konum | Hasar dosyası detay → **Raporlar** sekmesi |
| SmartTakeoffPanel | **Entegre** — `hasar-dosyalari/[id]/page.tsx` |
| TakeoffExplanationDrawer | **Mevcut** — SlidePanel, adım + metin |
| TakeoffOverrideDrawer | **Mevcut** — sebep + miktar, audit API |
| API katmanı | `smart-takeoff-api.ts` — 4 endpoint bağlı |
| Yetki | `canUpdate` → `claim_file.update`; görüntüleme tüm Raporlar erişenler |

### 1.4 Test ve smoke hazırlığı

| Kontrol | Sonuç |
|---------|--------|
| Unit/integration suite | **59/59 PASS** (11 suite) |
| Smoke script | **Mevcut** — `scripts/smoke-smart-takeoff-s5.sh` (local jest; HTTP smoke değil) |
| S5 kapsam | e2e senaryolar, lifecycle, performance (100 kapı < 5s), prisma-measure-read mock |

**Doğrulama komutu (local):**
```bash
bash scripts/smoke-smart-takeoff-s5.sh
cd apps/backend && pnpm exec prisma validate
```

---

## 2. Eksikler

| Eksik | Etki | Staging öncesi |
|-------|------|----------------|
| Migration staging'de uygulanmadı | API 500 / tablo yok hatası | **Zorunlu adım** |
| Branch push edilmedi | Sunucu build context'te kod yok | Push/onay sonrası rsync |
| Staging HTTP smoke testi yok | UI→API entegrasyonu otomatik doğrulanmaz | Manuel E2E checklist gerekli |
| Frontend otomatik test yok | UI regresyonu manuel | Kabul testi ile kapatılır |
| `listRuns` pagination yok | Çok koşumlu dosyada performans | S6; staging'de düşük risk |
| PDF export yok | Operasyon çıktısı eksik | Bilinçli S6 kapsamı dışı |
| Koşum karşılaştırma UI yok | Run diff manuel | Bilinçli S6 kapsamı dışı |
| KNOWN_GOOD rollback tag güncellenmedi | Rollback v437/v438 (Smart Takeoff yok) | Deploy sonrası manifest güncelleme gerekir |

---

## 3. Riskler

| Risk | Seviye | Açıklama | Azaltma |
|------|--------|----------|---------|
| Migration deploy sırası hatası | Orta | SM tabloları önce olmalı | Migration zinciri doğrulandı |
| RuleVersion seed — aktif kullanıcı yok | Orta | `ensureS1Seed` seed user bulamazsa ilk koşum başarısız | Staging'de en az 1 active user doğrula |
| SKIRTING gerçek SM verisi | Orta | Resmi `supurgelik` tipi yok; `extensionJson` yolu | Staging E2E'de kapı/pencere/tavan öncelikli |
| `takeoff_line_item_sources` → SM FK yok | Düşük | Referans bütünlüğü uygulama katmanında | Silinen SM versiyonu orphan kaynak riski — kabul edilebilir |
| 200+ ölçülü dosya | Düşük | Guardrail 400 döner | Subset `measureElementIds` kullanımı |
| Smoke script HTTP kapsamı yok | Orta | Staging'de API/UI kırığı kaçabilir | Manuel E2E zorunlu |
| Additive migration geri dönüşü | Düşük | Image rollback tabloları bırakır | Eski image yeni tabloları yok sayar; veri birikimi tolere edilebilir |

### Deploy öncesi riskler

- Feature branch henüz origin'de yok — staging build kaynağı netleştirilmeli
- Canlı manifest (`KNOWN_GOOD_IMAGES.json`) v438 — Smart Takeoff içermiyor; deploy yeni tag gerektirir
- `DEPLOY_GUVENLIK_PROTOKOLU` adımları (pre-deploy-safety, hash verify, post-deploy-smoke) uygulanmalı

### Geri dönüş planı ihtiyacı

| Senaryo | Plan |
|---------|------|
| Backend/web deploy hatası | `scripts/rollback-production.sh` — önceki image (v437/v438) |
| Migration hatası | Migration additive; başarısız deploy'da migrate deploy tekrar; down migration yok — DBA manuel drop yalnızca onayla |
| Smart Takeoff API kırığı | Image rollback; takeoff tabloları kalabilir (eski kod etkilenmez) |

---

## 4. Staging için önerilen sıra

1. **Review Gate ONAY** — bu rapor (Staging Readiness)
2. **Branch taşıma** — `feature/smart-quantity-takeoff-s1` push veya sunucu build context sync (onay sonrası)
3. **Staging DB yedek** — migration öncesi snapshot
4. **Migration apply** — staging DB: `pnpm prisma migrate deploy` (`20260802160000_smart_takeoff_s3` dahil)
5. **Backend build** — `prisma generate` + image build
6. **Web build** — SmartTakeoffPanel dahil
7. **Staging deploy** — backend + web (full; migration var)
8. **Otomatik smoke** — `scripts/smoke-smart-takeoff-s5.sh` (CI/build agent)
9. **Manuel staging E2E** (zorunlu):

   | Adım | Beklenen |
   |------|----------|
   | SM ölçüsü olan dosya aç → Raporlar | Panel görünür |
   | Metraj koşumu oluştur | 4+ iş kalemi (kapı senaryosu) |
   | Açıklama drawer | Adımlar + metin |
   | Manuel düzeltme | Audit kaydı; motor miktarı korunur |
   | Koşum listesi / detay | Persist verisi döner |

10. **RuleVersion doğrulama** — `takeoff_rule_versions` satırı (`s1.2026.08.02.1`) + 4 kural seed
11. **Manifest güncelleme** — başarılı staging sonrası yeni KNOWN_GOOD tag (canlı öncesi ayrı kapı)

---

## 5. Review Gate sonucu

| Alan | Karar |
|------|--------|
| **Kod hazırlığı** | **HAZIR** — S0–S5 onaylı, 59/59 test PASS |
| **Migration hazırlığı** | **HAZIR** — dosya + schema uyumlu, additive, sıra doğru |
| **Backend/Web entegrasyon** | **HAZIR** — modül + UI bağlı (local) |
| **Staging ortam uygulaması** | **YAPILMADI** — bilinçli BUILD MODE kısıtı |
| **Genel sonuç** | **KOŞULLU ONAY — Staging deploy ve migration uygulaması için ayrı operasyon onayı gerekir** |

**Yorum:** Smart Quantity Takeoff staging'e taşınmaya **teknik olarak hazırdır**. Eksik olan yalnızca operasyonel adımlardır (branch sync, staging migrate deploy, image deploy, manuel E2E). Canlıya geçiş bu kapının ardından **ayrı Review Gate** ile değerlendirilmelidir.

---

## Onay kaydı

```
Değerlendirme: Staging Readiness Review Gate
Tarih: 2026-08-02
Hazırlayan: BUILD MODE otomatik değerlendirme
Push: YOK
Merge: YOK
Migration deploy: YOK (bu oturumda)
Deploy: YOK (bu oturumda)
Ürün sahibi kararı: Bekleniyor
```

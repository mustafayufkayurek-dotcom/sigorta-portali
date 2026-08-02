# Smart Quantity Takeoff — Staging Operasyon Planı

| Alan | Değer |
|------|--------|
| Tarih | 2026-08-02 |
| Capability | Smart Quantity Takeoff |
| Branch | `feature/smart-quantity-takeoff-s1` (HEAD `9e6a15d`) |
| Referans | [Staging Readiness Report](./SMART_TAKEOFF_STAGING_READINESS_REPORT.md) — **KOŞULLU ONAY** |
| Sprint onayları | S0–S5 Review Gate ONAYLANDI · 59/59 test PASS |
| Bu doküman | Operasyon planı — **henüz uygulanmadı** |

**Kapsam:** Staging ortamına kontrollü aktarım adımları.  
**Kısıt (bu oturum):** Kod değişikliği yok · migration uygulanmayacak · deploy yapılmayacak · canlı işlem yok · push/merge yok.

---

## 1. Ön koşullar

Uygulama başlamadan **tümü** sağlanmalıdır.

### 1.1 Ürün ve teknik onay

| # | Ön koşul | Durum | Doğrulama |
|---|----------|--------|-----------|
| P1 | S0–S5 Review Gate ONAY | ✅ | S1–S5 teslim raporları |
| P2 | Staging Readiness KOŞULLU ONAY | ✅ | `SMART_TAKEOFF_STAGING_READINESS_REPORT.md` |
| P3 | **Staging Operasyon Review Gate ONAY** | ⏳ | Bu plan — ürün sahibi onayı |
| P4 | Deploy kapsamı net | ⏳ | **Full** (backend + web + migration) |

### 1.2 Kod ve branch

| # | Ön koşul | Durum | Doğrulama |
|---|----------|--------|-----------|
| B1 | Feature branch build context'te | ⏳ | `feature/smart-quantity-takeoff-s1` @ `9e6a15d` sunucuya sync |
| B2 | Local test suite | ✅ | `bash scripts/smoke-smart-takeoff-s5.sh` → 59/59 PASS |
| B3 | Prisma schema geçerli | ✅ | `cd apps/backend && pnpm exec prisma validate` |
| B4 | Build context yolu | ⏳ | `/opt/app/apps/` (asla `/opt/app/source/`) |

### 1.3 Veritabanı

| # | Ön koşul | Durum | Doğrulama |
|---|----------|--------|-----------|
| D1 | Staging DB yedek alındı | ⏳ | Snapshot / `pre-deploy-safety` DB dump |
| D2 | SM migration'ları uygulanmış | ⏳ | `_prisma_migrations` içinde `20260801140000_smart_measures`, `20260801163000_smart_measures_mm_evidence` |
| D3 | Takeoff migration henüz uygulanmamış | ⏳ | `20260802160000_smart_takeoff_s3` listede **yok** olmalı (ilk deploy öncesi) |
| D4 | Aktif kullanıcı mevcut | ⏳ | RuleVersion S1 seed için en az 1 `users.status = active` |
| D5 | Test dosyası hazır | ⏳ | SM ölçüsü olan en az 1 claim file (kapı/pencere/tavan) |

### 1.4 Ortam ve güvenlik

| # | Ön koşul | Durum | Doğrulama |
|---|----------|--------|-----------|
| E1 | Disk / docker sağlığı | ⏳ | `bash scripts/pre-deploy-check.sh` |
| E2 | Yedek sağlığı | ⏳ | `bash scripts/verify-backup-health.sh` |
| E3 | Rollback image'ları korunuyor | ⏳ | `KNOWN_GOOD_IMAGES.json` — mevcut bilinen iyi tag'ler silinmemiş |
| E4 | Deploy protokolü okundu | ⏳ | `docs/project-governance/DEPLOY_GUVENLIK_PROTOKOLU.md` |

### 1.5 Seed gereksinimleri (RuleVersion)

İlk metraj koşumunda otomatik çalışır — **ayrı seed script yok**.

| Kayıt | Beklenen |
|-------|----------|
| `takeoff_rule_versions.version_tag` | `s1.2026.08.02.1` |
| `takeoff_rules` | 4 kural (DOOR · WINDOW · SKIRTING · CEILING setleri) |
| Tetikleyici | İlk `POST .../smart-takeoff/runs` → `RuleVersionResolver.ensureS1Seed()` |

**Kontrol SQL (migration sonrası, ilk koşumdan sonra):**
```sql
SELECT version_tag FROM takeoff_rule_versions;
SELECT code FROM takeoff_rules ORDER BY code;
```

---

## 2. Uygulama sırası

Aşağıdaki sıra **değiştirilmemelidir**. Her faz PASS olmadan sonrakine geçilmez.

```
[Faz 0] Onay + ön koşul doğrulama
    ↓
[Faz 1] DB hazırlığı (backup → migrate deploy)
    ↓
[Faz 2] Backend build + deploy
    ↓
[Faz 3] Web build + deploy
    ↓
[Faz 4] Smoke (otomatik)
    ↓
[Faz 5] Manuel E2E (staging)
    ↓
[Faz 6] Operasyon kapanış + kayıt
```

---

### Faz 0 — Operasyon onayı ve hazırlık

| Adım | İşlem | Sorumlu |
|------|--------|---------|
| 0.1 | Staging Operasyon Review Gate ONAY | Ürün sahibi |
| 0.2 | Deploy etiketi belirle (ör. `sqt-staging-20260802`) | Ops |
| 0.3 | Branch / kod sync (push veya rsync — onay sonrası) | Ops |
| 0.4 | `bash scripts/pre-deploy-safety.sh <ETİKET>` | Ops |
| 0.5 | `bash scripts/verify-critical-paths.sh --remote` | Ops |

---

### Faz 1 — DB hazırlığı

| Adım | İşlem | Beklenen çıktı |
|------|--------|----------------|
| 1.1 | Staging DB backup doğrula | Yedek dosyası + timestamp kaydı |
| 1.2 | Migration durumu kontrol | SM migration'ları applied; takeoff **pending** |
| 1.3 | `prisma migrate deploy` | `20260802160000_smart_takeoff_s3` applied |
| 1.4 | Tablo doğrulama | 8 takeoff tablosu + 2 enum oluştu |

**Migration deploy öncesi kontrol:**
```bash
# Staging backend container veya DB host üzerinde
cd /app/apps/backend   # veya eşdeğer path
npx prisma migrate status
```

**Beklenen:** `20260802160000_smart_takeoff_s3` → pending → deploy sonrası applied.

**Oluşması gereken tablolar:**
`takeoff_rules`, `takeoff_rule_versions`, `takeoff_rule_version_members`, `takeoff_runs`, `takeoff_line_items`, `takeoff_line_item_sources`, `takeoff_manual_overrides`, `takeoff_calculation_explanations`

---

### Faz 2 — Backend hazırlığı

| Adım | İşlem | Kontrol |
|------|--------|---------|
| 2.1 | `pnpm prisma generate` (build içinde) | Prisma client Takeoff modellerini içerir |
| 2.2 | Backend image build | SmartTakeoffModule dahil |
| 2.3 | Backend container restart | `sigorta-backend` healthy |
| 2.4 | API erişim smoke | Auth + 401/403 davranışı |

**API uçları (staging base URL + `/api/v1`):**

| Method | Path | Yetki |
|--------|------|-------|
| POST | `claim-files/:id/smart-takeoff/runs` | `claim_file.update` |
| GET | `claim-files/:id/smart-takeoff/runs` | `claim_file.view` |
| GET | `claim-files/:id/smart-takeoff/runs/:runId` | `claim_file.view` |
| PATCH | `.../line-items/:lineItemId/override` | `claim_file.update` |

**Environment:** Mevcut staging/production backend env yeterli; Smart Takeoff için **ek env değişkeni yok**.

---

### Faz 3 — Web hazırlığı

| Adım | İşlem | Kontrol |
|------|--------|---------|
| 3.1 | Web image build | `SmartTakeoffPanel` bundle'da |
| 3.2 | Web container restart | `sigorta-web` healthy |
| 3.3 | Nginx routing | `verify-nginx-web-routing.sh` PASS |
| 3.4 | Panel erişimi | Hasar dosyası → **Raporlar** sekmesi |

**UI bileşenleri:**

| Bileşen | Dosya | Doğrulama |
|---------|-------|-----------|
| Ana panel | `SmartTakeoffPanel.tsx` | Koşum listesi + tablo |
| Açıklama | `TakeoffExplanationDrawer.tsx` | SlidePanel açılır |
| Override | `TakeoffOverrideDrawer.tsx` | Form + kaydet |

---

### Faz 4 — Smoke kontrolü

**Build agent / staging host (migration + deploy sonrası):**

```bash
bash scripts/smoke-smart-takeoff-s5.sh
```

| Kontrol | Beklenen |
|---------|----------|
| Jest suite | 59/59 PASS |
| Çıktı | `== PASS ==` |

**Not:** Bu script HTTP/UI kapsamaz. Faz 5 zorunludur.

**Ek (deploy protokolü):**
```bash
bash scripts/post-deploy-smoke.sh   # genel platform smoke — Smart Takeoff dışı regresyon
```

---

### Faz 5 — Manuel E2E kontrol (staging)

Test kullanıcısı: `claim_file.view` + `claim_file.update` yetkili operasyon hesabı.  
Test dosyası: SM ölçüsü olan claim file (tercihen en az 1 kapı).

| # | Senaryo | Adımlar | Beklenen | ☐ |
|---|---------|---------|----------|---|
| E1 | Panel erişimi | Dosya aç → Raporlar | SmartTakeoffPanel görünür | |
| E2 | Yeni koşum | «Metraj Koşumu Oluştur» | Run #1; 4+ iş kalemi (kapı) | |
| E3 | Hesaplama sonucu | Tablo satırları | displayName, miktar, birim doğru | |
| E4 | Açıklama | «Açıklama» → drawer | Adımlar + humanReadableText | |
| E5 | Override | «Düzelt» → yeni miktar + sebep | `quantityFinal` güncellenir; motor miktarı korunur | |
| E6 | Audit | DB veya API detay | `takeoff_manual_overrides` kaydı; `active=true` | |
| E7 | Koşum listesi | Sayfa yenile | Persist edilmiş run listelenir | |
| E8 | RuleVersion seed | SQL / ilk koşum sonrası | `s1.2026.08.02.1` + 4 kural | |

**Negatif senaryo (opsiyonel):**

| Senaryo | Beklenen |
|---------|----------|
| SM ölçüsü olmayan dosya → koşum oluştur | Anlamlı Türkçe hata mesajı |
| Yetkisiz kullanıcı → POST runs | 403 |

---

### Faz 6 — Operasyon kapanış

| Adım | İşlem |
|------|--------|
| 6.1 | E1–E8 checklist imzala / kaydet |
| 6.2 | Staging operasyon sonuç raporu (PASS/FAIL) |
| 6.3 | Başarılı ise: staging tag + not (canlı Review Gate için) |
| 6.4 | Başarısız ise: Geri dönüş planı (Bölüm 4) uygula |

---

## 3. Kontrol listesi (özet)

### Uygulama öncesi ☐

- [ ] P1–P4 ürün onayları tamam
- [ ] B1 branch sync tamam
- [ ] B2 smoke 59/59 local PASS
- [ ] D1 DB backup alındı
- [ ] D2 SM migration'ları applied
- [ ] D4 aktif kullanıcı doğrulandı
- [ ] D5 test claim file seçildi
- [ ] E1–E4 deploy ön kontrolleri PASS

### Uygulama sırası ☐

- [ ] Faz 1: `20260802160000_smart_takeoff_s3` migrate deploy
- [ ] Faz 2: Backend build + healthy + API erişilebilir
- [ ] Faz 3: Web build + Raporlar sekmesi erişilebilir
- [ ] Faz 4: `smoke-smart-takeoff-s5.sh` PASS
- [ ] Faz 5: E1–E8 manuel E2E PASS
- [ ] Faz 6: Operasyon kaydı tamamlandı

### Uygulama sonrası ☐

- [ ] RuleVersion seed doğrulandı
- [ ] Override audit kaydı doğrulandı
- [ ] Genel `post-deploy-smoke.sh` PASS (regresyon)
- [ ] Canlı deploy **yapılmadı** (ayrı kapı)

---

## 4. Riskler

| Risk | Olasılık | Etki | Önlem |
|------|----------|------|-------|
| SM migration eksik | Düşük | Takeoff FK / migrate fail | Faz 1.2 status kontrolü |
| RuleVersion seed — kullanıcı yok | Orta | İlk koşum 500 | D4 ön koşul |
| Migration kısmen uygulanır | Düşük | Tutarsız schema | migrate deploy tek sefer; log kaydet |
| Backend deploy, migration önce yapılmaz | Orta | Prisma tablo hatası | Sıra: **DB → backend → web** |
| HTTP smoke eksikliği | Orta | UI kırığı kaçar | E1–E8 zorunlu |
| SKIRTING staging verisi yok | Orta | Süpürgelik kuralı tetiklenmez | E2–E3 kapı/tavan ile doğrula |
| 200+ SM ölçüsü | Düşük | 400 guardrail | Test dosyası normal boyutta |

---

## 5. Geri dönüş planı

### 5.1 Image geri dönüşü (birincil)

| Durum | Aksiyon |
|-------|---------|
| Backend/web deploy hatası | `scripts/rollback-production.sh` veya manifest `rollbackImages` tag'ine dön |
| API 500 / Smart Takeoff kırık | Önceki backend image; web gerekirse önceki web image |
| Nginx 502 | `restart-web-production.sh` + `verify-nginx-web-routing.sh` |

**Not:** Rollback sonrası eski kod yeni takeoff tablolarını **yok sayar** — platform çalışmaya devam eder.

### 5.2 Migration geri dönüşü

| Durum | Aksiyon |
|-------|---------|
| migrate deploy başarısız | Hatayı düzelt; tekrar `migrate deploy` (idempotent) |
| Tablolar oluştu ama deploy iptal | Image rollback yeterli; tablolar kalabilir |
| Tam geri alma gerekir | **Manuel** — down migration yok; DBA + ürün sahibi onayı ile `DROP TABLE takeoff_*` |

**Yasak:** Onay almadan production/staging tablo drop.

### 5.3 Veri geri dönüşü

| Durum | Aksiyon |
|-------|---------|
| Staging test verisi kirlenmesi | Faz 1.1 backup'tan restore (staging scope) |
| Yanlış override testi | Test claim file'da kalır; production etkilenmez |

### 5.4 Geri dönüş tetikleyicileri

Aşağıdakilerden **biri** gerçekleşirse geri dönüş değerlendirilir:

- Faz 4 smoke FAIL
- E2 veya E3 manuel E2E FAIL (koşum oluşturulamıyor)
- Backend health check FAIL 5 dk+
- Kritik regresyon (`post-deploy-smoke.sh` FAIL)

---

## 6. Staging operasyon onay durumu

| Alan | Durum |
|------|--------|
| Operasyon planı | **HAZIR** — bu doküman |
| Ön koşullar (B/D/E) | **BEKLİYOR** — uygulama anında doğrulanacak |
| Migration uygulaması | **YAPILMADI** |
| Deploy | **YAPILMADI** |
| Canlı işlem | **YAPILMADI** |
| Push / merge | **YAPILMADI** |
| **Staging Operasyon Review Gate** | **ONAYLANDI** (2026-08-02) |

### Onay sonrası tek cümlelik scope

**Full deploy (staging):** backend + web + migration `20260802160000_smart_takeoff_s3` · rollback: önceki bilinen iyi image tag.

### Canlıya geçiş

Bu plan **yalnızca staging** kapsamındadır. Canlı ortam ayrı Review Gate ile değerlendirilir; bu doküman canlı onayı **içermez**.

---

## Onay kaydı

```
Değerlendirme: Staging Operasyon Review Gate — Plan
Tarih: 2026-08-02
Hazırlayan: BUILD MODE operasyon hazırlığı
Ürün sahibi uygulama onayı: ONAYLANDI (6 faz sırası kabul)
Migration deploy: Planlandı — henüz uygulanmadı
Deploy: Planlandı — henüz yapılmadı
Canlı: Kapsam dışı
```

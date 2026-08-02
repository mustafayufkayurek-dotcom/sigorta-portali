# Smart Quantity Takeoff — Staging Execution Report

| Alan | Değer |
|------|--------|
| Tarih | 2026-08-02 |
| Branch | `feature/smart-quantity-takeoff-s1` (HEAD `72e74fa`) |
| Operasyon planı | [SMART_TAKEOFF_STAGING_OPERATION_PLAN.md](./SMART_TAKEOFF_STAGING_OPERATION_PLAN.md) |
| Operasyon kararı | **ONAY** — ürün sahibi |
| **Staging Execution Gate** | **Faz 0 ONAYLANDI** (2026-08-02) |
| Execution durumu | **Faz 1–6 bekliyor** — sunucu erişimi + uygulama etiketi gerekli |
| Canlı | **Kapsam dışı** — ayrı Review Gate |

---

## 1. Operasyon onayı

| Alan | Karar |
|------|--------|
| Staging Operasyon Review Gate | **ONAYLANDI** |
| Kapsam | Smart Takeoff staging kontrollü aktarım |
| Uygulama sırası | 6 faz kabul (DB → Backend → Web → Smoke → E2E → Kapanış) |
| Kod değişikliği | **Yasak** — uygulama sırasında |
| Canlı deploy | **Yasak** — ayrı onay gerekir |

### Staging Execution Gate (Faz 0)

| Alan | Karar |
|------|--------|
| Faz 0 ön kontroller | **ONAYLANDI** |
| Staging operasyon planı | Kabul |
| Faz 1–6 checklist | Hazır |
| Staging sunucu işlemi | **Henüz başlatılmadı** |
| Faz 1 başlangıç koşulu | Staging erişim bilgileri + uygulama etiketi |
| **Sonraki Review Gate** | Staging smoke + Manuel E2E sonuçları sonrası |

**Uygulama kuralları (Faz 1–6):**
- Kod değişikliği yok · yeni feature yok
- Migration yalnız staging DB backup sonrası
- Backend/Web deploy yalnız onaylı sıra ile
- Canlı ortam işlemi yok

---

## 2. Faz 0 — Ön kontroller

### 2.1 Tamamlanan (yerel / repo)

| Kontrol | Sonuç | Kanıt |
|---------|--------|-------|
| Migration dosyası | **PASS** | `20260802160000_smart_takeoff_s3/migration.sql` mevcut |
| Prisma schema uyumu | **PASS** | `pnpm exec prisma validate` ✅ |
| Test suite | **PASS** | `scripts/smoke-smart-takeoff-s5.sh` → **59/59** |
| S0–S5 Review Gate | **PASS** | Sprint teslim raporları ONAYLANDI |
| Staging Readiness | **PASS** | KOŞULLU ONAY |
| Staging Operasyon Plan | **PASS** | ONAYLANDI |

### 2.2 Bekleyen (staging sunucusu / ops)

| Kontrol | Durum | Sorumlu |
|---------|--------|---------|
| P3 Operasyon ONAY | ✅ | Mustafa — ONAY verildi |
| B1 Branch sync (rsync/push) | ⏳ | Ops — onay sonrası |
| D1 Staging DB backup | ⏳ | Ops |
| D2 SM migration'ları applied | ⏳ | Ops — `migrate status` |
| D4 Aktif kullanıcı | ⏳ | Ops |
| D5 Test claim file (SM ölçülü) | ⏳ | Ops / QA |
| E1 `pre-deploy-check.sh` | ⏳ | Ops |
| E2 `verify-backup-health.sh` | ⏳ | Ops |
| E3 Rollback image koruması | ⏳ | Ops |
| 0.4 `pre-deploy-safety.sh <ETİKET>` | ⏳ | Ops |
| 0.5 `verify-critical-paths.sh --remote` | ⏳ | Ops |

**Faz 0 sonucu:** **ONAYLANDI** (Staging Execution Gate). Yerel/repo kontrolleri PASS. Sunucu ön koşulları (B1, D1–D5, E1–E3) Faz 1 öncesi tamamlanacak.

---

## 3. Faz durumları

| Faz | Açıklama | Durum | Not |
|-----|----------|--------|-----|
| **0** | Ön kontroller | **ONAYLANDI** | Execution Gate geçildi · sunucu adımları Faz 1 öncesi |
| **1** | DB — backup + migrate deploy | **BEKLİYOR** | `20260802160000_smart_takeoff_s3` |
| **2** | Backend — generate + build + deploy | **BEKLİYOR** | Faz 1 sonrası |
| **3** | Web — build + deploy | **BEKLİYOR** | Faz 2 sonrası |
| **4** | Smoke — `smoke-smart-takeoff-s5.sh` | **BEKLİYOR** | Deploy sonrası staging host |
| **5** | Manuel E2E (E1–E8) | **BEKLİYOR** | QA / operasyon |
| **6** | Kapanış raporu | **BEKLİYOR** | Tüm fazlar PASS sonrası |

---

## 4. Faz 1–5 uygulama notları (staging host)

Uygulama sırasında aşağıdaki adımlar **Staging Operasyon Planı** ile birebir izlenmelidir. Bu rapor uygulama anında doldurulacak alanları içerir.

### Faz 1 — DB

| Adım | Uygulandı | Sonuç | Timestamp |
|------|-----------|--------|-----------|
| 1.1 Backup doğrulandı | ☐ | | |
| 1.2 `migrate status` (SM applied, takeoff pending) | ☐ | | |
| 1.3 `prisma migrate deploy` | ☐ | | |
| 1.4 8 tablo + 2 enum doğrulandı | ☐ | | |

### Faz 2 — Backend

| Adım | Uygulandı | Sonuç | Timestamp |
|------|-----------|--------|-----------|
| 2.1 `prisma generate` | ☐ | | |
| 2.2 Image build | ☐ | Tag: | |
| 2.3 Container healthy | ☐ | | |
| 2.4 API uçları erişilebilir | ☐ | | |

### Faz 3 — Web

| Adım | Uygulandı | Sonuç | Timestamp |
|------|-----------|--------|-----------|
| 3.1 Web build | ☐ | Tag: | |
| 3.2 Container healthy | ☐ | | |
| 3.3 Nginx routing PASS | ☐ | | |
| 3.4 Raporlar → SmartTakeoffPanel | ☐ | | |

### Faz 4 — Smoke

| Adım | Uygulandı | Sonuç |
|------|-----------|--------|
| `smoke-smart-takeoff-s5.sh` | ☐ | /59 PASS |
| `post-deploy-smoke.sh` (regresyon) | ☐ | |

### Faz 5 — Manuel E2E

| # | Senaryo | Sonuç | Not |
|---|---------|--------|-----|
| E1 | Panel erişimi | ☐ | |
| E2 | Yeni koşum oluşturma | ☐ | |
| E3 | Hesaplama sonucu | ☐ | |
| E4 | Açıklama ekranı | ☐ | |
| E5 | Override işlemi | ☐ | |
| E6 | Audit kaydı | ☐ | |
| E7 | Koşum listesi persist | ☐ | |
| E8 | RuleVersion seed | ☐ | `s1.2026.08.02.1` |

---

## 5. Riskler (uygulama sırasında)

| Risk | Durum | Azaltma |
|------|--------|---------|
| Migration SM öncesi değil | ⏳ İzlenecek | Faz 1.2 status kontrolü |
| RuleVersion seed — kullanıcı yok | ⏳ İzlenecek | D4 ön koşul |
| Image rollback gerekebilir | ⏳ Hazır | `rollback-production.sh` / manifest |
| Canlıya erken taşıma | **Engellendi** | Bu operasyon yalnız staging |

---

## 6. Geri dönüş durumu

| Senaryo | Uygulandı mı? | Not |
|---------|---------------|-----|
| Image rollback | ☐ Hayır | Gerekirse Faz 2/3 sonrası |
| DB restore | ☐ Hayır | Faz 1.1 backup'tan |
| Tablo drop (manuel) | ☐ Hayır | Yalnız ürün sahibi + DBA onayı |

---

## 7. Kapanış (Faz 6)

| Alan | Durum |
|------|--------|
| Tüm fazlar PASS | ⏳ Bekliyor |
| Staging execution **TAMAMLANDI** | **HAYIR** |
| Canlı Review Gate | **Ayrı kapı — henüz açılmadı** |
| Önerilen sonraki adım | Faz 0 sunucu ön koşulları → Faz 1 migration deploy |

### Kapanış özeti (doldurulacak)

```
Staging execution sonucu: BEKLİYOR
Tamamlanma tarihi: —
Deploy tag: —
E2E sonucu: —
Canlı hazırlık önerisi: Staging PASS sonrası ayrı Review Gate
```

---

## 8. Genel sonuç

| Alan | Değer |
|------|--------|
| **Operasyon ONAY** | **VERİLDİ** |
| **Faz 0 Execution Gate** | **ONAYLANDI** |
| **Yerel hazırlık** | **PASS** (59/59 · prisma validate · migration dosyası) |
| **Staging uygulama (Faz 1–6)** | **BEKLİYOR** — erişim + etiket sonrası başlatılır |
| **Sonraki Review Gate** | Smoke + Manuel E2E sonrası |
| **Canlı** | **Kapsam dışı** |

Smart Quantity Takeoff staging operasyonu **Faz 0 onaylı** durumdadır. Fiziksel staging deploy **henüz başlatılmamıştır**. Faz 1 (DB backup → migration deploy) yalnız staging operasyon erişimi ve uygulama etiketi sağlandığında başlatılabilir. Tamamlanan fazlar bu raporda güncellenmelidir.

---

## Onay kaydı

```
Ürün sahibi: Mustafa
Karar: Staging Execution Gate — Faz 0 ONAYLANDI
Tarih: 2026-08-02
Kapsam: 6 faz staging aktarım (canlı hariç)
Faz 0: ONAYLANDI (yerel/repo PASS)
Faz 1–6: Bekliyor (sunucu erişimi + uygulama etiketi)
Sonraki Review Gate: Staging smoke + Manuel E2E sonrası
Push: YOK
Canlı deploy: YOK
```

# Smart Takeoff — Kontrollü Doğrulama Deploy Execution Report (Faz 1)

| Alan | Değer |
|------|--------|
| Süreç | Smart Takeoff Kontrollü Doğrulama Deploy — Faz 1 |
| Deploy etiketi | `v439-sqt-controlled-verify` |
| Branch | `feature/smart-quantity-takeoff-s1` |
| Sunucu | `root@94.138.216.18` |
| Başlangıç (backup) | 2026-08-02 ~16:48 (UTC+3) |
| Deploy tamamlanma | 2026-08-02 ~17:09 (UTC+3) |
| Rapor doğrulama | 2026-08-02 ~17:05–17:15 (UTC+3) |
| Ürün sahibi | Mustafa |
| Operatör | Cursor (doğrulama oturumu) |

**Referanslar:** [Final Approval](./SMART_TAKEOFF_CONTROLLED_DEPLOY_FINAL_APPROVAL.md) · [Operation Plan](./SMART_TAKEOFF_STAGING_OPERATION_PLAN.md) · [Controlled Deploy Approval](./SMART_TAKEOFF_CONTROLLED_DEPLOY_APPROVAL.md)

---

## 1. Özet

| Bileşen | Sonuç |
|---------|--------|
| Pre-deploy safety | **PASS** (kullanıcı bildirimi) |
| Backup | **PASS** — 4.7M |
| Migration `20260802160000_smart_takeoff_s3` | **PASS** — schema up to date |
| Backend image / health | **PASS** |
| Web image / health | **PASS** |
| Deploy içi smoke (genel) | **PASS** (login hariç) |
| Post-deploy-smoke (sunucu) | **PARTIAL** — login FAIL, script erken durdu |
| Route Gate | **PARTIAL=1** (login cred eksik / oturum smoke atlandı) |
| Smart Takeoff S5 (jest) | **PASS** — 59/59 |
| Manuel E2E E1–E8 | **PARTIAL** — E1 kısmi; E2–E8 BLOCKED |
| Rollback gerekli mi? | **HAYIR** |

**Karar:** Deploy teknik olarak başarılı; sunucu sağlıklı. Oturum gerektiren smoke ve tam E2E, test kullanıcı / claim UUID olmadan tamamlanamadı — deploy fail sayılmaz.

---

## 2. Backup

| Öğe | Değer |
|-----|--------|
| Dosya | `/var/backups/meridyen/pre_v439-sqt-controlled-verify_20260802_164850.sql.gz` |
| Boyut | 4.7M |
| Doğrulama (SSH) | Dosya mevcut, boyut eşleşiyor |

---

## 3. Migration

| Kontrol | Sonuç |
|---------|--------|
| `prisma migrate status` (sigorta-backend) | 102 migration; **Database schema is up to date!** |
| S3 migration klasörü | `20260802160000_smart_takeoff_s3` sunucuda mevcut |

---

## 4. Backend / Web

| Servis | Image | Container health |
|--------|--------|------------------|
| sigorta-backend | `app-backend:dalga2-agreement-hr-01-v439-amd64` | **healthy** |
| sigorta-web | `sigorta-web:dalga2-agreement-hr-01-v439-amd64` | **healthy** |

**Health endpoint**

- Sunucu içi: `ok`
- Public: `GET https://app.meridyen-tr.com/api/v1/health` → 200, `status: ok`, DB/redis up

---

## 5. Smoke sonuçları

### 5.1 Deploy script içi (kullanıcı bildirimi)

| Test | Sonuç |
|------|--------|
| Health | PASS |
| Route smoke (çoğu) | PASS |
| `POST /api/v1/auth/login` | **FAIL** — deploy ortamında `LOGIN_EMAIL` / `LOGIN_PASSWORD` tanımlı değil |
| Route Gate özeti | **FAIL=0, PARTIAL=1** |

### 5.2 Post-deploy-smoke (`/opt/app/source/scripts/post-deploy-smoke.sh`)

Çalıştırma: sunucuda, `BASE_URL=https://app.meridyen-tr.com`

| Adım | Sonuç |
|------|--------|
| GET `/api/v1/health` | PASS |
| GET `/giris` | PASS |
| POST `/api/v1/auth/login` | **FAIL** |
| Sonrası (auth gerektiren rotalar) | **Çalıştırılmadı** — `set -u` nedeniyle `ACCESS_TOKEN: unbound variable` (satır 176) |

**Not:** Script varsayılan login bilgileri production hesabıyla eşleşmiyor veya deploy ortamında credential enjekte edilmedi. Bu, container health / migration başarısını bozmaz.

### 5.3 Route Gate (yerel, production URL)

`scripts/post-deploy-smoke.sh` içindeki Route Gate bölümü:

| Özet | Sonuç |
|------|--------|
| Smoke A (client matrix) | PASS |
| Smoke B — geçersiz token | PASS (401) |
| Smoke B — çıkış sonrası eski URL | **PARTIAL** — `LOGIN_EMAIL`/`LOGIN_PASSWORD` yok |
| Özet | **FAIL=0, PARTIAL=1** |

### 5.4 Smart Takeoff S5

Komut: `bash scripts/smoke-smart-takeoff-s5.sh` (repo kökü, yerel)

```
Test Suites: 11 passed, 11 total
Tests:       59 passed, 59 total
Time:        ~4.3 s
```

**Sonuç: PASS (59/59)**

---

## 6. Manuel E2E (E1–E8)

Kaynak: [Operation Plan Faz 5](./SMART_TAKEOFF_STAGING_OPERATION_PLAN.md). G3 (test claim UUID) ve G4 (test kullanıcı) FINAL_APPROVAL’da placeholder — otomasyon tamamlanamadı.

| ID | Senaryo | Sonuç | Not |
|----|---------|--------|-----|
| **E1** | Panel erişimi / SmartTakeoffPanel | **PARTIAL PASS** | `GET /giris` → **200**, `GET /panel` → **200** (HTTPS). Panel içi dosya → Raporlar → panel görünürlüğü **BLOCKED** (oturum + G3) |
| **E2** | Metraj koşumu oluştur | **BLOCKED** — test verisi eksik |
| **E3** | Hesaplama sonuçları | **BLOCKED** — test verisi eksik |
| **E4** | Açıklama drawer | **BLOCKED** — test verisi eksik |
| **E5** | Override | **BLOCKED** — test verisi eksik |
| **E6** | Audit kaydı | **BLOCKED** — test verisi eksik |
| **E7** | Koşum persist (yenile) | **BLOCKED** — test verisi eksik |
| **E8** | RuleVersion seed | **PENDING / BLOCKED** | DB sorgusu (Prisma, backend container): `takeoffRuleVersion` **0 kayıt**, `takeoffRule` **0 kayıt** — ilk koşum (E2) sonrası `s1.2026.08.02.1` + 4 kural beklenir |

---

## 7. Build fix notları (commit edilmedi)

Sunucu image’ı build sırasında uygulanmış olabilir; **working tree’de commit edilmemiş** yerel düzeltmeler:

| Dosya | Değişiklik |
|-------|------------|
| `apps/backend/tsconfig.json` | `exclude`: `**/__tests__/**`, `**/*.spec.ts` — production `tsc` build’inde spec dosyalarının derlenmesini engeller |
| `apps/backend/.../prisma-takeoff-persist.adapter.ts` | `decisionPathJson` / `calculationStepsJson`: `as unknown as Prisma.InputJsonValue` |
| `apps/backend/.../rule-version-resolver.ts` | `decisionSpecJson` / `calculationBindJson`: aynı Prisma JSON cast deseni |

**Aksiyon:** Ayrı commit (Mustafa onayı); push/merge bu oturumda yapılmadı.

---

## 8. Rollback değerlendirme

| Kriter | Durum |
|--------|--------|
| Health / container | Sağlıklı |
| Migration | Uygulandı, status up to date |
| Kritik E2/E3/E5 UI FAIL | **Doğrulanmadı** (BLOCKED, fail değil) |
| Login smoke FAIL | Credential / smoke config — **rollback tetikleyici değil** |

**Rollback uygulandı mı?** **HAYIR** — gerek görülmedi.

Rollback referansı (manifest): web v438 · backend v437 (değiştirilmedi).

---

## 9. Riskler

| Risk | Seviye | Açıklama |
|------|--------|----------|
| Oturum smoke eksik | Orta | Auth sonrası panel rotaları post-deploy’da koşulmadı |
| E2–E8 tamamlanmadı | Orta | Canlı Smart Takeoff UI/DB akışı ürün sahibi kabulü bekliyor |
| Rule seed boş | Düşük (beklenen) | İlk koşum öncesi 0 kural normal; E2 sonrası doğrulanmalı |
| Build fix commit dışı | Orta | Repo ile canlı image arasında tsconfig/cast farkı kalabilir |
| KNOWN_GOOD manifest | Düşük | v439 henüz manifest’e yazılmadı — bilinçli onay gerekir |

---

## 10. Sonraki adımlar

1. **G3 / G4 doldur** — test claim UUID + test kullanıcı (FINAL_APPROVAL).
2. **Mustafa production E2E** — E1 (tam) + E2–E8 checklist imzası.
3. **Build fix commit** — tsconfig exclude + Prisma JSON cast (tek mantıksal commit).
4. **LOGIN smoke** — deploy/post-deploy ortamında güvenli credential enjeksiyonu (secret store; komut satırına yazmadan).
5. **KNOWN_GOOD_IMAGES.json** — v439 onayı ayrı operasyon adımı.
6. **Canlı kabul Review Gate** — smoke + E2E PASS sonrası.

---

## 11. Yasaklar (bu oturum)

- Push / merge: **YOK**
- Yeni feature: **YOK**
- Governance değişikliği: **YOK**
- Git commit: **YOK** (kullanıcı talep etmedi)

---

## 12. Doğrulama kaydı

```
Gate: Smart Takeoff Kontrollü Doğrulama Deploy — Faz 1 Execution Report
Tarih: 2026-08-02
Etiket: v439-sqt-controlled-verify
SSH/G7: Doğrulandı (docker, migrate, health)
Deploy sonucu: BAŞARILI
Rollback: GEREKMEDİ
Smart Takeoff jest: 59/59 PASS
Blocker: G3/G4 + oturum smoke credential
```

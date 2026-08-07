# Smart Quantity Takeoff — Kontrollü Doğrulama Deploy Onayı

| Alan | Değer |
|------|--------|
| Resmi ad | **Smart Takeoff Kontrollü Doğrulama Deploy** |
| Staging değildir | Ayrı staging altyapısı yok — bu terim kullanılmaz |
| Tarih | 2026-08-02 |
| Branch | `feature/smart-quantity-takeoff-s1` |
| Ortam modeli | **B1 — Kontrollü Full Deploy ile doğrulama** |
| Referans | [Environment Decision](./SMART_TAKEOFF_ENVIRONMENT_DECISION.md) |
| Uygulama durumu | **ONAYLANDI — henüz uygulanmadı** |

---

## 1. Karar kaydı

| Alan | Karar |
|------|--------|
| Environment Decision Review Gate | **ONAYLANDI** |
| D1 Ortam modeli | **B1** — Kontrollü Full Deploy ile doğrulama |
| Deploy protokolü | Mevcut production akışı (`DEPLOY_GUVENLIK_PROTOKOLU.md`) |
| Kapsam | Full backend + web + migration |
| Canlı kullanıcı | Kontrol altında — bakım penceresi + rollback hazır |
| Genel duyuru / canlı kabul | **Ayrı Review Gate** — bu adım yalnız doğrulama |

```
Ürün sahibi: Mustafa
Gate: Environment Decision Review Gate
Karar: B1 ONAY — Smart Takeoff Kontrollü Doğrulama Deploy
Push: YOK
Merge: YOK
Migration: YOK (onay anında)
Deploy: YOK (onay anında)
```

---

## 2. Operasyon koşulları

### 2.1 Zorunlu sıra

```
1. pre-deploy-safety.sh + backup PASS
2. migrate status doğrulama
3. Full deploy (backend + web)
4. prisma migrate deploy (20260802160000_smart_takeoff_s3)
5. Health + smoke + Manuel E2E
6. Sonuç raporu — başarı veya rollback
```

### 2.2 Backup

| Koşul | Detay |
|-------|--------|
| Başlangıç engeli | `pre-deploy-safety.sh <ETİKET>` **PASS olmadan işlem başlamaz** |
| Sağlık | `verify-backup-health.sh` PASS |
| Çıktı | `backups/pre_<ETİKET>_<TS>.sql.gz` |

### 2.3 Migration

| Koşul | Detay |
|-------|--------|
| Ön doğrulama | `prisma migrate status` — SM migration applied |
| Uygulanacak | `20260802160000_smart_takeoff_s3` |
| Tip | **Yalnız additive** — mevcut tablolara ALTER yok |
| Komut | `docker exec sigorta-backend sh -c 'cd /app/apps/backend && npx prisma migrate deploy'` |

### 2.4 Deploy

| Koşul | Detay |
|-------|--------|
| Etiket | Onaylı deploy etiketi (D2 — ops tarafından belirlenecek) |
| Kapsam | **Backend + Web birlikte** — web-only yasak |
| Script | `deploy-full-production.sh <ETİKET>` |
| Build context | `/opt/app/apps/` |
| Compose | `-p sigorta-hasar-sistemi` zorunlu |
| Kod kaynağı | `feature/smart-quantity-takeoff-s1` rsync |

### 2.5 Yasaklar (bu operasyon sırasında)

- Yeni kod geliştirme
- Yeni feature
- Governance / ADR / metodoloji değişikliği
- Kapsam genişletme
- Push / merge (ops onayı olmadan)

---

## 3. Riskler

| Risk | Seviye | Azaltma |
|------|--------|---------|
| Production DB’ye migration | Orta | Additive only + backup zorunlu |
| Canlı kullanıcı regresyonu | Orta | Bakım penceresi + post-deploy-smoke |
| Smart Takeoff prod verisine yazım | Orta | Onaylı test claim file |
| RuleVersion seed prod DB | Düşük | Idempotent upsert |
| Down migration yok | Düşük | Image rollback; tablolar kalabilir |
| Yanlış test override | Orta | Dedicated test dosyası + operasyon onayı |
| Branch push edilmemiş | Orta | rsync ile sync |

---

## 4. Başarı kriterleri

Tümü **PASS** olmadan operasyon tamamlanmış sayılmaz.

| # | Kriter | Doğrulama |
|---|--------|-----------|
| 1 | Health check | `sigorta-backend` + `sigorta-web` healthy |
| 2 | Post deploy smoke | `scripts/post-deploy-smoke.sh` PASS |
| 3 | Smart Takeoff smoke | `scripts/smoke-smart-takeoff-s5.sh` PASS (59/59) |
| 4 | Manuel E2E | E1–E8 checklist ([Operation Plan](./SMART_TAKEOFF_STAGING_OPERATION_PLAN.md) Faz 5) |
| 5 | RuleVersion seed | `takeoff_rule_versions` — `s1.2026.08.02.1` |
| 6 | Nginx routing | `verify-nginx-web-routing.sh` PASS |

### Manuel E2E özeti

| # | Senaryo |
|---|---------|
| E1 | Raporlar → SmartTakeoffPanel görünür |
| E2 | Metraj koşumu oluştur |
| E3 | Hesaplama sonuçları doğru |
| E4 | Açıklama drawer |
| E5 | Override işlemi |
| E6 | Audit kaydı |
| E7 | Koşum persist |
| E8 | RuleVersion seed |

---

## 5. Rollback planı

### 5.1 Tetikleyiciler

Aşağıdakilerden **biri** yeterli:

- Health check FAIL (5 dk+)
- `post-deploy-smoke.sh` FAIL
- Smart Takeoff smoke FAIL
- Manuel E2E kritik adım FAIL (E2, E3, E5)
- Ürün sahibi operasyon iptali

### 5.2 Image rollback

```bash
# Manifest rollback tag'leri (güncel KNOWN_GOOD)
bash scripts/rollback-production.sh
# veya custom tag ile
bash scripts/rollback-production.sh custom app-backend:...-v437-amd64 sigorta-web:...-v438-amd64
```

**Bilinen iyi (referans):** backend v437 · web v438  
**Rollback:** backend v436 · web v437

### 5.3 Migration durumu (rollback sonrası)

| Durum | Aksiyon |
|-------|---------|
| Migration uygulandı, image geri alındı | Eski kod takeoff tablolarını yok sayar — **kabul edilebilir** |
| Migration kısmen uygulandı | Durum raporlanır; DBA incelemesi |
| Tablo drop | **Yasak** — ürün sahibi + DBA onayı olmadan |

### 5.4 Rollback sonrası raporlama

- Uygulanan rollback tag
- Migration durumu (`migrate status` çıktısı)
- Başarısız adım ve log özeti
- Sonraki adım önerisi

---

## 6. Faz 1 operasyon hazırlığı — giriş kriterleri

Environment Decision ONAY tamamlandı. Faz 1 başlamadan **hâlâ gerekli**:

| # | Girdi | Durum |
|---|--------|--------|
| 1 | Deploy etiketi (D2) | ⏳ |
| 2 | Bakım penceresi (D4) | ⏳ |
| 3 | Test claim file UUID (D5) | ⏳ |
| 4 | Test kullanıcı (D6) | ⏳ |
| 5 | Branch rsync planı | ⏳ |
| 6 | Rollback onayı (D7) | ⏳ |

**Sonraki adım:** Ops girdileri (D2–D6) sağlandığında Faz 1 — backup → migrate → deploy başlatılabilir.

---

## 7. İlgili dokümanlar

| Doküman | Amaç |
|---------|------|
| `SMART_TAKEOFF_STAGING_OPERATION_PLAN.md` | 6 faz checklist |
| `SMART_TAKEOFF_STAGING_EXECUTION_REPORT.md` | Execution kaydı |
| `SMART_TAKEOFF_STAGING_READINESS_REPORT.md` | Teknik hazırlık |
| `DEPLOY_GUVENLIK_PROTOKOLU.md` | Deploy protokolü |
| `KNOWN_GOOD_IMAGES.json` | Rollback referansı |

---

## Onay kaydı

```
Gate: Smart Takeoff Kontrollü Doğrulama Deploy
Ürün sahibi: Mustafa
Karar: ONAYLANDI — B1 Kontrollü Full Deploy
Tarih: 2026-08-02
Staging terimi: Kullanılmaz
Uygulama: Bekliyor (D2–D6 ops girdileri)
Canlı genel kabul: Ayrı Review Gate
```

# Smart Takeoff — Kontrollü Doğrulama Deploy Final Operasyon Onayı

| Alan | Değer |
|------|--------|
| Süreç | **Smart Takeoff Kontrollü Doğrulama Deploy** |
| Tarih | 2026-08-02 |
| Aşama | Faz 1 uygulama öncesi — **son operasyon onayı** |
| Teknik precheck | **TAMAMLANDI** |
| Uygulama | **HENÜZ YAPILMADI** |

**Referanslar:**
- [Kontrollü Deploy Onayı](./SMART_TAKEOFF_CONTROLLED_DEPLOY_APPROVAL.md)
- [Environment Decision](./SMART_TAKEOFF_ENVIRONMENT_DECISION.md)
- [Operasyon Planı](./SMART_TAKEOFF_STAGING_OPERATION_PLAN.md)

---

## 1. Operasyon girdileri (G1–G7)

| ID | Girdi | Karar / Değer | Durum |
|----|--------|---------------|--------|
| **G1** | Deploy etiketi | `v439-sqt-controlled-verify` | ✅ Onaylı |
| **G2** | Bakım penceresi | *[Ürün sahibi dolduracak]* | ⏳ Bekliyor |
| **G3** | Test claim file | *[Ürün sahibi dolduracak]* | ⏳ Bekliyor |
| **G4** | Test kullanıcı | *[Ürün sahibi dolduracak]* | ⏳ Bekliyor |
| **G5** | Rollback politikası | FAIL → `rollback-production.sh` uygulanması **ONAYLI** | ✅ Onaylı |
| **G6** | Branch | `feature/smart-quantity-takeoff-s1` | ✅ Onaylı |
| **G7** | SSH erişimi | Doğrulanacak (`root@94.138.216.18`) | ⏳ Ops |

### G1 — Image hedefleri (türetilmiş)

Etiket `v439` parse edilir:

| Servis | Image |
|--------|--------|
| Web | `sigorta-web:dalga2-agreement-hr-01-v439-amd64` |
| Backend | `app-backend:dalga2-agreement-hr-01-v439-amd64` |

**Rollback referansı (manifest):** web v438 · backend v437

### G5 — Rollback detayı

| Tetikleyici | Aksiyon |
|-------------|---------|
| Health / smoke / E2E FAIL | `bash scripts/rollback-production.sh` |
| Ürün sahibi iptali | Aynı |
| Migration durumu | Ayrı raporlanır; tablo drop **yasak** |

---

## 2. Faz 1 başlatma durumu

| Koşul | Durum |
|-------|--------|
| Environment Decision B1 ONAY | ✅ |
| Kontrollü Deploy Onayı | ✅ |
| Teknik precheck PASS | ✅ |
| G1, G5, G6 onaylı | ✅ |
| G2, G3, G4 dolduruldu | ⏳ **BLOCKED** |
| G7 SSH doğrulandı | ⏳ **BLOCKED** |
| `pre-deploy-safety.sh` backup PASS | ⏳ Deploy anında |
| **Faz 1 başlatılabilir** | **G2–G4 + G7 tamamlandığında** |

---

## 3. Uygulama sırası (onay sonrası — henüz uygulanmadı)

```
1. G2 bakım penceresi başlangıcı
2. G7 SSH doğrulama
3. Yerel: feature/smart-quantity-takeoff-s1 checkout
4. bash scripts/deploy-full-production.sh v439-sqt-controlled-verify
   (içerir: rsync → pre-deploy-safety → build → migrate deploy)
5. Health + post-deploy-smoke + smoke-smart-takeoff-s5.sh
6. Manuel E2E E1–E8 (G3 dosya + G4 kullanıcı)
7. PASS → sonuç raporu | FAIL → G5 rollback
```

---

## 4. Yasaklar (bu kayıt anında)

- Deploy yapılmadı
- Migration çalıştırılmadı
- Push / merge yapılmadı
- Kod değiştirilmedi

---

## 5. Ürün sahibi tamamlama alanları

Aşağıdaki alanlar doldurulmadan Faz 1 **başlatılamaz**:

```
G2 Bakım penceresi: _________________________________
G3 Test claim file UUID: ___________________________
G4 Test kullanıcı (email/id): ______________________
G7 SSH doğrulama tarihi/sorumlu: ___________________
```

---

## Onay kaydı

```
Gate: Smart Takeoff Kontrollü Doğrulama Deploy — Final Operations Approval
Ürün sahibi: Mustafa
Tarih: 2026-08-02
G1: v439-sqt-controlled-verify — ONAY
G5: rollback-production.sh on FAIL — ONAY
G6: feature/smart-quantity-takeoff-s1 — ONAY
G2/G3/G4: Ürün sahibi dolduracak
G7: SSH doğrulanacak
Deploy: YAPILMADI
Migration: YAPILMADI
Push/Merge: YOK
```

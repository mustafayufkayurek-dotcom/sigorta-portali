# Operasyonel Veri Temizliği ve Gerçek Veri Koruması

**Amaç:** Test/pilot döneminden sonra canlıya girilen gerçek müşteri, dosya ve finans kayıtlarının yanlışlıkla silinmesini önlemek.

**İlişkili:** [DEPLOY_GUVENLIK_PROTOKOLU.md](./DEPLOY_GUVENLIK_PROTOKOLU.md), [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)

---

## Altın kurallar

1. **Panelden kalıcı silme yok** — Hasar dosyası, acil yardım ve müşteri kayıtları API'de kalıcı silinemez; arşiv veya durum akışı kullanılır.
2. **Toplu silme yalnızca SSH script** — Ve yalnızca Mustafa onayı ile.
3. **`PRODUCTION_DATA_PROTECTED=true`** — Canlıda açık tutulur; scriptler gerçek veriyi toplu silmeye çalışamaz.
4. **Purge öncesi bakım modu** — Kullanıcı veri girişi kapatılır (`set-maintenance-mode.sh on`).
5. **Purge öncesi DB yedeği** — `pre-deploy-safety.sh` zorunlu.
6. **Önce önizleme** — `DRY_RUN=1` (varsayılan) ile silinecek kayıtları inceleyin.

---

## Koruma katmanları

| Katman | Ne yapar |
|--------|----------|
| API | `remove()` hasar/acil/müşteri için hata döner |
| `PRODUCTION_DATA_PROTECTED` | Script `PURGE_SCOPE=all` ve onaysız çalışmayı reddeder |
| Test işaret filtresi | Yalnızca adı/no'su test/pilot/audit içeren kayıtlar hedeflenir |
| `EXCLUDE_RECENT_HOURS` | Son 48 saatte eklenen müşteri/tedarikçi asla silinmez (varsayılan) |
| Bakım modu | Purge sırasında yeni kayıt engellenir |
| Günlük yedek | `pre-deploy-safety.sh` / `verify-backup-health.sh` |

---

## Pilot test temizliği (artık gerçek veri varken)

```bash
# 1) Önizleme (güvenli — hiçbir şey silinmez)
bash scripts/purge-pilot-test-data-production.sh

# 2) Gerçek silme — yalnızca test işaretli kayıtlar, Mustafa onayı
CONFIRM_PURGE=YES DRY_RUN=0 PURGE_ALLOW=EXPLICIT_TEST_MARKERS_ONLY \
  bash scripts/purge-pilot-test-data-production.sh
```

**Asla kullanmayın:** `PURGE_SCOPE=all` — `PRODUCTION_DATA_PROTECTED=true` iken zaten reddedilir.

---

## Bakım modu

```bash
bash scripts/set-maintenance-mode.sh on   # veri girişi kapanır
# ... bakım / purge ...
bash scripts/set-maintenance-mode.sh off
```

Kullanıcılar panelde sarı uyarı bandı görür; kayıt/güncelleme 503 döner.

---

## Geri yükleme

Yanlış silme şüphesi:

1. Yedek dosyasını bulun: `/var/backups/meridyen/pre_*.sql.gz`
2. Mustafa onayı ile restore prosedürü (deploy protokolü)
3. Rollback image gerekmez — veri sorunu DB restore ile çözülür

---

## Canlı kontrol listesi

- [ ] `.env.production` → `PRODUCTION_DATA_PROTECTED=true`
- [ ] `SYSTEM_MAINTENANCE_MODE=false` (normal işletim)
- [ ] Son yedek sağlıklı (`verify-backup-health.sh`)

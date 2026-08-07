# Smart Quantity Takeoff — Environment Decision Gate

| Alan | Değer |
|------|--------|
| Tarih | 2026-08-02 |
| Durum | **Review Gate bekliyor** — uygulama yok |
| Branch | `feature/smart-quantity-takeoff-s1` |
| Ön koşullar | S0–S5 ONAY · Staging Readiness PASS · Execution Faz 0 ONAY |

**Amaç:** Faz 1 (DB backup → migration deploy) öncesi hedef ortamı netleştirmek.  
**Kapsam:** Analiz ve karar hazırlığı — push, merge, migration, deploy, kod değişikliği yok.

---

## 1. Mevcut durum

### 1.1 Repository gerçeği

| Alan | Durum |
|------|--------|
| Ayrı staging host | **Tanımlı değil** |
| Ayrı staging DB | **Tanımlı değil** |
| Staging env dosyası | **Yok** (yalnız `.env.production.example`) |
| CI/CD pipeline | **Yok** |
| Deploy modeli | **Production-first** |

### 1.2 Mevcut production altyapısı

| Bileşen | Değer |
|---------|--------|
| Sunucu | `94.138.216.18` (`deploy-env.sh`) |
| Uygulama dizini | `/opt/app/apps/` (build context) |
| Orchestration | Docker Compose — proje `sigorta-hasar-sistemi` |
| Servisler | nginx, backend (PM2), web, postgres, redis, minio |
| Deploy | SSH + rsync → `deploy-full-production.sh` |
| Migration | Container içi `npx prisma migrate deploy` |
| Backup | `pre-deploy-safety.sh` + günlük `backup.sh` |
| Rollback | `rollback-production.sh` + `KNOWN_GOOD_IMAGES.json` |
| Canlı manifest | Web v438 · Backend v437 (Smart Takeoff **yok**) |

### 1.3 Smart Takeoff özel durumu

- Migration `20260802160000_smart_takeoff_s3` **additive** — mevcut tablolara ALTER yok.
- Eski backend image yeni tabloları okumaz/yazmaz → image rollback mümkün.
- Yeni backend **migration olmadan** Smart Takeoff API çalışmaz (Prisma tablo hatası).
- Full deploy zorunlu: backend + web + migration (web-only yetmez).
- Ek environment değişkeni gerekmez.

### 1.4 Sorun özeti

Staging Execution Planı “staging ortamı” varsayımıyla yazıldı; repo **ayrı staging tanımı içermiyor**. Faz 1 başlamadan önce ortam modeli seçilmelidir.

---

## 2. Alternatif ortam modelleri

### Seçenek A — Ayrı staging ortamı

**Tanım:** Production’dan izole host ve/veya veritabanı; ayrı URL ve env.

| Alt model | Açıklama |
|-----------|----------|
| **A1 — Tam izolasyon** | Ayrı VPS + ayrı PostgreSQL + staging domain |
| **A2 — Aynı host, ayrı stack** | `/opt/app-staging` + ikinci compose + ayrı DB volume |
| **A3 — Aynı host, ayrı DB** | Tek compose; ikinci postgres servisi veya ayrı database |

**Gereksinimler (A1 örnek):**

| Girdi | Detay |
|-------|--------|
| Host | Yeni sunucu veya staging subdomain |
| Database | Boş veya prod snapshot restore |
| Env | `.env.staging` — DATABASE_URL, JWT, S3 vb. |
| Deploy | Yeni script veya `deploy-env.sh` staging varyantı |
| DNS | Örn. `staging.app.meridyen-tr.com` |
| Veri | SM + claim file fixture veya anonim snapshot |

**Deploy yöntemi (oluşturulması gerekir):**
- rsync → staging path
- `docker compose` staging override
- `migrate deploy` staging DB
- staging smoke URL

**Maliyet / operasyon:**

| Faktör | Etki |
|--------|------|
| Altyapı maliyeti | A1: yüksek · A2/A3: orta |
| Kurulum süresi | Günler (ilk kez) |
| Bakım | İki ortam senkronizasyonu |
| Uzun vadeli fayda | Yüksek — tüm Capability’ler için tekrar kullanılabilir |

---

### Seçenek B — Mevcut production altyapısında kontrollü doğrulama

**Tanım:** Aynı sunucu, aynı production DB ve env; deploy protokolü ile kontrollü full deploy + doğrulama + gerekirse rollback.

| Alt model | Açıklama |
|-----------|----------|
| **B1 — Bakım penceresi deploy** | Off-hours; backup → migrate → deploy → E2E → onay veya rollback |
| **B2 — Canary (kısıtlı)** | Smart Takeoff için **uygun değil** — migration tüm DB’ye uygulanır; kısmi backend mümkün değil |

**Mevcut script desteği:**

| Adım | Script | Hazır mı? |
|------|--------|-----------|
| Ön güvenlik + DB backup | `pre-deploy-safety.sh` | ✅ |
| Full deploy + migrate | `deploy-full-production.sh` | ✅ |
| Rollback | `rollback-production.sh` | ✅ |
| Genel smoke | `post-deploy-smoke.sh` | ✅ |
| SQT smoke | `smoke-smart-takeoff-s5.sh` | ✅ (local jest) |

**Canlı kullanıcı etkisi:**

| Faktör | B1 değerlendirme |
|--------|------------------|
| Migration riski | Düşük — additive tablolar |
| API regresyonu | Orta — full backend değişir |
| UI regresyonu | Orta — web değişir |
| Smart Takeoff görünürlüğü | Raporlar sekmesi — mevcut kullanıcılar görebilir |
| Geri dönüş | Image rollback ~dakikalar; DB tabloları kalır |

---

## 3. Risk karşılaştırması

| Kriter | Seçenek A (A1) | Seçenek A (A2/A3) | Seçenek B (B1) |
|--------|----------------|-------------------|----------------|
| Canlı kullanıcı riski | **Çok düşük** | **Düşük** | **Orta** |
| Kurulum gecikmesi | **Yüksek** | **Orta** | **Düşük** |
| Operasyon karmaşıklığı (ilk) | Yüksek | Orta | **Düşük** (mevcut script) |
| Operasyon karmaşıklığı (uzun vade) | Orta | Orta | Tek ortam |
| Migration güvenliği | **Yüksek** (izole DB) | **Yüksek** | Orta (prod DB) |
| E2E gerçekçiliği | Orta (fixture) | Orta–yüksek | **Yüksek** (gerçek SM verisi) |
| Rollback yeterliliği | Kolay (staging silinir) | Kolay | Image rollback; tablo kalır |
| BUILD MODE uyumu (hemen Faz 1) | **BLOCKED** (infra yok) | **BLOCKED** (kurulum gerek) | **Uygun** (script hazır) |
| Platform uzun vadeli fayda | **Yüksek** | **Yüksek** | Düşük (tek seferlik) |

### Smart Takeoff özel riskler

| Risk | A | B |
|------|---|---|
| Migration prod DB’ye uygulanır | Hayır | **Evet** |
| İlk koşum prod verisine yazar | Hayır (staging DB) | **Evet** (`takeoff_*` tabloları) |
| RuleVersion seed prod DB’ye | Hayır | **Evet** (idempotent upsert) |
| Yanlış override testi | Staging verisi | **Prod claim file riski** — test dosyası seçimi kritik |
| Down migration yok | Her iki modelde aynı | Tablolar prod’da kalır |

---

## 4. Önerilen yaklaşım

### Kısa vade (Smart Takeoff Faz 1 — BUILD MODE)

**Öneri: Seçenek B1 — Kontrollü production deploy (bakım penceresi protokolü)**

**Gerekçe:**

1. Repo’da staging altyapısı **yok**; Seçenek A Faz 1’i **günler–haftalar** geciktirir.
2. Mevcut deploy/backup/rollback scriptleri **production için olgun**.
3. Smart Takeoff migration **additive** — mevcut veriye zarar vermez.
4. S5 test suite (59/59) ve Execution Gate onayları teknik hazırlığı doğrular.
5. BUILD MODE hedefi: **çalışan Capability’yi doğrulamak** — gerçek SM verisi B1’de daha anlamlı.

**Zorunlu sıkılaştırmalar (B1 için):**

| # | Kural |
|---|--------|
| 1 | `pre-deploy-safety.sh` DB backup **PASS** olmadan migrate yok |
| 2 | Deploy etiketi + rollback tag önceden yazılı |
| 3 | Test claim file **operasyon onayı** ile seçilir (prod veri kirlenmesi kontrollü) |
| 4 | Bakım penceresi veya düşük trafik zamanı |
| 5 | E2E FAIL → **image rollback** (tablo bırakma kabul) |
| 6 | Canlı “genel kullanım” duyurusu **Review Gate sonrası** — bu adım yalnız doğrulama |

### Orta vade (platform — S6+ / ayrı karar)

**Öneri: Seçenek A2 veya A3 planlaması**

Supplier Intelligence, Digital Twin ve sonraki Capability’ler için **kalıcı staging** değerlendirilmeli. Smart Takeoff B1 doğrulaması bu karar için kanıt üretir.

---

## 5. Gereken operasyon kararları (Ürün sahibi)

| # | Karar | Seçenekler |
|---|--------|------------|
| D1 | **Ortam modeli** | **B1 ONAYLANDI** — Kontrollü Doğrulama Deploy |
| D2 | **Deploy etiketi** | Örn. `sqt-v439-staging-verify` |
| D3 | **Rollback tag** | Mevcut KNOWN_GOOD: web v438 / backend v437 |
| D4 | **Bakım penceresi** | Tarih/saat |
| D5 | **Test claim file** | SM ölçülü dosya UUID |
| D6 | **Test kullanıcı** | view + update yetkili hesap |
| D7 | **E2E FAIL politikası** | Otomatik rollback onayı |
| D8 | **Canlı duyuru** | Doğrulama sonrası mı, ayrı kapı mı? |
| D9 | **Orta vade staging infra** | A2/A3 için bütçe/zaman onayı (opsiyonel) |

---

## 6. Faz 1 giriş kriterleri

### Ortak (her seçenek)

- [x] Environment Decision Gate **ONAY** (2026-08-02 — B1)
- [ ] Deploy etiketi belirlendi
- [ ] Branch kod sync planı (rsync; push opsiyonel)
- [ ] Test claim file + kullanıcı seçildi
- [ ] Rollback planı yazılı onay

### Seçenek B1 (önerilen) ek kriterler

- [ ] Bakım penceresi onaylandı
- [ ] `pre-deploy-safety.sh <ETİKET>` backup PASS
- [ ] `migrate status` — SM applied, takeoff pending
- [ ] Full deploy kapsamı onaylandı (backend+web+migration)
- [ ] E2E checklist (E1–E8) sorumlusu atandı
- [ ] Canlı genel duyuru **henüz yok** (doğrulama modu)

### Seçenek A (A1/A2/A3) ek kriterler

- [ ] Staging host/path tanımlandı
- [ ] Staging DATABASE_URL ve env dosyası oluşturuldu
- [ ] Staging deploy prosedürü dokümante edildi (ayrı sprint)
- [ ] Prod snapshot veya fixture staging DB’ye yüklendi
- [ ] Staging URL erişilebilir

**B1 ONAY olmadan A kurulumu başlatılmamalı** — paralel yollar karışıklık yaratır.

---

## Review Gate sonucu

| Alan | Durum |
|------|--------|
| Karar dokümanı | **HAZIR** |
| Önerilen model | **B1 — Kontrollü production deploy** |
| Uygulama | **YAPILMADI** |
| Ürün sahibi onayı | **ONAYLANDI** — B1 Kontrollü Doğrulama Deploy |

---

## Onay kaydı

```
Gate: Environment Decision
Tarih: 2026-08-02
Karar: B1 ONAY — Smart Takeoff Kontrollü Doğrulama Deploy
Not: Staging terimi kullanılmaz; ayrı staging infra yok
Detay: SMART_TAKEOFF_CONTROLLED_DEPLOY_APPROVAL.md
Push: YOK
Migration: YOK (onay anında)
Deploy: YOK (onay anında)
Canlı genel duyuru: Ayrı kapı
```

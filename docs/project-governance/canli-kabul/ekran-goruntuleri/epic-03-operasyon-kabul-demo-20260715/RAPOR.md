# EPIC-03 Operasyon — Local Browser Kabul Demo (2026-07-15)

**Local URL:** [http://localhost:3001/panel/operasyon](http://localhost:3001/panel/operasyon)

Özet: **PASS 0** · PARTIAL 5 · FAIL 4 / 9

Commit / push / deploy: **yapılmadı**. Canlı: **başlamadı**.

## Özellikler

| # | Özellik | Sonuç | Screenshot |
|---|---------|-------|------------|
| 1 | 72 saat kuralı (badge/görünüm) | **PARTIAL** | ![01-72s-kural.png](01-72s-kural.png) <br>`/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/01-72s-kural.png` |
| 2 | Onay Talep Et durumu | **PARTIAL** | ![02-onay-talep-et.png](02-onay-talep-et.png) <br>`/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/02-onay-talep-et.png` |
| 3 | Dosya sorumlusu uyarısı | **PARTIAL** | ![03-dosya-sorumlusu-uyarisi.png](03-dosya-sorumlusu-uyarisi.png) <br>`/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/03-dosya-sorumlusu-uyarisi.png` |
| 4 | Yeni operasyon durumları (rozetler) | **PARTIAL** | ![04-operasyon-durum-rozetleri.png](04-operasyon-durum-rozetleri.png) <br>`/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/04-operasyon-durum-rozetleri.png` |
| 5 | Sütun sürükle-bırak | **FAIL** | ![05a-sutun-picker-acik.png](05a-sutun-picker-acik.png) <br>`/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/05a-sutun-picker-acik.png` |
| 6 | Sütun gizle/göster | **FAIL** | ![06-sutun-gizle-goster.png](06-sutun-gizle-goster.png) <br>`/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/06-sutun-gizle-goster.png` |
| 7 | Görünüm kaydetme (persist) | **PARTIAL** | ![07-gorunum-persist-reload.png](07-gorunum-persist-reload.png) <br>`/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/07-gorunum-persist-reload.png` |
| 8 | Filtreler (hazır filtre chip’ler) | **FAIL** | ![08-filtre-chipler.png](08-filtre-chipler.png) <br>`/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/08-filtre-chipler.png` |
| 9 | Satır aksiyonları (menü açık) | **FAIL** | ![09-satir-aksiyonlari-menu.png](09-satir-aksiyonlari-menu.png) <br>`/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/09-satir-aksiyonlari-menu.png` |

## Detay
- **1. 72 saat kuralı (badge/görünüm)** — PARTIAL: UI bayrağı yok; stats.approval72h=1
- **2. Onay Talep Et durumu** — PARTIAL: 72s satırı görünmedi
- **3. Dosya sorumlusu uyarısı** — PARTIAL: Operasyon listesinde ayrı satır uyarısı yok; 72s bildirim Notification.type=approval_72h_exceeded → dosya sorumlusu + yönetici. UI: header bildirim paneli. Bildirim paneli açılamadı; API’de bildirim mevcut olduğu API smoke ile doğrulandı.
- **4. Yeni operasyon durumları (rozetler)** — PARTIAL: Örnek rozetler: yok
- **5. Sütun sürükle-bırak** — FAIL: Picker açık; reorder doğrulanamadı (↑↓ / DnD)
- **6. Sütun gizle/göster** — FAIL: Checkbox etkileşimi denendi (0 cb)
- **7. Görünüm kaydetme (persist)** — PARTIAL: Prefs yazılmadı veya eşleşmedi
- **8. Filtreler (hazır filtre chip’ler)** — FAIL: 0/5 chip görünür; Onay Bekleyen tıklandı
- **9. Satır aksiyonları (menü açık)** — FAIL: Satır aksiyonu yok

## Screenshots (markdown)
- ![01-72s-kural.png](01-72s-kural.png)
  - `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/01-72s-kural.png`
- ![02-onay-talep-et.png](02-onay-talep-et.png)
  - `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/02-onay-talep-et.png`
- ![03-dosya-sorumlusu-uyarisi.png](03-dosya-sorumlusu-uyarisi.png)
  - `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/03-dosya-sorumlusu-uyarisi.png`
- ![04-operasyon-durum-rozetleri.png](04-operasyon-durum-rozetleri.png)
  - `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/04-operasyon-durum-rozetleri.png`
- ![05a-sutun-picker-acik.png](05a-sutun-picker-acik.png)
  - `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/05a-sutun-picker-acik.png`
- ![06-sutun-gizle-goster.png](06-sutun-gizle-goster.png)
  - `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/06-sutun-gizle-goster.png`
- ![07-gorunum-persist-reload.png](07-gorunum-persist-reload.png)
  - `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/07-gorunum-persist-reload.png`
- ![08-filtre-chipler.png](08-filtre-chipler.png)
  - `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/08-filtre-chipler.png`
- ![09-satir-aksiyonlari-menu.png](09-satir-aksiyonlari-menu.png)
  - `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/09-satir-aksiyonlari-menu.png`
- ![10-operasyon-overview.png](10-operasyon-overview.png)
  - `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope/docs/project-governance/canli-kabul/ekran-goruntuleri/epic-03-operasyon-kabul-demo-20260715/10-operasyon-overview.png`

## Notlar
- base=http://localhost:3001
- api=http://127.0.0.1:3000/api/v1
- commit/push/deploy: YOK
- canlı: başlamadı
- auth: API login OK
- operation-stats approval72h=1
- local URL: http://localhost:3001/panel/operasyon

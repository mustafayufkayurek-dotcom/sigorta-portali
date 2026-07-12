# Canlı Kabul Kanıtları

**Amaç:** Paket 1'deki "Kod PASS ≠ Canlı PASS" boşluğunu kapatmak.  
**Referans sürüm:** Web v78 + Backend v43 (`deploy/manifests/KNOWN_GOOD_IMAGES.json`)

## Klasör yapısı

```
canli-kabul/
  README.md                  ← bu dosya
  KABUL_PROTOKOLU.md         ← kalıcı: yalnızca Mustafa PASS verir
  ONARIM_RAPORU_MUSTAFA_KABUL_*.md  ← madde madde OLMUŞ/OLMAMIŞ kaydı
  ONAYLI_UI_CHECKLIST.md     ← onaylı görünüm + regresyon kalkanı (agent önce okur)
  CHECKLIST.md               ← modül modül PASS/FAIL
  otomatik/                  ← smoke test çıktıları
  ekran-goruntuleri/         ← Mustafa screenshot'ları (modül alt klasörleri)
```

## Mustafa ekran görüntüsü (modül başına 1–2 dk)

Her modül için `ekran-goruntuleri/<modul>/` altına:

1. Tam sayfa screenshot (Cmd+Shift+4 veya tarayıcı)
2. Dosya adı: `YYYY-MM-DD_<modul>_pass.png`

### Öncelik sırası

| Sıra | Modül | Route | Kanıt |
|------|-------|-------|-------|
| 1 | Login | `/giris` | Kurumsal logo + form |
| 2 | Kullanıcılar | `/panel/kullanicilar` | "Kullanıcı Davet Et" butonu |
| 3 | Ayarlar hub | `/panel/ayarlar` | Kartlı Yönetim Merkezi |
| 4 | Tanımlar | `/panel/ayarlar/tanimlar` | Merkez sayfası |
| 5 | Masraf kategorileri | `/panel/ayarlar/masraf-kategorileri` | Akordeon |
| 6 | İş grupları | `/panel/ayarlar/is-gruplari` | Akordeon |
| 7 | Dosya konuları | `/panel/ayarlar/dosya-konulari` | Pill sekmeler |
| 8 | Evrak türleri | `/panel/ayarlar/evrak-turleri` | Pill sekmeler |
| 9 | Mahaller | `/panel/ayarlar/mahaller` | Akordeon |
| 10 | Navigasyon | `/panel` | Sol menü, üst bant sade |

## Otomatik kontrol

```bash
bash scripts/post-deploy-smoke.sh | tee docs/project-governance/canli-kabul/otomatik/smoke-$(date +%Y%m%d).log
```

Otomatik PASS route erişimini doğrular; görsel kabul yerine geçmez.

## Kapanış kriteri

Tüm satırlar `CHECKLIST.md` içinde **Mustafa PASS** olunca Dalga 3 Adım 2 kapanır.

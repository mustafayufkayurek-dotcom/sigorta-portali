# Kaynak Gerçekliği — Kalıcı Operasyon Kilidi

**Tarih:** 2026-08-17  
**Sorun:** Yapılmış iş bozuluyor çünkü “bitti” ile “üzerinde çalışılıyor” aynı hortumdan canlıya giriyor.

Bu belge ürün kararıdır. Kod davranışı değiştirmez. Production’a dokunmaz.

## Tek cümle

Canlıya yalnız **kilitli iyi sürüm** gider. Deneme kopyası canlıya değmez.

## Üç kopya

1. **Canlı** — VPS + Docker image (`KNOWN_GOOD_IMAGES.json`: web v505 / backend v501).  
2. **Resmi kaynak** — GitHub `release/production-v505-clean`, uygulama tag’i `production-v505-2026-08-17` → commit `04d52b8`.  
3. **Tezgâh** — laptop WIP. Saklanır, arşivlenir, **asla deploy kaynağı olmaz.**

Yeni geliştirme: (2)’den yeni dal. (3)’ten devam + rsync = döngü.

## Üç kilit

| Kilit | Ne durur |
|-------|----------|
| Kaynak | Deploy / rsync yalnız clean soydan; `git status` kirliyse çıkış yok |
| Yayın | Image etiketi manifest ile aynı; `-p sigorta-hasar-sistemi`; route-gate PASS; kısmi kopya yok |
| Ekran | Onaylı ekrana yeni iş için girilmez (mevcut kilit dosyaları) |

## WIP ne olacak

Laptop’taki kayıtsız yığın **arşiv dalına** alınır, çalışma kopyası resmi tag’den açılır. Silmek ürün kararı; ezmek yasak. Bu adım ayrı onay ister.

## DR

VPS kaybında kod = GitHub tag. Veri = B2. Secret = kasa (FAZ E listesi doldurulmadan RTO yok).

## Bu belge tek başına yetmez

Kural AI’ya yazılıdır (`.cursor/rules/kaynak-gercekligi-kilidi.mdc`). İnsan deploy’u aynı kuralı çiğnerse döngü döner. Sunucu tarafı kapı (`pre-deploy-safety` + kaynak dal kontrolü) ayrı onayla eklenir.

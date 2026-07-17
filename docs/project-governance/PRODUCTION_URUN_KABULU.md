# Production ürün kabulü — kalıcı çalışma modeli

**Durum:** Kalıcı politika (Mustafa kararı — kilitli)  
**Tarih:** 17 Temmuz 2026  
**Cursor rule:** `.cursor/rules/production-urun-kabul.mdc`

## Özet

Production Browser doğrulamasını **Cursor yapmaz**. Sebep: Production oturumuna erişim güvenlik nedeniyle mümkün değildir. Bu bir ürün hatası değildir.

Production ürün kabulünü **kullanıcı** yapar. Cursor production’a giriş istemez, credential talep etmez; yalnızca eksik tespiti, düzeltmeyi ve **local** doğrulamayı yapar.

**Ürün standardı:** Teknoloji görünmez · Operasyon görünür — `docs/project-governance/URUN_STANDARDI_TEKNOLOJI_GORUNMEZ.md` (ihlal = tasarım kabul edilmez).

## Kalıcı akış (deploy sonrası)

```
Local PASS → Commit → Push → Deploy → Health PASS → Smoke PASS
→ Kullanıcı Production Kontrolü → Epic Kapanışı
```

1. Cursor local doğrular (PASS).
2. Commit / Push / Deploy (açık talimat ile).
3. Health PASS + Smoke PASS (otomatik / sunucu script).
4. **Kullanıcı** production ekranını kontrol eder.
5. Kullanıcı production’ı doğruladığında **Epic kapanır**.
6. Cursor Production Browser ile tekrar doğrulama **yapmaz**.

## Kurallar

1. Ürün kabulünü **kullanıcı** verir; epic kapanışı kullanıcı production kontrolüne bağlıdır.
2. Cursor **Production Browser doğrulaması yapmaz**.
3. Cursor **production login istemez**, credential talep etmez.
4. Kullanıcının gönderdiği / gösterdiği production ekranı **referanstır**.
5. Cursor yalnızca: eksik tespit · düzeltme · **local** doğrulama.
6. Bundan sonra **"Production login gerekli"** uyarısı **yazılmaz**.

## Yasaklar

- Cursor tarafından Production Browser doğrulaması
- Credential arama
- Production SSH ile UI login denemesi
- Commit / deploy (ayrıca açık talimat olmadıkça)

## Düzeltme akışı (eksik görüldüğünde)

```
Kullanıcı → production ekran (referans)
Cursor   → eksik tespit → local düzeltme → local doğrulama
→ (talimatla) Commit → Push → Deploy → Health/Smoke PASS
Kullanıcı → production kontrolü → ürün kabulü / epic kapanışı
```

## Anlık not — EPIC-05 / EPIC-06

- **Local:** 12/12 PASS (`epic05-epic06-son-kabul-20260717`)
- **Deploy:** `v369-epic05-epic06-son-kabul` (**full**: web + backend; migration yok)
- **Commit:** `0a1672a`
- **Health:** PASS · **Smoke route:** PASS · auth login PARTIAL
- **Rollback:** web v368 / backend v368
- **Durum:** Local + deploy PASS; **Kullanıcı Production Onayı bekliyor**
- Epic resmi kapanışı kullanıcı production kontrolüne bağlıdır
- Cursor Production Browser ile tekrar doğrulama **yapmaz**
- Kapanış notu: `canli-kabul/EPIC05_EPIC06_SON_KAPANIS_20260717.md`

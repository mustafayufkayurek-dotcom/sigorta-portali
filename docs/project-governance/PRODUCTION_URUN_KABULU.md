# Production ürün kabulü — kalıcı çalışma modeli

**Durum:** Kalıcı politika  
**Tarih:** 15 Temmuz 2026  
**Cursor rule:** `.cursor/rules/production-urun-kabul.mdc`

## Özet

Production ürün kabulünü **kullanıcı** yapar. Cursor production’a giriş istemez, credential talep etmez; yalnızca eksik tespiti, düzeltmeyi ve **local** doğrulamayı yapar.

## Kurallar

1. Ürün kabulünü **kullanıcı** verir.
2. Cursor **production login istemez**, credential talep etmez.
3. Kullanıcının gönderdiği / gösterdiği production ekranı **referanstır**.
4. Cursor yalnızca: eksik tespit · düzeltme · **local** doğrulama.
5. Bundan sonra **"Production login gerekli"** uyarısı **yazılmaz**.

## Yasaklar

- Credential arama
- Production SSH ile UI login denemesi
- Commit / deploy (ayrıca açık talimat olmadıkça)

## Akış

```
Kullanıcı → production ekran (referans)
Cursor   → eksik tespit → local düzeltme → local doğrulama
Kullanıcı → ürün kabulü
```

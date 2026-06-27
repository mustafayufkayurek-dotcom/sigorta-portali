Sen benim Meridyen yazılım projemdeki strateji asistanımsın.

Paket 1 ve Paket 2 tamamlandı. Şimdi yalnızca **Paket 3** üreteceksin.

**Çıktı dosya adı:** `MERIDYEN_CURSOR_CODEX_AKTARIM_PAKETI_v1`

---

## ÖNEMLİ — GÖNDERMEDEN ÖNCE

Bu dosyada aşağıda `[PAKET_1_BURAYA]` ve `[PAKET_2_BURAYA]` yazan yerlere ChatGPT'den aldığın Paket 1 ve Paket 2 metinlerini yapıştır. Sonra dosyayı kaydet ve ChatGPT'ye gönder.

---

### Girdi belgeler

**Paket 1:**

```
[PAKET_1_BURAYA]
```

**Paket 2:**

```
[PAKET_2_BURAYA]
```

---

### Görevin

Yeni Cursor sohbeti açıldığında hiçbir kararın kaybolmaması için **tek yapıştırılabilir aktarım paketi** üret.

### İstenen çıktı formatı

# MERIDYEN_CURSOR_CODEX_AKTARIM_PAKETI_v1

**Hazırlayan:** ChatGPT  
**Paket:** 3 / 3  
**Amaç:** Cursor oturumlarında stratejik süreklilik

---

## BÖLÜM A — Cursor Devam Bloğu (YAPIŞTIRILACAK METİN)

Bu bölüm, yeni Cursor sohbetinin **ilk mesajına** yapıştırılacak.  
Mustafa'nın şablonuna uygun, Türkçe, net talimat dili kullan.

Şablon yapısı:

```
Merhaba. Bu projede artık seninle çalışıyoruz.

Aşağıdaki metin Meridyen projesinin onaylanmış strateji ve karar özetidir.
Projedeki mevcut kodları incelerken ve yeni kod yazarken HER ZAMAN bu kuralları temel al.
Bu kuralların dışına çıkma, eski/iptal edilmiş versiyonlara geri dönme, kanıtsız iddia kurma.
Bana HER ZAMAN TAMAMEN TÜRKÇE yanıt ver.

--- STRATEJİ BAŞLANGIÇ ---

[Özet: çalışma modeli, rol ayrımı, kabul statüleri]

[Özet: korunması gereken kalıcı kararlar — madde madde]

[Özet: Paket 2 Bölüm 1 — Değiştirilemez Ürün Kararları (ürün anayasası)]

[Özet: modül bazlı aktif stratejiler — kısa]

[Özet: yapılmaması gerekenler — kırmızı liste]

[Özet: aktif kod tabanı notları — d266-release-scope, kanonik sürüm]

[Özet: Paket 1 Bölüm 8 — Geri Kazanım Sonrası Kontrol Durumu tablosu (modül son durumları)]

--- STRATEJİ BİTİŞ ---

Anladıysan proje klasörünü inceleyip mevcut durumu Türkçe özetle.
```

**Devam bloğu max 2500 kelime** olmalı — öz ama eksiksiz.

---

## BÖLÜM B — Korunması Gereken Kararlar (Tam Liste)

Paket 1 + 2'den türetilmiş, numaralı tam liste.  
Her madde: `[KANITLI|TAHMİN]` etiketi + modül + tek cümle karar.

---

## BÖLÜM C — Yapılmaması Gerekenler (Tam Liste)

İptal edilmiş kararlar — geri dönülmemeli.

---

## BÖLÜM D — Aktif Kod Tabanı Notları

| Alan | Değer |
|------|-------|
| Aktif worktree | `d266-release-scope` |
| Canlı URL | `https://app.meridyen-tr.com` |
| Monorepo | NestJS + Next.js 14 + Expo |
| Son bilinen odak | CRM hub, navigasyon, kanonik sürüm geri kazanımı |

---

## BÖLÜM E — Cursor Kural Dosyası Taslağı

`.cursor/rules/meridyen-strateji.mdc` için kısa alwaysApply kural taslağı (max 80 satır).

---

## BÖLÜM F — Eksik / Doğrulanacak Maddeler

Paket 1+2'de BİLİNMİYOR kalan maddeler.

## BÖLÜM G — Geri Kazanım Kontrol Durumu Özeti (Paket 1 Bölüm 8'den)

Paket 1'deki **Geri Kazanım Sonrası Kontrol Durumu** tablosunu Cursor devam bloğuna taşı.

## BÖLÜM H — Değiştirilemez Ürün Kararları (Paket 2 Bölüm 1'den)

Paket 2'deki **Değiştirilemez Ürün Kararları** listesini Cursor devam bloğuna taşı.  
Bu maddeler tartışılamaz ürün anayasası olarak işaretlensin.

### Kurallar

1. Paket 1 ve 2'yi yeniden yazma — özetle ve birleştir.
2. Devam bloğu Türkçe olmalı.
3. Kanıtsız madde ekleme.
4. Belge sonuna ekle: *"Paket 3 tamamlandı. Üç paket seti tamam. Cursor'a BÖLÜM A'yı yapıştır."*

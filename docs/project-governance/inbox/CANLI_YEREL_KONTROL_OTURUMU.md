# Canlı + Yerel İkili Kontrol Oturumu

**Tarih:** 2026-06-25  
**Yöntem:** Cursor yan panel tarayıcı — Chrome’a çıkma  
**Kural:** Canlı = bugün ne var | Yerel = düzeltme hedefi | PASS = yerel → deploy → canlı

---

## Kontrol tablosu

| # | Modül | Canlı URL | Yerel URL | Canlı (Mustafa) | Yerel (Mustafa) | Gap / Aksiyon |
|---|-------|-----------|-----------|-----------------|-----------------|---------------|
| 1 | Giriş | `/giris` | `/giris` | Canlı HAYIR | **KISMI** — logo düzeltmesi uygulandı, Mustafa onayı | Kurumsal SVG + sol karşılama |
| 2 | Panel / Nav | `/panel` | `/panel` | | **Yerel PASS** (Mustafa) | |
| 3 | Kullanıcılar | `/panel/kullanicilar` | `/panel/kullanicilar` | | **Tasarım güncellendi** — Mustafa onayı | Kartlı görev seçimi + kurumsal logo |
| 4 | CRM | `/panel/crm` | `/panel/crm` | | | |
| 5 | Müşteriler | `/panel/musteriler` | `/panel/musteriler` | | | |
| 6 | Tedarikçiler | `/panel/tedarikciler` | `/panel/tedarikciler` | | | |
| 7 | Ayarlar | `/panel/ayarlar` | `/panel/kullanicilar` | | | |

**Mustafa sütunları:** `PASS` / `HAYIR: …` / `ATLA`

---

## Modül 1 — Giriş (beklenen fark)

| Kontrol | Canlı (bugün) | Yerel (hedef) |
|---------|---------------|---------------|
| Başlık | Sisteme Giriş | **Kullanıcı Girişi** |
| Destek hattı | Sağ üst, WhatsApp? | Sağ üst, alt alta, **WhatsApp tıklanır** |
| Alt not | Yok / farklı | **Safran Birleşik Hizmetler Yan Kuruluşudur** |
| Logo | Küçük / beyaz kutu riski | Kompakt kurumsal logo |
| **Sol / üst logo görünür** | ? | **Zorunlu — kurumsal izlenim** |
| Karşılama paneli (sol) | ? | Kurumsal ton; logo + marka dili |

**Mustafa notu (2026-06-25):** Giriş öncesi sol tarafta logo görünmüyor; karşılama ekranı kurumsal izlenime uygun olmalı — unutulmayacak.

**Teknik kök neden (agent):** `giris/page.tsx` → `/meridyen-corporate-logo-correct.png` çağırıyor; `apps/web/public/` içinde yok (sadece `logo.svg`, `logo-dark.svg` var). Logo kırık / boş çerçeve.

---

## Sesli geri bildirim formatı (kısa)

```text
Modül 1 — Canlı HAYIR: … | Yerel PASS
```

veya sadece: **「1 yerel PASS, canlı HAYIR logo」**

---

## Sıradaki teknik adım (agent)

Modül PASS oldukça: yerel → commit hazırlığı → deploy paketi (Mustafa onayı ile).

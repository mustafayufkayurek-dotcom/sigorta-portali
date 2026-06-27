# Meridyen Kriz Kurtarma Protokolü

**Sürüm:** v1 (DONMUŞ)  
**Onay:** Mustafa — 2026-06-24 — 10/10  
**Belge türü:** Resmi kriz kurtarma metodolojisi ve kayıt standardı

**Revizyon kuralı:** Yeni bölüm eklenmez. Değişiklik yalnızca v1.1 (küçük düzeltme), v1.2 (yeni kanıt) veya v2 (büyük metodoloji değişikliği) ile yapılır.

**Doldurulmuş kriz kaydı:** `docs/meridyen-paketler/ciktilar/MERIDYEN_21_22_23_HAZIRAN_KURTARMA_PAKETI_v1.md`  
**ChatGPT talimatı (üretim için):** `docs/meridyen-paketler/talimatlar/01_CHATGPT_MESAJI_PAKET1.md`

---

## 0. ALTIN KURAL

Bu belge Meridyen projesinin **resmi kriz kurtarma kaydı standardıdır**.

Bu belgede yer alan kabul edilmiş kararlar;

- yeni geliştirme gerekçesiyle **değiştirilemez**,
- eski sürümlere **döndürülemez**,
- alternatif tasarım önerisiyle **yeniden tartışılamaz**.

Bir kararın değiştirilmesi gerekiyorsa önce:

1. Regresyon kanıtı oluşturulur.
2. Kök neden bulunur.
3. Mustafa onayı alınır.
4. Yeni karar kayıt altına alınır.

**Bu dört adım tamamlanmadan hiçbir kabul edilmiş karar değiştirilemez.**

> Karar değişecekse → önce karar kaydı değişir → sonra kod değişir.  
> Kod değişti diye karar değişmez.

**Kod–karar çelişkisi:** Bu belgede yer alan kararlar ile mevcut kod çelişirse, kod doğru kabul edilmez. Önce referans karar doğrulanır, sonra kod karar ile hizalanır.

> Bu belge `00_PROJE_ANAYASASI.md` ve `00_CALISMA_YASASI.md` ile uyumlu olmak zorundadır.

---

## Kapsam sınırı

| Dahil | Hariç |
|-------|-------|
| 21–23 Haziran 2026 kararları | Proje başlangıcından önceki dönem |
| 24 Haziran geri kazanım bağlantıları | Operasyon Merkezi vizyonu (Paket 2) |
| CRM, Login, Navigasyon, ULC, Ayarlar | Hasar / Acil Yardım genel stratejisi (Paket 2) |
| Kanonik sürüm geri kazanımı | Eksper yaklaşımı (Paket 2) |
| Canlı doğrulama sonuçları | Cursor aktarım paketi (Paket 3) |

---

## Etiket zorunluluğu

Her madde şu etiketlerden birini taşımalı:

- **KANITLI** — Sohbet, paket adı, rapor, kabul belgesi veya screenshot referansı var
- **TAHMİN** — Mantıksal çıkarım; kanıt zayıf
- **BİLİNMİYOR** — Kaynak yok; boş bırak, uydurma

**Kural:** Kanıt yoksa yazma. Tahmin gerekiyorsa **TAHMİN** etiketi koy.

---

## Karar Kanıtı zorunluluğu

"Kaynak" sütunu tek başına yeterli değildir. Her karar için ayrıca **Kanıt Türü** belirtilmelidir.

| Modül / Alan | Beklenen Kanıt Türü |
|---|---|
| Login | Screenshot + Canlı doğrulama |
| CRM | Screenshot + Route + Kabul raporu |
| Navigasyon | Screenshot + Route doğrulama |
| ULC | Backend deploy + Route doğrulama |
| Mail / Bildirim | Screenshot |
| Tanımlar Merkezi | Screenshot |
| Ayarlar | Screenshot + Route |
| Kullanıcı ve Yetki | Screenshot + Kabul raporu |
| Guard / Karar koruma | Karar dosyası + Checklist |

---

## Nihai Karar Durumu zorunluluğu

Her modül bölümünün **en sonunda** tek satırlık özet zorunludur:

```
**Nihai Karar Durumu:** [Geri kazanıldı | Kısmen geri kazanıldı | Canlı deploy bekliyor | Doğrulama bekliyor | Admin kabul testi bekliyor | Kayıp | Bilinmiyor]
```

---

## Kayıt yapısı (Bölüm 1–8)

1. **Acil Kurtarma Özeti** — max 10 madde, yalnız KANITLI
2. **Gün Gün Karar Tablosu** — Etiket, Kanıt Türü, Kaynak zorunlu
3. **Modül Bazlı Kurtarma Durumu** — Login, CRM, Navigasyon, Ayarlar, Mail, ULC, Kullanıcı ve Yetki, Tanımlar, Guard
4. **Canlıya Alınan Sayfalar Envanteri**
5. **21 Haziran — Sınırlı Kanıt Bölümü**
6. **Çelişkiler ve Açık Sorular**
7. **Paket 2'ye Devredilenler**
8. **Geri Kazanım Sonrası Kontrol Durumu** — ✅ ⚠️ ⏳ ❌ ❓ tablosu (zorunlu)

---

## Kurallar

1. **21 Haziran öncesi ve genel strateji hafızasına girme** — Paket 2'ye bırak.
2. **Cursor/Codex aktarım bloğu üretme** — Paket 3'e bırak.
3. Kanıtsız madde ekleme.
4. Her tablo satırında **Etiket** ve **Kanıt Türü** zorunlu (kanıt yoksa BİLİNMİYOR).
5. Her modül bölümünde **Nihai Karar Durumu** satırı zorunlu.
6. **Bölüm 0 (ALTIN KURAL)** ve **Bölüm 8** atlanamaz.
7. **Bu belgede yer alan kararlar ile mevcut kod çelişirse, kod doğru kabul edilmez.** Önce referans karar doğrulanır, sonra kod karar ile hizalanır.

---

*Bu protokol v1 donmuştur. Uygulama önceliklidir — belge büyütülmez, versiyonlanır.*

# Ürün Standardı — Teknoloji Görünmez · Operasyon Görünür

**Durum:** Değiştirilemez ürün standardı (kalıcı kilit)  
**Tarih:** 16 Temmuz 2026  
**Onay:** Mustafa  
**Ajan yansıması:** `.cursor/rules/urun-gorunmez-teknoloji.mdc`  
*(Cursor tercihi değildir; bu dokümanın ajanlara yansımasıdır.)*

---

## İlke

**Meridyen teknolojisini göstermez; operasyonu yönetir.**

Kullanıcıya görünen yüzey: iş dili, dosya akışı, karar ve işlem.  
Kullanıcıya görünmeyen: sağlayıcı, API, algoritma, motor markası, entegrasyon pazarlaması.

Bu kural bir UI tercihi veya ajan talimatı değildir. **Yazılımın ürün kabul standardıdır.** İhlal eden tasarım kabul edilmez.

---

## Kullanıcıya görünen (izinli)

Operasyon dili — örnekler:

- Güncel İşlem
- Önerilen Tedarikçiler
- Alış / Satış
- Onay Talebi
- WhatsApp yazışmaları
- Dosyayı Kapat
- Finansa Aktar
- Ortalama Maliyet, Daha Fazla Öneri (iş sonucu dili)

---

## Kullanıcıya görünmeyen (yasak)

UI etiketi, metin, badge, tooltip, boş durum, hata mesajı — hiçbirinde:

| Yasak | Neden |
|-------|--------|
| Google, Google Maps, Places | Harici sağlayıcı |
| API, entegrasyon, algoritma | Teknik iç yapı |
| Operasyon Hafızası, Terminoloji Hafızası, Maliyet Hafızası | İç motor markası |
| Akıllı Tedarikçi / Akıllı Tedarikçi Ağı | Teknoloji pazarlama |
| Alternatif Tedarikçi Servisi | Servis ürün adı |
| WhatsApp analizi | Analiz motoru |
| Hakediş / cari motoru, finans kuralları (arka plan detayı) | Motor detayı |

**İstisna:** Backend log, kod yorumu; admin ayar ekranı yalnızca açık ürün kararı varsa teknik dil kullanabilir.

---

## Kapsam — tüm modüller

Standart **tüm paneller ve yüzeyler** için geçerlidir; modül istisnası yoktur:

- Hasar
- Acil Yardım
- CRM
- Finans
- Tedarikçi
- Müşteri / Portal
- Operasyon
- Yönetim / Ayarlar (kullanıcıya görünen metinler)
- Eksper, Sigorta, Broker ve diğer rol panelleri

Yeni modül eklendiğinde bu standart otomatik geçerli sayılır; ayrı muafiyet yalnızca Mustafa onayıyla kayıt altına alınır.

---

## Tasarım kabul sorusu

Her yeni özellik, metin veya ekran için tek soru:

> Kullanıcı bunu **operasyon işi** olarak mı görür?

- **Evet** → yazılabilir.  
- **Hayır** (teknoloji, sağlayıcı, motor, API…) → yazılmaz.

Harici / alternatif tedarikçi önerisi yoksa veya servis kapalıysa (operasyon dili):

> Alternatif tedarikçi şu anda önerilemiyor. Lütfen daha sonra tekrar deneyin.

Google / API / yapılandırma demeden.

Bölüm başlığı: **Önerilen Tedarikçiler** (havuz + harici adaylar aynı liste; kaynak etiketi yok).

---

## İhlal = tasarım kabul edilmez

1. Bu standardı ihlal eden UI **ürün kabulü alamaz**.
2. Production referansında ihlal görülürse → eksik sayılır; local düzeltme zorunludur.
3. Eski “Akıllı / Hafıza / Google / API” etiketlerini geri getirmek regresyondur.
4. Standart değişecekse: önce Mustafa onayı + bu dokümanda kayıt → **sonra** kod. Kod değişti diye standart değişmez.

---

## İlgili belgeler

- Ürün kabul akışı: `docs/project-governance/PRODUCTION_URUN_KABULU.md`
- Proje anayasası: `docs/project-governance/00_PROJE_ANAYASASI.md`
- Ajan kuralı: `.cursor/rules/urun-gorunmez-teknoloji.mdc`

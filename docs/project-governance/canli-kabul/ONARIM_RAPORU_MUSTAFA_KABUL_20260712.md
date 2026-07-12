# Onarım Raporu — Mustafa Kabul Durumu (12 Temmuz 2026)

**Kaynak:** Mustafa'nın orijinal notları + 4'erli grup test geri bildirimi (Grup 1–5).  
**Canlı referans:** Web v289 (12 Temmuz sabah footer); deploy hedefi v290.  
**B-1 (Rapora Git akışı):** İptal — dokunulmayacak.

## Altın kural (kalıcı)

1. Agent **«canlıya alındı» / «tamamlandı»** demez; yalnızca Mustafa **OLMUŞ / OLMAMIŞ / YANLIŞ / YENİ TALEP** yazar.
2. Toplu 41 madde testi **deploy + footer sürüm doğrulaması** sonrası; madde madde.
3. PASS için: doğru ekran + footer sürümü + ekran görüntüsü veya açık cümle.

---

## Grup 1

| # | Durum | Not |
|---|--------|-----|
| 1 | **YENİ TALEP** | Üst bant: yalnızca kalın dosya no; `Hasar …` ikinci numara gizlensin; alt satır sigortalı ad soyad; `RPT-…` kalksın; Taslak/Satış/Kâr sağ üstte belirgin; detaydan sigortalı ad kalksın |
| 2 | **YAPILMIŞ** | Hasar nedeniyle uyumlu hızlı onarım |
| 2 ek | **YENİ TALEP** | Hızlı Onarım Türü yan yana (alt alta değil) |
| 3 | **YAPILMIŞ** | Hasar Türü(leri) → Hasar Türü |
| 4 | **YAPILMIŞ** | Hızlı Onarım Kalemleri → Hızlı Onarım Türü |

## Grup 2

| # | Durum | Not |
|---|--------|-----|
| 5 | **OLMAMIŞ** | Modal «Eşleşen kalem bulunamadı»; eski tanımlar silinmiş — geri getir veya yeniden listele (Mustafa kararı) |
| 6 | **YAPILMIŞ** | Satır ekleme |
| 7 | **YAPILMIŞ** | Mavi satır ekle kalktı |
| 8 | **YAPILMIŞ** | Düzenle/Sil ikonları |

## Grup 3

| # | Durum | Not |
|---|--------|-----|
| 9 | **YAPILMIŞ** | Kaydet butonu sadeleştirme |
| 10 | **OLMAMIŞ** | Fotoğraf yüklenemedi devam ediyor |
| 10 ek | **YENİ TALEP** | Yüklenen resim görünsün; orta/küçük boy; galeride sonraki resim; tip etiketi (Tespit/Onarım/Onarım Sonrası) |
| 11 | **YAPILMIŞ** / **TEST YAPILAMADI** | Etiketler tamam; köşe yazısı ve portal yansıması test edilemedi |
| 12 | **YAPILMIŞ** | Alt bant baloncuk ortalama |

## Grup 4

| # | Durum | Not |
|---|--------|-----|
| 13 | **YAPILMIŞ** | Sigortalı raporda; 1. madde revizyonları ayrı bekliyor |
| 14 | **OLMAMIŞ** | Dosya Eksperi raporda Atanmamış; müşteri kartında eksper var |
| 15 | **OLMAMIŞ** | Kaydet/İptal sağa çekilmedi (Mustafa beklentisi) |
| 16 | **BEKLEMEDE** | Yasal notlar — Mustafa yeniden maddeleştirecek |

## Grup 5

| # | Durum | Not |
|---|--------|-----|
| 17 | **YAPILMIŞ** | Dosya Bütçesi; Dahili kalktı |
| 18 | **YAPILMIŞ** | Tedarikçi kıyaslama |
| 18 ek | **YENİ TALEP** | Dosya Bütçesi başlık/satır/Genel Toplam ortalı |
| 19 | **KISMEN** | Revizyon modal var; çubuk+nokta + Dosya Bilgileri konumu eksik |
| 20 | **OLMAMIŞ** | = 14, Dosya Bilgileri eksper |

---

## Sonraki dalga (Grup 6–11 — test durduruldu)

Grup 6–11 Mustafa onayı sonrası, **v290+ canlı** ve footer doğrulandıktan sonra devam edilecek.

## Deploy notu (12 Temmuz 2026)

- **Kapsam:** web-only v290 (commit `75cb60e`); migration yok.
- **Rollback:** web v289, backend v278.
- **Deploy sonrası:** Ctrl+Shift+R; footer **Web v290** beklenir.

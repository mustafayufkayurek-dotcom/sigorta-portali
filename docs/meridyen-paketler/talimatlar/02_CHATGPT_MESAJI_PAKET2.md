Sen benim Meridyen yazılım projemdeki sohbet geçmişime erişebilen asistanımsın.

**Paket 1** (`MERIDYEN_21_22_23_HAZIRAN_KURTARMA_PAKETI_v1`) tamamlandı ve onaylandı varsayımıyla, şimdi yalnızca **Paket 2** üreteceksin.

### Görevin

Meridyen'in **uzun dönem ürün, karar ve regresyon hafızasını** tek belgede toplamak.  
Bu belge Cursor/Codex oturumlarında **ürün kararı referansı** olacak.

**Çıktı dosya adı:** `MERIDYEN_STRATEJIK_KARAR_ENVANTERI_v1`

### Kritik ilke (21–24 Haziran krizinden — zorunlu)

**Ürün kararı ile uygulama kararını aynı cümlede veya aynı satırda tutma.**

| Tür | Bu belgede (Paket 2) | Paket 1'de |
|-----|----------------------|------------|
| Ürün kararı | Evet — ne, neden, sınır | Kurtarma bağlamı |
| Uygulama kararı | Hayır — yalnızca referans | Evet — patch, deploy, route |
| Kanıt / screenshot | Kanıt türü referansı | Tam kanıt envanteri |

Ürün kararı tartışılamaz; uygulama yöntemi değişebilir ama ürün kararını ihlal edemez.

---

### Kapsam

| Dahil | Hariç |
|-------|-------|
| Değiştirilemez ürün kararları (anayasa) | 21–24 Haziran kriz tablosu (Paket 1'de) |
| Modül bazlı ürün stratejisi | Commit / patch / dosya detayları |
| Regresyon geçmişi (modül bazlı) | Cursor aktarım bloğu (Paket 3'te) |
| Karar değişiklik günlüğü | Teknik uygulama adımları |
| Canlı kabul seviyesi özeti | |
| Operasyon Merkezi, Hasar, Acil Yardım, Evrak, OZ Merkezi | |
| Eksper, CRM, Navigasyon, Ayarlar, Mail, ULC, Yetki, Tanımlar, Finans, Guard | |
| UX/marka, altyapı, platform dönüşümü | |

### Zorunlu referans belgeler (sohbet geçmişinde ara)

- `MERIDYEN_URUN_VE_UYGULAMA_ANAYASASI_V1`
- `MERIDYEN_KALICI_KARARLAR`
- `MERIDYEN_GELISTIRME_PRENSIPLERI`
- `PROFESSIONAL_CALISMA_MODELI`
- `MUSTAFA_CALISMA_MODELI_KARARI_01`
- `KARAR_KORUMA_GUARD_SISTEMI_01`
- Operasyon Zekası paket ailesi (`OPERASYON_ZEKASI_*`)
- Evrak paket ailesi (`EVRAK_*`)
- CRM paket ailesi (`CRM_*`)
- Ayarlar paket ailesi (`AYARLAR_MODULU_*`)

### Etiket zorunluluğu

- **KANITLI** — Sohbet, paket adı, rapor, kabul belgesi veya screenshot referansı var
- **TAHMİN** — Mantıksal çıkarım; kanıt zayıf
- **BİLİNMİYOR** — Kaynak yok; boş bırak, uydurma

**Kural:** Kanıt yoksa yazma.

---

## İstenen çıktı formatı

# MERIDYEN_STRATEJIK_KARAR_ENVANTERI_v1

**Hazırlayan:** ChatGPT  
**Kapsam:** Meridyen uzun dönem ürün + karar + regresyon hafızası  
**Paket:** 2 / 3  
**Belge türü:** Meridyen ürün hafızası referans dokümanı (uygulama detayı Paket 1'de)

---

## 1. Değiştirilemez Ürün Kararları (Ürün Anayasası — ZORUNLU)

Bu bölüm belgenin **başında** yer alır.  
Bu maddeler **Mustafa ürün kararıdır**; teknik ekip tartışamaz, geri alamaz, uygulama gerekçesiyle değiştiremez.

Aşağıdaki çekirdek maddeler **KANITLI ise dahil et**; kanıtsız olanları BİLİNMİYOR bırak:

| # | Değiştirilemez Karar | Etiket | Kaynak |
|---|----------------------|--------|--------|
| 1 | Login kurumsal kimliği değiştirilemez | | |
| 2 | Navigasyon tek sahiplik modeli değiştirilemez | | |
| 3 | CRM bağımsız modüldür (Müşteriler alias'ı değildir) | | |
| 4 | Mail ve Bildirim Merkezi tek merkezdir | | |
| 5 | İhbar Konuları canonical sahiptir | | |
| 6 | Kullanıcı / Rol / Ekran İzinleri tek aile yaklaşımı korunacaktır | | |
| 7 | Kurumsal logo statiktir; logo animasyonu yoktur | | |
| 8 | Operasyon Merkezi aksiyon ekranıdır; dashboard rapor ekranı değildir | | |
| 9 | Codex ürün kararı vermez; uygulama ve kanıt üretir | | |

Ek KANITLI değiştirilemez kararlar varsa tabloya ekle.

**Not:** Bu bölümde uygulama detayı (commit, dosya, deploy komutu) yazma.

---

## 2. Yönetici Özeti (max 15 madde, yalnız KANITLI)

---

## 3. Çalışma Modeli ve Rol Ayrımı

- Mustafa / ChatGPT / Codex / Cursor sorumlulukları
- **Ürün kararı ≠ Uygulama kararı ≠ Kanıt** (ayrı satırlarda tut)
- Kabul statüleri: KODLANDI ≠ DERLENDİ ≠ DEPLOY ≠ CANLI ≠ KABUL EDİLDİ

---

## 4. Modül Bazlı Stratejik Kararlar

Her modül için **aynı alt yapı zorunludur**. Modül listesi:

### Login
### Navigasyon
### CRM ve İlişki Yönetimi
### Ayarlar
### Mail / Bildirim Merkezi
### İhbar Konuları
### Kullanıcı Yaşam Döngüsü (ULC)
### Kullanıcı ve Yetki
### Tanımlar Merkezi
### Operasyon Merkezi
### Hasar Dosyaları
### Acil Yardım
### Evrak Standardı
### Operasyon Zekâ Merkezi
### Eksper ve Eksper Portalı
### Finans
### Karar Koruma (Guard)

---

### Her modülde zorunlu alt bölümler (sırayla):

#### 4.x.1 Aktif Ürün Kararları
- Yalnız **ürün kararı** cümleleri (KANITLI / TAHMİN / BİLİNMİYOR)
- Her madde için **Kanıt Türü** (Paket 1 ile uyumlu)

#### 4.x.2 Regresyon Geçmişi (ZORUNLU)
Yaşanan regresyonlar — strateji kadar önemli. Aynı hata tekrar edilmesin diye yaz.

Format (örnek CRM):
- **KANITLI:** Müşteri alias'ına yanlış döndü.
- **KANITLI:** Teknik audit kutuları canlıya taşındı.
- **KANITLI:** Bağımsız modül olarak geri kazanıldı.

Regresyon yoksa: *"KANITLI regresyon kaydı bulunamadı"* yaz (uydurma).

#### 4.x.3 Karar Değişiklik Günlüğü (ZORUNLU)
Stratejik kararların kısa tarihçesi:

| Aşama | Karar | Tarih / Paket | Etiket | Durum |
|-------|-------|---------------|--------|-------|
| İlk karar | | | | İptal edildi / Geçersiz |
| Revizyon (varsa) | | | | İptal edildi / Geçersiz |
| Son geçerli karar | | | | **AKTİF** |

Örnek CRM:
| Aşama | Karar | Durum |
|-------|-------|-------|
| İlk | CRM → Müşteriler alias | İptal |
| Son geçerli | CRM bağımsız modül | **AKTİF** |

#### 4.x.4 Canlı Kabul Seviyesi (ZORUNLU)

| Alan | Durum |
|------|-------|
| Kod | PASS / FAIL / BEKLİYOR / BİLİNMİYOR |
| Build | PASS / FAIL / BEKLİYOR / BİLİNMİYOR |
| Deploy | PASS / FAIL / BEKLİYOR / BİLİNMİYOR |
| Canlı | PASS / KISMİ / BEKLİYOR / BİLİNMİYOR |

#### 4.x.5 Nihai Karar Durumu (ZORUNLU)

```
**Nihai Karar Durumu:** [Geri kazanıldı | Kısmen geri kazanıldı | Canlı deploy bekliyor | Doğrulama bekliyor | Admin kabul testi bekliyor | Kayıp | Bilinmiyor]
```

---

## 5. UX ve Marka Kuralları (ürün kararı düzeyinde)

## 6. Altyapı ve Deploy Kuralları (ürün kararı düzeyinde)

## 7. Platform Dönüşüm Stratejisi

## 8. Yapılmaması Gerekenler (Kırmızı Liste)

| Karar / Yaklaşım | Neden iptal | Etiket | Kaynak |
|------------------|-------------|--------|--------|

## 9. Paket 1 ile Çelişen Maddeler

KANITLI çelişki varsa listele; yoksa *"çelişki tespit edilmedi"* yaz.

## 10. Doğrulanması Gereken Sorular (max 15)

---

### Kurallar

1. **Ürün kararı ile uygulama kararını karıştırma** — uygulama Paket 1'de kalır.
2. Paket 1 kriz tablosunu tekrarlama — yalnızca stratejik/regresyon hafızası.
3. **Bölüm 1 (Değiştirilemez Ürün Kararları) atlanamaz.**
4. Her modülde **Regresyon Geçmişi**, **Karar Değişiklik Günlüğü**, **Canlı Kabul Seviyesi** zorunlu.
5. Cursor aktarım bloğu üretme — Paket 3'e bırak.
6. Kanıtsız madde ekleme; eski/iptal kararlara dönüş önerme.
7. Çıktıyı tek seferde, kopyalanabilir belge olarak ver.
8. Belge sonuna ekle: *"Paket 2 tamamlandı. Bu belge Meridyen ürün + karar + regresyon hafızası referans dokümanıdır. Sırada MERIDYEN_CURSOR_CODEX_AKTARIM_PAKETI_v1 (Paket 3) var."*

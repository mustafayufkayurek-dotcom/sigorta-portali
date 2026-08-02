# Meridyen — AI + AR Akıllı Ölçüm Modülü (Enterprise Spec)

**Durum:** Ürün spesifikasyonu alındı (Mustafa — 2026-08-01)  
**Mimari:** Onaylandı + revizyon 1–10 — `AI_AR_AKILLI_OLCUM_MIMARI.md`  
**Taslak DDL:** `docs/features/ai-ar-smart-measure/DRAFT_migration.sql` (**çalıştırılmadı**)  
**Birim:** DB + API = **mm (int)**; UI mm/cm/m/inch.  
**Evidence Chain:** SmartMeasureVersion + FileAsset + AuditLog.  
**Tenant:** ClaimFile üzerinden `assertClaimFileAccess` zorunlu.

---

## Amaç

Mobil cihaz kamerası ile hasarlı / ölçülecek yapı elemanlarının ölçülerini almak.

Sistem yalnızca mesafe göstermez:
- Nesneyi tanır (AI)
- Ölçüyü hesaplar (ARKit / ARCore)
- Alan / çevre / metraj üretir
- Hasar dosyasına işler
- Fotoğraf + ölçüleri Evidence Chain olarak saklar

Bu, sıradan kamera modülü değil; kurumsal **Akıllı Ölçüm Sistemi**dir.

---

## Temel mimari (3 katman)

| Katman | Rol |
|--------|-----|
| **1 — AR Ölçüm Motoru** | Apple ARKit + Google ARCore. Sıfırdan mesafe algoritması yok; cihaz gerçek dünya koordinatı. |
| **2 — AI Nesne Tanıma** | Nesne tipi + sınır. Mimari açık; yeni tipler eklenebilir. |
| **3 — Operasyon Zekâsı** | En / boy / yükseklik / alan / çevre / adet / hacim → dosyaya kayıt + metraj. |

### Teknik ilkeler (kilitli)

- Mesafe/boyut: **yalnızca cihaz AR altyapısı**. Görüntü üzerinden tahmini cm algoritması nihai yol değildir.
- AI: tanıma, sınır, sınıflandırma.
- **Web kamera ile ölçüm yapmaz**; mobil uygulamadan gelen sonuçları gösterir, raporlar, iş akışında kullanır.
- Katmanlar bağımsız geliştirilebilir.
- Mevcut API / veri modeli korunur; yeni bileşenler entegre edilir.
- Audit Log + Evidence Chain zorunlu; sessiz ölçü değişikliği yok.
- Mümkün olduğunca cihaz üstü işlem; düşük internette çalışır.

---

## Kullanıcı senaryosu (özet)

Hasar dosyası → **Kamera ile Ölç** → AI algılar + sınır işaretler → AR gerçek ölçü → ekranda (ör. Kapı 91×212, Alan 1.93 m²) → kullanıcı düzeltir/onaylar → dosyaya + Evidence Chain.

Manuel düzeltme: köşe taşıma, yeniden ölçüm, AI önerisini değiştirme. Son karar kullanıcıda.

---

## Veri ilişkisi

`Dosya → Mahal → Oda → Yapı Elemanı → Ölçü → Fotoğraf → AI Güven Skoru → Ölçüm Geçmişi`

Ölçümler versiyonlanır (ilk / revizyon / son); silinmez.  
PDF: foto, ölçü, alan, AI tanımı, tarih, personel, GPS, cihaz, güven skoru.

---

## Desteklenen nesne tipleri (F1 hedef listesi)

Kapı, pencere, mutfak/banyo dolabı, tezgâh, duvar, cam, seramik, fayans, parke, tavan, kolon, kiriş, lavabo, klozet, duşakabin, klima, radyatör, merdiven, asma tavan, PVC/ahşap doğrama. Liste genişletilebilir.

---

## Gelecek fazlar (mimari açık kalsın; şimdi yapılmaz)

3D oda tarama, hacim, kat planı, çoklu oda, hasar bölgesi işaretleme, AI keşif raporu, sesli yönlendirme, video/drone ölçü, LiDAR hassasiyet, BIM/CAD, Digital Twin.

---

## Kabul kriterleri

1. Kamera açılınca AI ölçülebilir nesneyi algılar  
2. Manuel düzeltme mümkün  
3. AR gerçek dünya ölçüsü üretir  
4. En/boy/alan/metraj otomatik  
5. Foto + katman birlikte saklanır  
6. Evidence Chain + Audit Log  
7. Doğrudan hasar dosyasına aktarım  
8. Yeni nesne / gelecek teknoloji için genişletilebilir  
9. Mevcut mimari bozulmadan kurumsal entegrasyon  

---

## Dilim durumu

| Dilim | Kapsam | Durum |
|-------|--------|--------|
| **0** | Spec + API sözleşmesi + veri modeli | ✅ 2026-08-01 |
| **1** | Backend CRUD/versiyon/audit + web liste/geçmiş | ✅ v434 |
| **2a** | Mobil: Kapı — foto + cm + API kayıt (AR motoru köprüsü) | ✅ |
| **2b** | Mobil: ARKit/ARCore (`@reactvision/react-viro@2.41.6` + expo-dev-client) | ✅ local — development build gerekir |
| **3** | AI nesne tanıma + güven skoru + sınır kutusu | ✅ v436 |
| **4** | Metraj otomasyonu + PDF zenginleştirme | ✅ v437 |

---

## Dilim 0 — API sözleşmesi

Base: `/api/v1/claim-files/:claimFileId/smart-measures`

| Method | Path | Yetki | Açıklama |
|--------|------|-------|----------|
| POST | `/detect` | `claim_file.update` | AI nesne tipi + güven + sınır kutusu |
| POST | `/photo` | `claim_file.update` | Ölçüm fotoğrafı yükle → `{ photoUrl }` |
| POST | `/` | `claim_file.update` | Eleman + ilk sürüm (mobil AR payload) |
| GET | `/` | `claim_file.view` | Liste (her elemanda `latestVersion` + `metraj`) |
| GET | `/:elementId/pdf` | `claim_file.view` | Metraj + ölçü PDF indir |
| GET | `/:elementId` | `claim_file.view` | Detay + tüm sürümler + `metraj` |
| POST | `/:elementId/versions` | `claim_file.update` | Yeni sürüm (eski silinmez; AuditLog) |

### Veri modeli

- `SmartMeasureElement` — dosya → mahal → oda → yapı elemanı
- `SmartMeasureVersion` — en/boy/derinlik, alan, çevre, hacim, foto, overlay, GPS, cihaz, AI güven, `source`

Ölçüm sürümleri **silinmez**. Değişiklik `AuditLog` (`smart_measure.create` / `smart_measure.revise`).

Web kamera ile ölçmez; mobil uygulamadan gelen kayıtları gösterir.

Migration: `20260801140000_smart_measures`


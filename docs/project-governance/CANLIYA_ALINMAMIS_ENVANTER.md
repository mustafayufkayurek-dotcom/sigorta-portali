# Canlıya Alınmamış / Yarım Kalan İşler Envanteri

**Tarih:** 28 Haziran 2026 (güncelleme 26.08.2026)  
**Referans canlı sürüm:** Web + backend **v540**  
**Güvenlik protokolü:** `DEPLOY_GUVENLIK_PROTOKOLU.md`

Bu liste yalnızca **henüz ürün olarak kapanmamış** veya **bilinçli ertelenmiş** işleri içerir.

**Sıradaki canlı paket (Mustafa · 26.08.2026, henüz alınmadı):** Hasar dijital onay WhatsApp — telefon hazır gelir, gönderim sohbeti açar (v541). İK / puantaj bu alıma karışmaz.

---

## Öncelik A — Kod/strateji var, canlı kapanış yok

| # | Konu | Durum | Risk | Önerilen adım |
|---|------|-------|------|----------------|
| A1 | **Resmi kabul kanıtları** (Paket 1 modülleri) | Canlıda olabilir; screenshot/PASS eksik | Orta — "eski mi yeni mi" belirsizliği | Modül modül 5 dk smoke + ekran görüntüsü klasörü |
| A2 | **Git commit eksikliği** | Canlı ≈ yerel disk; repo HEAD geride | Yüksek — kayıp/rollback zor | `safety/pre-inventory` branch + snapshot commit |
| A3 | **Hoş geldin maili** | Kod canlı; başarılı gönderim kanıtı zayıf | Orta | 1 test davet + log kontrolü |

---

## Öncelik B — Bilinçli ertelenmiş paketler (canlıya alınmadı)

| # | Konu | Kaynak | Not |
|---|------|--------|-----|
| B1 | **D276 Finans UX olgunlaştırması** | ARCHIV envanter | Finans rotaları var; D276'daki özel UX ayrı paket |
| B2 | **D278 MinIO canlıya alma** | ARCHIV | Hazır denmiş, deploy yok |
| B3 | **D255 Sahip ekranları CRUD standardı** | ARCHIV | Tek tip şablon henüz kapanmadı |
| B4 | **Personel / demirbaş pod tam entegrasyonu** | agreement-hr dalga | İK zimmet — v541’den **sonra**. Bu alıma karışmaz. |
| B5 | **CRM tam kapsam** | Kurtarma Paketi 1 | Route var; "kısmen geri kazanıldı" — derinlik eksik olabilir |
| B6 | **Hasar dijital onay WhatsApp** | Mustafa 26.08.2026 | **Sıradaki canlı paket (v541).** Kod + kilit hazır. Sunucu kopyası bekliyor. |

---

## Öncelik C — Süreç / belge güncelliği

| # | Konu | Aksiyon |
|---|------|---------|
| C1 | `RECOVERY_LOG_2026-06-24.md` "deploy edilmedi" | Güncelle veya arşivle |
| C2 | `MUSTAFA_SABAH_RAPORU` | Tarihsel belge olarak işaretle |
| C3 | Guard checklist canlı PASS | Tek oturumda doğrula |

---

## Önerilen sıradaki dalga (güvenli)

**Dalga 3 — Envanter + düşük risk (deploy gerektirmez):**
1. Git safety snapshot
2. Resmi kabul klasörü (screenshot)
3. B paketlerinden hangisinin hâlâ geçerli olduğuna Mustafa kararı

**Dalga 4 — İlk canlı aday (tek paket, web-only tercih):**
- B1 Finans UX **veya** B3 Sahip CRUD — ikisi birden değil
- Protokol: pre-deploy-safety → rsync → build → smoke → Mustafa PASS

---

## Canlıda OLDUĞU kesin (tekrar deploy gereksiz)

- Ayarlar anayasası v26–v29 (masraf, iş grubu, dosya, evrak, mahaller, hizmet türleri)
- Kullanıcı davet akışı + geçici şifre
- Sol menü tek sahiplik (PanelSidebar)
- KVKK / sözleşme onay modalı
- Tanımlar Merkezi hub
- Eskalasyon geri linki (v29)

---

*Sonraki adım: Mustafa hangi B maddesinden başlamak istediğini seçer; her deploy `DEPLOY_GUVENLIK_PROTOKOLU` ile yapılır.*

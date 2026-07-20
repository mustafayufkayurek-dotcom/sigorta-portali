# Hasar Modülü Perde UX Standardı — 2026-07-19

> **DEPRECATED / SUPERSEDED (2026-07-19)**  
> Bu belge silinmedi; geri dönüş için korunur.  
> Güncel bağlayıcı standart: `HASAR_OPERASYON_PLANLAYICISI_UX_STANDARDI_20260719.md`  
> Piksel referans: `docs/project-governance/ui-reference/HASAR_OPERASYON_PLANLAYICISI_FINAL_REFERANS.png`

**Kaynak kilit:** `HASAR_1_PERDE_UX_KILIT_20260719.md` (deprecated)  
**Piksel referans:** `ekran-goruntuleri/hasar-1-perde-operasyon-kontrol-20260718/26-viewport-aktif-rozet-20260719.png`  
**Lokal rota:** `/dev/hasar-operasyon-kontrol-merkezi` (korunur)

## Temel kural

1. Perde ekranı Hasar Modülünün **referans UX standardıdır**.  
2–6. Perdeler aynı tasarım dilini kullanır; farklı dil üretilmez.

| Perde | Operasyon |
|-------|-----------|
| 1 | Randevu Operasyon Merkezi (bu referans) |
| 2 | Tespit Operasyonu |
| 3 | Tedarikçi Operasyonu |
| 4 | Dijital Onay |
| 5 | Rapor Aşaması |
| 6 | Finans / Dosya Kapat |

Her perde yalnız kendi operasyonunu gösterir. Yeni perde bu referanstan türetilir.

## Korunacak kabuk

Kart yapısı · Drawer (popup yok) · Renk hiyerarşisi · SVG ikon dili · Alt Operasyon Şeridi · Zorunlu İşlemler · Notlar & Hatırlatmalar · 6’lı grid + Bugünkü Görev yerleşimi

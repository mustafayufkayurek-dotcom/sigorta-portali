# Dalga 2 — Hazırlık Notu (uygulama yok)

**Tarih:** 2026-07-23  
**Durum:** 🔒 Hazırlık · **kod / deploy / push yok**  
**Önkoşul:** Dalga 1 PASS + Feature Freeze AKTİF ✅  
**Başlatma:** Mustafa **yeni görev + kapsam onayı** vermeden uygulama başlamaz.

---

## Amaç (plan taslağı — onaylanmadı)

İş akışı güvenliği: Dosya Detay, Operasyon, Gelen Kutusu, Planlayıcı, Acil Yardım, Eksper Portalı.

## Aday kapsam (onay bekleyen liste)

| Aday | Odak (taslak) |
|------|----------------|
| Hasar Dosya Detay | Sessiz catch, kaydet güvenliği, tab regresyonu |
| Acil Dosya Detay | Dil / form / yetki; Asistan metinleri |
| Operasyon Merkezi | Liste + aksiyon güvenliği |
| Gelen Kutusu | T1–T7 senaryoları |
| Hasar Operasyon Planlayıcısı | Adım akışı |
| Eksper Portalı | Portal freeze + iş akışı |

## Zorunlu koruma (Dalga 1 freeze)

Her Dalga 2 iş paketinde:

1. `pnpm smoke:route-gate` → PASS  
2. D1 form/kaydet/il-ilçe/route-gate util’lerine regresyon yok  
3. Feature Freeze kabuk + D1-* ihlali yok  
4. Push / deploy yok (ayrı onay)

## Bilinçli erteleme (Dalga 1’den)

| Madde | Taşındığı yer |
|-------|----------------|
| Çıkış sonrası eski URL (smoke PARTIAL) | Login modülü dalgası — Dalga 1 açılmaz |

## Beklenen girdi (Mustafa)

- [ ] Dalga 2 başlangıç onayı  
- [ ] Öncelik sırası / hangi madde önce  
- [ ] Kapsam dışı bırakılacaklar  

*Bu dosya yalnızca hazırlıktır; onay olmadan uygulama yapılmaz.*

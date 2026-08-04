# Ürün Notu — Mesai Saati Denetimi

**Tarih:** 2026-08-04  
**Durum:** ✅ Uygulandı (migration yok)

## Karar

Personel mesai başlangıç / bitiş saatleri sistemde denetlenir.

## Kurallar (v1 sabit)

| Gün | Saat |
|-----|------|
| Hafta içi | 08:30 – 18:00 |
| Cumartesi | 08:30 – 13:00 |
| Pazar + resmi tatil | Çalışılmıyor |

- Tolerans: **5 dakika** (geç / erken)
- Kaynak: kayıtlı `clockInAt`/`clockOutAt` veya panel aktivitesi nabzı
- Nabız resmi mesai kartı değildir; denetim referansıdır

## Personel dili (Mustafa — 2026-08-04)

Doğrudan “mesai saati uyarısı / ihlal” mesajı **yok**.

| Durum | Davranış |
|-------|----------|
| Hafta içi 08:30’dan sonra giriş | Popup: **Yazılıma Giriş Saatiniz** + büyük saat (ör. 09:20) + uyarı ikonu · Devam Et |
| Mesai bitmeden çıkış | Popup: **Yazılımdan Çıkış Saatiniz** + büyük saat · Çıkışa Devam |
| Pazar / resmi tatil | Giriş **kapalı** · “Yöneticiniz ile irtibata geçin” |
| Cumartesi 13:01+ (mesai bitişi sonrası) | Giriş **kapalı** · aynı dil |
| Hafta içi 18:01+ | Giriş **kapalı** |

Lokal popup önizleme: `/dev/personel-ozluk-denetim`  
Kurallar: `hr-work-hours.helper` → `evaluatePanelAccess` / `evaluateEarlyExitNotice`  
Türkiye resmi tatilleri: `hr-turkey-calendar.helper` (Pazar + tatil günleri giriş kapalı)  
Canlı bağ: `GET /hr/panel-access` + `WorkHoursPanelGate` (panel layout)  
Muaf: Admin, Manager, portal rolleri

## Nerede görünür

- **Popup** (personel) — masum saat bildirimi / kapalı gün
- **Puantaj Onay Uyarısı** — yalnız “bugünü onayla” (ayrı)
- Admin Özet Ve Denetim: geç/erken sayıları (iç denetim)
- API: `GET /hr/work-hours`

## Sonraki (opsiyonel)

- Ayarlar ekranından saatleri değiştirme (`system-settings`)
- Panel giriş kilidi (`AttendanceAccessGate`) — ayrı ürün kararı

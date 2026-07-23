# Meridyen — Enterprise Stabilizasyon Programı

**Durum:** 🔴 NOT READY (program açık — yeni özellik / push / deploy yasak)  
**Feature Freeze:** ✅ **AKTİF**  
**Başlangıç:** 2026-07-22  
**Canlı referans:** web v392 / backend v390 (`deploy/manifests/KNOWN_GOOD_IMAGES.json`)  
**Ürün sahibi:** Mustafa · AI yalnızca teknik uygulayıcı

## Amaç

Canlı kullanıcı testlerinde çıkan hata sınıflarını kalıcı kapatmak; aynı sınıfın diğer ekranlarda varlığını tarayıp ortak altyapı ile önlemek; tamamlanmış ekranları Feature Freeze ile korumak.

Bu çalışma **yeni özellik geliştirme değildir**.

## Kapı kuralları (READY verilene kadar)

| Yasak | Açıklama |
|-------|----------|
| Yeni özellik | Yeni ekran / yeni iş kuralı / kapsam genişletme yok |
| Yeni tasarım | Onaylı UI / dashboard / portal shell’e dokunma yok |
| Push | READY + Mustafa onayı olmadan yok |
| Deploy / canlı | READY + Mustafa onayı olmadan yok |
| Dalga atlama | Önceki dalga tamam + onay olmadan sonraki yok |
| Freeze ihlali | Feature Freeze (kabuk **ve Dalga 1 akışları**) — Mustafa onayı şart |
| Dalga 1 regresyon | D1 form/kaydet/il-ilçe/route-gate/smoke bozulamaz; `pnpm smoke:route-gate` zorunlu |

## Dalgalar (akış bazlı — tek yürütme planı)

**Kaynak:** `docs/project-governance/ENTERPRISE_DALGA_PLANI.md`  
Öncelik ekran değil — **kullanıcı akışı**.

| Dalga | Amaç | Durum |
|-------|------|--------|
| **1** | Form/seçim/kaydet/güncelle/yetki/erişim/sessiz hata/runtime + Route Gate | ✅ **KAPANDI (PASS)** · Feature Freeze |
| **2** | Dosya Detay, Operasyon, Gelen Kutusu, Planlayıcı, Acil, Eksper Portalı | 🔒 Hazırlık notu var — **uygulama yok** (yeni görev + kapsam onayı bekleniyor) |
| **3** | CRM, Finans, Ayarlar, Raporlar, Bildirimler, destek | 🔒 |
| **4** | Dil/UX/ortak component/Feature Freeze/regresyon/smoke/E2E | 🔒 |

Eski F0–F5 etiketleri arşivdir; yürütme yalnızca **Dalga 1–4**.

Her dalga sonu: Typecheck · Build · Lint · Smoke (`smoke-route-gate` dahil) · kullanıcı kabulü · **Mustafa onayı**.

## Hata sınıfları (tekrar etmesin diye)

1. **Ölü UI** — buton varmış gibi; API alanı yok sayıyor / no-op  
2. **Case / ID uyumsuzluğu** — `hasar` vs `HASAR`; yanlış etiket  
3. **Yasak teknoloji dili** — Google / API / Hafıza / Akıllı… kullanıcıya  
4. **Dil tutarsızlığı** — Dashboard (EN), Asistans/Asistan, Kara/Kara Liste  
5. **Bağımlı alan race** — ilçe listesi boşken tüm-il no-op  
6. **Sessiz catch** — `console.error` only; kullanıcıya toast yok  
7. **WIP sızıntısı** — uncommitted kodun rsync ile canlıya kaçması  
8. **Route Gate deliği** — `/panel` catch-all / portal bypass (Dalga 1’de kapatıldı — freeze)

## Feature Freeze

Kaynak: `docs/project-governance/ENTERPRISE_FEATURE_FREEZE.md`  
Kabuk: `DASHBOARD_RC1_FREEZE.md` + `canli-kabul/ONAYLI_UI_CHECKLIST.md`  
**Dalga 1 akış freeze:** D1-FORM … D1-HTTP — regresyon yok.

## Erteleme notu (Dalga 1 kapanışında)

| Madde | Durum |
|-------|--------|
| Çıkış sonrası eski URL (smoke PARTIAL) | Login modülü dalgasında ele alınacak · **Dalga 1 tekrar açılmaz** |

## Teslim

Her dalga sonunda güncel rapor.  
Genel sonuç yalnız: 🟢 READY · 🟡 READY WITH WARNINGS · 🔴 NOT READY

## Anlık genel sonuç

**🔴 NOT READY**

- Dalga 1: ✅ KAPANDI (PASS) + Feature Freeze AKTİF (2026-07-23)  
- Dalga 2: 🔒 Uygulama yok — Mustafa yeni görev / kapsam onayı bekleniyor  
- Push / deploy: yok  

*Son güncelleme: 2026-07-23 — Dalga 1 kapanış + Feature Freeze*

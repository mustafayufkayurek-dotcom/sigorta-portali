# Enterprise Stabilizasyon — Akış Bazlı Dalga Planı

**Onay:** Mustafa — 2026-07-22 (WARNING risk analizi onaylandı; öncelik ekran değil **kullanıcı akışı**)  
**Kural:** Push yok · Deploy yok · Canlıya alma yok  
**Geçiş:** Hiçbir dalga tamamlanmadan sonraki dalgaya geçilmez  
**Her dalga sonu zorunlu:** Typecheck · Build · Değişen dosyalarda Lint · Smoke · **Kullanıcı kabulü + onay**

Kaynak risk analizi: `ENTERPRISE_WARNING_RISK_ANALIZI.md`  
Program: `ENTERPRISE_STABILIZASYON_PROGRAMI.md`

---

## DALGA 1 — Kritik kullanıcı akışı (sistem geneli)

**Amaç:** Kullanıcı hiçbir ekranda veri girememe, seçim yapamama veya kayıt oluşturamama sorunuyla karşılaşmayacak.

| Madde | Kapsam |
|-------|--------|
| Form ve seçim alanları | Input, TextArea, Select, AsyncSelect, Combobox, Multi, Checkbox, Radio, Switch, Date/Time, Upload, Drawer/Modal/Popup form, dinamik satırlar — sistem geneli |
| Tedarikçi seçimi | Liste açılır / API / arama / ID kaydı / düzenlemede geri yükleme / yetki filtresi |
| İl / İlçe | Bağımlılık, race, il değişince ilçe sıfırlama, tüm ilçeler / boş liste no-op |
| Hasar Konusu | Liste, kayıt, düzenleme, yetki |
| Kaydetme | Create, başarı/hata görünür, duplicate, partial update, loading |
| Güncelleme | Edit yükleme, kaydet, veri kaybı yok |
| Yetki | Görünürlük + kayıt yetkisi doğru |
| Sayfaya erişim | Route, refresh, deep link, white screen, yetkili erişim |
| Sessiz hata | `console.error` / boş catch → kullanıcıya toast veya net empty/error |
| Runtime hataları | Boundary / kırık navigasyon / null data |

**Çıkış kriteri (Dalga 1):** Yukarıdaki akışlar için kritik FAIL yok + kapı kontrolleri PASS + Mustafa onayı.

**Durum:** ✅ **PASS — KAPANDI** (Mustafa kapanış onayı: 2026-07-23)  
**Feature Freeze:** AKTİF — `ENTERPRISE_FEATURE_FREEZE.md` (D1-* kodları)  
**Kapanış raporu:** `ENTERPRISE_DALGA1_KAPANIS.md`  
**Kalıcı smoke:** `scripts/smoke-route-gate.sh` · `pnpm smoke:route-gate`  
**Not:** «Çıkış sonrası eski URL» PARTIAL → Login dalgası; Dalga 1 yeniden açılmaz.

---

## DALGA 2 — İş akışı güvenliği

**Amaç:** İş akışlarının eksiksiz ve güvenli çalışması.

| Madde |
|-------|
| Dosya Detay (hasar + acil) |
| Operasyon Merkezi |
| Gelen Kutusu (T1–T7 dahil) |
| Hasar Operasyon Planlayıcısı |
| Acil Yardım |
| Eksper Portalı |

**Önkoşul:** Dalga 1 tamam + onay ✅  
**Durum:** 🔒 Kilitli — **uygulama yok**  
**Hazırlık:** `ENTERPRISE_DALGA2_HAZIRLIK.md` (kapsam taslağı)  
**Başlatma kuralı:** Mustafa yeni görev + kapsam onayı vermeden kod değişikliği yapılmaz.  
**Regresyon:** Her Dalga 2 işi sonunda `pnpm smoke:route-gate` PASS (Dalga 1 freeze).

---

## DALGA 3 — Destek modülleri / fonksiyonel bütünlük

**Amaç:** Fonksiyonel bütünlük ve kullanıcı deneyimi.

| Madde |
|-------|
| CRM |
| Finans |
| Ayarlar |
| Raporlar |
| Bildirimler |
| Diğer destek modülleri |

**Önkoşul:** Dalga 2 tamam + onay.  
**Durum:** 🔒 Kilitli

---

## DALGA 4 — Enterprise kalite ve koruma

**Amaç:** Kurumsal standart, freeze ve regresyon kapısı.

| Madde |
|-------|
| Dil tutarlılığı |
| UX tutarlılığı |
| Ortak component standartları |
| Feature Freeze (birlikte karar) |
| Regresyon testleri |
| Smoke testleri (genişletme) |
| E2E kontrolleri |

**Önkoşul:** Dalga 3 tamam + onay.  
**Durum:** 🔒 Kilitli

---

## Her dalga sonu teslim paketi

1. Yapılanlar / düzeltilenler  
2. Bilinçli ertelenenler  
3. Typecheck sonucu  
4. Build sonucu  
5. Lint (değişen dosyalar)  
6. Smoke sonucu  
7. Kullanıcı kabul adımları  
8. Dalga sonucu: PASS / PASS WITH WARNINGS / FAIL  
9. **Mustafa onayı beklenir** → sonraki dalga

---

## Genel program

**🔴 NOT READY** — Dalga 1 henüz uygulanmadı.

*Son güncelleme: 2026-07-22 — Akış bazlı dalga planı*

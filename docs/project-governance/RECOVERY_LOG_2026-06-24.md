# Kurtarma Günlüğü — 2026-06-24

## Yapılan iş

**Navigasyon regresyonu geri alındı** (Codex kanıt paketi: `NAVIGASYON_TEK_SAHIPLIK_UYGULAMA_01`)

Kaynak sürüm: `d278h-minio-release-scope/apps/web/src/app/panel/layout.tsx`  
Hedef: `d266-release-scope/apps/web/src/app/panel/layout.tsx`

### Geri kazanılan yapı

- **Sol menü** — Dashboard, Operasyon, Personel, Sahiplik, Müşteriler, Tedarikçiler, CRM, Finans, Harita, Ayarlar
- **Üst bant** — yalnızca Logo, Arama, Bildirimler, Profil, mobil hamburger (modül linkleri kaldırıldı)
- **Ayarlar alt menüsü** — sol sidebar içinde gruplu: Kullanıcı ve Yetki, Kurumsal Ayarlar, Zorunlu Tanımlar, Operasyon Tanımları, Finans ve Fiyatlandırma, Yönetim ve Denetim
- **Ayarlar girişi** — `/panel/kullanicilar` (eski monolit `tanimlar` devre dışı, 2026-06-24 düzeltmesi)

### Adım 2 — Yönetim Merkezi hub kaldırıldı (2026-06-24)

- `/panel/ayarlar` → `/panel/kullanicilar` yönlendirmesi
- `/panel/ayarlar/tanimlar` → `/panel/ayarlar/departmanlar` (emoji sekme bandı kaldırıldı)
- Sol menü Ayarlar linki Kullanıcılar sayfasına gider; ayar alt menüsü tüm ayar rotalarında görünür
- Kartlı "Yönetim Merkezi" ara sayfası devre dışı
- SettingsPageLayout varsayılan "← Geri → hub" linki kaldırıldı

### Adım 3 — Sol menü daralt/genişlet (MENU_R1, 2026-06-24)

- Sidebar 286px ↔ 74px; tercih `localStorage` (`panel-sidebar-collapsed`)
- Dar modda ayar alt grupları gizlenir

### Doğrulama

- `pnpm --filter @sigorta/web typecheck` → PASS

### Adım 4 — Kullanıcılar profesyonel davet akışı (Projects + pratik modal, 2026-06-24)

- Kaynak: `Projects/sigorta-hasar-sistemi/.../kullanicilar/page.tsx`
- Modal akışı: **Adım 1** Bu kişi kim? (açılır liste) → göreve göre alt sorular → **Adım 2** kişi bilgileri
- Liste: arama, görev filtresi, aktif/pasif, geçici şifre, arşivleme

Bu değişiklik **henüz canlıya deploy edilmedi**. Canlı site eski üst menüyü göstermeye devam eder ta ki deploy yapılana kadar.

### Adım 5 — Yerel önbellek / eski bundle teşhisi (2026-06-25 gece)

**Belirti:** Mustafa yerelde hâlâ “Yeni Kullanıcı” + manuel şifre görüyor.

**Kök neden:**
- `kullanicilar/page.tsx` değişiklikleri **commit edilmemiş** (git HEAD = 963 satır eski UI)
- Dev sunucusu derleme hataları sonrası **eski `.next` bundle** servis etmiş olabilir

**Gece aksiyonu:**
- `rm -rf apps/web/.next` + `pnpm --filter @sigorta/web dev` (port 3001)
- Sabah doğrulama: buton metni **“Kullanıcı Davet Et”**, modal **Adım 1/2**

**Sabah raporu:** `docs/project-governance/MUSTAFA_SABAH_RAPORU_2026-06-25.md`

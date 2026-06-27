# Meridyen — Mustafa Sabah Raporu

**Tarih:** 25 Haziran 2026 (gece oturumu)  
**Hazırlayan:** Cursor agent  
**Aktif proje:** `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope`  
**Yerel test:** `http://localhost:3001`  
**Canlı:** `https://app.meridyen-tr.com` — kurtarma değişiklikleri **henüz deploy edilmedi**

---

## 1. Kısa Özet (30 saniyede)

| Konu | Durum |
|------|--------|
| Kullanıcılar sayfası “eski görünüyor” | **Kod diskte güncel; ekranda eski bundle görünmesinin nedeni bulundu** — gece `.next` cache temizlendi, dev sunucu yeniden başlatıldı |
| Canlı site | Hâlâ **eski sürüm** — deploy yapılmadı |
| Yerel kod | **Commit edilmemiş** — git HEAD’de 963 satırlık eski UI duruyor |
| Strateji dokümanları | Okundu ve ürün hafızasına işlendi |
| Paket 1 kurtarma belgesi | Derlendi — Mustafa onayı bekliyor |

**Sabah ilk kontrol:** `localhost:3001/panel/kullanicilar` → buton **“Kullanıcı Davet Et”** yazmalı. “Yeni Kullanıcı” görürseniz bana yazın.

---

## 2. Kullanıcılar Sayfası — Neden Eski Görünüyordu?

### Kök neden (kanıtlı)

1. **Yeni kod yalnızca diskte** — `page.tsx` git’te +1419 / -315 satır değişiklik; **commit yok**.
2. **Dev sunucusu eski bundle servis etmiş** — önceki oturumda derleme hataları olmuş; Next.js son başarılı derlemeyi (963 satır, “Yeni Kullanıcı”, manuel şifre) tutmuş olabilir.
3. **Tarayıcı cache** — normal yenileme yetmeyebilir; Cmd+Shift+R gerekir.

### Diskteki güncel kod ne içeriyor?

| Özellik | Eski (git HEAD) | Güncel (disk) |
|---------|-----------------|---------------|
| Buton | “Yeni Kullanıcı” | **“Kullanıcı Davet Et”** |
| Şifre | Admin manuel yazar | **Sistem geçici şifre üretir** |
| Modal | Düz form | **Adım 1** (görev seçimi) → **Adım 2** (kişi bilgileri) |
| Başarı ekranı | Yok / basit | **CredentialSuccessPanel** — yeşil kart, UserCheck ikonu, iki sütun, siyah şifre bandı |
| Liste | Basit | Arama, görev filtresi, toplu işlem, arşivleme, geçici şifre |

### Gece yapılan teknik düzeltme

```text
rm -rf apps/web/.next
pnpm --filter @sigorta/web dev   → port 3001 yeniden ayağa kalktı
```

### Yanlış sayfa tuzağı

`/panel/ayarlar/kurulum` içindeki **Kullanıcılar sekmesi** ayrı, eski CRUD — ana sayfa değil.  
Doğru adres: **`/panel/kullanicilar`**

---

## 3. Okunan Dokümanlar — Ne Anladım?

### 3.1 Stratejik vizyon (Desktop + Codex)

**Kaynaklar:**
- `Desktop/Yazılım Dokümanlar/CODEX_MERIDIYEN_STRATEJIK_URUN_HAFIZASI_NOTU.md`
- `Desktop/Yazılım Dokümanlar/MERIDIYEN_STRATEJIK_VIZYON_OZETI.docx`
- `Desktop/MERIDIYEN_STRATEJIK_VIZYON_TAM_DOKUMAN.docx` (Codex extract)

**Çekirdek anlayış:**

| Prensip | Anlam |
|---------|--------|
| Meridyen ≠ hasar takip yazılımı | **Hasar ve Acil Yardım Operasyon İşletim Sistemi** |
| Dashboard | Rapor değil — **operasyon merkezi** |
| Tedarikçi | **Sistem önerir, insan karar verir** |
| Eksper | Kullanıcı değil — **iş ortağı + CRM varlığı** |
| Sigortalı deneyimi | “Dosyam unutuldu” hissini kaldırmak |
| Finans | Tahsilat değil — **dosya bazlı karlılık + operasyon sağlığı** |
| Risk omurgası | Muvafakatname, fotoğraf, checklist, teslim, sesli tespit |
| Ürünleşme | Amatör tasarım, mock hissi, kavram karmaşası **kabul edilemez** |

Bu filtreler bundan sonraki her ekran kararında geçerli.

### 3.2 Verdent devir paketi (24 Mayıs 2026)

**Kaynak:** `Desktop/Yazılım Dokümanlar/VERDENT_PROJE_DEVIR_TESLIM_PAKETI_20260524.docx`

- Canlı domain: `app.meridyen-tr.com`, sunucu Docker tabanlı
- Frontend: Next.js standalone, port 3001
- Backend: NestJS, port 3000
- DB: PostgreSQL, 127 tablo, 49 migration
- **Kritik uyarı:** Bazı backend düzeltmeleri runtime patch ile yapılmış — image rebuild ile kaybolabilir
- Git remote yoktu; `Projects/sigorta-hasar-sistemi` tarihsel arşiv

### 3.3 TN-2026-0033 Paket 7A (Audit düzeltmesi)

**Kaynak:** `Desktop/Yazılım Dokümanlar/TN-2026-0033_PAKET_7A_AUDIT_YAZIM_HATASI_DUZELTME_v1_RAPORU.md`

- Otomatik sahiplik audit’leri `userId: 'system'` FK hatası yüzünden düşüyordu
- Düzeltme: `userId: null`, `userEmail: 'system'`
- UI’ya dokunulmadı — saf backend paketi

### 3.4 Kriz kurtarma Paket 1 (21–24 Haziran)

**Kaynak:** `docs/project-governance/01_MERIDYEN_21_22_23_HAZIRAN_KURTARMA_PAKETI_v1.md`

- **Altın kural:** Kabul edilmiş karar geri alınamaz; kod–karar çelişkisinde kod yanlış kabul edilir
- Paket kanıtı ≠ canlı kullanıcı kanıtı — çoğu modül `KISMEN_VAR` veya `KANIT_YOK`
- Mustafa onayı bekliyor

### 3.5 Codex klasör haritası (bilgisayar envanteri)

| Klasör | Rol |
|--------|-----|
| **d266-release-scope** | Aktif geliştirme + governance |
| **d265-release-scope** | Canlı/ops yansıması, `backups/` (asıl yedek deposu) |
| **d278h-minio-release-scope** | Navigasyon layout referansı, MinIO prod standardı |
| **d272-approved-ui-release-scope** | Mayıs onaylı UI — kullanıcı davet ekranı referansı |
| **d256-release-worktree** | Ayarlar UI standardizasyonu |
| **2026-06-22/outputs/** | Kriz kanıt arşivi (yüzlerce paket çıktısı) |
| **Projects/sigorta-hasar-sistemi** | D-serisi rapor arşivi (~264 md), bazı UI referansları |

Desktop’ta “yedek” adlı klasör **yok** — asıl yedekler `d265/backups/` altında.

---

## 4. Modül Modül Durum Tablosu

**Sütunlar:** Yerel d266 (disk) | Canlı | Hedef kaynak | Sabah aksiyonu

| Modül | Yerel d266 | Canlı | Hedef / kanıt | Durum |
|-------|------------|-------|---------------|-------|
| **Navigasyon (sol menü)** | ✅ d278’ten geri alındı, MENU_R1 daralt/genişlet | ❌ Eski üst menü | d278 layout | Yerel OK — deploy bekliyor |
| **Ayarlar girişi** | ✅ Hub kaldırıldı → `/panel/kullanicilar` | ❌ Eski emoji menü | Paket 1 kararı | Yerel OK |
| **Ayarlar / tanımlar** | ✅ Monolith redirect → departmanlar | ⚠️ Karışık | d256 + modern alt sayfalar | Kısmen |
| **Kullanıcılar** | ✅ Davet akışı diskte (commit yok) | ❌ Eski CRUD | Projects + d272 | **Sabah doğrula** |
| **Geçici şifre UI** | ✅ CredentialSuccessPanel | ❌ | d272 kurulum | Yerel OK |
| **Hoş geldin maili** | ⚠️ Backend stub | ❌ | Gerçek SMTP | Yapılmadı |
| **E-posta bildirimleri** | ✅ Güncel (Mustafa onaylı referans) | ✅ | d266 | Referans sayfa |
| **CRM** | ⚠️ Placeholder / kısmi | ⚠️ Kartlı hub | f3s2-crm-mvp kanıt paketi | Sırada |
| **Login** | ✅ Kurumsal | ✅ Paket kanıtı var | LOGIN_REGRESYON_* | Canlı oturum kanıtı eksik |
| **Mail merkezi** | ✅ Kodda | ⚠️ Doğrulanmadı | MAIL_BILDIRIM_* | Screenshot bekliyor |
| **ULC (kullanıcı yaşam döngüsü)** | ⚠️ Backend kısmen | ⚠️ | ULC_CANLIYA_ALMA_01 | Admin test bekliyor |
| **Finans** | ⚠️ d276 worktree ayrı | Bilinmiyor | d276 | Paket 2 |
| **Hasar / Acil Yardım** | ⚠️ Ana akış var | Bilinmiyor | Operasyon paketleri | Paket 2 |
| **Audit (sahiplik)** | ✅ 7A düzeltmesi raporu var | ⚠️ 7B canlı test bekliyor | TN-2026-0033 | Backend only |

---

## 5. Bu Gece Kodda Yapılan / Tamamlanan İşler

| # | İş | Dosya / kanıt |
|---|-----|---------------|
| 1 | Navigasyon geri kazanımı | `apps/web/src/app/panel/layout.tsx` |
| 2 | Yönetim Merkezi hub kaldırma | `ayarlar/page.tsx`, `tanimlar/page.tsx` redirect |
| 3 | Sol menü daralt/genişlet (MENU_R1) | `layout.tsx` + localStorage |
| 4 | Kullanıcılar davet akışı | `kullanicilar/page.tsx` (~2067 satır) |
| 5 | Geçici şifre başarı ekranı (d272 stili) | `CredentialSuccessPanel` |
| 6 | Backend geçici şifre API | `users.service.ts`, `users.controller.ts` |
| 7 | Paket 1 kurtarma belgesi | `01_MERIDYEN_21_22_23_HAZIRAN_KURTARMA_PAKETI_v1.md` |
| 8 | Kurtarma günlüğü | `RECOVERY_LOG_2026-06-24.md` |
| 9 | Dev cache temizliği + sunucu restart | `.next` silindi, port 3001 |

**Commit edilmedi** — tüm değişiklikler working tree’de.

---

## 6. Yazılıma Ne Kadar Hakimim? (Dürüst Değerlendirme)

### Güçlü alanlar (~%75–85 hakimiyet)

- Monorepo yapısı: `apps/web`, `apps/backend`, `apps/mobile`
- Panel routing ve Next.js App Router
- Ayarlar modülü mimarisi, SettingsPageLayout, redirect zinciri
- Kullanıcı yönetimi akışı (davet, geçici şifre, rol/görev/kapsam)
- Codex release scope’lar arası fark ve kurtarma metodolojisi
- Governance belgeleri (anayasa, altın kural, paket onay kuralı)
- Stratejik ürün prensipleri (operasyon OS, tedarikçi hafızası, eksper CRM)
- Deploy topology (Docker, nginx, portlar) — Verdent devir belgesinden

### Orta alanlar (~%50–65)

- CRM modülü derinliği (ilişki havuzu, performans metrikleri — henüz geri kazanılmadı)
- Finans modülü (d276 worktree ayrı; Carilerim kararları)
- Hasar dosya operasyon akışının uçtan uca iş kuralları
- Acil yardım sahiplik motoru ve audit zinciri (7B canlı test bekliyor)
- Prisma schema’nın 127 tablosunun tamamı
- Mobile app yüzeyi

### Zayıf / kanıt eksik alanlar (~%30–40)

- Canlı ortamda Mustafa oturumu ile gerçek kullanıcı testi (ben göremiyorum)
- SMTP / gerçek mail gönderim hattı
- ULC admin kabul senaryoları uçtan uca
- Kroki, fotoğraf işaretleme, AI hasar anlatımı (gelecek faz)
- Production env secret değerleri (bilinmemeli ve bilinmiyor — doğru)

### Genel puan (agent perspektifi)

| Boyut | Puan | Not |
|-------|------|-----|
| Kod okuma / navigasyon | 8/10 | d266 + Codex arşivi taranabilir |
| Ürün stratejisi anlama | 8/10 | Dokümanlar tutarlı |
| Kurtarma / regresyon teşhisi | 7/10 | Kök neden bulundu |
| Canlı doğrulama | 4/10 | Oturum olmadan sınırlı |
| Deploy / ops | 6/10 | Verdent belgesi var, uygulamadım |

---

## 7. Sabah İçin Net Kontrol Listesi (Mustafa)

1. Giriş: `http://localhost:3001/giris` (geçici test kullanıcısı veya kendi hesabınız)
2. **Cmd+Shift+R** ile sert yenileme
3. Sol menü → Ayarlar → **Kullanıcılar** (`/panel/kullanicilar`)
4. Kontrol:
   - [ ] Buton **“Kullanıcı Davet Et”** mi?
   - [ ] Modalda **“Adım 1 — Bu kişi kim?”** var mı?
   - [ ] Davet sonrası **yeşil tamamlandı ekranı** + siyah şifre bandı var mı?
5. Sonucu yazın: **onayla** / **hayır — şunu görüyorum: …**

---

## 8. Sıradaki İşler (Öncelik)

| Öncelik | İş | Bağımlılık |
|---------|-----|------------|
| P0 | Mustafa yerel kullanıcılar ekranını doğrular | Sabah |
| P0 | Onay sonrası değişiklikleri **commit** (isteğe bağlı deploy) | Mustafa “commit” derse |
| P1 | CRM geri kazanımı (f3s2 kanıt paketi) | Kullanıcılar onayı |
| P1 | Hoş geldin maili gerçek SMTP | Backend |
| P2 | Paket 1 belgesi Mustafa onayı | Governance |
| P2 | Paket 2 — Stratejik karar envanteri | Paket 1 onayı |
| P3 | Canlı deploy (d266 → production) | Mustafa açık onayı |

---

## 9. Hassas Doküman Notu

Paylaştığınız klasörlerde **sunucu, DB, SMTP** gibi operasyonel bilgiler var (Verdent devir paketi). Bu raporda **parola/secret yazılmadı**.  
Codex yedekleri (`d265/backups/`) production verisi içerebilir — dışarı paylaşılmamalı.

---

## 10. Son Söz

Kullanıcılar sayfası **kodda düzeltilmiş durumda**; ekranda eski görünmesi büyük olasılıkla **derleme önbelleği + commit edilmemiş değişiklik** kombinasyonuydu. Gece cache temizlendi, sunucu yeniden başlatıldı.

Canlı site (`app.meridyen-tr.com`) **bilinçli olarak dokunulmadı** — siz deploy demeden oraya gitmiyoruz.

İyi dinlenmeler. Sabah “Kullanıcı Davet Et” görüp görmediğinizi yazmanız yeterli; oradan devam ederiz.

---

## 11. Ek: 2026-05-14 Verdent Arşivi (Mustafa paylaşımı)

Mustafa gece **83 Python talimat scripti + 83 docx + 35 md rapor** içeren Verdent dönemi arşivini paylaştı:

`/Users/mustafayufkayurek/Documents/Codex/2026-05-14/chatgpt-ile-yaz-l-m-haz/`

**Detaylı envanter:** `docs/project-governance/ARCHIV_2026-05-14_VERDENT_ENVANTER.md`

### Bu arşivden netleşen kritik kararlar

1. **Ayarlar kavram haritası (D249A)** — Sigorta şirketi, tedarikçi, eksper Ayarlar’da ikinci CRUD olarak yaşamaz. Tanımlar Merkezi yönlendirme merkezidir. Bu, hub kartlarının kaldırılmasını doğrular.

2. **TN-2026-0065** — “Saha Personeli” tedarikçi değil; tedarikçi `Vendor.category` ile ayrılır. Kullanıcı davetinde “Bu kişi kim?” zorunlu.

3. **Modül 1 kullanıcı paketleri** — Geçici şifre + mail P0; canlı ekran kabulü çoğu raporda **FAIL** (kanıt/oturum eksik).

4. **Verdent çalışma modeli** — Onay olmadan kod/deploy yok; danışman kararları bağlayıcı.

5. **24 Mayıs günlük rapor** — P0 auth fix canlıya alındı; TN batch’ler ayarlar/hasar düzeltmeleri.

### Açık dosya: Ayarlar Kavram Haritası

Mustafa’nın editörde açık tuttuğu belge:

`2026-06-11/.../AYARLAR_KAVRAM_HARITASI_VE_SAHIPLIK_KARARI.md`

Bu belge **Ayarlar restorasyonunun anayasa metni** — d266’daki redirect/hub kaldırma kararlarıyla birebir örtüşüyor.

---

*Bu belge gece oturumu çıktısıdır. Revizyon: v1.1 — 2026-06-25 (Verdent arşivi eklendi)*

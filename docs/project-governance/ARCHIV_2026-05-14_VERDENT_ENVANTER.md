# Codex Arşiv Envanteri — 2026-05-14 Verdent Dönemi

**Kaynak klasör:** `/Users/mustafayufkayurek/Documents/Codex/2026-05-14/chatgpt-ile-yaz-l-m-haz/`  
**Derleme:** 25 Haziran 2026 gece oturumu  
**Amaç:** Mustafa’nın paylaştığı Verdent/Codex yedek evraklarının okunabilir haritası

---

## 1. Klasör Özeti

| Tür | Adet (kök dizin) | Not |
|-----|------------------|-----|
| Python script (`build_*.py`, `create_*.py`) | ~83 | Word talimat dosyası üreten otomasyon |
| Word (`.docx`) | ~83 | Verdent’e gönderilen mühendis talimatları |
| Markdown rapor (`.md`) | ~35 | Analiz, kabul, audit raporları |
| SQL | 3 | Canlı test verisi temizliği |
| Alt klasörler | 10+ | `reports/`, `scripts/`, `SCREENSHOT_PACKAGE_20260530/`, render çıktıları |

**Toplam kök dosya:** ~209

Bu klasör **Mayıs 2026 Verdent mühendislik döneminin** tam arşividir: talimat üretimi, kabul kapıları (Kapı 1–4), blocker çözümleri, pilot bulguları.

---

## 2. Çalışma Modeli (Proje Hafızasından)

Kaynak: `PROJE_HAFIZA_VE_CALISMA_KURALLARI_20260517.md`

```text
Kullanıcı → doğal dil
Codex → mühendislik talimatı
Verdent → analiz + onay bekle → uygula
Codex → danışman denetimi
```

**Bağlayıcı kararlar (hâlâ geçerli):**
- Dosya numarası otomatik üretilmez — manuel, benzersiz
- Sigorta şirketi otomatik atanmaz
- Ürün yalnız sigorta yazılımı değil — modüler operasyon platformu
- Permission standardı: `entity.action` snake_case
- Ana varlıklarda hard delete yasak — soft-delete tercih

---

## 3. Kritik Ürün Kararları (Bu Arşivden)

### 3.1 Ayarlar Kavram Haritası (D249A)

Kaynak: `2026-06-11/.../AYARLAR_KAVRAM_HARITASI_VE_SAHIPLIK_KARARI.md` (Mustafa’nın açık dosyası)

| Kavram | Ayarlar’da yaşar mı? | Doğru yer |
|--------|----------------------|-----------|
| Sigorta şirketi | **Hayır** (ikinci CRUD) | Müşteri/Cari modülü |
| Tedarikçi | **Hayır** | Tedarikçi Yönetimi |
| Eksper | **Hayır** | Eksper CRM / Portal |
| CRM kayıtları | **Hayır** | Kendi modülleri |
| Tanımlar Merkezi | Yönlendirme merkezi | CRUD değil |

**UX standardı:** Başlık + açıklama + `Yeni ...` + arama + tablo + modal düzenle + otomatik kod.

Bu karar, “Yönetim Merkezi hub” ve emoji-sekme monolith’in kaldırılmasını doğrular.

### 3.2 Kullanıcı ve Tedarikçi Rol Modeli (TN-2026-0065)

Kaynak: `TN-2026-0065_KULLANICI_VE_TEDARIKCI_ROL_MODELI_ANALIZI_v1_RAPORU.md`

| Kavram | Doğru model |
|--------|-------------|
| Saha Personeli (`field_staff`) | Meridyen **iç** saha personeli — tedarikçi değil |
| Hasar/Acil tedarikçi | `Vendor.category`: hasar / acil / her_ikisi |
| Kullanıcı davet akışı | “Bu kişi kim?” karar ağacı gerekli |
| Tedarikçiye login | Bugün yok — `User.vendorId` ilişkisi yok |

**Önerilen görev etiketleri:**
- `office_staff` → Meridyen Dosya Sorumlusu
- `field_staff` → Meridyen Saha Personeli
- `insurance_company_user` → Sigorta Şirketi Kullanıcısı
- `adjuster` (Eksper İç) → **KALDIR** önerildi (0 kullanıcı)

### 3.3 Kullanıcı Davet / Geçici Şifre (Modül 1)

Kaynak: `MODUL_1_TALIMATLAR_UYGULANABILIRLIK_TRIYAJ_RAPORU.md`, Paket B/C raporları

- Geçici şifre + hoş geldin maili **P0 güvenlik** kapsamında ayrı paket
- Sigorta şirketi kullanıcısı: tek şirket scope — canlı deploy yapıldı ama **ürün sahibi ekran kabulü eksik (FAIL)**
- Hedef route: `/panel/kullanicilar` (kurulum sekmesi değil)
- TN-0065 Paket 5B/5C: canlı görsel kabul **FAIL** — oturum/kanıt eksik

### 3.4 Operasyon Ekranları Denetimi

Kaynak: `KULLANICI_VE_OPERASYON_EKRANLARI_DENETIMI_v1.md`

| Ekran | Pilot | Not |
|-------|-------|-----|
| Personel | PASS | Sekme yoğun — sadeleştirme P2 |
| Sahiplik | REVİZYON | “İzleme paneli” olduğu net yazılmalı |
| Müşteriler | PASS | CRM güçlü, yoğun |
| Tedarikçi | PASS | Hafıza/risk görünürlüğü artırılmalı |

---

## 4. Talimat Script Kategorileri (build_*.py)

Python scriptler Word talimat dosyası üretir. Gruplar:

| Grup | Örnek dosyalar | Konu |
|------|----------------|------|
| **Verdent günlük** | `build_bugun_verdent_muhendis_talimati.py` | Günlük mühendis talimatı |
| **Kapı 1 (release)** | `create_kapi1_*`, `build_verdent_kapi1_*` | Production deploy, smoke, DNS, healthcheck |
| **Kapı 2 (kullanım)** | `create_kapi2_*` | P0/P1 fix onayı, kullanım testi |
| **Kapı 3 (notlar)** | `create_kapi3_*` | Kullanıcı notları, kapanış |
| **Kapı 4 (telegram/env)** | `create_kapi4_*` | Telegram alarm, env güvenli giriş |
| **Blocker 18 Mayıs** | `build_verdent_blocker_*_20260518.py` | Build/test blocker çözümü |
| **Faz 1 onay** | `build_verdent_faz1_*` | Revizyon, kanıt, test diff |
| **Devir/teslim** | `build_verdent_proje_devir_talebi.py`, `create_verdent_devir_gecis_talimati.py` | Proje devri |
| **Ürün olgunluk** | `build_urun_olgunluk_*`, `build_urun_vizyonu_kavram_modeli.py` | Vizyon/kavram modeli |
| **Danışman** | `build_danisman_karari_verdent.py`, `build_p1_danisman_kararlari.py` | Codex danışman kararları |
| **Snapshot** | `build_kod_snapshot_*`, `build_production_snapshot_*` | Kod/production snapshot talebi |

**Not:** Script çalıştırmak yeni talimat üretir — arşiv amaçlı okunmalı, rastgele çalıştırılmamalı.

---

## 5. Önemli Markdown Raporları (Öncelik Sırası)

| # | Dosya | Konu |
|---|-------|------|
| 1 | `PROJE_HAFIZA_VE_CALISMA_KURALLARI_20260517.md` | Ana hafıza — 2300+ satır |
| 2 | `TN-2026-0065_KULLANICI_VE_TEDARIKCI_ROL_MODELI_ANALIZI_v1_RAPORU.md` | Kullanıcı/tedarikçi ayrımı |
| 3 | `TN-2026-0065_KULLANICI_VE_TEDARIKCI_TERMINOLOJI_RESTORASYONU_v1_RAPORU.md` | Terminoloji düzeltmesi |
| 4 | `MODUL_1_PAKET_B_CANLIYA_ALMA_VE_EKRAN_KABUL_v1_RAPORU.md` | Kullanıcılar canlı kabul |
| 5 | `MODUL_1_PAKET_C_ROLLER_EKRANI_URUN_SONUCU_v1_RAPORU.md` | Roller ekranı — BLOKE |
| 6 | `KULLANICI_VE_OPERASYON_EKRANLARI_DENETIMI_v1.md` | Personel/sahiplik/müşteri/tedarikçi |
| 7 | `GUNLUK_RAPOR_20260524.md` | 24 Mayıs deploy özeti (P0 auth, TN batch) |
| 8 | `IC_PILOT_01_*` serisi | Pilot bulgular, test verisi temizliği |
| 9 | `RISK_VE_ISPAT_ZINCIRI_TEKNIK_TASARIM_v1.md` | Risk/is pat omurgası |
| 10 | `TEDARIKCI_HAFIZA_VE_MALIYET_HAFIZASI_TEKNIK_TASARIM_v1.md` | Tedarikçi hafızası |
| 11 | `SESLI_TESPIT_VE_BULGU_MOTORU_TEKNIK_TASARIM_v1.md` | Sesli tespit |
| 12 | `MERIDYEN_MARKA_KIMLIGI_VE_ONBOARDING_REVIZYONU_v1_RAPORU.md` | Hoş geldin maili marka |

---

## 6. Bu Arşiv ile d266 Kurtarmanın Bağlantısı

| Verdent dönemi kararı | d266 kurtarma durumu |
|-----------------------|----------------------|
| Kullanıcı davet + geçici şifre | Diskte uygulandı — commit/deploy yok |
| “Bu kişi kim?” karar ağacı | Adım 1/2 modal — TN-0065 ile uyumlu |
| Ayarlar ≠ CRM | Hub kaldırıldı, D249A ile uyumlu |
| `/panel/kullanicilar` ana route | Aktif — kurulum sekmesi eski |
| Canlı ekran kabulü | Hâlâ eksik — Paket 5B/5C FAIL |
| Terminoloji (Meridyen Saha Personeli) | Kısmen — görev dropdown’da kontrol edilmeli |
| Hoş geldin maili kurumsal | Backend stub — gerçek SMTP yok |

---

## 7. Hassas İçerik Uyarısı

Bu arşivde ve bağlantılı docx’lerde:
- Sunucu IP, deploy prosedürleri
- SQL temizlik scriptleri (`cleanup_live_test_data_*.sql`)
- Production env referansları

**Secret değerler bu envanterde yazılmaz.** Dış paylaşımda dikkat.

---

## 8. Kapı Sistemi — Kronolojik Özet (Mustafa paylaşımı #2)

Verdent döneminde release **4 kapılı** süreç yönetilmiştir:

| Kapı | Tarih | Sonuç | İçerik |
|------|-------|-------|--------|
| **Kapı 1** | 18–20 May | ✅ KAPANDI | Production deploy, smoke 8/8 PASS, healthcheck Docker inspect |
| **Kapı 2** | 20 May | ⚠️ Koşullu kapandı | P0-2/3, P1-1/3 PASS — P0-5 ürün kararı ayrıldı |
| **Kapı 3** | 20–21 May | ✅ KAPANDI | Kullanıcı notları envanteri, test öncesi kapanış |
| **Kapı 4** | 20–21 May | ✅ KAPANDI | Telegram alarm zinciri kuruldu |

### Kapı 1 — Production Release (18–20 Mayıs)

**Dosyalar:** `VERDENT_KAPI1_*` serisi (~15 docx)

- Build/test blocker çözümü, local patch, package.json kapsam revizyonu
- DNS, healthcheck yöntemi, smoke fail kök neden
- Senaryo 4 (payload) ve Senaryo 7 (password) final denemeleri
- **Kapanış:** `VERDENT_KAPI1_KAPANIS_KABUL_VE_SIRADAKI_KAPILAR_20260520.docx` — smoke 8/8 PASS

**Kalite notu:** Tekrar eden smoke protokol hataları Verdent teslim kalitesi sorunu olarak kayda alındı.

### Kapı 2 — Kullanımsal Revizyon (20 Mayıs)

**Dosyalar:** `VERDENT_KAPI2_*` serisi (~8 docx)

| Madde | Sonuç | Konu |
|-------|-------|------|
| P0-2 | PASS | Kullanıcı oluşturma validasyon |
| P0-3 | PASS | Yeni hasar dosyası submit |
| P0-5 | FAIL → ürün kararı | Gerçek ihbar CRUD yok — bug değil, kapsam boşluğu |
| P1-1 | PASS | Evrak türleri UI/API |
| P1-3 | PASS | Form feedback |

Kaynak: `VERDENT_KAPI2_FINAL_DEGERLENDIRME_VE_P05_URUN_KARAR_TALIMATI_20260520.docx`

### Kapı 3 — Test Öncesi Kapanış (20–21 Mayıs)

**Dosyalar:** `VERDENT_KAPI3_*`, `VERDENT_TEST_ONCESI_*`

- Kullanıcı notları envanter ve aksiyon
- Kullanımsal revizyon kontrol
- Final kapanış paketi

### Kapı 4 — Telegram (20–21 Mayıs)

**Dosyalar:** `VERDENT_KAPI4_*`, `VERDENT_TELEGRAM_*` (~12 docx)

- Env güvenli giriş, blocker çözüm, hedefli kurulum
- **Kapanış:** dry-run PASS, tek test mesajı SENT — Kapı 4 kapatıldı
- Not: `offsite-backup.sh` placeholder — operasyonel risk notu

---

## 9. Devir ve Codex Geçişi (24 Mayıs)

| Dosya | İçerik |
|-------|--------|
| `VERDENT_PROJE_DEVIR_VE_DOGRUDAN_CODEX_YONETIMINE_GECIS_TALIMATI_20260524.docx` | **Bağlayıcı:** Verdent yeni geliştirme yapmayacak; ~1070 kredi yalnız devir için |
| `VERDENT_PROJE_YONETIM_TASIMA_VE_DEVIR_TALIMATI_20260520.docx` | Proje yönetimi taşıma |
| `Verdent_Eksik_Devir_Materyalleri_Talebi_20260515.docx` | lock.yaml, migration seviyesi, smoke çıktısı |
| `Verdent_Eksik_Backend_Modul_Dosyalari_Talebi_20260515.docx` | Eksik cache/ uploads modülleri |
| `Verdent_Kod_Snapshot_Talebi.docx` / `V2` | Kod snapshot bütünlüğü |

**Devir paketi kalemleri:** repo durumu, production kaynak eşleşmesi, deploy akışı, DB/migration, env envanteri (secret'sız).

---

## 10. P0 Kritik Hatalar (24 Mayıs)

### Login/Auth P0

| Dosya | Karar |
|-------|-------|
| `VERDENT_P0_LOGIN_AUTH_CEVAP_TALIMATI_20260524.md` | API 201 ≠ PASS — canlı browser kanıtı şart |
| `VERDENT_P0_LOGIN_AUTH_DONGUSU_KALICI_COZUM_TALIMATI_20260524.docx` | Kalıcı çözüm talimatı |
| `VERDENT_P0_LOGIN_BROWSER_OTOMASYON_TALIMATI_20260524.md` | Browser otomasyonu ile kanıt; runtime patch yasak |

**Belirti:** Login → 1 sn Dashboard → tekrar giriş ekranı.

**Kabul:** `/panel`'de 10 sn stabil + refresh sonrası düşmeme.

### Hasar + Acil P0

Kaynak: `VERDENT_HASAR_ACIL_P0_KUSURLU_TESLIM_DUZELTME_VE_KREDI_TELAFI_TALIMATI_20260524.docx`

| Sorun | Durum |
|-------|-------|
| `/panel/acil-yardim` 500 | P0 blocker — cache bahanesi kabul edilmedi |
| Hasar formuna gereksiz Hasar No | Yanlış ürün davranışı — Dosya No yeterli |

---

## 11. Faz 1 ve Release Planı (18 Mayıs)

| Dosya | Konu |
|-------|------|
| `VERDENT_FAZ1_REVIZYON_TALIMATI_20260518.docx` | Production onayı yok — insurance-company-scopes 404, typecheck FAIL |
| `VERDENT_FAZ1_REVIZYON_SONRASI_KARAR_TALIMATI_20260518.docx` | Revizyon sonrası karar |
| `Verdent_Faz1_Onay_Oncesi_Test_ve_Diff_Ayristirma_Talimati_20260517.docx` | Diff ayrıştırma |
| `VERDENT_RELEASE_PLANI_*_20260518.docx` | Release planı revizyon/kabul |
| `VERDENT_FAIL_TEST_QUARANTINE_TALIMATI_20260518.docx` | Fail test karantina |
| `VERDENT_TEMIZ_PATCH_*_20260518.docx` | Temiz patch + typecheck |

---

## 12. Test Notları Serisi (21–24 Mayıs)

| Dosya | Konu |
|-------|------|
| `VERDENT_TEST_NOTLARI_1_*_20260521.docx` | P0 kabul, P1 mini paket, mühendislik düzeltme |
| `VERDENT_TEST_NOTLARI_DUZENLE_*_20260524.md` | Düzenle inline UX — sayfa başına atlama sorunu |
| `VERDENT_TEST_BASLANGIC_CANLI_KAPSAM_TEYIT_TALIMATI_20260521.docx` | Canlı test kapsam teyidi |

---

## 13. Süreç Yönetimi Belgesi (Bağlayıcı)

Kaynak: `YAZILIM_PROJESI_SUREC_YONETIMI_VE_TEDARIKCI_DEGERLENDIRME_TALIMATI_20260524.md`

**Altın PASS kuralı:**

> Kullanıcı canlı ekranda çalıştığını görmeden hiçbir iş tamamlanmış sayılmaz.

**Tek paket kuralı:** Kök neden + düzeltme + dosyalar + deploy + rollback + canlı kanıt + kabul kriteri — ara rapor yasak.

**Verdent sınırları:** Runtime patch yasak, dirty tree yasak, kusurlu teslim ek ücret yok.

**Codex rolü:** Teknik temsilci — sınıflandırma, denetim, doğrudan kod/deploy yönetimi.

**Karar (24 May):** Verdent geliştirmeden çıkarılır; Codex doğrudan yönetime geçiş.

---

## 14. Bu Batch'in d266 Kurtarmayla Bağlantısı

| Verdent dönemi olayı | d266'daki yansıma |
|----------------------|-------------------|
| Login P0 browser kanıtı | 22 Haz LOGIN_REGRESYON paketi — kısmen geri kazanıldı |
| Kullanıcı oluşturma P0-2 | Davet akışı diskte — canlı kabul hâlâ eksik |
| Kapı 1 production deploy | Canlı hâlâ karma regresyon (eski menü + yeni sayfalar) |
| Codex'e devir 24 May | d266 aktif worktree — Cursor agent yönetimi |
| PASS = canlı ekran | Paket 1'de KANIT_YOK sorunu — aynı prensip |
| P0-5 ihbar CRUD | Henüz ele alınmadı — backlog |
| Ayarlar placeholder | Hub kaldırıldı — D249A ile uyumlu |

---

*Revizyon: v1.8 — Strateji, devir paketleri, kanıt protokolü — Haziran 11 oturumu TAMAMLANDI (2026-06-25)*

---

## 21. Oturum Kapanış Belgeleri — Strateji, Devir, Kanıt Protokolü

Mustafa’nın son paylaşımı: **6 belge + Zoho referans görselleri**.

### 21.1 Stratejik vizyon (`MERIDIYEN_STRATEJIK_VIZYON_TAM_DOKUMAN_EXTRACT.txt`)

**Meridyen tanımı:**

```text
Hasar takip yazılımı DEĞİL → Hasar ve Acil Yardım Operasyon İşletim Sistemi
```

**Omurga kavramları:** Operasyon görünürlüğü, dosya sorumlusu, risk/ispat, tedarikçi hafızası, kurumsal hafıza, dosya bazlı karlılık.

**Gelecek fazlar:** Kroki, fotoğraf işaretleme, AI hasar anlatımı, operasyon radar.

**Başarı kriteri:** Güven, şeffaflık, kontrol, karlılık.

### 21.2 Zorunlu Canlı Kanıt Protokolü V1

**Paket kapanışı için üç katman:**

```text
Kod PASS + Canlı PASS + Mustafa PASS
```

**Yasak (tek başına yeterli değil):** Route 200, bundle izi, build PASS, healthy.

**Zorunlu tablo:** Local ekran → Canlı ekran → Aynı mı? → Mustafa kararı.

**Kapanış sırası:** Local onay → Canlı yayın → Canlı ekran kanıtı → Mustafa doğrulaması → KAPANDI.

**Zorunlu modüller:** Dashboard, CRM, Müşteriler, Tedarikçiler, Ayarlar, Haritalar, Kullanıcı Yönetimi.

**d266 kurtarma bağlantısı:** Diskteki değişiklikler Mustafa PASS almadan “tamamlandı” sayılamaz.

### 21.3 Zoho Settings görsel referans

**Kural:** Zoho kopyalanmaz — davranış referansı alınır.

**Taşınacak fikirler:**
- Ayarlar Merkezi → kategori kartları → tek sahip ekranlar
- Mail/SMS/Roller tek sahiplik
- Tanımlar = yönlendirme merkezi (CRUD merkezi değil)
- Liste ekranları: net başlık, kısa açıklama, arama, standart tablo

**d266 uyumu:** Hub kaldırma + D249A + D238 tek sahiplik = Zoho davranış hedefi.

### 21.4 Paket bazlı canlı kanıt (`PAKET_BAZLI_CANLI_KANIT_RAPORU` = D270)

Bundle seviyesi audit (15 Haziran, D267 image anında):

| Paket | Canlı bundle kanıtı |
|-------|---------------------|
| D258 | Müşteri/tedarikçi route + modal izleri |
| D262 | Backend permission + masked visibility |
| D266 | CRM route, Empty State, mock yok, finans temizliği |
| D267 | Doğru API URL, localhost yok |

**Uyarı:** Compose override D266 kayıtlı, runtime D267 — kayıt sapması.

**Not:** Bundle kanıtı ≠ Mustafa PASS (protokol V1).

### 21.5 Yeni sohbet devir paketi (2026-06-14)

**Çalışma modeli:**

```text
Local önizleme → Mustafa inceler → Canlıya alma → Canlı doğrulama
```

**Son canlı (14 Haz):** D252B CRM, D253 kurulum payload hotfix.

**Açık konu (Mustafa):** Ayarlar görsel/akış karmaşası — ekran göstererek anlatılacak; önce local revizyon.

**Anayasa maddeleri:** Mock canlıda yok; CRM ≠ Ayarlar; canlıya alma zinciri atlanmaz.

### 21.6 FAZ 2 resmi devir paketi (`MERIDYEN_FAZ2_DEVIR_PAKETI`)

**Roller:** Mustafa + ChatGPT (karar) → Codex (uygulama).

**D268 release standardı:** 1 paket → 1 scope → 1 image → 1 rapor; `build: null` + `--no-build`.

**FAZ 1:** TAMAMLANDI — stabilizasyon dönemi.

**Referans UI (D273/D275):** Onaylı UI bozulamaz — müşteri, tedarikçi, CRM, ayarlar.

**Açık Faz 2 paketleri:**

| Paket | Durum |
|-------|-------|
| D278I MinIO canlıya alma | D278H hazır, henüz deploy yok |
| D276 Finans/Carilerim | Local hazır, Mustafa bekliyor |
| CRM faz 2 | İzleme/backlog |

**Geçerli kararlar yeniden tartışılmaz:** D268, Mustafa PASS, birebir UI kanıtı, MinIO standardı, layout koruma.

---

## 22. Haziran 11 Oturumu — Tam Envanter Özeti

**Kapsam:** D62–D278 + master/FAZ1/strateji/devir belgeleri (~200+ rapor).

**Ana tema hatları:**

| Hat | Belge aralığı | Sonuç |
|-----|---------------|-------|
| Ürün mimarisi | D62–D66, D89–D133 | Spesifikasyon arşivi |
| Operasyon MVP’leri | D67–D88 | Hızlı erişim, hafıza, zeka, belge, mobil, ses |
| Go-live + auth | D144–D171 | Canlı veri, refresh token |
| Kullanıcı yönetimi | D172–D220, D263–D265D | Arşiv modeli canlıda |
| Ayarlar UX | D223–D255, D249A | Tek sahiplik, Zoho referans |
| CRM | D221–D223, D243E, D252–D266 | Empty State canlı; zengin UI local only |
| Müşteri/Tedarikçi | D257–D258 | D273 onaylı UI |
| Haritalar | D259–D262 | Maskeleme canlıda |
| Release/regresyon | D268, D271–D275, D251D | Kısmi deploy kök neden |
| MinIO/Finans | D276–D278 | Faz 2 açık |
| FAZ 1 kapanış | MASTER_13, FAZ_1 | Stabilizasyon |

**d266-release-scope kurtarma anayasası (tüm oturumdan):**

1. Onaylı UI kaynağı: `d272-approved-ui-release-scope` / `d273-approved-ui-v1`
2. CRM Empty State: `d266-release-scope` (4 dosya)
3. Sol menü d278: ayrı paket, Mustafa onayı gerekli
4. Kullanıcılar: D265 backend + D173/D217–D218 UI
5. Deploy: temiz scope, amd64, nginx DNS, Mustafa PASS
---

## 23. Haziran 14 Oturumu — Ayarlar Local Tasarım Devir (`senin-sohbet-alan-nda-san-r`)

Kaynak: `/Users/mustafayufkayurek/Documents/Codex/2026-06-14/senin-sohbet-alan-nda-san-r/outputs/`

### 23.1 Ayarlar local tasarım devir paketi (14 Haziran)

**Önemli:** Bu çalışma **ana Next.js projesi (d266) değil** — ayrı prototip:

```text
/Users/mustafayufkayurek/Documents/Codex/2026-05-29/bu-al-ma-mevcut-eski-proje/insurance-ops-platform-ui
Dosya: src/modules/settings/page.tsx
Local: http://localhost:5173/settings
```

**Canlı o an (salt okunur):** `d252b` web + `d253` backend — deploy yapılmadı.

**Yapılan local deneme:**
- Sol iç menü + sağ çalışma alanı
- Bölümler: Kurulum, Kullanıcılar/Roller, Tanımlar, Platform Tercihleri
- Alt bölümler (Genel Bilgiler, Logo, Davet akışı, Evrak türleri vb.)

**Mustafa geri bildirimi (kritik):**

İstenmeyen dil:
- "Ayarlar Merkezi"
- "Bilgi hiyerarşisi"
- "Ayar aileleri" / "aile" terminolojisi
- Fazla açıklayıcı manifesto blokları

**Hedef:** Gerçek ürün ekranı hissi — sade başlık **"Ayarlar"**, kısa durum satırı.

**Korunan sınırlar (D249A ile uyumlu):**
- Ayarlar ≠ CRM
- Tanımlar = yönlendirme, ikinci CRUD değil
- Canlıya alma yok — önce local Mustafa onayı

**Sonuç:** `LOCAL_TASARIM_DEVAM` + `SON_TUR_DIL_REVIZYONU_GEREKIYOR`

### 23.2 d266 kurtarma bağlantısı

| 14 Haz prototip | d266 disk (24–25 Haz) |
|-----------------|------------------------|
| "Ayarlar Merkezi" kaldır | Hub `/panel/ayarlar` → redirect ✅ |
| Sol iç menü fikri | d278 `layout.tsx` sol PanelSidebar ✅ |
| "Aile" dili yok | Settings UI sadeleştirme gerekli |
| Ayrı Vite projesi (5173) | Asıl ürün Next.js (3001) — **birleştirilmedi** |

**Risk:** Mustafa 14 Haz’da gördüğü sol menü **prototipte**; canlı/d266 farklı kod tabanı. Kurtarmada kaynak netleştirilmeli.

### 23.3 Genel devir paketi (`devir-paketi.md`)

- 14 Haz sohbet devir — aktif kod işi yok
- Türkçe, dar kapsam, önce oku sonra uygula
- Çalışma: `2026-06-14/senin-sohbet-alan-nda-san-r`

---

*Revizyon: v2.9 — d266-release-scope kök yönetişim ve disk durumu (2026-06-25)*

---

## 33. d266-release-scope — Aktif Proje Kökü ve Yönetişim

Kaynak: `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope`

### 33.1 Kök anayasa dosyaları (Mustafa 10/10 — 2026-06-24)

| Dosya | Rol | Durum |
|-------|-----|-------|
| `00_PROJE_ANAYASASI.md` | **En üst referans** — altın kural, kabul kriteri, paket sırası | ✅ Onaylı |
| `00_CALISMA_YASASI.md` | Ürün kararı > Kod; 4'lü kabul kriteri | ✅ Onaylı |
| `01_KRIZ_KURTARMA_PROTOKOLU.md` | Donmuş v1 — kriz kayıt standardı, etiketler, kanıt türleri | ✅ Onaylı |
| `02_STRATEJIK_KARAR_ENVANTERI.md` | Paket 2 placeholder — **henüz boş** | ⏳ Bekliyor |

**Kabul kriteri (dördü birlikte):** Kod + Canlı davranış + Screenshot + Mustafa onayı.  
**"Çalışıyor" tek başına yeterli değil.**

**Paket sırası:** Paket 1 (kriz) → Paket 2 (strateji) → Paket 3 (aktarım). Onaysız geçiş yok.

### 33.2 Kanonik yönetişim klasörü

`docs/project-governance/` — yeni oturum başlangıç noktası (`00_OKU_BENI.md`):

| # | Belge | Durum |
|---|-------|-------|
| 1–2 | Anayasa + Çalışma Yasası (kopya) | ✅ |
| 3 | `01_MERIDYEN_21_22_23_HAZIRAN_KURTARMA_PAKETI_v1.md` | ⏳ Mustafa onayı |
| 4 | `02_MERIDYEN_STRATEJIK_KARAR_ENVANTERI_v1.md` | Paket 1 sonrası |
| 5 | `03_MERIDYEN_CURSOR_CODEX_AKTARIM_PAKETI_v1.md` | Paket 2 sonrası |
| — | `ARCHIV_*` (Verdent + worktree envanter) | v2.9 güncel |
| — | `RECOVERY_LOG_2026-06-24.md` | Disk kurtarma adımları |
| — | `MUSTAFA_SABAH_RAPORU_2026-06-25.md` | Yerel doğrulama |

### 33.3 Proje kökeni vs kurtarma disk

**Orijinal D266 release scope (canlı image kökeni):** yalnız CRM empty + müşteri finans mock temizliği + layout CRM topbar.

**d266 disk bugün:** kriz kurtarma oturumunda genişletilmiş — commit edilmemiş:

| Alan | Git durumu | Kaynak |
|------|------------|--------|
| `layout.tsx` | Modified | d278 NAV-001 + MENU_R1 |
| `kullanicilar/page.tsx` | Modified | Projects + ULC davet |
| `ayarlar/page.tsx`, `tanimlar` | Modified | D249A hub kaldırma |
| `users.service/controller` | Modified | Geçici şifre backend |
| `crm/`, `eksper-crm/` | Untracked | CRM-002 hub |
| Kök anayasa 00–02 | Untracked | 24 Haz onay |
| `docs/project-governance/` | Untracked | Paket 1 + envanter |

**Git:** `HEAD (no branch)` — commit yok, deploy yok.

### 33.4 Paket 1 modül durumu özeti (kurtarma belgesi)

| Modül | Nihai durum |
|-------|-------------|
| Login | Kısmen — paket var, canlı screenshot eksik |
| Navigasyon | Kısmen — d266 diskte d278; canlı D273 çift menü |
| CRM | Kısmen — route var, UX kararı açık |
| Ayarlar | Kısmen — D249A diskte; D256 hub çelişkisi |
| ULC | Admin kabul bekliyor — backend canlı, UI diskte |
| Kullanıcı/Yetki | Doğrulama bekliyor |
| Tanımlar | Doğrulama bekliyor |

### 33.5 Monorepo kabuğu (d256/d258 ile ortak)

Kökte ayrıca: docker-compose, Dockerfile.*, nginx, pnpm workspace, BACKLOG, ROUTE_INVENTORY, rapor scriptleri — **standart Sigorta Hasar monorepo iskeleti**; kurtarma değeri `apps/` ve `docs/project-governance/` altında.

### 33.6 Sıradaki anayasa adımları

1. Mustafa **Paket 1** onayı (`01_MERIDYEN_21_22_23_...`)
2. Paket 2 doldurulur → `02_STRATEJIK_KARAR_ENVANTERI.md`
3. Modül modül localhost:3001 PASS + screenshot
4. Commit/deploy — yalnız Mustafa isterse

---


## 32. D276 Finans Local Worktree — Navigasyon ve Cari Ekran Olgunlaştırma

Kaynak: `/Users/mustafayufkayurek/Documents/Codex/d276-finans-local-worktree`

Ana rapor: `D276_FINANS_NAVIGASYON_VE_CARI_EKRAN_OLGUNLASTIRMA_RAPORU.md`

### 32.1 Amaç ve durum

D276 = Finans modülü UX olgunlaştırması — **local only, canlıya alınmadı**.

```text
FINANS_NAVIGASYON_VE_CARI_EKRANLAR_LOCALDE_OLGUNLASTIRILDI
MUSTAFA_INCELEMESI_BEKLIYOR
```

**Kaynak türetimi:** D273 onaylı UI (`d272-approved-ui-release-scope`) baz alınarak oluşturuldu — diff'te Ayarlar/Müşteri/Tedarikçi/CRM dosyaları baz olarak görünür; D276 müdahalesi finans + navigasyon çevresinde tutuldu.

**FAZ 1 öncelik:** P2 (D278G MinIO P1 sonrası).

### 32.2 D276 ana paket — dokunulan dosyalar (10)

| Dosya | Değişiklik |
|-------|------------|
| `panel/layout.tsx` | Finans/operasyon alt menü hiyerarşisi, sol menü daralt/genişlet |
| `panel/finans/page.tsx` | Finans özeti dashboard |
| `panel/finans/faturalar/page.tsx` | İlişki türü filtresi, sigortalı kolonu |
| `panel/finans/tahsilatlar/page.tsx` | Tahsilat Ekle formu, para/tarih standardı |
| `panel/finans/masraflar/page.tsx` | Masraf akışı, finansal bağlam kartları |
| `panel/finans/sabit-giderler/page.tsx` | Aylık gider dili |
| `panel/finans/karlilik/page.tsx` | Departman kırılımı analiz dili |
| `panel/carilerim/page.tsx` | Filtreler, finans geri dönüş, empty state |
| `panel/raporlar/finansal/page.tsx` | Mock 12 ay trend **kaldırıldı** |
| `panel/operasyon/mail-yakalama/page.tsx` | **Yeni** — empty state (backend yok) |

**Dışarıda:** Backend, migration, auth, logo, yeni finans motoru, D265 ULC.

### 32.3 Navigasyon yaklaşımı (NAV-001 ile uyumlu yön)

D276 raporu:

- Üst yatay modül menüsü **sadeleştirildi**
- Ana modül navigasyonu **sol menüde**
- Üst: logo, arama, bildirim, kullanıcı
- Finans alt sayfaları sol menüde açılır hiyerarşi

**Not:** d272 (canlı D273) çift menü kullanır; D276 layout d266/d278 yönüne **daha yakın** — ancak d266 layout ile birebir aynı değil (1279 satır, diff var).

Finans sol menü:

```text
Finans Özeti → Faturalar → Tahsilatlar → Masraflar → Carilerim
→ Sabit Giderler → Karlılık → Finans Raporları
```

Operasyon hızlı aksiyonları: Merkez, Yeni Hasar, Yeni Acil Yardım, Mail Yakalama.

### 32.4 D276A–G alt serisi (Akıllı Masraf Yakalama) — AYRI PAKET

| Paket | Konu | Canlı |
|-------|------|-------|
| D276A–D276E | Masraf yeri, hızlandırıcı, hasar dosyası düzeltme | Local/ürün kabul |
| **D276F** | Temiz release scope — **8 dosya** patch | Hazırlık |
| **D276G** | Akıllı masraf canlıya alma | ✅ **CANLI** (16 Haz) |

**D276G canlı kapsamı (D276F patch — finans worktree'nin tamamı DEĞİL):**

```text
Backend: expenses modülü + claim-files + emergency cost
Web: panel/finans/masraflar/page.tsx  (yalnız 1 web dosyası)
```

**D276G bilinçli dışarıda:** Panel layout, CRM, Ayarlar, Müşteri, Tedarikçi, D278, migration.

**Anlam:** Canlıda masraflar sayfası D276G akıllı yakalama içerebilir; finans navigasyon/carilerim/faturalar D276 ana paketi **canlıda yok**.

### 32.5 d266 gap analizi

| Dosya | d276-finans-local | d266 disk | Canlı (tahmini) |
|-------|-------------------|-----------|-----------------|
| `finans/**` (6 sayfa) | Olgunlaştırılmış | Eski | D273 baz — D276 UX yok |
| `carilerim/page.tsx` | 293 satır | 252 satır | D276 UX yok |
| `layout.tsx` | Finans alt menü | d278 (farklı diff) | D273 çift menü |
| `mail-yakalama` | Var | **Yok** | Yok |
| `masraflar/page.tsx` | D276 + D276G birleşik olabilir | Eski? | D276G backend+web kısmi |

### 32.6 Worktree ek içerik

| Klasör | İçerik |
|--------|--------|
| `outputs/D278F_file_flow/` | MinIO dosya akış testi kalıntısı (D278F — ayrı paket) |
| `tools/d278f-local-file-flow-test.mjs` | D278F test aracı |

D276 worktree kirli — doğrudan deploy **yasak**; D276F patch disiplini örnek alınmalı.

### 32.7 Kurtarma stratejisi

| Öncelik | Aksiyon |
|---------|---------|
| **P0–P1 önce** | Login, nav (d278), kullanıcılar, müşteri/tedarikçi, CRM |
| **P2** | D276 finans 10 dosyasını d266'ya taşı — layout merge dikkatli (d278 koru) |
| **P2** | Mustafa local PASS: `/panel/finans`, carilerim, masraflar |
| **Ayrı** | D276G masraflar zaten canlıda — taşımada çift uygulama kontrolü |

**Layout merge kuralı:** d266 d278 layout + D276 finans alt menü bloklarını seçici merge — d272 çift menü geri gelmesin.

---


## 31. D272 Approved UI Release Scope — Birleşik Onaylı UI Kaynağı

Kaynak: `/Users/mustafayufkayurek/Documents/Codex/d272-approved-ui-release-scope`

Raporlar: `D272_ONAYLI_UI_RELEASE_SCOPE_RAPORU.md`, `D273_ONAYLI_UI_CANLIYA_ALMA_RAPORU.md`, `D273_KAPANIS_RAPORU.md`

### 31.1 Temel kural

```text
ONAYLANAN_UI = YAYINLANACAK_UI
```

Yeni tasarım veya ürün kararı değil — **onaylanmış paketlerin tek temiz worktree'de birleştirilmesi**.

### 31.2 Birleştirilen paketler

| Paket | D272'ye taşınan |
|-------|-----------------|
| **D256** | Ayarlar UI (`ayarlar/**`, settings bileşenleri) |
| **D258** | Müşteri + Tedarikçi (3 dosya) |
| **D266** | CRM route, Empty State, eksper-crm redirect |
| **D267** | `NEXT_PUBLIC_API_URL=https://app.meridyen-tr.com/api/v1` build |

**Dışarıda:** Backend, migration, auth, haritalar, kullanıcı yaşam döngüsü UI.

### 31.3 Resmi dosya kapsamı

```text
apps/web/src/app/panel/ayarlar/**
apps/web/src/components/settings/**
apps/web/src/components/ui/WorkingText.tsx
apps/web/src/utils/text-helpers.ts
apps/web/src/app/panel/musteriler/**
apps/web/src/app/panel/tedarikciler/**
apps/web/src/app/panel/layout.tsx
apps/web/src/app/panel/crm/page.tsx
apps/web/src/app/panel/eksper-crm/page.tsx
```

Local önizleme portu: **3007**

### 31.4 Canlıya alma (D273)

| Alan | Değer |
|------|--------|
| Image | `sigorta-web:d273-approved-ui-v1` |
| Rollback | `sigorta-web:d267-api-url-fix-v1` |
| Durum | **D273_KAPANDI** — canlı route kanıtı PASS |
| Deploy dersi | Yanlış Docker network → 502 → nginx network düzeltmesi |

Canlı UI kanıt (D273): Ayarlar, Müşteriler, Tedarikçiler, CRM — D272 işaretleri PASS.

### 31.5 Layout mimarisi (kritik — NAV-001 ile çelişki)

D272 `layout.tsx` (**~1331 satır**):

- **Üst menü:** Dashboard, Operasyon, Personel, Sahiplik, Müşteriler, Tedarikçiler, **CRM**, Finans dropdown…
- **Sol sidebar:** Aynı modüllerin kopyası + Ayarlar alt grupları
- **Çift navigasyon** — 22–24 Haz `NAVIGASYON_TEK_SAHIPLIK` hedefinin **tersi**

d266 disk `layout.tsx` (**~1279 satır**, d278):

- **Üst menü:** Logo, arama, bildirim, kullanıcı (modül linki yok)
- **Sol sidebar:** Tek modül sahibi + CRM sidebar'da + MENU_R1 daralt/genişlet

**Parçalı regresyon açıklaması:** Canlı D273 = d272 kabuk (üst+sol çift menü). d266 kurtarma = d278 tek sahiplik. İkisi aynı anda doğru olamaz.

### 31.6 Modül bazlı d272 vs d266 disk

| Modül | d272 (onaylı/canlı D273) | d266 disk (kurtarma) | Not |
|-------|--------------------------|----------------------|-----|
| Ayarlar hub | Gruplu Merkezi (D256) | redirect → kullanicilar | D249A çelişkisi |
| Müşteriler | 3266 satır (D258) | 2999 satır | D266 finans mock temizliği |
| Tedarikçiler | 2689 satır (D258) | 2530 satır | d266 eski |
| CRM | Empty State + 4 hazırlık kartı (tıklanmaz) | 4 kart + yönlendirme linkleri | Farklı CRM yüzeyi |
| Kullanıcılar | ~963 satır (eski) | ~2067 satır | ULC/davet kurtarması d266'da |
| Layout | Çift menü | d278 tek sahiplik | **En büyük görsel fark** |

### 31.7 CRM netleştirme

D272 `crm/page.tsx` = D266 Empty State **+** 4 ilişki alanı kartı (`Hazırlık aşaması`, link yok).

d266 `crm/page.tsx` = 24 Haz **CRM-002** — Müşteri/Tedarikçi/Sigorta/Temas kartları **href ile yönlendirir**.

Mustafa canlı screenshot'ı (ExpertCrmList, üst menü) muhtemelen D273 sonrası **başka image** (operasyon-zekasi-nav vb.) veya Projects ExpertCrmList — d272 kaynağında ExpertCrmList **yok**.

### 31.8 Kurtarma stratejisi önerisi

**Katmanlı birleştirme** — d272'yi bütün olarak kopyalamak d278 nav'ı bozar:

| Katman | Kaynak | Hedef |
|--------|--------|-------|
| Müşteri/Tedarikçi UI | d272 veya d258 | d266 |
| Ayarlar iç sayfalar | d272/d256 | d266 (hub kararı ayrı) |
| CRM yüzeyi | Mustafa kararı (D272 empty vs CRM-002 hub) | d266 |
| Layout/navigasyon | d266 d278 | Canlıya deploy — d272 layout **kullanılmamalı** |
| Kullanıcılar ULC | d266 disk | d272'den **alınmamalı** |

### 31.9 D274/D275 bağlantısı

D265D web image D273'ü ezdi → D275 web'i `d273-approved-ui-v1`'e geri aldı.

**Canlı web hedefi (D275 sonrası):** d272 kaynağıyla uyumlu image.

**d266 kurtarma:** Onaylı UI'dan **modül dosyalarını** al, **layout'u d278'den** koru, **kullanicilar'ı d266'dan** koru.

---


## 30. D258 Release Worktree — Müşteri ve Tedarikçi UX Olgunlaştırma

Kaynak: `/Users/mustafayufkayurek/Documents/Codex/d258-release-worktree`

Raporlar: `2026-06-11/.../outputs/D258_*.md`

### 30.1 Amaç ve disiplin

D258 = **Müşteri + Tedarikçi** ekranlarının aynı profesyonel ürün ailesi hissini vermesi.

- Temiz release worktree (D256 ile aynı commit tabanı: `4994a23`)
- **Yalnız 3 dosya** — en dar scope örneklerinden biri
- Backend, migration, veri modeli **değişmedi**

### 30.2 Release kapsamı (tek gerçek diff)

```text
apps/web/src/app/panel/musteriler/page.tsx          (~3266 satır)
apps/web/src/app/panel/tedarikciler/page.tsx        (~2689 satır)
apps/web/src/app/panel/tedarikciler/[id]/page.tsx
```

**D258 UX değişiklikleri (özet):**
- Tedarikçi modalı müşteri kartına denk (`max-w-7xl`, kayıt merkezi bandı)
- Ortak filtre/arama dili, il adı standardı (plaka değil)
- Müşteri bilgi hiyerarşisi korundu — profesyonel CRM kart yaklaşımı

### 30.3 Canlıya alma

| Alan | Değer |
|------|--------|
| Image | `sigorta-web:d258-customer-vendor-ux-v1` |
| Platform | `linux/amd64` (ilk arm64 denemesi → 502, rollback + yeniden build) |
| Rollback | `sigorta-web:d256-settings-ui-standard-v1` |
| Backend | Değişmedi — `app-backend:d254-user-email-reinvite-v1` |
| Durum | **D258_KAPANDI** — ChatGPT denetim ONAY, CANLIDA |
| Mustafa | CANLI_URUN_SAHIBI_DOGRULAMASI_BEKLIYOR (kapanış raporunda) |

### 30.4 Deploy dersi (tekrarlayan)

```text
Lokal arm64 image → canlı amd64 → exec format error → 502
Çözüm: --platform linux/amd64 + D256 rollback + yeniden deploy
```

### 30.5 D272 onaylı UI zinciri

D258, D272 birleştirmesinin **Müşteri/Tedarikçi bileşeni**:

```text
D258 (3 dosya) + D256 Ayarlar + D266 CRM Empty + D267 API URL
  → d272-approved-ui-release-scope
  → sigorta-web:d273-approved-ui-v1
```

**Doğrulama:** `d258/musteriler/page.tsx` = `d272/musteriler/page.tsx` (birebir, 3266 satır).

### 30.6 d266 kurtarma gap analizi

| Dosya | d258/d272 (onaylı) | d266 disk | Gap |
|-------|-------------------|-----------|-----|
| `musteriler/page.tsx` | 3266 satır | 2999 satır | **Farklı** — D266 finans mock temizliği |
| `tedarikciler/page.tsx` | 2689 satır | 2530 satır | **Eski/regresyon** — D258 UX yok |
| `tedarikciler/[id]/page.tsx` | D258 | Doğrulanmalı | Muhtemelen eski |

**Anlam:** Mustafa’nın “müşteri/tedarikçi eski/sade” şikâyeti — d266 disk D258 onaylı sürümden **geride**. Kurtarma kaynağı: `d258-release-worktree` veya `d272-approved-ui-release-scope`, D266 finans temizliği ayrı merge.

### 30.7 Local geliştirme notu

D258 UX raporu: bayat `.next` → `Cannot find module './2328.js'` 500 hatası. Çözüm: `.next` temizle, farklı port (3005/3006).

### 30.8 Worktree'deki diğer içerik

d256 ile aynı monorepo iskeleti (docker, nginx, docs, BACKLOG). **Ürün değeri yalnız 3 panel dosyasında** — geri kalan paylaşılan proje kabuğu.

### 30.9 Kurtarma önceliği

| Öncelik | Aksiyon |
|---------|---------|
| P1 | `d272` veya `d258` → d266 `musteriler` + `tedarikciler` kopyala |
| P1 | D266 finans mock temizliğini koruyarak merge (conflict çözümü) |
| P2 | Mustafa canlı liste/detay/modal PASS |

---


## 29. D256 Release Worktree — Ayarlar UI Standartlaştırma

Kaynak: `/Users/mustafayufkayurek/Documents/Codex/d256-release-worktree`

### 29.1 Amaç ve disiplin

D256 = **temiz release worktree** disiplininin erken örneği (D258/D262/D265/D266 ile aynı model).

- Ana kirli worktree'den build **alınmadı**
- Kaynak commit: `4994a23 fix(test-notes): kabul durumunda notu kapat`
- Yalnız Ayarlar UI/metin revizyonu — yeni özellik paketi değil

### 29.2 Taşınan dosya kapsamı

```text
apps/web/src/app/panel/ayarlar/**
apps/web/src/app/panel/layout.tsx
apps/web/src/components/settings/**
apps/web/src/components/ui/WorkingText.tsx
apps/web/src/components/ui/index.ts
apps/web/src/utils/text-helpers.ts
```

**Bilerek dışarıda:** Auth, Dashboard, CRM, Hasar, Finans, backend, migration.

### 29.3 Canlıya alınan kapsam

| Konu | Detay |
|------|--------|
| Image | `sigorta-web:d256-settings-ui-standard-v1` |
| Rollback | `sigorta-web:d254-user-email-reinvite-v1` |
| Backend | Değişmedi — `app-backend:d254-user-email-reinvite-v1` |
| Durum | Container healthy — **CANLI_DOGRULAMA_BEKLIYOR** (Mustafa PASS) |

**UI değişiklikleri:** Ayarlar başlık sadeleştirme, iç menü, Mahal & Bölgeler adı, Alan Zorunlulukları metni, tek tip CRUD şablonu, standart modal/Empty State dili.

### 29.4 Ayarlar Merkezi yapısı (d256 disk)

`/panel/ayarlar/page.tsx` = **gruplu kart hub** (Şirket ve Sistem, Operasyon Tanımları, Finans, Dosya Yaşam Döngüsü…).

Paylaşılan bileşenler:
- `SettingsPageLayout.tsx`
- `SettingsModal.tsx`
- `SettingsUI.tsx`

44 ayar alt route'u mevcut (kurulum, tanimlar, ihbar-konulari, mail-kurulum, e-posta-bildirimleri…).

### 29.5 D272 birleştirme zinciri

D272 onaylı UI scope'a **D256 Ayarlar UI dahil edildi**:

```text
D256 Ayarlar + D258 Müşteri/Tedarikçi + D266 CRM Empty + D267 API URL
  → d272-approved-ui-release-scope
  → sigorta-web:d273-approved-ui-v1
```

**Anlam:** Canlı/onaylı Ayarlar iç sayfaları büyük ölçüde D256 standardından gelir; hub sayfası sonraki kararlarla değişmiş olabilir.

### 29.6 d266 kurtarma çelişkisi

| Yüzey | d256 worktree | d266 disk (kurtarma) |
|-------|---------------|----------------------|
| `/panel/ayarlar` | Gruplu Ayarlar Merkezi hub | `redirect('/panel/kullanicilar')` — D249A |
| Ayarlar erişimi | Hub kartları | Sol menü → Ayarlar alt route'ları |
| Settings bileşenleri | ✅ standart | Doğrulanmalı — d272/d278 ile diff |

**Karar gereken:** D249A hub kaldırma (d266) vs D256/D248 Ayarlar Merkezi hub (onaylı UI'da olabilir).

### 29.7 Worktree'deki diğer belgeler (referans)

| Dosya | Rol |
|-------|-----|
| `D256_AYARLAR_UI_STANDARTLASTIRMA_CANLIYA_ALMA_RAPORU.md` | Deploy kanıtı |
| `D256_RELEASE_KAYNAGI_IZOLASYONU_RAPORU.md` | Scope izolasyonu |
| `IMPLEMENTATION_SUMMARY.md` | Domain ayrıştırma (ClaimSubject, departmanlar) — **D256 deploy dışı** |
| `BACKLOG.md` | Silent catch / workaround envanteri |
| `ROUTE_INVENTORY.md`, `DOMAIN_MAPPING.md` | Route haritası |
| `docker-compose*.yml`, `Dockerfile.*` | Deploy altyapısı |
| `MUHENDIS_RAPORU_20260515.md`, `URUN_OLGUNLUK_ANALIZI.md` | Erken dönem analiz |

### 29.8 Kurtarma kullanımı

Ayarlar **iç sayfa** CRUD/modal/Empty State regresyonu için referans:

1. `d256-release-worktree/.../ayarlar/<ekran>/page.tsx`
2. `d272-approved-ui-release-scope` ile diff
3. d266 disk ile karşılaştır — hub redirect ayrı karar

**Öncelik:** P1 (login, nav, kullanıcılar, CRM sonrası).

---


## 28. Haziran 22 `work/` — Kanıt ve Uygulama Araçları

Kaynak: `devir-paketini-ald-m-ve-ba-3/work/`

Codex oturumunda **Mustafa PASS kanıtı** ve **dar kapsamlı patch** için kullanılan scriptler.

### 28.1 Uygulama scriptleri

| Dosya | Amaç | Hedef worktree |
|-------|------|----------------|
| `apply-mail-bildirim-merkezi-01.py` | Mail + E-posta Bildirimleri tek merkez (SMTP + kurallar + test sekmesi) | `d278h-minio-release-scope` |
| `prepare-meridyen-corporate-logo.py` | Desktop logo JPEG → `meridyen-corporate-logo-correct.png` kırpma | outputs klasörü |

### 28.2 Playwright capture scriptleri (kanıt üretimi)

| Script | Çıktı paketi | URL |
|--------|--------------|-----|
| `capture-login-regresyon-duzeltme-01.cjs` | LOGIN_REGRESYON_DUZELTME_01 | localhost:3001/giris |
| `capture-login-regresyon-live.cjs` | LOGIN_REGRESYON_CANLIYA_ALMA | canlı giriş |
| `capture-master-logo-regresyon-01.cjs` | MASTER_LOGO_REGRESYON | login/panel logo |
| `capture-navigasyon-tek-sahiplik-01.mjs` | NAVIGasyon_TEK_SAHIPLIK_UYGULAMA_01 | Sol menü modülleri |
| `capture-kullanici-yetki-ia-01.cjs` | KULLANICI_VE_YETKI_BILGI_MIMARISI | kullanicilar + yetki |
| `capture-ayarlar-03.cjs` | AYARLAR_MODULU_03 | ayarlar ekranları |
| `capture-mail-bildirim-merkezi-01.mjs` | MAIL_BILDIRIM_MERKEZI | mail merkezi |
| `capture-operasyon-nav-duzeltme-01.cjs` | OPERASYON nav düzeltme | /panel/operasyon |
| `capture-operasyon-yerlesim-02-live.cjs` | Yerleşim canlı | operasyon |
| `capture-operasyon-zekasi-13*.cjs` … `23.cjs` | OZ V8–V18 paketleri | operasyon zekası bandı |

**Ortak pattern:** Mock auth/API → desktop/tablet/mobile screenshot + JSON metrics → `outputs/<PAKET>/`

### 28.3 Altyapı scriptleri

| Dosya | Amaç |
|-------|------|
| `disk-cleanup-01.sh` | Canlı disk — aktif image koruyarak unused image temizliği |
| `release-log-cleanup-01.sh` | Eski `/opt/app/releases/*` arşivleme (disk kazanımı) |

### 28.4 Referans patch dosyaları

`work/master-logo-regresyon-01/`:
- `giris-page.tsx`
- `panel-layout.tsx`

Login logo regresyon düzeltmesi için referans snippet’ler.

### 28.5 d266 kurtarma kullanımı

Bu scriptler **ürün kodu değil** — Zorunlu Canlı Kanıt Protokolü V1 için yeniden çalıştırılabilir:

1. d266 local `localhost:3001` ayakta
2. İlgili `capture-*.cjs` → screenshot + metrics
3. Mustafa karşılaştırması → PASS/KAPANDI

Öncelikli yeniden kanıt: `capture-login-regresyon-*`, `capture-navigasyon-*`, `capture-kullanici-yetki-*`.

---

---

## 27. Haziran 22–24 — Tanımlar, ULC, TRM, Ürün Temizlik Paketleri

### 27.1 Tanımlar Merkezi Dashboard Dönüşümü (23 Haz)

**Paket:** `TANIMLAR_MERKEZI_DASHBOARD_DONUSUMU_01`

**Karar (TAN-001):** Tanımlar = dashboard/rehber — ikinci menü/CRUD merkezi değil.

**Yapılan:**
- Sekmeli ikinci menü kaldırıldı
- Gruplar: Kurumsal, Operasyonel, Finans, Dosya Yaşam Döngüsü
- Kart: ne işe yarar, nerede yönetilir, kayıt sayısı, yönlendirme
- Dosya: `d278h-minio-release-scope/.../tanimlar/page.tsx`

**Deploy:** Hayır — local only.

**d266 uyumu:** Hub kaldırma + D249A ile uyumlu; d266 `tanimlar/page.tsx` doğrulanmalı.

### 27.2 Geçici Şifre Geri Kazanım (24 Haz)

**Paket:** `TEMP_PASSWORD_GERI_KAZANIM_01`

**Kaynak:** `guvenli-geri-kazanim-01` worktree

**Geri getirilen:**
- `POST /users/:id/temporary-password`
- `mustChangePassword`, `temporaryPasswordIssuedAt`
- Frontend: `kullanicilar/page.tsx` — ayrı **Geçici Şifre Üret** aksiyonu

**Deploy (paket içi):** Hayır — kod kanıtı only.

**d266:** Diskteki kullanicilar kurtarması **bu paketle aynı hedef**.

### 27.3 ULC Canlıya Alma (24 Haz) — BACKEND ONLY ✅

**Paket:** `ULC_CANLIYA_ALMA_01`

**Canlı image:** `app-backend:ulc-canliya-alma-01-v1-amd64`

**Canlıya alınan:**
- temporary-password, reactivate, me/change-password
- inactive forgot/refresh guard
- DB kolonları zaten vardı — migration yok

**Canlıya ALINMAYAN:** Web UI, login, CRM, navigasyon

**Route kanıt:** Authsuz 401; admin 201 (raporda)

**d266 gap:** Backend canlıda ✅ — frontend geçici şifre UI diskte, deploy yok.

### 27.4 TRM/CRM Route Regresyon (24 Haz) — KRİTİK

**Paket:** `TRM_ROUTE_REGRESYON_AUDITI_VE_DUZELTME_01`

**Kök neden:**

```tsx
// crm/page.tsx
export { default } from '../musteriler/page';
```

CRM tıklanınca **Müşteriler** açılıyor — redirect değil, **component alias**.

**Köken:** `NAVIGASYON_TEK_SAHIPLIK` sırasında kırık link olmasın diye müşteriye bağlanmış.

**Düzeltme:** Yapılmadı — doğru TRM/CRM hedefi kilitlenmedi.

**Bekleyen karar:** CRM hub mu, ExpertCrmList mi, TRM ayrı route mu?

**d266:** 4 kartlı hub diskte — alias ile çelişiyor; Mustafa CRM/Müşteri karışıklığı buradan.

### 27.5 Ürün Temizlik Sprinti (23 Haz)

**Paket:** `URUN_TEMIZLIK_SPRINTI_01` — plan only

| Öncelik | Bulgu |
|---------|--------|
| **P0** | Login logosu kurumsal format değil |
| P1 | Sayfa yerleşimi sıkılaştırma, mail çift ayar, evrak/ihbar kavramları |
| P2 | Mahal/Bölgeler yanlış örnek, ayarlar menü karmaşası |

Mustafa canlı gözlemlerinin resmi envanteri.

### 27.6 Yetki Matrisi Kök Audit (23 Haz)

**Karar:** `YETKI_MATRISI_ROLLER_ICINE_ALINMALI`

- Ayrı modül/route yok
- Gerçek matris: `kullanicilar/[id]` → **Ekran Erişim İzinleri**
- Roller = rol tanımı; Matris = ekran izni görünümü + override

**d266:** Kullanıcılar kurtarmasında detay sayfası / yetki sekmesi kontrol edilmeli.

---

---

## 26. Operasyon Zekası Serisi (OPERASYON_ZEKASI_01–23)

Kaynak: `2026-06-22/.../outputs/OPERASYON_ZEKASI_*`

Haziran 11 D97–D105 spesifikasyonunun **22 Haziran uygulama dalgası**.

### 26.1 Ürün tanımı

**Operasyon Zekâ Merkezi** = yöneticinin **karar ekranı** (rapor değil).

```text
30 saniyede bugünün operasyon önceliğini göster.
Operasyon Zekâsı ne olduğunu anlatmaz; ne yapılması gerektiğini söyler.
```

**Üç katman ayrımı:**

| Katman | Rol |
|--------|-----|
| Operasyon Hafızası | Geçmiş bağlam |
| Operasyon Merkezi | Günlük aksiyon yüzeyi (`/panel/operasyon`) |
| Operasyon Zekâsı | Yönetici öncelik/karar bandı |

MVP’de ayrı modül şart değil — Operasyon Merkezi içinde üst karar bandı olarak başlar.

### 26.2 Ekran iskeleti (MVP)

1. Bugün Müdahale Gerekenler (max 5 kart)
2. Kritik Dosyalar
3. Operasyon Darboğazları
4. Bekleyen Kararlar
5. Günlük Öncelikler

Alt metin: **"Bugün önce bunlara bakın."**

### 26.3 Paket haritası (01–23)

| Paket | Katman / MVP | Tür |
|-------|--------------|-----|
| 01–02 | Ürün kapsamı + ekran mimarisi | Spesifikasyon |
| 03–07 | Sinyal kalitesi, darboğaz analizi | Tasarım |
| 08–12 | Aksiyon etkisi, müdahale hedefi/zamanı, aksiyon zinciri, **Operasyon Sağlığı** | Motor tasarımı |
| **13** | **MVP V8 — Operasyon Sağlığı uygulama** | **CANLI ✅** |
| 14 | Operasyon Baskısı (V9) | Uygulama |
| 15 | MVP V10 — Öncelik skoru / baskı motoru | Uygulama |
| 16 | MVP V11 — Sonuç motoru | Tasarım/uygulama |
| 17 | MVP V12 — Etki doğrulama | Tasarım |
| 18 | MVP V13 — Kök neden / tema haritası | Tasarım |
| 19 | MVP V14 — Trend | Tasarım |
| 20 | MVP V15 — Tema önceliği / yönetici odağı | Uygulama |
| 21 | MVP V16 — Etki panosu / müdahale etki | Tasarım |
| 22 | MVP V17 — Öğrenme / önleyici hafıza | Tasarım |
| 23 | MVP V18 — Yönetici etkisi motoru | Tasarım/uygulama |

**Kural (tüm paketler):** Yeni tablo, migration, AI/ML, otomatik atama yok — mevcut API sinyallerinden türetim.

### 26.4 Canlıya alınan

| Paket | Image / Durum |
|-------|---------------|
| **OZ-13 MVP V8** | `app-backend:operasyon-zekasi-13-v*` + web — `OPERASYON_ZEKASI_MVP_V8_CANLIDA` |
| **Navigasyon düzeltme** | `sigorta-web:operasyon-zekasi-nav-duzeltme-01-v1` |

**V8 canlı kapsam:** `operationHealth` API — Sağlıklı/Dikkat/Riskli, evidence, ilk müdahale.

**Kabul:** `MUSTAFA_KABUL_BEKLIYOR` — görsel kanıt oturum açılamadığı için eksik.

**Disk uyarısı:** Deploy sonrası disk %97 — anayasa %95 blokajına yakın.

### 26.5 Konsolidasyon (V8–V18 audit sonrası)

**Sorun:** Üst bantta çok kart (Sağlık, Baskı, Yönetici Odağı, Yönetici Etkisi) — yönetici yükü artıyor.

**Hedef:** Tek kart → **"BUGÜNÜN YÖNETİCİ KARARI"**

Alt rozetler: Sağlık, Baskı, Etki, Trend.

Korunan: Bugün Müdahale Gerekenler, Kritik Dosyalar, Bekleyen Kararlar.

**Durum:** Konsolidasyon raporu hazır — uygulama ayrı paket.

### 26.6 d266 kurtarma bağlantısı

| Konu | İlişki |
|------|--------|
| Operasyon sayfası yerleşim | `OPERASYON_MERKEZI_YERLESIM_02` (16 Haz) — ayrı paket |
| Sol menü "Operasyon" | Nav düzeltme canlıda — d278 layout ile uyumlu olmalı |
| d266 öncelik | **P2** — login, nav, kullanıcılar, CRM önce |
| Haziran 11 D97–105 | Önceki spesifikasyon arşivi — 22 Haz uygulama dalgası |

---

---

## 25. Haziran 22–24 Oturumu — Kanonik Sürüm Geri Kazanım (`devir-paketini-ald-m-ve-ba-3`)

Kaynak: `/Users/mustafayufkayurek/Documents/Codex/2026-06-22/devir-paketini-ald-m-ve-ba-3/outputs/`

**80+ paket** — acil durum geri kazanım, kanonik sürüm, login, navigasyon, CRM, ayarlar, evrak motoru, ULC.

### 25.1 Üst tema: Kanonik sürüm vs canlı sapma

| Paket grubu | Amaç |
|-------------|------|
| `ACIL_DURUM_*`, `GUVENLI_GERI_KAZANIM_*` | Sürüm sapması teşhis + güvenli geri kazanım |
| `KANONIK_SURUM_*` | Kilitli kararlarla kaynak/canlı uyum |
| `AYARLAR_VE_LOGIN_KANONIK_*` | Login + Ayarlar kanonik geri kazanım |
| `MERIDYEN_KANONIK_SURUM_ENVANTER_*` | Karar envanteri + eksiklik haritası |
| `21_22_23_HAZIRAN_KARAR_*` | 3 günlük karar listesi + canlı varlık doğrulama |
| `KARAR_KORUMA_GUARD_SISTEMI_01` | Deploy öncesi kilitli karar PASS zorunluluğu |

### 25.2 Kilitli kanonik kararlar (PRODUCT_DECISIONS_LOCKED özeti)

**Login (LOGIN-001–004):**
- Logo: `/meridyen-corporate-logo-correct.png`
- Kompakt premium kart; header büyümez; beyaz çerçeve yok
- Destek hattı, WhatsApp, hero korunur

**Navigasyon (NAV-001–002):**
- Sol menü = tek modül sahibi (Dashboard, Operasyon, Personel, Sahiplik, Müşteriler, Tedarikçiler, CRM, Finans, Harita, Ayarlar)
- Üst menü = yalnız logo, arama, bildirim, kullanıcı

**CRM (CRM-001–002):** Bağımsız `/panel/crm` İlişki Yönetimi Merkezi — müşteri alias değil

**Ayarlar:** Tanımlar = dashboard/rehber; Mail tek merkez; İhbar Konuları canonical

**ULC (ULC-001–005):** Geçici şifre, arşiv, reactivate, mustChangePassword — **kaynakta EKSİK bulundu (24 Haz audit)**

### 25.3 Login regresyon — Mustafa ekran görüntüsü teşhisi

**Paket:** `LOGIN_REGRESYON_DUZELTME_01` (22 Haz)

**Canlı audit (regresyon):**
- Header 137px, logo 276×104, **beyaz çerçeveli logo kartı**
- Mustafa’nın paylaştığı screenshot ile uyumlu

**Düzeltme (local):** `login-kimlik-01-release/.../giris/page.tsx`
- Header → 108px, logo küçültüldü, beyaz çerçeve kaldırıldı
- **Deploy:** `LOGIN_REGRESYON_CANLIYA_ALMA` — `MUSTAFA_KABUL_BEKLIYOR`

**CODEX_CANLI_KANIT (24 Haz):** In-app browser ile `/giris` screenshot — Chrome oturumundan kanıt alınamıyor (izin blokajı)

### 25.4 Navigasyon tek sahiplik — d266 kurtarma hedefi

**Paket:** `NAVIGASYON_TEK_SAHIPLIK_UYGULAMA_01` + canlıya alma

- Sol menü tek kaynak; üst menü modül linkleri kaldırıldı
- **d266 diskte d278 layout ile uyumlu** — henüz Mustafa PASS / deploy tam değil

### 25.5 CRM paketleri (22–24 Haz)

| Paket | Sonuç |
|-------|--------|
| `CRM_URUN_KARARI_KILITLEME_01` | CRM bağımsız alan |
| `CRM_ILISKI_YONETIMI_MVP1_UYGULAMA_01` | 4 kartlı hub → d266 disk |
| `CRM_UX_GERI_KAZANIM_01`, `CRM_UX_SON_TEMIZLIK_01` | UX temizlik + canlıya alma |

**Not:** Canlı D266 Empty State ile 24 Haz hub kararı **farklı yüzeyler** — kanonik karar hub (CRM-002).

### 25.6 Kritik eksiklikler (24 Haz `EKSIKLIK_HARITASI`)

| Alan | Durum |
|------|--------|
| Login logo/header | VAR (canlıda regresyon BOZUK olabilir) |
| Sol menü | VAR / RISKLI |
| CRM hub | VAR |
| `POST /users/:id/temporary-password` | **EKSIK** (canlı 404) |
| `reactivate`, `mustChangePassword` | **EKSIK** |
| Create-time geçici şifre | **RISKLI** |

**d266 kurtarma önceliği:** ULC backend + kullanicilar UI diskte var — canlıda eksik.

### 25.7 21–23 Haziran karar özeti

- **22 Haz:** Login regresyon, Operasyon Zekası V8–V18, Evrak standart motoru MVP1
- **23 Haz:** Disk temizlik, Ayarlar canonical, Mail merkezi, Navigasyon tek sahip, Tanımlar dashboard
- **24 Haz:** Güvenli geri kazanım deploy, ULC geri kazanım, fonksiyonel tamlık audit

### 25.8 d266 kurtarma — tek doğruluk kaynağı tablosu

| Modül | Kanonik karar | d266 disk | Canlı (screenshot) |
|-------|---------------|-----------|------------------|
| Login | Kompakt logo, çerçevesiz | login-kimlik worktree düzeltildi | ⚠️ Beyaz kutu — regresyon |
| Navigasyon | Sol menü d278 | ✅ layout.tsx | ❌ Eski üst menü |
| CRM | 4 kartlı hub | ✅ crm/page.tsx | Empty State (D266) |
| Kullanıcılar | Davet + geçici şifre | ✅ diskte | Eski UI |
| Ayarlar hub | Kaldır | ✅ redirect | Karma |

---

---

## 24. Haziran 16 Oturumu — Anayasa, Marka, Operasyon, Disk (`files-mentioned-by-the-user-meridyen`)

Kaynak: `/Users/mustafayufkayurek/Documents/Codex/2026-06-16/files-mentioned-by-the-user-meridyen/`

**510+ teslim dosyası** (outputs altında login logo, operasyon yerleşim, operasyon zekası vb.).

### 24.1 Üst yönetişim — üçlü anayasa (22 Haziran)

| Belge | Rol |
|-------|-----|
| **MERIDYEN_URUN_VE_UYGULAMA_ANAYASASI_V1** | Tek kaynak: çalışma modeli, canlıya alma, marka, CRM, operasyon, disk |
| **MERIDYEN_KALICI_KARARLAR** | Kronolojik kalıcı karar kaydı |
| **MERIDYEN_GELISTIRME_PRENSIPLERI** | Scope, release, raporlama, UX, marka prensipleri |

**Kilit kurallar (tüm kurtarma için geçerli):**

```text
Kodlandı ≠ Canlıya alındı ≠ Kabul edildi
Codex ürün/mimari karar vermez — uygular ve kanıt üretir
Mustafa kabul etmeden paket kapanmaz
```

**CRM (Anayasa §7):** Operasyon ilişkileri yönetimi; Ayarlar/Operasyon Hafızası ile karıştırılmaz.

**Operasyon Merkezi (§8):** Aksiyon ekranı — dashboard rapor değil; boş veri hata değil.

**Disk (§9):** %80 uyarı, %90 inceleme, **%95 deploy blokajı**; aktif image/container/volume silinmez.

### 24.2 Kurumsal logo V2 — CANLI ✅ (22 Haziran)

| Paket | Image | Kapsam |
|-------|-------|--------|
| MERIDYEN_KURUMSAL_LOGO_V2 | `sigorta-web:meridyen-kurumsal-logo-v2-v1` | Master logo: login, şifre sıfırla, panel layout |

**Kalıcı karar:** `/meridyen-kurumsal-logo-master.png` — statik, animasyon yok, kalkan/M logosu değil.

### 24.3 Panel marka standardizasyonu Plan 2 — CANLI ✅ (22 Haziran)

| Paket | Değişiklik |
|-------|------------|
| PANEL_MARKA_STANDARDIZASYONU_PLAN_2 | Header logo sidebar hizasına — `max-w-screen-2xl` → `w-full px-4 md:px-6` |

Image: `sigorta-web:panel-brand-plan2-v1`

**Kaynak worktree:** `tmp/login-kimlik-01-release` — d266 ile aynı olmayabilir.

### 24.4 Operasyon Merkezi yerleşim 01/02 — LOCAL (deploy yok)

| Paket | Konu |
|-------|------|
| YERLESIM_01 | İlk yerleşim optimizasyonu |
| YERLESIM_02 | Mobil KPI sıkılaştırma, breadcrumb gizleme, kompakt aksiyonlar |

Dosya: `tmp/login-kimlik-01-release/.../panel/operasyon/page.tsx`

Playwright screenshot + layout metrics kanıtı var; **canlıya alınmadı**.

### 24.5 INFRA_DISK_04 — CANLI disk kurtarma

| Metrik | Önce | Sonra |
|--------|------|-------|
| Root doluluk | %100 | %81 |
| Boş alan | 167M | 7.5G |

Aktif container/image korundu; deploy blokajı kaldırıldı. Volume/DB/uploads dokunulmadı.

### 24.6 d266 kurtarma — anayasa uyum kontrol listesi

| Anayasa maddesi | d266 durum |
|-----------------|------------|
| Mustafa PASS | ❌ Bekliyor (nav, kullanıcılar, CRM) |
| Onaylı UI (D273) korunmalı | ⚠️ d278 layout henüz deploy yok |
| Ayarlar ≠ CRM (D249A) | ✅ Hub kaldırıldı |
| CRM Empty State | ⚠️ diskte hub vs canlı empty çelişkisi |
| Logo master | Canlıda V2 — d266 layout doğrulanmalı |
| Temiz release scope | D266 örneği: 4 dosya scope |
| Disk %95 | Deploy öncesi kontrol şart |

### 24.7 Worktree notu

16–22 Haziran paketlerinin çoğu **`tmp/login-kimlik-01-release`** üzerinde — **d266-release-scope ile paralel hat**. Kurtarmada hangi worktree’nin canlıya gittiği image tag ile eşleştirilmeli.

---

---

## 20. D266 Sonrası — Onaylı UI, Regresyon, FAZ 1 Kapanış (D267–D278)

Mustafa’nın beşinci paylaşımı: **release yönetimi, onaylı UI birleştirme, D274 regresyon, D275 geri kazanım, MinIO, FAZ 1 kapanış**.

### 20.1 d266-release-scope resmi tanımı (D266 son kontrol)

Temiz kaynak: `/Users/mustafayufkayurek/Documents/Codex/d266-release-scope`

**Yalnız 4 alan + CRM klasörleri:**

- `layout.tsx` (CRM topbar)
- `musteriler/page.tsx` (finans mock temizliği)
- `crm/page.tsx`, `eksper-crm/page.tsx`

Harita, backend, auth, D262 permission **dahil değil**.

### 20.2 Onaylı UI birleştirme (D271–D273)

| Belge | Rol |
|-------|-----|
| D271 | Audit: paket izi ≠ birebir UI; D258 müşteri/tedarikçi canlıda eşleşmiyor |
| **D272** | **Onaylı UI tek scope:** `d272-approved-ui-release-scope` |
| **D273** | Canlı deploy: `sigorta-web:d273-approved-ui-v1` |

**D272 birleştirilen paketler:**

```text
D256 Ayarlar UI + D258 Müşteri/Tedarikçi + D266 CRM Empty State + D267 API URL
```

**Build zorunluluğu:** `NEXT_PUBLIC_API_URL=https://app.meridyen-tr.com/api/v1`

**Kural:** `ONAYLANAN_UI = YAYINLANACAK_UI`

### 20.3 D265D regresyon + D275 geri kazanım (kritik)

| Olay | Detay |
|------|-------|
| D265D | Backend+web+migration birlikte deploy |
| **D274 kök neden** | D265D web image, D273 onaylı UI’yı **ezdi** |
| Geri düşen dosyalar | `layout.tsx`, `musteriler`, `tedarikciler` — eski üst menü, eski tedarikçi dili |
| D265 web değişikliği | Aslında **gerekli değil** — arşiv UI zaten `kurulum/page.tsx`’te D273 ile aynı |
| **D275 düzeltme** | Web → `d273-approved-ui-v1`; Backend → `d265-user-lifecycle-v1` korundu |

**Canlı hedef durum (D275 sonrası):**

```text
sigorta-web:d273-approved-ui-v1      ← onaylı UI
app-backend:d265-user-lifecycle-v1   ← arşiv modeli
```

**d266 kurtarma dersi:** Kullanıcılar/kurulum arşiv UI’si `kullanicilar/page.tsx` değil, onaylı kaynakta `ayarlar/kurulum` veya ayrı scope’ta olabilir — kaynak eşleştirmesi şart.

### 20.4 Release yönetimi (D267–D268)

| Belge | Konu |
|-------|------|
| D267 | D265 production geçiş hazırlık + API URL doğrulama/yayın |
| D268 | Release yönetimi standardizasyonu — temiz scope, diffscope, nginx, amd64 |

**Tekrarlayan deploy hataları:** yanlış compose network, `app-web-1` vs `sigorta-web`, arm64/amd64.

### 20.5 LOCAL vs CANLI uyumsuzluk raporu

Canlı ≠ local worktree çünkü:

- Canlı = Docker **image zinciri** (D267, D273, D275…)
- Local = kirli worktree + farklı paket birleşimleri

**CRM:** D266 scope ile canlı eşleşiyor (Empty State).  
**Müşteri/Tedarikçi:** D258 onaylı ≠ D266 release scope’taki eski dil (D271).

### 20.6 Finans + MinIO (D276–D278)

| Paket | Durum |
|-------|-------|
| D276 | Finans navigasyon + Carilerim local olgunlaştırma — **canlıya alınmadı** |
| D277 | Dosya depolama risk raporu |
| D278A–B | Disk temizlik (%95 → ~%68) — kapalı |
| **D278C** | MinIO/StorageService standardı **karar kilitlendi** |
| D278D | Geçiş etki — canlı uploads taşıma gerekmedi |
| D278E | Local MinIO uygulama |
| D278F | Dosya akış testi — **3 FAIL** |
| D278G | Düzeltme paketi — **canlı öncesi zorunlu** |

### 20.7 FAZ 1 kapanış + Master 13 madde (16 Haziran)

**FAZ_1_KAPANIS:** Aktif zorunlu başlıklar kapandı; stabilizasyon dönemi — yeni tasarım paketi açılmayacak.

**MASTER_13_MADDE — kapalı başlıklar:**

1. Ayarlar UI (D273)
2. Müşteri UI (D273/D258)
3. Tedarikçi UI (D273/D258)
4. CRM Empty State (D266/D273)
5. API URL (D267/D273)
6. Haritalar maskeleme (D262)
7. Kullanıcı yaşam döngüsü (D265D)
8. Release protokolü (D268)

**Açık öncelikler:**

| Öncelik | Başlık |
|---------|--------|
| P1 | D278G MinIO düzeltme |
| P2 | D276 Finans/Carilerim |
| P3 | DB şema audit (backlog) |
| P4 | CRM faz 2 (izleme) |

### 20.8 d266-release-scope kurtarma — doğru kaynak haritası

| Modül | Onaylı/canlı kaynak | d266 disk (git HEAD) | Not |
|-------|---------------------|----------------------|-----|
| CRM Empty State | `d266-release-scope` / D273 | ⚠️ 4 kartlı hub? | Route dosyalarını karşılaştır |
| Ayarlar UI | `d272-approved-ui-release-scope` | Hub kaldırıldı (d278?) | d278 layout ayrı paket |
| Müşteri/Tedarikçi | D258 → D272 → D273 | Doğrulanmalı | D274 regresyon riski |
| Sol menü PanelSidebar | D273 layout | d278 layout diskte | **Deploy edilmedi** |
| Kullanıcı arşiv | D265 backend + kurulum UI | kullanicilar/page kurtarma | İki farklı ekran yolu |

### 20.9 Mustafa regresyon döngüsü — dokümanlarla açıklama

```text
Local/onay: D258 müşteri, D256 ayarlar, D243E CRM preview (local only)
Canlı D266: sadece CRM empty + müşteri finans temizliği
Canlı D273: birleşik onaylı UI
Canlı D265D: UI geri düştü (D274)
Canlı D275: UI geri kazanıldı, backend D265 kaldı
Mustafa bugün: d278 sol menü diskte, canlı d273 kabuk → PARÇALI REGRESYON
```

---

---

## 19. Haziran 11 Oturumu — D257–D266 Batch (Müşteri/Tedarikçi, Haritalar, Kullanıcı yaşam döngüsü, D266 canlı)

Mustafa’nın dördüncü paylaşımı: **28 belge + screenshot klasörleri**.

**Önemli:** Aktif proje `d266-release-scope` adını **D266 canlıya alma paketinden** alır.

### 19.1 Müşteri ve Tedarikçi (D257–D258)

| Belge | Tür | Özet |
|-------|-----|------|
| D257 | Değerlendirme | Müşteri = İlişki Merkezi; Tedarikçi = Operasyon Ağı — aynı aile, farklı kimlik |
| D258 UX | Uygulama | Liste/detay olgunlaştırma |
| D258 release scope | Hazırlık | Temiz worktree: `d258-release-worktree` — sadece 3 dosya |
| **D258 canlı** | Deploy | ✅ `sigorta-web:d258-customer-vendor-ux-v1` |
| D258 kapanış | Kapanış | CANLIDA, ONAY, DÜŞÜK risk |

**Deploy dersi:** İlk image `arm64` → canlı `502`; `--platform linux/amd64` ile düzeltildi.

**Dosyalar:** `musteriler/page.tsx`, `tedarikciler/page.tsx`, `tedarikciler/[id]/page.tsx`

### 19.2 Haritalar + veri maskeleme (D259–D262)

| Belge | Konu | Canlı |
|-------|------|-------|
| D259 | Haritalar değerlendirme — Leaflet, konum, rota | Audit |
| D260 | Operasyon görünürlüğü olgunlaştırma | Uygulama |
| D261 | Veri maskeleme + rol matrisi | Spesifikasyon |
| D262 backend | Maskeleme uygulama | Uygulama |
| **D262 canlı** | Haritalar masking | ✅ `app-backend:d262-maps-masking-v1` + web |
| D262 release scope | Temiz kaynak: `d262-release-scope` | diffscope PASS |

**Not:** D266 CRM düzeltmeleri de `d262-release-scope` worktree’sinden üretildi (D266 raporu).

### 19.3 Kullanıcı yaşam döngüsü (D263–D265D)

| Belge | Karar / Durum |
|-------|---------------|
| D263 | E-posta yeniden kullanım risk analizi |
| **D264** | **Hard delete yok** — Arşivle; `archivedEmail` + `archivedAt` modeli |
| D265 | Local uygulama — migration + auth + UI (`d265-release-scope`) |
| D265A–C | Auth kararları, doğrulama, son kontrol |
| **D265D** | **CANLIYA ALINDI** (16 Haz) — backend + web + migration birlikte |
| D265 local | Auth regresyon incelemesi |

**D265 canlı image:** `app-backend:d265-user-lifecycle-v1`, `sigorta-web:d265-user-lifecycle-v1`

**UI:** Varsayılan filtre Aktif; Arşiv / Tümü; dil: Pasif → **Arşiv**

**D266 kullanıcı envanter audit (16 Haz):** Canlıda henüz `archived_email` yoktu — web `d273`, backend `d262` — zaman çizelgesi karmaşık (D265D sonrası güncellenmiş olabilir).

### 19.4 D266 — Aktif projenin kökeni

| Belge | İçerik |
|-------|--------|
| D266 bugünkü düzeltme | CRM route + müşteri finans mock temizliği |
| **D266 canlıya alma** | ✅ `sigorta-web:d266-crm-customer-cleanup-v1` |
| D266 kullanıcı envanter | Admin dışı 14 test kullanıcısı temizlik audit — silme yapılmadı |

**D266 canlı kapsamı (Mustafa CRM ekranı = bu paket):**

- Topbar `CRM` bağlantısı
- `/panel/crm` + `/panel/eksper-crm` redirect
- CRM profesyonel Empty State (mock veri yok)
- Müşteri ekranından ödeme/finans mock dili kaldırıldı

**Canlıya ALINMAYAN:** D262 haritalar (ayrı), backend, migration, auth, kullanıcı yaşam döngüsü

**Deploy dersi (tekrar):** Yanlış compose → `app-web-1` oluştu, nginx `sigorta-web` bekliyordu → 404

**Rollback:** `sigorta-web:d258-customer-vendor-ux-v1`

### 19.5 Canlı image kronolojisi (D257–D266)

```text
d256-settings-ui-standard-v1
  ↓ D258
d258-customer-vendor-ux-v1
  ↓ D262
d262-maps-masking-v1 (backend + web)
  ↓ D266
d266-crm-customer-cleanup-v1  ← Mustafa CRM screenshot kaynağı
  ↓ (paralel hatlar)
d265-user-lifecycle-v1 (16 Haz — backend+web+migration)
d273-approved-ui-v1 (D266 audit anında canlı web)
```

### 19.6 d266-release-scope kurtarma eşleştirmesi

| Modül | D266 canlı | d266 disk (kurtarma) | Gap |
|-------|------------|----------------------|-----|
| CRM Empty State | ✅ D266 | ⚠️ 4 kartlı hub (24 Haz) | **Route/UI çelişkisi** |
| Müşteri finans temizliği | ✅ D266 | Doğrulanmalı | |
| Müşteri/Tedarikçi UX | ✅ D258 | Projects referans | |
| Kullanıcı arşiv modeli | D265D canlı | d266 backend? | Migration kontrol |
| Haritalar masking | D262 canlı | Doğrulanmalı | |
| Navigasyon sol menü | ❌ (d278) | ✅ d278 layout | Deploy bekliyor |

### 19.7 Temiz release scope disiplini (D258, D262, D265, D266 ortak ders)

```text
Ana kirli worktree DEĞİL → d258/d262/d265/d266-release-scope
Diffscope PASS → yalnız paket dosyaları
Platform linux/amd64 → canlı sunucu
Nginx upstream → sigorta-web container adı doğrula
Backend+web+migration → birlikte (D265D) veya bilinçli ayrı (D266 web-only)
```

---

---

## 18. Haziran 11 Oturumu — D225–D255 Batch (Ayarlar olgunlaştırma + CRM canlıya alma)

Mustafa’nın üçüncü paylaşımı: **31 belge + screenshot/video klasörleri**.

### 18.1 UX standartlaştırma uygulama paketleri (D225–D229)

| Belge | Paket | Canlı |
|-------|-------|-------|
| D225 | Ayarlar referans UX standart tanımı | Spesifikasyon |
| D226 | Paket B — Hizmet Türleri standart CRUD | Uygulama |
| D227 | D226 canlıya alma | ✅ Deploy |
| D228 | İhbar Konuları UX standartlaştırma | Uygulama |
| D229 | D228 canlıya alma | ✅ Deploy (`d229-ihbar-konulari-ux-v1`) |

### 18.2 Mimari teşhis ve karar serisi (D231–D237)

| Belge | İçerik |
|-------|--------|
| D231 | Ayarlar bilgi mimarisi + kod haritası |
| D232 | Hedef mimari — korunacak ekranlar |
| D233 + screenshots | Ekran envanteri + görsel kanıt |
| D234 + screenshots | Görsel karar dosyası |
| D235 | Kök neden temizliği (çift yönetim) |
| D236 + screenshots | D235 canlı doğrulama |
| D237 + video frames | **Profesyonel ekran seçimi — nihai karar ürün sahibinde** |

**D237 kök neden (Mustafa döngüsü):**

```text
Düzeltilen ekran ≠ Mustafa'nın test ettiği ekran
```

Aynı anda 3 mimari ailesi: Ayarlar Merkezi, Kurulum tab’ları, Tanımlar CRUD.

### 18.3 Tek sahiplik + Zoho referans (D238–D242) — CANLIYA ALINDI

| Belge | Image / Durum |
|-------|---------------|
| **D238** | Tek sahiplik uygulama — Kurulum’dan Mail/SMS tab kaldırma, Tanımlar → yönlendirme |
| **D239** | Canlı deploy `sigorta-web:d239-d238-settings-single-owner-v1` |
| D240 | Zoho davranış referansı — profesyonel görsel standart |
| D241 | D240 ürün doğrulama |
| D242 | Zoho bilgi hiyerarşisi + canlıya alma notu |

**D239 kritik deploy dersi:** Yanlış compose → trafik dışı container; Nginx DNS doğrulaması şart.

### 18.4 Kurulum + kullanıcı daveti (D243A, D244, D248)

| Belge | Konu |
|-------|------|
| D243A / D244 | Kurulum ve Kullanıcı Daveti UX olgunlaştırma |
| **D248** | Canlıya alındı — Ayarlar Merkezi, Tanımlar, Kurulum, Settings UI |
| D248 not | Success state canlı doğrulama Mustafa aksiyonu bekliyor |

**D248 canlıya ALINMAYAN:** D243E Eksper CRM, tedarikçi hafızası, yeni auth.

### 18.5 Eksper CRM MVP-1 (D243B–D243E) — LOCAL ÖNİZLEME

| Belge | İçerik |
|-------|--------|
| D243B | Portal davet yaşam döngüsü kapsam |
| D243C | Veri modeli + ekran mimarisi |
| D243D | Ekran tasarımı + görsel mimari |
| **D243E** | **Uygulama — CANLIYA ALINMADI** |
| D243E preview | `localhost:3001/d243e-preview/eksper-crm` (örnek veri ile) |
| D243E devir | Ayarlar modülüne dönüş notu |

**Mustafa’nın “zengin CRM” beklentisi muhtemelen D243E local preview’dır** — liste, detay, filtreler, örnek kayıtlar. Canlıya hiç taşınmadı.

### 18.6 Sahip ekran CRUD + rebase regresyonu (D249B–D251D)

| Belge | Konu |
|-------|------|
| D249B | Sahip ekranları UX CRUD standartlaştırma |
| D249C | Görsel doğrulama + ChatGPT denetim protokolü |
| D251D | Kaynak geçiş adapter + UI canlıya alma |
| **D251D regresyon kök nedeni** | D251D sadece 3 dosya deploy etti; D248 Ayarlar mimarisi dirty diff’te kaldı → canlı regresyon |

```text
D251D deploy: ihbar-konulari, dosya-konulari, yeni hasar dosyası (3 dosya)
D248 Ayarlar: layout, page, tanimlar, kurulum, SettingsUI → CANLIYA GİTMEDİ
```

### 18.7 CRM topbar + empty state — MUSTAFA EKRANININ KAYNAĞI (D252–D252B)

| Belge | Ne yaptı |
|-------|----------|
| **D252** | Topbar `Eksper CRM` → `CRM`; `/panel/crm` ana route; `/panel/eksper-crm` redirect |
| **D252A** | Mock veri temizliği — `EXPERT_CRM_RECORDS = []` |
| **D252B** | **CANLIYA ALINDI** — `sigorta-web:d252b-topbar-crm-empty-state-v1` |

**D252A → D252B = Mustafa’nın gördüğü ekran:**

- İstatistikler 0
- “CRM altyapısı hazırlanıyor” EmptyState
- “MVP-1 yerel önizleme…” banner
- Mock kişi/firma kayıtları **bilinçli kaldırıldı** (Murat Aydın vb.)

Bu regresyon değil — **ürün anayasasına uygun canlı davranış**.

### 18.8 Son hotfix + CRUD şablon (D253–D255)

| Belge | Konu | Canlı |
|-------|------|-------|
| D253 | Kurulum şirket bilgisi payload limit hotfix | Deploy |
| D254 | Kullanıcı e-posta yeniden davet | Deploy |
| D255 | Sahip ekranları tek tip CRUD şablonu | **Henüz canlıya alınmadı** |

### 18.9 Üç CRM sürümü — netleştirme tablosu

| Sürüm | Route | Veri | Durum |
|-------|-------|------|-------|
| D243E preview | `/d243e-preview/eksper-crm` | Örnek kayıtlar | Local only — Mustafa’nın “güzel CRM” referansı |
| D252 ExpertCrmList | `/panel/crm` | Boş dizi | **Canlı (D252B)** — Mustafa screenshot |
| CRM hub (24 Haz) | `/panel/crm` 4 kart | Yönlendirme | d266 disk — D252 ile çelişiyor |

**Karar gereken:** d266 kurtarmada hangi CRM sürümü hedef?
- Canlı ile uyum → ExpertCrmList + empty state (D252B)
- Mustafa onayı ile → D243E zengin UI + backend bağlantısı (ayrı paket)
- 4 kartlı hub → 24 Haziran paketi — D252 ile route çakışması

### 18.10 d266 kurtarma eşleştirmesi (D225–D255)

| d266 iş | Kaynak belge | Not |
|---------|--------------|-----|
| Hub kaldırma `/panel/ayarlar` → kullanicilar | D249A, D238 | ✅ Uyumlu |
| Sol menü d278 | D238 topbar temizliği | d278 ayrı paket |
| Kullanıcı daveti + success panel | D248, D173, D244 | Diskte var — D248 success canlı doğrulanmadı |
| Arşiv filtresi | D217–D218 | Taşınmalı |
| CRM ekranı | D252B (canlı) veya D243E (preview) | Mustafa kararı |
| Ayarlar CRUD şablonu | D255 | Canlıya alınmamış — backlog |
| Regresyon önleme | D251D dersi | Kısmi deploy yasak — tam diffscope |

---

---

## 17. Haziran 11 Oturumu — D159–D224 Batch

Mustafa’nın ikinci paylaşımı: **66 belge** (canlı veri geçişi, go-live, kullanıcı yönetimi, portal 2, test notları, Eksper CRM, Ayarlar UX).

### 17.1 Canlı veri geçişi ve backend entegrasyonu (D159–D165)

| Belge | Modül | Tür | Özet |
|-------|-------|-----|------|
| D159 | Dashboard | Uygulama | Mock fallback kapatma, canlı veri sözleşmesi |
| D160 | Settings | Uygulama | Settings canlı veri geçişi |
| D161 | Claims | Backend entegrasyon | Canlı API bağlantısı |
| D162 | Documents | Backend entegrasyon | Canlı API bağlantısı |
| D163 | Finance | Backend entegrasyon | Canlı API bağlantısı |
| D164 | Dashboard | Backend entegrasyon | Canlı API bağlantısı |
| D165 | Settings | Backend entegrasyon | Canlı API bağlantısı |

**Sonuç:** Claims, Documents, Finance, Dashboard, Settings teknik olarak canlı kaynağa hazır; canlıda iş verisi yokken EmptyState davranışı korunuyor (mock’a düşülmüyor).

### 17.2 Go-live doğrulama ve auth (D166–D171)

| Belge | Sonuç | Not |
|-------|-------|-----|
| D166 | FAIL | Docker/Postgres ayakta değildi — uçtan uca oturum doğrulanamadı |
| D167 | PASS | Altyapı (PostgreSQL, Redis, MinIO) çalışır durumda |
| D168 | P0 bulgu | Refresh token P2002 — aynı saniyede aynı token |
| D169 | Düzeltme | `jti: randomUUID()` refresh payload’a eklendi |
| D170 | PASS | Final go-live doğrulama — auth zinciri, modüller, build |
| D171 | Veri temizliği | Go-live öncesi veri temizlik raporu |

**d266 bağlantısı:** D169 refresh düzeltmesi canlıda uygulanmış olmalı; d266’da auth modülü kontrol edilmeli.

### 17.3 Kullanıcı yönetimi serisi (D172–D220) — d266 kurtarma ile doğrudan ilgili

| Belge | Konu | d266 durumu |
|-------|------|-------------|
| D172 | Silme akışı kök neden | Hard delete değil → `status=inactive` |
| D173 | Geçici şifre modal success state | ✅ d266 diskte CredentialSuccessPanel ile uyumlu hedef |
| D174 | Pasifleştirme dili ve liste | Pasif kullanıcılar listede kalıyor |
| D175A | Hard delete doğrulama | DB’de kalır, yeniden aktifleştirilebilir |
| D179A | Pasif + e-posta benzersizlik | Canlı doğrulama |
| D180 | Pasif yeniden aktifleştirme | Akış tanımı |
| D180A | Pasif akış canlı doğrulama | Canlı kabul |
| D210–D215 | Aktifleştirme tutarsızlığı düzeltme | Video bazlı kesin düzeltme + canlı iz sürme |
| D216 | Canlı kullanıcı yönetimi test oturumu | Erişim doğrulama |
| **D217** | **Arşivleme ürün kararı** | Pasif kullanıcı varsayılan listeden çıkmalı |
| **D218** | **Arşiv görünümü düzeltme** | Aktif/Pasif/Arşiv filtresi |
| D219–D220 | D218 canlı doğrulama + deploy | Container: `sigorta-web:d220-d218-archive-filter-v1` |

**Kritik:** D217–D220, Mustafa’nın “kullanıcılar sayfası” beklentisinin bir parçası — arşivlenen kullanıcı listeden kaybolmalı. d266 kurtarmada Projects referansından bu filtre davranışı da taşınmalı.

### 17.4 Sigorta Şirketi Portalı 2.0 (D175–D184)

| Belge | İçerik |
|-------|--------|
| D175 | Mevcut portal değer audit |
| D176 | Portal 2.0 vizyon + MVP tanımı |
| D177 | MVP1 paketlere ayrıştırma |
| D178–D183 | Paket A–G (Kokpit, Onarım Şeffaflığı, Evrak, İl bazlı, Maliyet, Onay Merkezi) |
| D184 | MVP1 entegrasyon ve kabul testi |

**Not:** Tasarım/spesifikasyon — canlıda Portal 2.0 henüz tam uygulanmamış olabilir.

### 17.5 Eksper Portalı canlı doğrulama

| Belge | Konu |
|-------|------|
| D176A | Eksper portalı canlıya alma doğrulama |
| D186A | Eksper portalı akıllı belge ön okuma canlı doğrulama |

### 17.6 Test notları konsolidasyonu (D187–D209)

TN_2026_XXXX serisi — test notları doğrulama, düzeltme, kapanış ve master liste.

Örnekler: D188–D204 (0034, 0058, 0064, 0065, 0066, 0059, 0055, 0046, 0056, 0036, 0037, 0042), D206 tedarikçi maliyet hafızası MVP, D209 master liste.

**Kullanım:** Regresyon ve kabul testi referans arşivi — d266 Paket 1 kabul kriterleriyle çaprazlanabilir.

### 17.7 Eksper CRM MVP-1 (D221–D223) — Mustafa CRM ekranının tasarım anayasası

| Belge | İçerik |
|-------|--------|
| **D221** | Kapsam ve ekran mimarisi — **Kullanıcı Yönetimi ≠ Eksper CRM** |
| **D222** | UX mimarisi — liste kolonları, filtreler, boş durumlar, detay kartı |
| **D223** | Uygulama haritası — Paket A–G (Liste, Kart, Portal, Görüşme, Zaman çizelgesi, Sahiplik) |

**Kilitli karar (D221):**

- Kullanıcı Yönetimi → erişim, rol, şifre, aktif/pasif
- Eksper CRM → iş ortağı ilişkisi, portal durumu, görüşme hafızası, dosya ilişkisi, yaşam döngüsü

**Mustafa’nın gördüğü CRM ekranı** bu D221–D223 spesifikasyonunun **ExpertCrmList** uygulamasıdır — kayıt yokken “CRM altyapısı hazırlanıyor” empty state D222’de tanımlı.

**Çelişki notu:** 24 Haziran `CRM_ILISKI_YONETIMI_MVP1` (4 kartlı hub) ile D221–D223 (Eksper listesi) **farklı CRM yüzeyleri**. Ürün kararı netleştirilmeli:
- `/panel/crm` → İlişki Yönetimi Merkezi hub mu?
- `/panel/crm` veya `/panel/eksper-crm` → ExpertCrmList mi?
- İkisi birlikte mi (hub + eksper alt route)?

### 17.8 Ayarlar UX (D223 audit + D224 harita)

| Belge | İçerik |
|-------|--------|
| D223 (Ayarlar audit) | Canlıda tek tip CRUD yok — Tanımlar karma yüzey |
| D224 | UX standartlaştırma MVP haritası — modal CRUD, Tanımlar = indeks |

**d266 uyumu:** Hub kaldırma (D249A) + D224 hedef modeli uyumlu. Tanımlar → kategori indeksi; CRUD kendi ekranlarında.

### 17.9 d266 kurtarma öncelik matrisi (D159–D224 ışığında)

| Öncelik | Kaynak belge | Aksiyon |
|---------|--------------|---------|
| P0 | D173, D217–D218 | Kullanıcılar: success panel + arşiv filtresi |
| P0 | D221–D223 | CRM: ExpertCrmList kopyala + route kararı |
| P1 | D224 | Ayarlar CRUD standardizasyonu (hub sonrası) |
| P1 | D169 | Refresh token jti — d266 backend doğrula |
| P2 | D175–D184 | Portal 2.0 — ayrı paket |
| P2 | D187–D209 | Test notları — kabul testi referansı |

---

---

## 15. Haziran 11 Oturumu — `kesinlikle-do-ru-zaman-bu-oturum/outputs/`

Mustafa’nın paylaştığı **80+ belge** (D62–D158 + Ayarlar + Auth + Canlı doğrulama).

### 15.1 Kritik karar belgeleri (önce bunlar)

| Dosya | Konu |
|-------|------|
| `AYARLAR_KAVRAM_HARITASI_VE_SAHIPLIK_KARARI.md` | D249A — Ayarlar ≠ CRM; hub kaldırma anayasası |
| `AYARLAR_MODULU_IKI_MIMARI_PROFESYONEL_EKRAN_SECIMI_KARAR_NOTU.md` | İki mimari arasında profesyonel ekran seçimi |
| `AUTH_LOGIN_ERISIM_SORUNU_KOK_NEDEN_RAPORU.md` | Admin giriş — şifre doğru, auth akışı sorunu |
| `BUGUNKI_TASARIM_KARARLARI_CANLI_DOGRULAMA_RAPORU.md` | 15 Haziran canlı audit — CRM 404, müşteri/tedarikçi CANLIDA |
| `CANLIYA_ALINMAMIS_KARARLAR_VE_CHATGPT_BILGILENDIRME_NOTU.md` | Karar alındı / canlıya alınmadı envanteri |
| `CANLIYA_ALMA_ONCESI_BIREBIR_UI_KANIT_ZORUNLULUGU.md` | Deploy öncesi UI kanıt protokolü |
| `CODEX_MERIDIYEN_STRATEJIK_URUN_HAFIZASI_NOTU.md` | Stratejik ürün hafızası |

### 15.2 D-serisi mimari paketleri (özet harita)

| Aralık | Modül | İçerik |
|--------|-------|--------|
| D62–D66 | Ürün prensipleri | Farklılaştırıcı özellikler, onboarding, operasyon hafızası, yol haritası |
| D67–D78 | Operasyon Hızlı Erişim Merkezi | MVP1 spesifikasyon, wireframe, uygulama paketleri |
| D79–D88 | MVP1 Paket A–G | EmptyState, topbar, dosya içi erişim, entegrasyon testi |
| D89–D96 | Operasyon Hafızası MVP1 | Hafıza kartı, kayıt tipleri, dosya entegrasyonu |
| D97–D105 | Operasyon Zeka Merkezi MVP1 | Zeka kartı, karar destek, hafıza bağlantısı |
| D106–D114 | Akıllı Belge Ön Okuma MVP1 | Belge paneli, operasyon hafızası/zeka bağlantısı |
| D115–D123 | Mobil Operasyon Paneli MVP1 | Mobil dosya özeti, hızlı aksiyonlar |
| D124–D133 | Operasyon Ses Kaydı Merkezi MVP1 | Sesli not, transkript, hafıza kaynağı |
| D134–D143 | Konsolidasyon + Settings audit | UX standartları, settings olgunlaştırma |
| D144–D158 | Go-live hazırlık | Auth session, canlı veri geçişi, mock izolasyon |

**Not:** Bu D-serisi belgeler **tasarım/spesifikasyon arşividir** — her biri canlıda uygulanmış değildir. Uygulama durumu Paket 1 kurtarma belgesi ve `CANLIYA_ALINMAMIS_KARARLAR` ile çapraz kontrol edilmeli.

### 15.3 Haziran 22 CRM paketleri (gerçek uygulama kanıtı)

| Paket | Konu |
|-------|------|
| `CRM_ILISKI_YONETIMI_MVP1_UYGULAMA_01` | `/panel/crm` bağımsız hub (4 kart) — d266’daki mevcut sayfa |
| `CRM_UX_SON_TEMIZLIK_01` | Canlıdan teknik/audit metinlerini temizleme |
| `CRM_UX_GERI_KAZANIM_01` | CRM UX geri kazanım |

---

## 16. CRM Ekranı Teşhisi (Mustafa screenshot — 25 Haziran)

### Ekranda görünen

- Üst menü: **Operasyon Paneli, Operasyon, Pilot Notları…** → **canlı / eski kabuk** (d278 sol menü değil)
- Mavi kutu: **“MVP-1 yerel önizleme: kalıcı CRM backend bağlantısı bu paketin dışında tutuldu.”**
- İstatistik kartları: Portal Aktif **0**, Görüşme Gerekiyor **0**…
- Ortada: **“CRM altyapısı hazırlanıyor”** placeholder

### Kaynak kod

Bu ekran **Projects/canlı** sürümündeki `ExpertCrmList` bileşenidir:

```text
Projects/sigorta-hasar-sistemi/apps/web/src/app/panel/eksper-crm/_components/ExpertCrmList.tsx
Projects/.../eksper-crm/_data.ts → EXPERT_CRM_RECORDS = []  (bilerek boş)
```

Canlıda kayıt olmadığı için liste yerine **empty state** gösteriliyor. Bu “eski basit sayfa” regresyonu değil — **bilinçli MVP-1 boş durum**.

### d266 yerel sürüm farkı

d266 diskte **farklı** CRM var — 4 kartlı **İlişki Yönetimi Merkezi** hub:

```text
d266/apps/web/src/app/panel/crm/page.tsx → Müşteri / Tedarikçi / Sigorta / Temas kartları
```

Kaynak: `CRM_ILISKI_YONETIMI_MVP1_UYGULAMA_01` (24 Haziran).

### Mustafa’nın beklediği “zengin CRM”

Tam ilişki listesi, filtreler, portal sinyalleri, eksper detay — `ExpertCrmList` **kodda var** ama:

1. Canlıda `EXPERT_CRM_RECORDS` boş → placeholder
2. Backend CRM API henüz bağlı değil (MVP-1 banner)
3. d266’ya `ExpertCrmList` henüz kopyalanmadı — sadece hub kartları var

### CRM kurtarma önceliği (onay sonrası)

| Adım | İş |
|------|-----|
| 1 | `Projects/.../eksper-crm/` → d266 `/panel/crm` (ExpertCrmList) |
| 2 | MVP-1 banner metnini kullanıcı diline çevir veya kaldır |
| 3 | Backend ilişki API bağlantısı (ayrı paket) |
| 4 | Canlı deploy + Mustafa ekran kabulü |

---

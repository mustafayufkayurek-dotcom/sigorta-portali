# Devir Paketi — Tedarikçi Hakediş UI/UX

**Tarih:** 2026-08-29  
**Sohbet / ajan:** [Tedarikçi hakediş ekranları](https://cursor.com/agents/bc-01a04d20-e064-7a0a-a51c-a80baca15c76) (`bc-01a04d20-e064-7a0a-a51c-a80baca15c76`)  
**Ürün sahibi:** Mustafa  
**Amaç:** Bu sohbeti kapatan / devam eden ajana veya insana bağlam, kod, doğrulama ve açık kararları tek yerden aktarmak.

---

## 1. Ne istendi

Hasar dosyası **Finans → Gider & Bütçe** içindeki **Tedarikçi Hakediş** UI/UX revizyonu:

1. **Avans:** “Avans Nedeni” dropdown kalkacak; zorunlu serbest metin **Açıklama**; çift TL yok; özet kartlar.
2. **Hakediş İşlemleri:** Sözleşme / Toplam / Ödenen / Kalan kartları; gerçekleşme %; tablo (No, Dönem, Tutar, Kesintiler, Net, Durum, İşlem); “Hakediş Oluştur”; oluşturmada otomatik finansal özet; durum akışı (Taslak → Kontrol → Onay → Ödeme → Tamamlandı — mevcut domain status map).
3. **Ödeme Planı:** Planlanan / Bu Ay / Ödenen / Yaklaşan kartları + tablo.
4. Backend, veri modeli, routing ve çalışan API bozulmayacak; production’da mock/hardcoded veri yok; Meridyen Title Case (`uppercase` CSS yok).

**Gösterim tercihi (kullanıcı netleştirmesi):**
- Sahte `/dev` mock kart sayfası **istenmiyor**.
- Ekran görüntüsü/video yetmez; **birebir lokal panel dosya sayfası** isteniyor.
- Cloud Agent `localhost` kullanıcı makinesinden erişilemez; port forward veya geçici tunnel gerekir.

---

## 2. Branch / PR / taban

| Alan | Değer |
|------|--------|
| Feature branch | `cursor/tedarikci-hakedis-ui-5c76` |
| PR | https://github.com/mustafayufkayurek-dotcom/sigorta-portali/pull/12 |
| PR base | `cursor/cloud-agent-1787996961671-o9ger` |
| Tercih edilen safety base | `safety/post-v164-operasyon-finans-20260703` — **bu tabanda hakediş UI yoktu**; bu yüzden feature, mevcut hakediş tasarımının olduğu cloud-agent branch’ten açıldı |
| Son commit (devir anı) | `0d4fdadd` — `/dev` kısayolu birebir panel sayfasına yönlendirir |

**Önemli:** Safety base’e merge stratejisi **onay bekliyor**. Kör rebase / force push yok.

---

## 3. Değişen dosyalar (ürün kodu)

Tek mantıksal değişiklik seti:

1. `apps/web/src/components/finance/HasarFileHakedisPanel.tsx`  
   - Ana UI: çekmece sekmeleri, özet kartlar (`FinanceSummaryCard`), stepper (`StatusStepper`), avans formu (`avansAciklama` + `withAvansNote`), hakediş tablosu / “Hakediş Oluştur”, ödeme planı.
2. `apps/web/src/utils/hasar-hakedis-ozet.ts`  
   - `buildHakedisAkis` (+ Tamamlandı), `hakedisDonemEtiket`, `hakedisKesintiNet`, `hakedisGerceklesmeOrani`, `buildOdemePlani` (planlanan / buAy / yaklasan), durum etiketleri.
3. `apps/web/src/utils/hasar-hakedis-ozet.lock.spec.ts`  
   - Ozet helper kilit testleri.
4. `apps/web/src/app/dev/tedarikci-hakedis-ui/page.tsx`  
   - **Ürün UI değil.** Dev-only kısayol: oturum hazırlayıp  
     `/panel/hasar-dosyalari/<DEMO_CLAIM>?grup=finans&alt=gider-butce`  
     adresine `router.replace`. Production’da `notFound()`.

**Dokunulmayan (bilinçli):** backend API, Prisma şema, auth, Docker/CI, routing isimleri, `FileMasrafIsleme` wire (panel zaten buradan mount).

Bağlantı noktası: `FileMasrafIsleme` → `HasarFileHakedisPanel` (Hasar dosyası Finans → Gider & Bütçe).

---

## 4. Davranış özeti (kod gerçeği)

### Avans
- `avansNeden` UI alanı yok.
- Zorunlu `avansAciklama`; kayıtta `withAvansNote(...)`.
- Kartlar: Toplam Avans / Kullanılan / Kalan Avans Hakkı.
- Para gösterimi: `₺` önek (kartlarda çift `TL` yok). `TrAmountInput` içinde hâlâ birim `TL` suffix olabilir — hizalama açık konu.

### Hakediş
- Kartlar: Sözleşme / Toplam Hakediş / Ödenen / Kalan.
- `hakedisGerceklesmeOrani` + progress.
- Tablo kolonları brief’e uygun; “Hakediş Oluştur”; detayda `StatusStepper` + `buildHakedisAkis`.

### Ödeme Planı
- Kartlar: Planlanan / Bu Ay / Ödenen / Yaklaşan.
- Pending → UI’da “Planlandı”; ödenen yeşil “Ödendi”.

### Title Case
- Kart etiketlerinde CSS `uppercase` kaldırıldı.

---

## 5. Lokal doğrulama (Cloud VM / dev)

Bu ajan VM’sinde (ephemeral) kurulmuştu: Postgres 16 + Redis (apt; Docker yok), `prisma db push` (migrate mid-way sorunlu olabiliyordu), seed + demo claim.

| Öğe | Değer |
|-----|--------|
| Web | `http://localhost:3001` (`next dev -p 3001`) |
| API | `http://localhost:3000` |
| Web env | `apps/web/.env.local` → `NEXT_PUBLIC_API_URL=/api/v1` (Next proxy; CORS için `127.0.0.1` vs `localhost` karıştırmayın) |
| Demo dosya | `PLT-2026-001` |
| Claim id | `9fc6fa76-e290-49cc-b3fa-4b8e93e37142` |
| Panel URL | `/panel/hasar-dosyalari/9fc6fa76-e290-49cc-b3fa-4b8e93e37142?grup=finans&alt=gider-butce` |
| Dev kısayol | `/dev/tedarikci-hakedis-ui` → yukarıdaki panele redirect |
| Seed admin | `apps/backend/prisma/seed.ts` — `admin@meridyenassistance.com` (şifre seed logunda) |

**Auth otomasyon notları:**
- `sessionStorage.authSession = 'active'` + remember-me / `storeAuthAfterLogin`.
- Refresh token unique constraint: aynı saniyede çift login JWT çakışması → retry / token temizliği gerekebilir.
- Kullanıcıya gösterim: **birebir panel sayfası**; `/dev` içinde gömülü sahte kart yok.

**Erişim:** Agent `localhost` dışarıdan kapalı. Cursor Agents Window port forward (3001) veya geçici `cloudflared` tunnel kullanıldı; tunnel URL’leri kalıcı değildir.

---

## 6. Test durumu

- `hasar-hakedis-ozet` + avans lock spec’leri bu sohbette geçti (shared build sonrası).
- Manuel / puppeteer: gerçek claim üzerinde Avans / Hakediş / Ödeme sekmeleri DB verisiyle doğrulandı.
- Artifact örnekleri (ajan VM): `/opt/cursor/artifacts/panel_gider_butce.png`, `panel_hakedis_drawer.png`, önceki `local_*` / `demo_*` görüntüleri.

---

## 7. Açık kararlar / riskler (Mustafa onayı)

1. **UI kabul:** Tasarım “sayfa” brief’i vs mevcut **çekmece + sekme** — ürün onayı net değil.
2. **Merge hedefi:** PR base cloud-agent branch; `safety/post-v164-...` ile birleştirme stratejisi belirsiz.
3. **TrAmountInput `TL` suffix** vs kartlarda `₺` — tutarlılık isteğe bağlı ince ayar.
4. **`/dev` kısayol:** Yalnızca local preview; production’da kapalı. Kalıcı mı / silinsin mi?
5. **Deploy:** Bu sohbette production deploy yok. Canlıya alma için `deploy-guvenlik.mdc` protokolü + onay şart.
6. Backend login’de refresh token unique race (aynı saniye) — ürün dışı lokal rahatsızlık; auth refactor **onaysız yapılmasın**.

---

## 8. Kırmızı çizgi hatırlatması (devralan için)

- Migration / schema / auth / package / Docker / CI değişikliği yok.
- Refactor veya dosya taşıma yok.
- Layout / global nav değişikliği yok.
- Mock production data yok.
- Belirsizlikte dur, Mustafa’ya sor.

---

## 9. Sıradaki ajan için kısa checklist

- [ ] Branch `cursor/tedarikci-hakedis-ui-5c76` checkout / PR #12 oku
- [ ] `HasarFileHakedisPanel` + `hasar-hakedis-ozet` diff’ini incele
- [ ] Lokal web+api ayağa kaldır; demo claim panel URL’sinde Avans / Hakediş / Ödeme doğrula
- [ ] Kullanıcı “lokal göster” derse: **panel dosya sayfası** aç; `/dev` mock kart üretme
- [ ] Yeni UI isteği veya safety-base merge → önce onay
- [ ] Deploy talebi → güvenlik protokolü; bu PR’ı tek başına “canlıya al” sayma

---

## 10. Tek cümlelik durum

Tedarikçi Hakediş UI revizyonu feature branch + PR #12’de; gerçek panel bileşeni ve ozet helper’lar güncel; lokal doğrulama yapıldı; production deploy ve safety-base merge **bekliyor**; kullanıcı gösterimi birebir **hasar dosyası Finans → Gider & Bütçe** sayfası üzerinden isteniyor.

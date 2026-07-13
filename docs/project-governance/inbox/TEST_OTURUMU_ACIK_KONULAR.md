# Test Oturumu — Açık / Netleşmeyen Konular

> Mustafa seri test notları akışında. Başka ekrana geçmeden önce bu listeden ilgili maddeyi kapat veya karar ver.

---

## P1-DASH — Dashboard P1 paket kapanış (13 Temmuz 2026)

**Durum:** ✅ Implementasyon KAPANDI · ⏳ Mustafa canlı PASS  
**Canlı:** Web **v348** + Backend **v348** (`v348-dashboard-faz6-admin-a3a4`)  
**Rollback:** Web **v346** / Backend **v342**  
**v349:** Yok (A5 zaten `AdminBottomRow`)

### Roller — ne test edilir?

| Rol | Route | Beklenen |
|-----|-------|----------|
| **Admin / manager** | `/panel` | Operasyon Yönetim Merkezi; Finans + Operasyon KPI; Haftalık Performans (bar + personel yük); Günün Akışı + Gider; alt 3’lü (Kritik / Finans / Personel Yük); sağ kılavuz |
| **Dosya sorumlusu (D0)** | `/panel` | Dosya Sorumlusu Merkezi; finans/admin yok; Operasyon + Akış + Onay Gecikmesi + alt 3’lü |
| **Saha (F0)** | `/panel` | Saha Operasyon Merkezi; Saha Özeti 6 KPI; finans/onay yok; alt 3’lü SLA/Bekleyen/Açık |

### Bilinen gap (engelleyici değil)

- S7 menü gruplama (5 grup) — backlog / ayrı karar
- Pixel-perfect mockup (eski lacivert sidebar) — P1 talimat dili yeterli
- Login smoke FAIL yerel credential yoksa beklenen

### Sonraki büyük iş

- **Büyük paket** (PayTR canlı / envanter B7) — **bu turda başlatılmadı**
- Önce: Mustafa’nın admin / D0 / saha screenshot PASS’leri

### Referans

- `canli-kabul/P1_SIDEBAR_DASHBOARD_KABUL_KRITERLERI.md`
- `DEPLOY_GECMISI.md` (v344–v348 + kapanış notu)
- `ONAYLI_UI_CHECKLIST.md`

---

## AK-001 — Müşteri / Tedarikçi Kart Notları (Numaralı + Görünürlük)

**Tarih:** 2026-07-12 (teyit güncellemesi)  
**Kaynak:** Onarım raporu / fotoğraf testi sırasında Mustafa sorusu  
**Durum:** 🟡 Teyit bekliyor — implementasyon Mustafa onayı sonrası  
**Öncelik:** P1 (maliyet doğrudan etkileniyor)

> **2026-07-12 düzeltmesi:** Önceki «CRM + iş atama anında popup/banner» yorumu **yanlıştı**. Bu madde CRM modülüne dayanmaz; tedarikçi tarafında CRM notu anlamsızdır. Notlar müşteri/tedarikçi kartında kalır.

### Sorun
- Müşteri ve tedarikçi hakkında operasyonel tespitler («uygun maliyetli tedarikçi», «fazla iş yönlendiren», «avantajlı/dezavantajlı müşteri» vb.) **kart üzerinde yapılandırılmış biçimde tutulmuyor**.
- Mevcut tek alanlı / dağınık not yapısı **birden fazla numaralı not** ve **not başına görünürlük** desteklemiyor.
- Bilgi iş atama anında ayrı bir banner/popup ile değil; personelin **müşteri veya tedarikçi kartına baktığında** okunabilir olmalı.

### Mevcut sistem (doğrulandı)
| Parça | Var mı? | Nerede? | Eksik |
|-------|---------|---------|-------|
| Müşteri kayıt sihirbazı | ✅ | Adım 4 «İlişki Özeti» | Kayıt Notu alanı tek parça; numaralı not + görünürlük yok |
| Tedarikçi kayıt sihirbazı | ✅ | Adım 4 «İlişki Özeti» | Aynı — Kayıt Notu alanı genişletilmeli |
| Müşteri kartı (detay) | ✅ | Müşteri detay görünümü | Notlar kart üzerinde kalıcı gösterilmiyor / yapı eksik |
| Tedarikçi kartı (detay) | ✅ | Tedarikçi detay görünümü | Aynı |
| CRM modülü notları | ⚠️ | `/panel/crm` | **Bu özellik için kaynak değil** — özellikle tedarikçi tarafında anlamsız |

### Önerilen özellik (taslak — Mustafa teyidi gerekir)
**Ad:** Kart Notları — Numaralı Kayıt Notu + Kimler Görsün

1. **Konum:** Müşteri ve Tedarikçi sihirbazı **Adım 4 «İlişki Özeti»** içindeki **Kayıt Notu** alanı (ekran görüntülerindeki gibi).
2. **Kartta kalıcılık:** Girilen notlar ilgili **müşteri / tedarikçi kartının detay görünümünde** listelenir; ayrı CRM ekranına veya atama popup'ına taşınmaz.
3. **Numaralı notlar:** Birden fazla not — `1. Not`, `2. Not`, `3. Not` … sıralı liste.
4. **Görünürlük (zorunlu):** Her not satırında **«Kimler görsün»** seçici; kayıt sırasında ve düzenlemede zorunlu alan.
5. **Kapsam dışı (eski yanlış yorum):** İş atama / tedarikçi seçimi anında CRM kaynaklı sarı-kırmızı banner veya popup **yapılmayacak**.

### Mustafa'dan netleştirilecekler
- [ ] **«Kimler görsün» seçenek listesi** — önerilen adaylar (teyit gerekir):
  - Yalnızca yöneticiler
  - Operasyon personeli (genel)
  - Dosya sorumlusu
  - Sigorta şirketi personeli **görmesin** (müşteri notları için varsayılan?)
  - Diğer / rol bazlı (liste genişletilecek mi?)
- [ ] Not düzenleme / silme yetkisi kimde?
- [ ] Maksimum not sayısı veya karakter sınırı var mı?

### Test akışı etkisi
Bu madde **onarım raporu / fotoğraf testinden** ayrı bir ürün kararı. **Implementasyon, Mustafa'nın bu teyidi onaylamasına kadar bekletilir.** Teste devam ederken bu konuyu kodlamaya başlama.

---

*Son güncelleme: 2026-07-13 — P1 Dashboard kapanış notu eklendi; AK-001 teyit bekliyor*

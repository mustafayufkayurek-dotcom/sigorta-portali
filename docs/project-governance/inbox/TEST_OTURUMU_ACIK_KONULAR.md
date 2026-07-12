# Test Oturumu — Açık / Netleşmeyen Konular

> Mustafa seri test notları akışında. Başka ekrana geçmeden önce bu listeden ilgili maddeyi kapat veya karar ver.

---

## AK-001 — Operasyonel İstihbarat Yayını (Tedarikçi + Müşteri CRM Notları)

**Tarih:** 2026-07-12  
**Kaynak:** Onarım raporu / fotoğraf testi sırasında Mustafa sorusu  
**Durum:** 🟡 Karar bekliyor (KARAR_GEREKLI)  
**Öncelik:** P1 (maliyet doğrudan etkileniyor)

### Sorun
- CRM'de tedarikçi ve müşteri kartlarında notlar var; ancak **iş atama / tedarikçi seçimi anında** personele düşmüyor.
- İl/ilçede iş yaptırırken «uygun maliyetli tedarikçi», «fazla iş yönlendiren», «avantajlı/dezavantajlı müşteri» gibi tespitler **duyuru olarak yayınlanmıyor**.
- Tedarikçi önerisi (`/vendors/suggest`) var ama yalnızca **konum + iş sayısı + ortalama tutar** skorluyor; CRM görüş/not taşımıyor.

### Mevcut sistem (doğrulandı)
| Parça | Var mı? | Nerede? | Eksik |
|-------|---------|---------|-------|
| CRM notları | ✅ | `/panel/crm` | Sadece CRM ekranında; atama anında yok |
| Operasyon hafızası | ✅ | CRM `memory` API | Dosya/tedarikçi seçiminde gösterilmiyor |
| Tedarikçi önerisi | ✅ | `VendorSuggestPanel`, `GET /vendors/suggest` | Not/uyarı yok |
| Tedarikçi risk skoru | ✅ | CRM listesi, `VendorRiskScore` | Öneri panelinde yok |
| Müşteri kart notu | ✅ | `customer.notes` alanı | Bağlamsal uyarı yok |

### Önerilen özellik (taslak — Mustafa onayı gerekir)
**Ad:** Operasyonel İstihbarat / Karar Anı Uyarıları

1. CRM notuna **«İş atamada göster»** bayrağı + isteğe bağlı **il/ilçe kapsamı**
2. Not türleri genişlet: `Maliyet Avantajı`, `Maliyet Riski`, `İş Baskısı`, `Müşteri Davranışı`
3. **Tetikleme noktaları:**
   - Dosyada tedarikçi atama / `VendorSuggestPanel`
   - Acil yardım tedarikçi seçimi
   - Müşterili yeni dosya / müşteri seçimi
4. UI: Sarı/kırmızı kompakt banner — «Son operasyon notu: …» (tıkla → CRM)

### Mustafa'dan netleştirilecekler
- [ ] Notlar sadece yöneticiler mi görsün, yoksa tüm operasyon personeli mi?
- [ ] İl/ilçe kapsamı zorunlu mu, yoksa tedarikçi/müşteri bazlı yeterli mi?
- [ ] Eski notlar süre sınırı (ör. 6 ay) ile mi düşsün?
- [ ] Müşteri tarafında sigorta şirketi personeline görünür olmamalı — onay?

### Test akışı etkisi
Bu madde **onarım raporu / fotoğraf testinden** ayrı bir ürün kararı. Teste devam ederken bu konuyu implemente etme; önce yukarıdaki 4 soruyu netleştir.

---

*Son güncelleme: 2026-07-12 — Cursor oturumu*

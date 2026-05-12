# Operasyonel Hardening — Backlog Etiketlemeleri

Tarih: 2026-05-12

## Silent Catch / Fallback Workaround'lar

Aşağıdaki dosyalarda API hatası durumunda sessizce state boşaltan veya 0/null atan catch blokları bulunmaktadır. Bunlar geçici workaround olarak işaretlenmiştir.

| # | Dosya | Satır | Pattern | Risk |
|---|-------|-------|---------|------|
| 1 | `panel/acil-yardim/yeni/page.tsx` | 252 | `catch { setTcDupError(null); }` | Düşük — form validasyon |
| 2 | `panel/acil-yardim/yeni/page.tsx` | 265 | `catch { setPhoneDupError(null); }` | Düşük — form validasyon |
| 3 | `panel/acil-yardim/yeni/page.tsx` | 278 | `catch { setNameDupWarn(null); }` | Düşük — form validasyon |
| 4 | `panel/acil-yardim/yeni/page.tsx` | 294 | `catch { setFileNoError(null); }` | Düşük — form validasyon |
| 5 | `panel/tedarikciler/page.tsx` | 247 | `.catch(() => setVendor(null))` | Orta — detay veri kaybı |
| 6 | `panel/tedarikciler/page.tsx` | 767 | `.catch(() => { /* empty */ })` | Orta — listeleme veri kaybı |
| 7 | `panel/musteriler/[id]/page.tsx` | 31 | `catch { return null; }` | Düşük — SSR helper |
| 8 | `panel/musteriler/[id]/page.tsx` | 386 | `catch(e) { console.error(e); }` | Düşük — action error |
| 9 | `panel/musteriler/[id]/page.tsx` | 397 | `catch(e) { console.error(e); }` | Düşük — action error |
| 10 | `panel/musteriler/page.tsx` | 428 | `.catch(() => setCustomer(null))` | Orta — detay veri kaybı |
| 11 | `panel/musteriler/page.tsx` | 1243 | `.catch(() => { /* empty */ })` | Orta — listeleme veri kaybı |
| 12 | `panel/hasar-dosyalari/yeni/page.tsx` | 262 | `catch { setTcDupError(null); }` | Düşük — form validasyon |
| 13 | `panel/hasar-dosyalari/yeni/page.tsx` | 275 | `catch { setPhoneDupError(null); }` | Düşük — form validasyon |
| 14 | `panel/hasar-dosyalari/yeni/page.tsx` | 288 | `catch { setNameDupWarn(null); }` | Düşük — form validasyon |
| 15 | `panel/hasar-dosyalari/[id]/page.tsx` | 30 | `catch { return null; }` | Düşük — SSR helper |
| 16 | `panel/hasar-dosyalari/[id]/page.tsx` | 87 | `.catch(() => setData(null))` | Yüksek — dosya detay veri kaybı |
| 17 | `panel/hasar-dosyalari/[id]/page.tsx` | 139 | `.catch(() => setSuggestions([]))` | Orta — öneri veri kaybı |
| 18 | `panel/hasar-dosyalari/[id]/page.tsx` | 2339 | `.catch(() => setVendors([]))` | Orta — dropdown veri kaybı |
| 19 | `panel/hasar-dosyalari/[id]/page.tsx` | 2344 | `.catch(() => setUsers([]))` | Orta — dropdown veri kaybı |
| 20 | `panel/hasar-dosyalari/page.tsx` | 81 | `catch { return { officeStaffUserId: null, isFieldStaff: false }; }` | Düşük — auth helper |
| 21 | `panel/admin/audit-logs/page.tsx` | 62 | `.catch(() => setRows([]))` | Orta — log veri kaybı |
| 22 | `panel/ayarlar/e-posta-bildirimleri/page.tsx` | 88-89 | `.catch(() => null)` (2 adet) | Düşük — settings fallback |
| 23 | `panel/personel-yonetimi/page.tsx` | 454 | `catch { setSearchResults([]); }` | Orta — arama veri kaybı |
| 24 | `panel/layout.tsx` | 737 | `.catch(() => { setPendingRevisionCount(0); })` | Düşük — badge fallback |

## Diğer Workaround'lar

| Dosya | Satır | Açıklama |
|-------|-------|----------|
| `panel/hasar-dosyalari/[id]/page.tsx` | 25 | `// JWT payload fallback` |
| `panel/hasar-dosyalari/[id]/page.tsx` | 3764 | `// fallback: load all vendors` |
| `panel/ayarlar/kurulum/page.tsx` | 1052 | `// localStorage'dan oku fallback` |
| `panel/ayarlar/kurulum/page.tsx` | 1059 | `// localStorage fallback on error` |

## Önerilen Aksiyon

1. **Yüksek risk** (#16): `hasar-dosyalari/[id]/page.tsx:87` — dosya detay verisi kaybolursa kullanıcı boş sayfa görür. Error boundary + retry eklenebilir.
2. **Orta risk** (#5-6, #10-11, #17-19, #21, #23): Listeleme/dropdown veri kaybı — toast notification + retry butonu eklenebilir.
3. **Düşük risk** (#1-4, #12-14, #20, #22, #24): Form validasyon, auth helper, badge — mevcut davranış kabul edilebilir.
4. **4012 satır dosya** (`hasar-dosyalari/[id]/page.tsx`): Faz 3'te refactor edilecek (ertelendi).

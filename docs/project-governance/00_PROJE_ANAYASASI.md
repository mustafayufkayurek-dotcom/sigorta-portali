# Meridyen — Proje Anayasası

**Bu dosya en üst referans belgedir.**  
ChatGPT, Cursor ve Codex oturumlarında **ilk okunan** belgedir.

**Konum:** `docs/project-governance/00_PROJE_ANAYASASI.md`  
Son güncelleme: 2026-06-24  
Onay: Mustafa — 10/10

---

## ALTIN KURAL

**Hiçbir yeni geliştirme, daha önce kabul edilmiş ürün kararını bozamaz.**

Şüphe oluşursa:

1. Geliştirme **durur**.
2. Referans karar **bulunur**.
3. Karar **doğrulanır**.
4. Sonra geliştirmeye **devam edilir**.

**Karar değişecekse:** önce regresyon kanıtı + kök neden + Mustafa onayı + yeni karar kaydı → **sonra** kod değişir.  
Kod değişti diye karar değişmez. (Son 72 saatin dersi.)

---

## ÇALIŞMA YASASI

**Ürün kararı > Kod**

Kabul edilmiş ürün davranışı, mevcut koddan **daha üst önceliğe** sahiptir.

Kod ile ürün kararı çelişirse:

1. Kod doğru kabul edilmez.
2. Önce referans karar bulunur.
3. Karar doğrulanır.
4. Kod karar ile hizalanır.

**"Çalışıyor" ifadesi tek başına kabul kriteri değildir.**

Kabul kriteri — **dördünün birlikte** sağlanmasıdır:

| # | Kriter |
|---|--------|
| 1 | Kod |
| 2 | Canlı davranış |
| 3 | Screenshot |
| 4 | Mustafa onayı |

---

## Temel maddeler

1. **Ürün kararları koddan üstündür.** Kod, kabul edilmiş ürün kararına aykırı olamaz.

2. **Kabul edilmiş davranış bozulamaz.** Canlıda onaylanmış ekran, akış veya kural regresyon sayılır.

3. **Kod PASS ≠ Build PASS ≠ Deploy PASS ≠ Canlı PASS ≠ Ürün Kabulü.** Her aşama ayrı kaydedilir ve karıştırılmaz.

4. **Ürün kararı ile uygulama kararı aynı belgede tutulmaz.**  
   - Paket 1 = kriz kurtarma + uygulama + kanıt  
   - Paket 2 = ürün + karar + regresyon hafızası  
   - Paket 3 = yeni oturumlara aktarım anayasası

5. **Regresyon varsa önce kök neden bulunur.** Aynı strateji sınırsız tekrar edilmez.

6. **Kanıt yoksa "BİLİNMİYOR" denir; tahmin yapılmaz.** Tahmin gerekiyorsa **TAHMİN** etiketi zorunludur.

7. **Değiştirilemez ürün kararları tartışılamaz.** Teknik ekip uygulama gerekçesiyle ürün anayasasını değiştiremez.

8. **Codex ürün kararı vermez; uygulama ve kanıt üretir.** Ürün kararı Mustafa + ChatGPT katmanındadır.

9. **Mustafa kabul etmeden ürün kabulü verilmez.** Kabul = Kod + Canlı davranış + Screenshot + Mustafa onayı (dördü birlikte). "Çalışıyor" tek başına yeterli değildir.

10. **Paketler sırayla ilerler; onaysız geçiş yapılmaz.**  
    - Paket 1 tamamlanmadan Paket 2'ye geçilmez.  
    - Paket 2 tamamlanmadan Paket 3'e geçilmez.  
    - Her paket Mustafa tarafından onaylandıktan sonra bir sonraki pakete geçilir.

11. **Eski veya iptal edilmiş kararlara geri dönülmez.** Karar değişiklik günlüğünde geçersiz kılınan karar tekrar uygulanmaz.

12. **Tüm geliştirmeler bu anayasa ile uyumlu olmak zorundadır.**

13. **Paket belgeleri versiyonlanır; üzerine yazılmaz.** Donmuş sürüme yeni bölüm eklenmez.  
    - **v1** → Donmuş (değişmez)  
    - **v1.1** → Yazım / küçük iyileştirme  
    - **v1.2** → Yeni kanıt  
    - **v2** → Metodoloji gerçekten değişirse  
    Eski sürüm arşivlenir, silinmez.

---

## Resmi referans seti (bu klasör)

Yeni oturumda sırayla oku:

| Sıra | Dosya | Rol |
|------|-------|-----|
| 1 | `00_PROJE_ANAYASASI.md` | En üst referans |
| 2 | `00_CALISMA_YASASI.md` | Ürün kararı > Kod |
| 3 | `01_MERIDYEN_21_22_23_HAZIRAN_KURTARMA_PAKETI_v1.md` | Kriz kaydı |
| 4 | `02_MERIDYEN_STRATEJIK_KARAR_ENVANTERI_v1.md` | Stratejik hafıza |
| 5 | `03_MERIDYEN_CURSOR_CODEX_AKTARIM_PAKETI_v1.md` | Oturum aktarımı |

**Protokol metodolojisi (donmuş v1):** proje kökünde `01_KRIZ_KURTARMA_PROTOKOLU.md`

**Talimatlar / üretim:** `docs/meridyen-paketler/talimatlar/`

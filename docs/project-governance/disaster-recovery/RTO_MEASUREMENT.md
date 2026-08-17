# RTO Ölçümü — Meridyen

**Amaç:** Tahmin yok. Kronometre.  
**Ne zaman doldurulur:** `RECOVERY_DRILL_PLAN.md` tatbikatı.  
**Bu faz:** Şablon hazır; hücreler boş = henüz ölçülmedi.

RTO tanımı: T0 (yeni VPS SSH) → ilk başarılı login (T9).  
RPO ayrı: `RPO_RTO_TEST_PLAN.md`. Hedef RPO &lt; 24s; RTO hedefi ürün kararı (sayı yok).

Canlı production bu tabloyu doldurmak için **kullanılmaz**.

---

## Kronometre kuralları

- Her satır **gerçek bitiş − gerçek başlangıç** (dakika, tam sayı).  
- Bekleme (secret kasa, DNS panel, insan) ayrı satır: “Blokaj”.  
- Paralel işler (ör. build ile indirme) hem kendi satırına hem “paralel kazanç” notuna.  
- Başarısız deneme süreye dahildir (gerçek hayatı yansıtır).

T0 = `date -Iseconds` ilk SSH.

---

## Ölçüm tablosu (tatbikatta doldur)

| İşlem | Başlangıç | Bitiş | Süre (dk) | Not |
|--------|-----------|--------|-----------|-----|
| VPS hazırlama (panel + SSH) | | | | |
| Docker kurulum | | | | Compose v2 dahil |
| Source checkout | | | | Tag `04d52b8` doğrula |
| B2 erişimi + dump/tar indir | | | | rclone; secret blokajı ayrı |
| DB restore | | | | postgres 16 + psql |
| Upload restore | | | | tar + integrity |
| Build | | | | web v505 + backend v501 |
| DNS | | | | Tatbikatta hosts ise “N/A — canlı DNS yok” |
| SSL | | | | Tatbikatta self-signed/hosts ise not düş |
| İlk login | | | | Operatör; Cursor prod login yok |
| **RTO (T0 → login)** | T0 | | **___** | |

Blokaj (kasasız B2, yanlış branch, 502 / `-p` unutuldu): süre + neden. Secret değer yok.

---

## Sonuç kutusu

```
Tatbikat tarihi:
T0:
RTO_dakika:
RPO_saat (lastSuccessAt → T0):
Hedef RPO < 24s: PASS / FAIL / ölçülmedi
Login: PASS / FAIL
Backup.sh yerel: PASS / FAIL
Canlı VPS değişti: HAYIR (beklenen)
Canlı B2 yazıldı: HAYIR (beklenen)
Mustafa kararı (RTO kabul / tekrar):
```

İlk doldurulmuş tablo = “gerçek RTO”. Boş şablon RTO iddiası taşımaz.

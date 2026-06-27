# Meridyen — Proje Yönetişimi

**Kanonik referans klasörü.** Yeni oturum buradan başlar.

---

## Mustafa ne yapar?

| Yapar | Yapmaz |
|-------|--------|
| **"onayla"** veya **"devam"** der | Dosya kaydetmez |
| **"hayır"** / düzeltme ister | Sohbete metin yapıştırmaz |
| İsteğe bağlı: ChatGPT'ye talimat dosyasını sürükler | Kopyala-yapıştır, klasör taşıma, git |

**Tüm teknik iş:** Cursor agent (kaydetme, derleme, doğrulama, senkron).

---

## Okuma sırası

| # | Dosya | Durum |
|---|-------|--------|
| 1 | `00_PROJE_ANAYASASI.md` | ✅ |
| 2 | `00_CALISMA_YASASI.md` | ✅ |
| 3 | `01_MERIDYEN_21_22_23_HAZIRAN_KURTARMA_PAKETI_v1.md` | ⏳ Mustafa onayı bekliyor |
| 4 | `02_MERIDYEN_STRATEJIK_KARAR_ENVANTERI_v1.md` | Paket 1 onayı sonrası |
| 5 | `03_MERIDYEN_CURSOR_CODEX_AKTARIM_PAKETI_v1.md` | Paket 2 onayı sonrası |

**Protokol (donmuş v1):** `../../01_KRIZ_KURTARMA_PROTOKOLU.md`

---

## Agent iş akışı

1. Codex kanıt dosyalarını okur → paket belgesini derler → `docs/project-governance/` ve `docs/meridyen-paketler/ciktilar/` senkronlar  
2. Mustafa'ya **özet + onay** sorar  
3. Onay sonrası bir sonraki pakete geçer  

ChatGPT kullanılırsa: agent talimatı gönderir veya Mustafa sürükler; çıktı varsa agent `inbox/` klasöründen alır — Mustafa yapıştırmaz.

**Inbox (opsiyonel):** `docs/project-governance/inbox/` — dışarıdan gelen `.md` dosyaları agent okur.

---

## Revizyon kuralı

| Sürüm | Ne zaman? |
|-------|-----------|
| v1 | Donmuş |
| v1.1 | Yazım / küçük iyileştirme |
| v1.2 | Yeni kanıt |
| v2 | Metodoloji değişirse |

---

## Talimatlar (agent kullanır)

`docs/meridyen-paketler/talimatlar/`

# Operasyon Gelen Kutusu — Uygulama Planı

Tarih: 2026-06-29  
Durum: F1–F4 canlı + **F5 uygulandı** (2026-06-30)

## Hedef

Microsoft 365 paylaşımlı kutularından (`ihbar@safranbh.com`, `hasar@safranbh.com`) gelen mailleri okuyup AI ile sınıflandırmak; yeni hasar/acil ihbarları aksiyon kartlarıyla dosya sorumlusuna talimat akışıyla açmak; dosya yazışmalarını ilgili dosyaya bağlamak; **REPLY_ONLY** mesajlara paylaşımlı kutudan yanıt göndermek.

## Faz kararı

| Faz | Kapsam | Durum |
|-----|--------|-------|
| F1-çekirdek | Schema, modül, Bull kuyruk, Graph delta, M365 ayar | ✅ |
| F2 | AI sınıflandırma, ihbar kartları, talimatlı dosya açma, proaktif UI | ✅ |
| F3 | Otomatik dosya eşleştirme, E-posta Yazışmaları sekmesi, Graph webhook | ✅ |
| F4 | E-postadan yanıt gönderme (`REPLY_ONLY`) | ✅ |
| F5 | Akıllı yönlendirme, sahiplenme, müşteri çözümleme, bildirim | ✅ |

## Paylaşımlı kutular

| Enum | Adres |
|------|-------|
| `IHBAR` | ihbar@safranbh.com |
| `HASAR` | hasar@safranbh.com |

## Azure IT checklist

1. Azure AD uygulama kaydı (single tenant)
2. Application permission: `Mail.Read`
3. Application permission: `Mail.Send` *(F4 — gelen kutusundan yanıt)*
4. Admin consent (her iki izin için)
5. Client secret (rotation takvimi)
6. Shared mailbox erişimi: ihbar@, hasar@
7. Webhook URL (canlı): `https://app.meridyen-tr.com/api/v1/operation-inbox/webhooks/graph`
8. İsteğe bağlı: `GRAPH_WEBHOOK_CLIENT_STATE` env (yoksa tenant+secret hash)
9. Lokal test: ngrok → `GRAPH_WEBHOOK_URL=https://xxx.ngrok-free.app/api/v1/operation-inbox/webhooks/graph`

### Mail.Send ekleme (Azure Portal)

1. Azure Portal → **Uygulama kayıtları** → ilgili uygulama
2. **API izinleri** → **İzin ekle** → **Microsoft Graph** → **Uygulama izinleri**
3. `Mail.Send` seç → **İzin ekle**
4. **Yönetici onayı ver** (Grant admin consent)
5. Birkaç dakika bekleyin; Ayarlar → Entegrasyonlar → **Bağlantıyı Test Et** (Mail.Read doğrulanır; Mail.Send ilk yanıt denemesinde doğrulanır)

## Implementasyon durumu

1. ✅ Prisma migration (`inbound_messages`, `graph_subscriptions`)
2. ✅ `operation-inbox` modül + Bull kuyrukları
3. ✅ Graph delta poll + ingest + classify
4. ✅ REST: open-claim-file, open-emergency-file, assign, archive, sync
5. ✅ Frontend `/panel/operasyon/gelen-kutusu`
6. ✅ Ayarlar → Entegrasyonlar → Microsoft 365
7. ✅ **F3:** Otomatik dosya eşleştirme (`InboundFileMatcherService`)
8. ✅ **F3:** Manuel bağlama (`link-claim-file`, `link-emergency-file`)
9. ✅ **F3:** Dosya detay → İletişim → E-posta Yazışmaları
10. ✅ **F3:** Graph webhook + abonelik yenileme
11. ✅ **F4:** Graph `reply` / `replyAll` — paylaşımlı kutudan yanıt (`GraphMailSendService`)
12. ✅ **F4:** REST `POST .../messages/:id/reply` + gelen kutusu / dosya sekmesi **Yanıtla** UI

## Otomatik eşleştirme (F3)

Sınıflandırma sonrası `attemptAutoLink` çalışır (yazışma tipleri veya `LINK_EXISTING` önerisi):

| Sinyal | Skor | Sonuç |
|--------|------|-------|
| `fileNo` tam eşleşme (ClaimFile / EmergencyCase) | 100 | Otomatik bağla → `ACTIONED` |
| `claimNo` eşleşmesi | 95 | Otomatik (tek aday + yüksek skor farkı) |
| `policyNo` eşleşmesi | 88 / 75 | Tek aday → otomatik; çoklu → manuel |
| Aynı `conversationId` ile bağlı mesaj | 85 | Otomatik (tek aday) |
| Konu/gövde HK-/AYF- dosya no kalıbı | 80+ | Regex ile fileNo çıkarımı |
| Plaka metin eşleşmesi (description) | 72 | Belirsiz → `LINK_EXISTING` |

**Yüksek güven:** skor ≥ 90 ve ikinci adaydan ≥ 15 puan fark → otomatik bağlanır.  
**Belirsiz:** `CLASSIFIED` + `suggestedAction: LINK_EXISTING` → UI'da **Dosyaya Bağla**.

## API

| Method | Path | Yetki |
|--------|------|-------|
| GET | `/operation-inbox/messages` | `operation_inbox.view` |
| GET | `/operation-inbox/messages/by-claim/:claimFileId` | `operation_inbox.view` |
| GET | `/operation-inbox/messages/by-emergency/:emergencyCaseId` | `operation_inbox.view` |
| GET | `/operation-inbox/messages/:id` | `operation_inbox.view` |
| GET | `/operation-inbox/stats` | `operation_inbox.view` — `pending`, `unownedCount`, `escalatedCount` |
| GET | `/operation-inbox/messages/:id/routing-suggestion` | `operation_inbox.view` |
| POST | `/operation-inbox/messages/:id/open-claim-file` | `operation_inbox.manage` |
| POST | `/operation-inbox/messages/:id/open-emergency-file` | `operation_inbox.manage` |
| POST | `/operation-inbox/messages/:id/link-claim-file` `{ claimFileId }` | `operation_inbox.manage` |
| POST | `/operation-inbox/messages/:id/link-emergency-file` `{ emergencyCaseId }` | `operation_inbox.manage` |
| POST | `/operation-inbox/messages/:id/assign` | `operation_inbox.manage` |
| POST | `/operation-inbox/messages/:id/archive` | `operation_inbox.manage` |
| POST | `/operation-inbox/messages/:id/reply` `{ body, replyAll? }` | `operation_inbox.manage` |
| GET | `/operation-inbox/messages/:id/match-candidates` | `operation_inbox.view` |
| POST | `/operation-inbox/compose` `{ mailbox, to[], subject, body, claimFileId?, emergencyCaseId? }` | `operation_inbox.manage` |
| POST | `/operation-inbox/sync` | `operation_inbox.settings` |
| POST/GET | `/operation-inbox/webhooks/graph` | Public (Graph validation) |

## Graph webhook

- `graph_subscriptions`: delta-poll kayıtları (`delta-poll-*`) ayrı; webhook abonelikleri Graph UUID ile saklanır.
- Abonelik oluşturma: M365 `active=true` kayıt, bağlantı testi, modül init (15 sn), günlük cron (06:00).
- Bildirim gelince → `triggerSync()` (delta poll, 10 dk beklemeden).
- `clientState`: `GRAPH_WEBHOOK_CLIENT_STATE` veya tenant+secret SHA256.

### Lokal webhook testi (ngrok)

```bash
# 1. Backend çalışır durumda (port 3000)
ngrok http 3000

# 2. .env veya ortam değişkeni
export GRAPH_WEBHOOK_URL=https://YOUR-ID.ngrok-free.app/api/v1/operation-inbox/webhooks/graph
export APP_URL=https://YOUR-ID.ngrok-free.app

# 3. Ayarlar → Microsoft 365 → Etkin + Bağlantı Testi (abonelik oluşturur)
# 4. Paylaşımlı kutuya test maili gönder → webhook → sync job logları
```

## Yetkiler

- `operation_inbox.view`
- `operation_inbox.manage`
- `operation_inbox.settings`

## Deploy notu

**full deploy** — backend + web (F4: yeni migration yok; `status` + `processedAt` güncellenir).  
Rollback: webhook abonelikleri Graph'ta manuel silinebilir; `inbound_*` verisi korunur.

## F4 — E-posta yanıtı

- Graph: `POST /users/{mailbox}/messages/{graphMessageId}/reply` veya `replyAll`
- Gönderen: mesajın `mailbox` alanına göre ihbar@ veya hasar@
- Başarı: `status → ACTIONED`, `processedAt` güncellenir; ayrı `outbound_replies` tablosu yok
- UI: Gelen kutusu kartları + dosya **E-posta Yazışmaları** sekmesi → **Yanıtla** modal
- Mail.Send eksikse: Türkçe hata + Azure admin yönlendirmesi

## F5 — Akıllı Yönlendirme, Sahiplenme ve Bildirim

Sınıflandırma + otomatik bağlama sonrası `InboundRoutingService` çalışır; sonuç `aiExtractedJson.routing` içinde saklanır (migration yok).

### Routing alanları (`aiExtractedJson.routing`)

| Alan | Açıklama |
|------|----------|
| `suggestedAssigneeId` / `suggestedAssigneeName` | Dosya sorumluluğu veya bölge eşleşmesi |
| `suggestedAssigneeRole` | `office` → ofis, `field` → saha |
| `customerMatch` | `{ status: found\|ambiguous\|not_found, customer?, candidates? }` |
| `warnings[]` | Kapsam/bölge uyarıları (UI badge) |
| `confidence`, `reasons[]` | Skor ve gerekçeler |
| `escalated`, `escalatedAt` | Yöneticiye iletildi mi |

### Sorumlu çözümleme sırası

1. `ClaimResponsibilitiesService.findResponsibleUser` (departman + il/ilçe)
2. `UserInsuranceCompanyScope` filtresi (poliçe kaydından sigorta şirketi biliniyorsa)
3. Fallback: `ClaimFilesService.suggestAssigneesByRegion(city, district)`

### Sahipsiz / escalation

- **Sahipsiz:** `CLASSIFIED` + `assignedUserId` null + `OPEN_HASAR_FILE` / `OPEN_ACIL_FILE`
- **Escalation:** Yüksek aciliyet (`urgency: HIGH`) **veya** routing sonrası sorumlu bulunamadı → `admin` + `manager` rolüne in-app (+ e-posta tercihine göre)
- **Atama sonrası:** Atanan kullanıcıya `inbox_assigned`
- **Dosya açma sonrası:** Atanan kullanıcıya `inbox_new_ihbar` (+ mevcut hasar dosyası bildirimleri)

### Müşteri — dosya açarken

`POST .../open-claim-file` ve `.../open-emergency-file` body:

```json
{
  "instruction": "...",
  "assignedUserId": "uuid?",
  "customerId": "uuid?",
  "insuredName": "string?",
  "insuredPhone": "string?",
  "insuredAddress": "string?",
  "fileNo": "string?",
  "policyNo": "string?",
  "claimNo": "string?",
  "lossType": "string?",
  "createCustomer": {
    "entityType": "individual|corporate",
    "firstName?", "lastName?", "companyName?", "phone?", "email?", "address?"
  }
}
```

- Modal alanları mailden ön-dolar; **tümü manuel düzenlenebilir** (eksper/AI okuyamazsa dosya sorumlusu doldurur)
- `GET .../routing-suggestion` → `mailFields` (sigortalı + dosya alanları, sunucu heuristic/AI birleşimi)
- Dosya no ≠ referans no: `fileNo` sistem dosya numarası, `claimNo` sigorta referansı

### UI

- Gelen kutusu kartları: **Sahiplenilmedi** amber badge, kapsam uyarıları
- Hasar/Acil aç modal: Önerilen Sorumlu + Müşteri bölümü
- Operasyon özeti: Gelen Kutu (Bekleyen) → `GET /operation-inbox/stats`

### Bildirim tipleri

| Tip | Alıcı | Tetikleyici |
|-----|-------|-------------|
| `inbox_assigned` | Atanan kullanıcı | `POST .../assign` |
| `inbox_unowned_escalation` | admin + manager | HIGH aciliyet veya sorumlu yok |
| `inbox_new_ihbar` | Dosya sorumlusu | Hasar/acil aç + atama |

---

## Ertelenen (Polish — ✅ 2026-06-30)

Aşağıdaki iyileştirmeler uygulandı:

| # | Özellik | Durum |
|---|---------|-------|
| 1 | Kullanıcı atama UI (`Ata` + kullanıcı seçici modal) | ✅ |
| 2 | Hasar Aç — sigorta şirketi dropdown (çoklu şirkette zorunlu seçim) | ✅ |
| 3 | Önerilen dosyalar (`GET .../match-candidates`, tek tıkla bağla) | ✅ |
| 4 | Yanıt sonrası anında UI (`ACTIONED`, Yanıt Gönderildi rozeti) | ✅ |
| 5 | Sıfırdan compose (`POST /operation-inbox/compose`, Yeni E-posta modal) | ✅ |
| 6 | Outbound audit (`aiExtractedJson.outboundReplies[]`, migration yok) | ✅ |

### Yeni API

| Method | Path | Yetki |
|--------|------|-------|
| GET | `/operation-inbox/messages/:id/match-candidates` | `operation_inbox.view` |
| POST | `/operation-inbox/compose` | `operation_inbox.manage` |

### Compose — Azure gereksinimi

`POST /operation-inbox/compose` Graph `Mail.Send` kullanır (`/users/{mailbox}/sendMail`). F4 ile aynı Azure AD **Mail.Send (Application)** izni ve admin consent gerekir.

### Outbound audit

Yanıt gönderiminde `aiExtractedJson` genişletilir (migration yok):

```json
{
  "outboundReplies": [{ "sentAt", "bodyPreview", "replyAll", "sentByUserId" }],
  "lastReplyAt": "...",
  "lastReplyPreview": "..."
}
```

---

## Bekleyen test paketi (Mustafa — bütün test)

> **Not (2026-06-30):** Mustafa operasyon sayfasına geçiyor; aşağıdaki maddeler **henüz test edilmedi** — tek seferde bütün paket olarak doğrulanacak.

### Web v109–v110 + Backend v57–v58 (canlı)

> **Canlı (2026-06-30):** Web **v110**, Backend **v58** — inbox file-open 2.01 tam modal.

### Web v107–v108 + Backend v56 (önceki paket)

| # | Konu | Beklenen | Durum |
|---|------|----------|-------|
| T1 | VKN checksum (`7340735275`) | Blur’da “Geçersiz vergi numarası” **çıkmamalı** | ⏳ test bekliyor |
| T2 | Remed VKN mükerrer | Sarı uyarı + **Mevcut Müşteriye Git**; “Yine de Kaydet” yok | ⏳ test bekliyor |
| T3 | Adres Title Case | `BÜYÜKDERE CAD.` → `Büyükdere Cad.` (yapıştırma / özet) | ⏳ test bekliyor |
| T4 | **Gelen kutusu → Müşteri Ekle** (Remed) | Remed kurumsal kart + gönderen personel (ör. Tuğçe İşlek) ad/e-posta dolu; sekme **Yetkili & İletişim**; odak **Görev / Ünvan** | ⏳ test bekliyor |
| T5 | T4 — Remed zaten kayıtlı | Mevcut Remed kaydına yönlendirme; yeni duplicate kart açılmamalı | ⏳ test bekliyor |
| T6 | **Hasar / Acil dosya aç** — Sigortalı Adı Soyadı | Kurumsal gönderende gönderen adı **sigortalı** alanına yazılmamalı; konu/gövde/AI özeti veya manuel alan doğru sigortalı adını taşır; kayıtta dosyada görünür | ⏳ test bekliyor |
| T7 | **Hasar / Acil dosya aç** — Tam modal (v2.01) | İhbar bağlamı + sigortalı + dosya detayları (dosya no, hasar türü vb.) önerileri dolu; eksik alanlarda manuel fallback; kayıt sonrası dosyada alanlar doğru | ⏳ test bekliyor |

### Test senaryosu (T4)

1. Gelen kutusu → Remed ihbar maili (Tuğçe İşlek gönderen)
2. **Müşteri Ekle / Ara** → yeni sekme
3. Kontrol: Kurumsal / Asistan Firması / Remed unvanı + VKN
4. Kontrol: Yetkili #1 = Tuğçe İşlek, e-posta = gönderen adres
5. Yalnızca görev seç → kaydet veya mevcut kayda git

### Sonraki geliştirme (not — implementasyon sonrası)

- Remed **zaten kayıtlıyken** mevcut karta **yeni yetkili ekleme** (Tuğçe) — güncelleme akışı
- Safran / sigorta portalı gönderen profilleri için aynı sender-prefill genişletmesi

---

## Eski ertelenen maddeler

- Gönderilen yanıtların gelen kutusuna otomatik geri senkronu (delta sonraki turda gelir)

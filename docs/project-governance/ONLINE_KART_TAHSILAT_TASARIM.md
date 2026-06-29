# Online Kart Tahsilat Altyapısı — Tasarım Dokümanı

**Tarih:** 2026-06-28  
**Durum:** Tasarım (implementasyon bekliyor)  
**İlgili modüller:** Tahsilatlar, ClaimFileRevenue, Payment, Logo entegrasyonu

---

## 1. Problem ve hedef

Sigortalıdan tahsilatlı dosyalarda tahsilatın **kayıt dışı / şahıs hesabına** gitmesi riski var. Kurumsal (sigorta şirketi) tahsilatlar Logo/muhasebe kanalından gider; sigortalı ödemelerinde ise **online kart linki** ile resmi, izlenebilir tahsilat isteniyor (Siemens benzeri model).

**Ürün kararı (önceki oturum):**
- Tahsilat **kaynağını** UI’da sigorta/sigortalı/özel müşteri diye çeşitlendirmeyelim.
- **Kanal** modeli kullanılsın: `muhasebe` | `online_kart` | `manuel_onay`
- `ClaimFileRevenue.collectionSource` = **kimden tahsil edilecek** (`insurance_company` | `insured`) — bu P&L/analitik için kalır, kullanıcıya “kaynak seçimi” olarak sunulmaz.

---

## 2. Mevcut durum (kod envanteri)

| Katman | Durum |
|--------|--------|
| `Payment.method` | `credit_card` enum değeri **var**, UI’da manuel kayıt |
| `Payment.status` | `pending \| completed \| cancelled` |
| `ClaimFileRevenue` | `collectionSource`, `collectedAmount`, `relatedPaymentId` |
| Logo sync | Tamamlanan `Payment` → tahsilat fişi |
| Public token örnekleri | `/ekstre/[token]`, `/sozlesme/[token]`, `/evrak/[token]` |
| PSP entegrasyonu | **Yok** (iyzico/PayTR/Stripe vb.) |

---

## 3. Kavram modeli

```
ClaimFile
  └── ClaimFileRevenue (tahsil edilecek tutar, collectionSource=insured)
        └── PaymentCollectionLink (1:N — yeniden gönderim / kısmi ödeme)
              └── Payment (method=credit_card, channel=online_kart)
                    └── Logo sync (muhasebe kanalı)
```

### 3.1 Yeni alanlar (öneri)

**`ClaimFile` (bayraklar)**
```prisma
requiresOnlineCardCollection  Boolean @default(false)  // dosya sorumlusu işaretler
onlineCardCollectionStatus    String? // not_required | pending | link_sent | paid | failed
```

**`PaymentCollectionLink` (yeni tablo)**
```prisma
model PaymentCollectionLink {
  id              String    @id @default(uuid())
  claimFileId     String
  revenueId       String?   // ClaimFileRevenue — hangi kalem için
  amount          Float
  currency        String    @default("TRY")
  publicToken     String    @unique
  tokenExpiresAt  DateTime
  status          String    // draft | sent | opened | processing | paid | expired | cancelled | failed
  payerName       String?
  payerPhone      String?
  payerEmail      String?
  description     String?
  sentAt          DateTime?
  paidAt          DateTime?
  paymentId       String?   // başarılı ödeme sonrası Payment.id
  provider        String?   // iyzico | paytr
  providerRef     String?   // PSP conversationId / paymentId
  providerPayload Json?     // webhook ham veri (denetim)
  createdByUserId String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**`Payment` (genişletme)**
```prisma
collectionChannel  String?  // muhasebe | online_kart | manuel_onay
collectionLinkId   String?  // online_kart ise zorunlu
providerRef        String?
```

> **Not:** `payerType` mevcut alan kalır (`customer` sigortalı için). UI’da “kaynak” seçtirmeyiz; kanal dosya/revenue bağlamından türetilir.

---

## 4. Akışlar

### 4.1 Dosya sorumlusu — link oluşturma

1. Dosya `requiresOnlineCardCollection = true` (veya revenue `collectionSource = insured` + onaylı tutar).
2. Finans / dosya ekranından **“Ödeme linki oluştur”**.
3. Backend `PaymentCollectionLink` oluşturur (`amount`, `revenueId`, 7–30 gün TTL).
4. Link: `https://app.meridyen-tr.com/odeme/{publicToken}` (public, auth yok).
5. SMS/WhatsApp/e-posta ile gönderim (mevcut notification altyapısı).

### 4.2 Sigortalı — ödeme sayfası

1. Token doğrulama (süre, status, tutar).
2. Özet: dosya no, açıklama, tutar, KDV.
3. PSP hosted checkout veya iframe (PCI: kart verisi **backend’e gelmez**).
4. Başarı → webhook → atomik işlem:
   - `Payment` oluştur (`method=credit_card`, `channel=online_kart`, `status=completed`)
   - `ClaimFileRevenue.collectedAmount` güncelle
   - `PaymentCollectionLink.status = paid`
   - `FinancialSummary.recalculate`
   - Logo sync kuyruğuna ekle
5. Başarısız → `failed`, audit log, opsiyonel yeniden link.

### 4.3 Muhasebe / Logo kanalı (değişmez)

- Sigorta şirketi faturaları → Logo’dan tahsilat; `channel=muhasebe`.
- Manuel banka onayı → `channel=manuel_onay`, yetkili kullanıcı onayı.

### 4.4 Finans hub özeti

Tahsilatlar sayfasında kanal kırılımı:
- **Online kart:** link sayısı, bekleyen tutar, bugün tahsil
- **Muhasebe:** Logo sync durumu
- **Manuel onay:** pending onay kuyruğu

---

## 5. API taslağı

| Method | Endpoint | Auth | Açıklama |
|--------|----------|------|----------|
| POST | `/claim-files/:id/collection-links` | Panel | Link oluştur |
| GET | `/claim-files/:id/collection-links` | Panel | Liste |
| POST | `/collection-links/:id/send` | Panel | SMS/WA/e-posta |
| POST | `/collection-links/:id/cancel` | Panel | İptal |
| GET | `/public/collection-links/token/:token` | Public | Ödeme özeti |
| POST | `/public/collection-links/token/:token/checkout` | Public | PSP session başlat |
| POST | `/webhooks/payments/:provider` | Public (imzalı) | PSP callback |

---

## 6. PSP seçimi (Türkiye)

| Sağlayıcı | Artı | Eksi |
|-----------|------|------|
| **iyzico** | Yaygın, link/checkout, 3DS | Komisyon, sözleşme süreci |
| **PayTR** | Link ödeme, düşük entegrasyon | Raporlama sınırlı |
| **Param** | Kurumsal | Dokümantasyon |

**Öneri:** Faz 1’de **iyzico Checkout Form** veya **PayTR Link** — tek PSP, abstraction katmanı ile.

```typescript
interface PaymentProvider {
  createCheckoutSession(link: PaymentCollectionLink): Promise<{ redirectUrl: string; providerRef: string }>;
  verifyWebhook(headers: Record<string, string>, body: unknown): WebhookEvent;
  getPaymentStatus(providerRef: string): Promise<'paid' | 'failed' | 'pending'>;
}
```

---

## 7. Güvenlik ve uyumluluk

- Public token: UUID v4, tek kullanımlık ödeme oturumu (PSP tarafında).
- Webhook: HMAC imza doğrulama, idempotency key (`providerRef`).
- Tutar sunucuda sabitlenir; client’tan amount kabul edilmez.
- Rate limit: `/public/collection-links/*` (nginx + uygulama).
- Audit: link oluşturma, gönderim, ödeme, iptal — `AuditLog`.
- KVKK: payerPhone/e-posta maskeleme panel listesinde.

---

## 8. UI yerleşimi

| Ekran | Değişiklik |
|-------|------------|
| Hasar dosyası → Tahsilatlar sekmesi | “Online ödeme linki” butonu, link geçmişi |
| Finans → Tahsilatlar | Kanal filtresi (`online_kart`), pending link kartları |
| Public `/odeme/[token]` | Mobil öncelikli checkout özeti |
| Dosya listesi | `requiresOnlineCardCollection` ikonu / filtre |

**Gösterilmeyecek:** “Tahsilat kaynağı: sigorta / sigortalı” dropdown (ürün kararı).

---

## 9. Logo entegrasyonu

Online kart tahsilatı da `Payment` kaydı olduğu için mevcut `SYNC_COLLECTION` job’u çalışır. Ek mapping:

- `method=credit_card` → Logo `paymentType` = kart (mevcut map kontrol edilmeli).
- `referenceNo` = PSP işlem no.
- `collectionChannel=online_kart` meta alanı Logo’ya not/description olarak gidebilir.

---

## 10. Uygulama fazları

### Faz 1 — MVP (2–3 sprint)
- [ ] Prisma migration: `PaymentCollectionLink`, `Payment.collectionChannel`
- [ ] `ClaimFile.requiresOnlineCardCollection` bayrağı
- [ ] Public ödeme sayfası iskeleti
- [ ] PSP sandbox + webhook
- [ ] Payment → Revenue sync (mevcut `syncPaymentToRevenue` genişlet)

### Faz 2
- [ ] SMS/WhatsApp link gönderimi
- [ ] Finans hub kanal özeti
- [ ] Kısmi ödeme / çoklu revenue

### Faz 3
- [ ] Logo alan eşlemesi doğrulama
- [ ] Mutabakat raporu (PSP vs sistem)
- [ ] Otomatik hatırlatma (vadesi yaklaşan link)

---

## 11. Kararlar (Mustafa — onaylandı)

| Karar | Seçim |
|-------|--------|
| **PSP** | **PayTR** (Faz 1) |
| **Link TTL** | **14 gün** |
| **Kısmi ödeme** | MVP kapalı |
| **Komisyon** | Şirket karşılar |

### Canlıya alma checklist

1. PayTR panelinden merchant bilgileri → `.env.production`
2. PayTR Bildirim URL: `https://app.meridyen-tr.com/api/v1/webhooks/payments/paytr`
3. `prisma migrate deploy` (backend deploy)
4. `ONLINE_CARD_COLLECTION_ENABLED=true`
5. Test modunda (`PAYTR_TEST_MODE=1`) uçtan uca ödeme dene
6. Canlı moda geç (`PAYTR_TEST_MODE=0`)

---

## 12. Rollback

- Feature flag: `ONLINE_CARD_COLLECTION_ENABLED=false` → link oluşturma gizli, mevcut manuel tahsilat devam.
- Webhook kapalıyken PSP dashboard’dan manuel mutabakat.

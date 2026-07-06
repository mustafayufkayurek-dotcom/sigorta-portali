# Marangoz Keşif Ölçüsü — Teknik Plan

Tarih: 2026-07-06  
Durum: **Faz 1 (iskelet)** — AI vision + kayıt + PDF + WhatsApp  
İlgili ekran: Hasar dosyası detay → **Keşif Ölçüsü**

---

## 1. Kullanıcı Hikayesi

**Saha / operasyon personeli olarak**, hasar yerinde çektiğim marangoz keşif fotoğrafından **tahmini ölçü modülleri** ve **malzeme listesi** çıkarmak, marangoza WhatsApp ile göndermek ve PDF olarak kaydetmek istiyorum.

**İş sorunu:** Ölçüler elle not alınıyor, marangoza aktarım gecikiyor, dosya ile ilişkilendirilmiyor.

**Meridyen prensibi:** Tüm ölçüler **tahmini** etiketli; kesin ölçü saha doğrulaması gerektirir.

---

## 2. Faz Kapsamı

| Faz | Kapsam | Durum |
|-----|--------|-------|
| **F1** | Prisma `FieldSurveyBrief`, AI vision scan, kayıt, PDF, WhatsApp share, modal UI | ✅ iskelet |
| **F2** | Annotated foto (çizim overlay), marangoz telefon rehberi, gönderim geçmişi, liste sekmesi | ⬜ |
| **F3** | Lazer / AR ölçüm entegrasyonu, kesin ölçü modu, mobil native kamera | ⬜ |

### Faz 1 MVP

- `FieldSurveyBrief` modeli + migration
- `POST .../scan` — OpenAI vision (pattern: `receipt-scan.util.ts`)
- `POST ...` — kaydet (`draft` | `sent`)
- `GET ...` — dosyaya göre liste
- `GET .../:id/pdf` — Puppeteer HTML→PDF
- `GET .../:id/share` — `{ pdfUrl, whatsappUrl, summaryText }`
- `FieldSurveyBriefModal` — kamera/foto, düzenlenebilir form, uyarı bandı
- Hasar dosyası detay → **Keşif Ölçüsü** butonu

### Kapsam dışı (F1)

- Lazer / AR cihaz entegrasyonu
- Annotated foto üretimi
- Otomatik marangoz ataması

---

## 3. Veri Modeli

```prisma
model FieldSurveyBrief {
  id, claimFileId, createdByUserId
  itemType   // mutfak_alt_modul | kapi | lavabo_alt | ada_tezgah | parke | diger
  title, summaryText
  dimensionsJson  // [{ label, genislikCm, yukseklikCm, derinlikCm }]
  materialsJson   // [{ name, quantity, note }]
  aiConfidence, isEstimated (default true)
  photoUrl, annotatedPhotoUrl (nullable)
  status: draft | sent
}
```

---

## 4. API Özeti

| Method | Path | Yetki |
|--------|------|-------|
| POST | `/claim-files/:claimFileId/field-survey-briefs/scan` | `claim_file.update` |
| POST | `/claim-files/:claimFileId/field-survey-briefs` | `claim_file.update` |
| GET | `/claim-files/:claimFileId/field-survey-briefs` | `claim_file.view` |
| GET | `/claim-files/:claimFileId/field-survey-briefs/:id/pdf` | `claim_file.view` |
| GET | `/claim-files/:claimFileId/field-survey-briefs/:id/share?phone=` | `claim_file.view` |

---

## 5. UI Akışı

1. Dosya detay → **Keşif Ölçüsü** butonu
2. Modal açılır → Kamera veya dosyadan foto seç
3. AI scan → düzenlenebilir form (parça tipi, modüller, malzemeler, özet)
4. Sarı uyarı bandı: **Tahmini Keşif Ölçüsü**
5. **Kaydet** → `draft` veya `sent`
6. **PDF İndir** → `:id/pdf`
7. **WhatsApp Gönder** → `:id/share` → `wa.me` yeni sekme

Title Case; `vaka` değil `dosya`.

---

## 6. Backend Modül

```
apps/backend/src/modules/field-survey-briefs/
├── field-survey-briefs.module.ts
├── field-survey-briefs.controller.ts
├── field-survey-briefs.service.ts
├── field-survey-scan.util.ts
├── field-survey-scan.types.ts
├── dto/create-field-survey-brief.dto.ts
└── pdf/field-survey-pdf.service.ts
```

---

## 7. Frontend Bileşen

```
apps/web/src/components/field-survey/FieldSurveyBriefModal.tsx
```

Entegrasyon: `apps/web/src/app/panel/hasar-dosyalari/[id]/page.tsx`

---

## 8. Faz 2 Hook'ları (planlanmış)

- `annotatedPhotoUrl` — canvas overlay API
- `status: sent` — gönderim zaman damgası + alıcı telefon
- Dosya **Raporlar** sekmesinde keşif listesi
- Marangoz (`assignedSupplier`) telefon ön doldurma

## 9. Faz 3 Hook'ları (planlanmış)

- BLE lazer ölçer adapter
- ARKit / ARCore depth → `dimensionsJson` kesin mod
- Mobil uygulama native kamera + offline kuyruk

---

## 10. Referans Dosyalar

- Vision scan: `apps/backend/src/modules/expenses/receipt-scan.util.ts`
- WhatsApp: `apps/backend/src/modules/external-approvals/external-approvals.service.ts`
- PDF: `apps/backend/src/modules/repair-reports/pdf/report-pdf.service.ts`
- Kamera UI: `apps/web/src/components/ReceiptCameraModal.tsx`

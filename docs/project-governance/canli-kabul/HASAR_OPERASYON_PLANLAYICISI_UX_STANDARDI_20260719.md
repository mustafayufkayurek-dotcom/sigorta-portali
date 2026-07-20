# Hasar Operasyon Planlayıcısı — Güncel UX Standardı (2026-07-20)

**Durum:** Canlı entegrasyon — hasar dosyası Operasyon sekmesi  
**Ürün sahibi:** Mustafa  

## Rotalar

| Ortam | Rota |
|--------|------|
| Canlı | `/panel/hasar-dosyalari/[id]?grup=operasyon` (varsayılan: Operasyon Planlayıcısı) |
| Geri dönüş | `?grup=operasyon&gorunum=eski` → eski Takip görünümü |
| Lokal önizleme | `/dev/hasar-operasyon-planlayicisi` (production’da `notFound()`) |

`/dev` route canlıya taşınmaz.

## Kilit

- **Hasar raporu yazım sayfasına dokunulmaz.** “Rapora Git” yalnızca Raporlar sekmesine yönlendirir.
- Backend’i olmayan adımlarda sahte başarı yok.
- Eski Operasyon görünümü silinmez.

## Kaynak

- Bileşenler: `apps/web/src/components/hasar-operasyon-planlayicisi/`
- Piksel: `docs/project-governance/ui-reference/HASAR_OPERASYON_PLANLAYICISI_FINAL_REFERANS.png`

## 8 aşama

1. Sigortalı ve Randevu  
2. Tespitçi Ataması  
3. Tedarikçi Ataması  
4. WhatsApp Bilgilendirme  
5. Dijital Onay  
6. Rapor Yazım Aşamasında  
7. Onaya Gönderildi  
8. Onaylandı  

# Hasar Operasyon Planlayıcısı — Component Haritası (2026-07-19)

**Referans PNG:** `docs/project-governance/ui-reference/HASAR_OPERASYON_PLANLAYICISI_FINAL_REFERANS.png`  
**Lokal rota:** `/dev/hasar-operasyon-planlayicisi`  
**Kaynak kök:** `apps/web/src/app/dev/hasar-operasyon-planlayicisi/`

Bu harita referans görseldeki bölgelerden türetilmiştir. Yeni kart / yerleşim eklenmez.

## Ana ekran (Drawer kapalı veya açık arka plan)

| # | Referans bölgesi | Component | Not |
|---|------------------|-----------|-----|
| 1 | Sol menü | `LocalSidebar` | Dashboard … Ayarlar; Hasar Dosyaları aktif |
| 2 | Üst başlık | `FilePageHeader` | `Hasar Dosyaları > HD-2026-0042` + Açık + Düzenle / Diğer İşlemler / Operasyon Planlayıcısı |
| 3 | Dosya bilgi bandı | `FileInfoBand` | Sigortalı, Şirket, Hasar Türü, İhbar, Randevu, Adres, Sorumlu — tek bant, tekrar yok |
| 4 | Operasyon Planlama Özeti | `OperationPlanningSummary` | 8 daire + durum 2/8 + Düzenle → Drawer |
| 5 | İlerleme Özeti | `ProgressSummaryCard` | Dikey zaman çizgisi + oran / tahmini tamamlanma |
| 6 | Dosyada Kimler Var? | `WhoIsOnFileCard` | Özet satırlar + Tümünü Gör |
| 7 | Notlar | `NotesCard` | Operasyon Notları / Tüm Notlar + giriş + liste |
| 8 | Hızlı İşlemler | `QuickActionsBar` | 6 nötr ikon buton |
| 9 | Risk & Hatırlatmalar | `RiskRemindersBar` | Kritik / bilgi satırları → Drawer adımı |

## Operasyon Planlayıcısı Drawer

| # | Referans bölgesi | Component | Not |
|---|------------------|-----------|-----|
| 10 | Drawer kabuğu | `OperationPlannerDrawer` | Sağ, tam yükseklik, ~%30 |
| 11 | Sol aşama listesi | `PlannerStepNav` | 8 adım; yeşil / turuncu / gri |
| 12 | Adım 1 içerik | `steps/InsuredAppointmentStep` | Sigortalı + ana randevu |
| 13 | Adım 2 içerik | `steps/InspectorAssignStep` | Kayıtlı tespitçiler |
| 14 | Adım 3 içerik | `steps/SupplierAssignStep` | Tedarikçi Seçimi / Görev Tanımı (referansta açık) |
| 15 | Adım 4 içerik | `steps/WhatsAppNotifyStep` | Şablon + gönderim |
| 16 | Adım 5 içerik | `steps/DigitalApprovalStep` | Form / gönderim |
| 17 | Adım 6 içerik | `steps/ReportWritingStep` | Rapor Yazım Aşamasında |
| 18 | Adım 7 içerik | `steps/SentForApprovalStep` | Onaya Gönderildi |
| 19 | Adım 8 içerik | `steps/ApprovedStep` | Onaylandı |

## Paylaşılan yardımcılar

| Component | Rol |
|-----------|-----|
| `types.ts` | Aşama id / durum tipleri |
| `preview-data.ts` | Lokal önizleme sabit verisi (mock = gerçek API iddiası yok) |
| `StatusPill` | Yeşil / turuncu / gri rozet |
| `PlannerWhatsAppPanel` | Drawer içi kompakt WA paneli (ilgili adımlarda) |

## Etkileşim sözleşmesi (referans)

- Ana kart / özet / hızlı işlem / risk Detay → Drawer ilgili adımı açar  
- Modal / yeni sayfa yok  
- Ana ekran Drawer açıkken görünür kalır  
- Production `/panel/hasar-dosyalari/[id]` bu aşamada bağlanmaz  

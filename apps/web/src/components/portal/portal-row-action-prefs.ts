export type PortalRowActionDef = {
  id: string;
  label: string;
  defaultPinned: boolean;
  /** Kolonda henüz durmuyordu; önerilen ekleme */
  suggested?: boolean;
};

export const DOSYALAR_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'summary', label: 'Dosya Özeti', defaultPinned: true },
  { id: 'note', label: 'Dosya Notu', defaultPinned: true },
  { id: 'documents', label: 'Evraklar', defaultPinned: true, suggested: true },
  { id: 'operation', label: 'Operasyon Bilgileri', defaultPinned: true, suggested: true },
  { id: 'history', label: 'Geçmiş', defaultPinned: false },
  { id: 'copyFileNo', label: 'Dosya No Kopyala', defaultPinned: false },
];

export const ONAYLAR_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'preview', label: 'Rapor Önizleme', defaultPinned: true },
  { id: 'approve', label: 'Onayla', defaultPinned: true },
  { id: 'note', label: 'Dosya Notu', defaultPinned: true },
  { id: 'documents', label: 'Evraklar', defaultPinned: true, suggested: true },
  { id: 'summary', label: 'Dosya Özeti', defaultPinned: false },
  { id: 'download', label: 'Raporu İndir', defaultPinned: false },
  { id: 'history', label: 'Geçmiş', defaultPinned: false },
  { id: 'copyFileNo', label: 'Dosya No Kopyala', defaultPinned: false },
];

export const FATURALAR_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'preview', label: 'Rapor Önizleme', defaultPinned: true },
  { id: 'note', label: 'Dosya Notu', defaultPinned: true },
  { id: 'download', label: 'Faturayı İndir', defaultPinned: true, suggested: true },
  { id: 'documents', label: 'Evraklar', defaultPinned: true, suggested: true },
  { id: 'summary', label: 'Dosya Özeti', defaultPinned: false },
  { id: 'history', label: 'Geçmiş', defaultPinned: false },
  { id: 'copyFileNo', label: 'Dosya No Kopyala', defaultPinned: false },
  { id: 'copyInvoiceNo', label: 'Fatura No Kopyala', defaultPinned: false },
];

export const OPS_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'view', label: 'Görüntüle', defaultPinned: true },
  { id: 'pdf', label: 'PDF Oluştur', defaultPinned: true },
  { id: 'mail', label: 'E-posta Gönder', defaultPinned: true },
  { id: 'whatsapp', label: 'WhatsApp', defaultPinned: true },
  { id: 'note', label: 'Not Yaz', defaultPinned: true, suggested: true },
  { id: 'edit', label: 'Düzenle', defaultPinned: false, suggested: true },
  { id: 'history', label: 'Geçmiş', defaultPinned: false },
  { id: 'archive', label: 'Arşive Taşı', defaultPinned: false },
];

export const FINANS_FATURA_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'print', label: 'Yazdır', defaultPinned: true },
  { id: 'notify', label: 'Dosya Sorumlusuna Bildir', defaultPinned: true, suggested: true },
  { id: 'edit', label: 'Düzenle', defaultPinned: true },
  { id: 'pay', label: 'Ödendi', defaultPinned: true },
  { id: 'cancel', label: 'İptal Et', defaultPinned: false },
];

export const FINANS_TAHSILAT_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'print', label: 'Yazdır', defaultPinned: true },
  { id: 'ekstre', label: 'Cari Hesap Ekstresi', defaultPinned: true, suggested: true },
  { id: 'pay', label: 'Ödendi İşaretle', defaultPinned: true },
];

export const FINANS_FATURA_TALEP_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'view', label: 'Görüntüle', defaultPinned: true },
  { id: 'print', label: 'Yazdır', defaultPinned: true },
  { id: 'notify', label: 'Dosya Sorumlusuna Bildir', defaultPinned: true, suggested: true },
  { id: 'edit', label: 'Düzenle', defaultPinned: false },
  { id: 'cancel', label: 'İptal Et', defaultPinned: false },
];

export const FINANS_MASRAF_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'edit', label: 'Düzenle', defaultPinned: true },
  { id: 'delete', label: 'Sil', defaultPinned: false },
];

export const FINANS_CARI_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'view', label: 'Detay', defaultPinned: true },
];

export const ADMIN_USER_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'edit', label: 'Düzenle', defaultPinned: true },
  { id: 'resetPwd', label: 'Geçici Şifre Üret', defaultPinned: true, suggested: true },
  { id: 'activate', label: 'Yeniden Aktifleştir', defaultPinned: false },
  { id: 'archive', label: 'Arşivle', defaultPinned: false },
  { id: 'delete', label: 'Kalıcı Sil', defaultPinned: false },
];

export const MUSTERI_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'view', label: 'Görüntüle', defaultPinned: true },
  { id: 'edit', label: 'Düzenle', defaultPinned: true },
  { id: 'archive', label: 'Arşivle', defaultPinned: false, suggested: true },
];

export const TEDARIKCI_ROW_ACTIONS: PortalRowActionDef[] = [
  { id: 'view', label: 'Görüntüle', defaultPinned: true },
  { id: 'edit', label: 'Düzenle', defaultPinned: true },
  { id: 'delete', label: 'Sil', defaultPinned: false, suggested: true },
];

export function defaultPinnedActionIds(catalog: PortalRowActionDef[]): string[] {
  return catalog.filter((item) => item.defaultPinned).map((item) => item.id);
}

export function parsePinnedActionIds(raw: string | null, catalog: PortalRowActionDef[]): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const allowed = new Set(catalog.map((item) => item.id));
    return parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id));
  } catch {
    return null;
  }
}

/** API action kodlarını kullanıcıya Türkçe Title Case göster */

const ACTION_LABELS: Record<string, string> = {
  status_change: 'Durum Değişti',
  STATUS_CHANGED: 'Durum Değişti',
  STATUS_CHANGE: 'Durum Değişti',
  assignment: 'Atama',
  ASSIGNMENT: 'Atama',
  ASSIGNED: 'Atama',
  comment: 'Yorum',
  COMMENT: 'Yorum',
  note: 'Not',
  NOTE: 'Not',
  document: 'Belge',
  DOCUMENT: 'Belge',
  DOCUMENT_UPLOAD: 'Belge',
  created: 'Oluşturuldu',
  CREATED: 'Oluşturuldu',
  updated: 'Güncellendi',
  UPDATED: 'Güncellendi',
  deleted: 'Silindi',
  DELETED: 'Silindi',
  payment: 'Ödeme',
  PAYMENT: 'Ödeme',
  approval: 'Onay',
  APPROVAL: 'Onay',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  closed: 'Kapatıldı',
  CLOSED: 'Kapatıldı',
  opened: 'Açıldı',
  OPENED: 'Açıldı',
};

const TECHNICAL_PATTERN = /^[A-Z0-9_]+$|^[a-z0-9]+(?:_[a-z0-9]+)+$/;

export function formatActivityAction(action: string | null | undefined): string {
  if (!action?.trim()) return 'İşlem güncellendi';
  const trimmed = action.trim();
  const mapped = ACTION_LABELS[trimmed];
  if (mapped) return mapped;

  // Ham snake_case / SCREAMING_SNAKE / teknik kod → güvenli fallback
  if (TECHNICAL_PATTERN.test(trimmed)) {
    return 'İşlem güncellendi';
  }

  // Zaten kullanıcıya yönelik Türkçe / serbest metin
  return trimmed;
}

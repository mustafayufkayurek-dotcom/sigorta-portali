/** Eksper ve sigorta portalında gösterilen dosya akışı etiketleri */

export const PORTAL_ACTIVITY_LABELS: Record<string, string> = {
  SUPPLIER_ASSIGNED: 'Onarım Tespitçisi Atandı',
  APPOINTMENT_SCHEDULED: 'Site Randevusu Alındı',
  APPOINTMENT_UPDATED: 'Site Randevusu Güncellendi',
  INSPECTION_DONE: 'Tespit Yapıldı',
  COST_REPORT_SUBMITTED: 'Rapor Gönderildi',
  ATTACHMENT_ADDED: 'Dosyaya Görsel Eklendi',
  STATUS_CHANGED: 'Durum Güncellendi',
  NOTE_ADDED: 'Not Eklendi',
};

export const PORTAL_STATUS_LABELS: Record<string, string> = {
  new: 'Yeni İhbar',
  pre_review: 'Tespit Aşamasında',
  adjuster_assigned: 'Tespit Aşamasında',
  site_visit_planned: 'Onarım Aşamasında',
  site_visit_done: 'Onarım Aşamasında',
  budget_preparing: 'Rapor Yazım Aşamasında',
  budget_submitted: 'Onay Bekliyor',
  budget_revision_requested: 'Rapor Yazım Aşamasında',
  budget_approved: 'Onarım Aşamasında',
  repair_planning: 'Onarım Aşamasında',
  repair_in_progress: 'Onarım Aşamasında',
  repair_completed: 'Finansa Aktarıldı',
  invoice_pending: 'Finansa Aktarıldı',
  invoice_submitted: 'Finansa Aktarıldı',
  payment_pending: 'Finansa Aktarıldı',
  partially_collected: 'Finansa Aktarıldı',
  closed: 'Dosya Kapatıldı',
  cancelled: 'İptal',
  completed: 'Dosya Kapatıldı',
  SUPPLIER_ASSIGNED: 'Onarım Tespitçisi Atandı',
  APPOINTMENT_SCHEDULED: 'Site Randevusu Alındı',
  INSPECTION_DONE: 'Tespit Yapıldı',
  COST_REPORT_SUBMITTED: 'Rapor Gönderildi',
};

export const PORTAL_NEXT_STEP_HINTS: Record<string, string> = {
  new: 'Dosya sorumlusu incelemesi ve onarım tespitçi ataması bekleniyor.',
  pre_review: 'Onarım tespitçi ataması bekleniyor.',
  adjuster_assigned: 'Site randevusu planlanması bekleniyor.',
  site_visit_planned: 'Saha ziyareti ve tespit bekleniyor.',
  site_visit_done: 'Rapor yazım aşamasına geçiliyor.',
  budget_preparing: 'Onarım raporu hazırlanıyor.',
  budget_submitted: 'Rapor onayı bekleniyor.',
  budget_revision_requested: 'Revize rapor bekleniyor.',
  budget_approved: 'Onarım planlaması bekleniyor.',
  repair_planning: 'Onarım başlangıcı bekleniyor.',
  repair_in_progress: 'Onarım süreci devam ediyor.',
  repair_completed: 'Fatura ve kapanış süreci bekleniyor.',
  invoice_pending: 'Fatura yüklemesi bekleniyor.',
  invoice_submitted: 'Tahsilat süreci bekleniyor.',
  payment_pending: 'Ödeme takibi devam ediyor.',
  partially_collected: 'Kalan tahsilat bekleniyor.',
  closed: 'Dosya tamamlandı.',
  cancelled: 'Dosya iptal edildi.',
  SUPPLIER_ASSIGNED: 'Site randevusu planlanması bekleniyor.',
  APPOINTMENT_SCHEDULED: 'Saha ziyareti ve tespit bekleniyor.',
  INSPECTION_DONE: 'Rapor yazım aşamasına geçiliyor.',
  COST_REPORT_SUBMITTED: 'Onay sonucu bekleniyor.',
};

export function portalStatusLabel(code: string | undefined, fallbackName?: string): string {
  if (code && PORTAL_STATUS_LABELS[code]) return PORTAL_STATUS_LABELS[code];
  const name = (fallbackName ?? '').toLocaleLowerCase('tr-TR');
  if (/bütçe sun|butce sun|budget.?submit|onay bek/.test(name)) return 'Onay Bekliyor';
  if (/revizyon/.test(name)) return 'Rapor Yazım Aşamasında';
  if (/rapor yaz|budget.?prepar/.test(name)) return 'Rapor Yazım Aşamasında';
  if (/kapat|tamam|closed|completed/.test(name)) return 'Dosya Kapatıldı';
  if (/iptal|cancel/.test(name)) return 'İptal Edildi';
  return fallbackName ?? code ?? '—';
}

export function portalNextStepHint(code: string | undefined): string | null {
  if (!code) return null;
  return PORTAL_NEXT_STEP_HINTS[code] ?? null;
}

export function portalActivityLabel(action: string): string {
  return PORTAL_ACTIVITY_LABELS[action] ?? action.replace(/_/g, ' ');
}

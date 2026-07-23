/**
 * Onay gecikmesi — mevcut ürün etiketleri (ApprovalDelayWidget ile aynı kaynak dil).
 * Yeni senaryo / müşteri tipi üretilmez.
 */

const CATEGORY_LABELS: Record<string, string> = {
  pending_approval: 'Dosya Sorumlusu Onayı',
  external_approval: 'Dış Onay Yanıtı',
  submitted: 'Eksperden Gelen Rapor',
};

export function approvalDelayWorkflowStep(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function approvalDelayWaitingParty(category: string): string | null {
  if (category === 'pending_approval') return 'Dosya Sorumlusu';
  if (category === 'external_approval') return 'Sigorta / Dış Onay';
  if (category === 'submitted') return 'Eksper';
  return null;
}

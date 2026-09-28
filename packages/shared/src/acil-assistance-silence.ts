/** Acil asistans müşterisi: son gelen ihbar. Onay kuyruğu değildir. Mail otomatik gitmez. */

export const ACIL_SILENCE_CRM_HREF = '/panel/crm?lane=silent&kind=customer&scope=acil';
export const ACIL_SILENCE_STRIP_TITLE = 'Sessiz Müşteri Uyarı';
export const ACIL_SILENCE_STRIP_CLICK = 'Tıklayınız';
export const ACIL_SILENCE_STRIP_HINT =
  'İhbar Akış Hızı Düşmüş Olup, Mevcut ve Alternatif Müşteri Görüşmelerine Başlayınız';
export const ACIL_SILENCE_FOLLOW_UP_TITLE = 'Bu müşteriden ihbar gelmedi.';
export const ACIL_SILENCE_LIST_HREF = '/panel/operasyon?filter=acil';

const ASSISTANCE_SUB_TYPES = new Set(['asistan_firmasi', 'asistans_firmasi', 'asistan', 'asistans']);

export function isAssistanceFirmCustomer(
  customer?: {
    subType?: string | null;
    type?: string | null;
    entityType?: string | null;
  } | null,
): boolean {
  if (!customer) return false;
  const sub = String(customer.subType ?? '').trim().toLocaleLowerCase('tr-TR');
  return ASSISTANCE_SUB_TYPES.has(sub);
}

export function acilSilenceDismissStorageKey(istanbulYmd: string) {
  return `acil-sessiz-uyari-kapat:${istanbulYmd}`;
}

export function acilSilenceMailDraft(officeName: string) {
  const name = String(officeName ?? '').trim() || 'Asistans';
  return {
    subject: `${name} - Sonraki ihbar`,
    message: 'Merhaba,\n\nSon ihbardan bu yana yeni iş gelmedi. Sonraki ihbarda buradayız.\n',
  };
}

export function acilNewRegionMailDraft(officeName: string) {
  const name = String(officeName ?? '').trim() || 'Asistans';
  return {
    subject: `${name} - Bölge`,
    message: 'Merhaba,\n\nBölgede acil yardım yürüttüğümüzde buradayız. Ortak bir iş olursa yazabilirsiniz.\n',
  };
}

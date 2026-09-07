/**
 * Acil Yardım dijital onay.
 * Mustafa (07.09.2026): İhbarda adres ve hizmet talep onayı;
 * kapanışta ücret görünmeyen servis onay formu. Sözleşme (Hasar muvafakat) ayrıdır.
 */

export const ACIL_ADRES_HIZMET_TALEP_KIND = 'adres_hizmet_talep';
export const ACIL_SERVIS_ONAY_KIND = 'matbu_evrak';

export const ACIL_DIGITAL_APPROVAL_RESUME_ISO = '2026-08-28T18:01:00+03:00';
export const ACIL_DIGITAL_APPROVAL_RESUME_MS = Date.parse(ACIL_DIGITAL_APPROVAL_RESUME_ISO);

export function isAcilDigitalFormKind(kind: string): boolean {
  return kind === ACIL_ADRES_HIZMET_TALEP_KIND || kind === ACIL_SERVIS_ONAY_KIND;
}

export const ACIL_ADRES_HIZMET_TALEP_TITLE = 'Adres Ve Hizmet Talep Onayı';
export const ACIL_ADRES_HIZMET_TALEP_OLUSTUR = 'Adres Ve Hizmet Talep Onayı Oluştur';

export function acilDigitalFormTitle(kind: string): string {
  if (kind === ACIL_ADRES_HIZMET_TALEP_KIND) return ACIL_ADRES_HIZMET_TALEP_TITLE;
  if (kind === ACIL_SERVIS_ONAY_KIND) return 'Servis Onay Formu';
  return 'Evrak';
}

export function isAcilDigitalApprovalRequired(_now: Date | number = Date.now()): boolean {
  return true;
}

/** Onay yoksa kapı kapalı. */
export function acilDigitalApprovalGateOk(
  approved: boolean,
  _now: Date | number = Date.now(),
): boolean {
  return Boolean(approved);
}

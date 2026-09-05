/**
 * Acil Yardım dijital sözleşme / servis onay formu zorunluluğu.
 * Mustafa (05.09.2026): Acil’de her dosyada sözleşme uygulanmaz. Hasar dijital onayı ayrıdır.
 */

export const ACIL_DIGITAL_APPROVAL_RESUME_ISO = '2026-08-28T18:01:00+03:00';
export const ACIL_DIGITAL_APPROVAL_RESUME_MS = Date.parse(ACIL_DIGITAL_APPROVAL_RESUME_ISO);

export function isAcilDigitalApprovalRequired(_now: Date | number = Date.now()): boolean {
  return false;
}

/** Acil’de sözleşme kapısı yok; eksik form operasyonu durdurmaz. */
export function acilDigitalApprovalGateOk(
  _approved: boolean,
  _now: Date | number = Date.now(),
): boolean {
  return true;
}

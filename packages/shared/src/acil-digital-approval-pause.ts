/**
 * Acil Yardım dijital onay zorunluluğu — geçici durdurma.
 * 28.08.2026 18:00’e kadar kapalı; 18:01 (Europe/Istanbul) itibarıyla talimatsız açılır.
 * Hasar dijital onayı bu kurala girmez.
 */

export const ACIL_DIGITAL_APPROVAL_RESUME_ISO = '2026-08-28T18:01:00+03:00';
export const ACIL_DIGITAL_APPROVAL_RESUME_MS = Date.parse(ACIL_DIGITAL_APPROVAL_RESUME_ISO);

export function isAcilDigitalApprovalRequired(now: Date | number = Date.now()): boolean {
  const t = typeof now === 'number' ? now : now.getTime();
  if (!Number.isFinite(t)) return true;
  return t >= ACIL_DIGITAL_APPROVAL_RESUME_MS;
}

/** Zorunluluk kapalıyken eksik onay operasyonu durdurmaz. */
export function acilDigitalApprovalGateOk(
  approved: boolean,
  now: Date | number = Date.now(),
): boolean {
  return approved || !isAcilDigitalApprovalRequired(now);
}

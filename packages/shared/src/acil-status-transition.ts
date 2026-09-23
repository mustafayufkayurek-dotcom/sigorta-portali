/** Acil dosya durum basamağı — personel PATCH atlamaz, geri sıçramaz. */

export const ACIL_STATUS_SEQUENCE_MESSAGE = 'Bu işlem sırasıyla yapılmalıdır';

export const ACIL_STATUSES = ['GELEN', 'ATANDI', 'SAHADA', 'COZULDU', 'FATURALANDILDI'] as const;
export type AcilCaseStatus = (typeof ACIL_STATUSES)[number];

/**
 * İzinli ileri adımlar. Aynı durum yenilemesi serbesttir.
 * Canlı yedek: Gelen → Sahada (işe başlama / onay; Atandı yazılmamış dosya).
 * Atandı → Çözüldü (kapanış; Sahada yazılmamış dosya).
 * Gelen → Çözüldü / Faturalandı ve geri sıçrama yok.
 */
export const ACIL_STATUS_TRANSITIONS: Record<AcilCaseStatus, readonly AcilCaseStatus[]> = {
  GELEN: ['ATANDI', 'SAHADA'],
  ATANDI: ['SAHADA', 'COZULDU'],
  SAHADA: ['COZULDU'],
  COZULDU: ['FATURALANDILDI'],
  FATURALANDILDI: [],
};

export function isAcilCaseStatus(value: string): value is AcilCaseStatus {
  return (ACIL_STATUSES as readonly string[]).includes(value);
}

export function canAdvanceAcilStatus(from: string, to: string): boolean {
  if (from === to) return true;
  if (!isAcilCaseStatus(from) || !isAcilCaseStatus(to)) return false;
  return ACIL_STATUS_TRANSITIONS[from].includes(to);
}

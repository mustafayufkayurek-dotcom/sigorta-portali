/**
 * 4857 sayılı İş Kanunu m.53 — yıllık ücretli izin süresi (iş günü).
 * Kıdem / ihbar tazminatı bu yardımcıda YOKTUR (sonraki faz).
 */

export type LeaveEntitlementResult = {
  totalDays: number;
  completedYears: number;
  ruleLabel: string;
  eligible: boolean;
};

/** İşe giriş tarihine göre tamamlanan yıl sayısı (asOf itibarıyla). */
export function completedServiceYears(
  hireDate: Date | string | null | undefined,
  asOf: Date = new Date(),
): number {
  if (!hireDate) return 0;
  const hire = typeof hireDate === 'string' ? new Date(hireDate) : hireDate;
  if (Number.isNaN(hire.getTime())) return 0;

  let years = asOf.getUTCFullYear() - hire.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - hire.getUTCMonth();
  const dayDiff = asOf.getUTCDate() - hire.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1;
  }
  return Math.max(0, years);
}

/**
 * Yıllık izin hakedişi (iş günü).
 * - 1 yıldan az: hak yok (0)
 * - 1–5 yıl (5 dahil): 14
 * - 5 yıldan fazla – 15 yıl (15 dahil): 20
 * - 15 yıldan fazla: 26
 *
 * Not: 18 yaş altı / 50 yaş üstü için asgari 20 gün kuralı doğum tarihi
 * alanı gelince eklenecek.
 */
export function annualLeaveEntitlementDays(
  hireDate: Date | string | null | undefined,
  asOf: Date = new Date(),
): LeaveEntitlementResult {
  const completedYears = completedServiceYears(hireDate, asOf);

  if (!hireDate) {
    return {
      totalDays: 14,
      completedYears: 0,
      ruleLabel: 'İşe giriş tarihi yok — varsayılan 14 gün',
      eligible: false,
    };
  }

  if (completedYears < 1) {
    return {
      totalDays: 0,
      completedYears,
      ruleLabel: '1 yıl dolmadan yıllık izin hakkı doğmaz',
      eligible: false,
    };
  }

  if (completedYears <= 5) {
    return {
      totalDays: 14,
      completedYears,
      ruleLabel: '1–5 yıl hizmet → 14 iş günü',
      eligible: true,
    };
  }

  if (completedYears <= 15) {
    return {
      totalDays: 20,
      completedYears,
      ruleLabel: '5 yıldan fazla – 15 yıl → 20 iş günü',
      eligible: true,
    };
  }

  return {
    totalDays: 26,
    completedYears,
    ruleLabel: '15 yıldan fazla hizmet → 26 iş günü',
    eligible: true,
  };
}

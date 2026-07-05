/** Türkiye resmi tatilleri (YYYY-MM-DD) — bordro/puantaj otomatik işaretleme */
const TR_PUBLIC_HOLIDAYS: Record<number, string[]> = {
  2025: [
    '2025-01-01',
    '2025-03-30', '2025-03-31', '2025-04-01', // Ramazan Bayramı
    '2025-04-23',
    '2025-05-01',
    '2025-05-19',
    '2025-06-06', '2025-06-07', '2025-06-08', '2025-06-09', // Kurban Bayramı
    '2025-07-15',
    '2025-08-30',
    '2025-10-28', '2025-10-29',
  ],
  2026: [
    '2026-01-01',
    '2026-03-19', '2026-03-20', '2026-03-21', // Ramazan Bayramı
    '2026-04-23',
    '2026-05-01',
    '2026-05-19',
    '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30', // Kurban Bayramı
    '2026-07-15',
    '2026-08-30',
    '2026-10-28', '2026-10-29',
  ],
  2027: [
    '2027-01-01',
    '2027-03-09', '2027-03-10', '2027-03-11',
    '2027-04-23',
    '2027-05-01',
    '2027-05-19',
    '2027-05-16', '2027-05-17', '2027-05-18', '2027-05-19',
    '2027-07-15',
    '2027-08-30',
    '2027-10-28', '2027-10-29',
  ],
};

const holidaySetCache = new Map<number, Set<string>>();

function holidaySetForYear(year: number): Set<string> {
  let set = holidaySetCache.get(year);
  if (!set) {
    set = new Set(TR_PUBLIC_HOLIDAYS[year] ?? []);
    holidaySetCache.set(year, set);
  }
  return set;
}

/** ISO hafta günü: 0=Pazar … 6=Cumartesi. Varsayılan haftalık tatil: Pazar (İş Kanunu m.46). */
export const DEFAULT_WEEKLY_REST_DAY = 0;

export function isPublicHoliday(dateKey: string): boolean {
  const year = Number(dateKey.slice(0, 4));
  return holidaySetForYear(year).has(dateKey);
}

export function getPublicHolidayName(dateKey: string): string | null {
  if (!isPublicHoliday(dateKey)) return null;
  const [, m, d] = dateKey.split('-').map(Number);
  if (m === 1 && d === 1) return 'Yılbaşı';
  if (m === 4 && d === 23) return 'Ulusal Egemenlik ve Çocuk Bayramı';
  if (m === 5 && d === 1) return 'Emek ve Dayanışma Günü';
  if (m === 5 && d === 19) return 'Gençlik ve Spor Bayramı';
  if (m === 7 && d === 15) return 'Demokrasi ve Millî Birlik Günü';
  if (m === 8 && d === 30) return 'Zafer Bayramı';
  if (m === 10 && d === 28) return 'Cumhuriyet Bayramı Arifesi';
  if (m === 10 && d === 29) return 'Cumhuriyet Bayramı';
  if (m === 3 && d >= 19 && d <= 21) return 'Ramazan Bayramı';
  if (m === 6 && d >= 5 && d <= 9) return 'Kurban Bayramı';
  if (m === 5 && d >= 27 && d <= 30) return 'Kurban Bayramı';
  return 'Resmi Tatil';
}

export function isWeeklyRestDay(dateKey: string, weeklyRestDay = DEFAULT_WEEKLY_REST_DAY): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCDay() === weeklyRestDay;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function dateKeyInRange(dateKey: string, start: Date, end: Date): boolean {
  const t = parseDateKey(dateKey).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

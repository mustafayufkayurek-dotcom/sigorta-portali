/** Panel nabzı ve hatırlatma pencereleri — Europe/Istanbul. */

export function istanbulYmd(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function istanbulDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isIstanbulLastCalendarDay(now: Date = new Date()): boolean {
  const { year, month, day } = istanbulYmd(now);
  return day === istanbulDaysInMonth(year, month);
}

export function previousIstanbulMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/** Admin, saha ve portal günlük puantaj maili almaz. */
export function roleReceivesAttendanceReminders(roleCode?: string | null): boolean {
  const r = (roleCode ?? '').toUpperCase();
  if (!r) return true;
  if (r === 'ADMIN' || r === 'SUPER_ADMIN') return false;
  if (r === 'FIELD_STAFF') return false;
  if (r.includes('PORTAL')) return false;
  if (r === 'EXPERT' || r === 'INSURANCE_COMPANY_USER' || r === 'ASSISTANCE_COMPANY_USER') return false;
  return true;
}

/** İstanbul takvimi — hafta Pazartesi–Pazar. */

export function istanbulYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now);
}

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function istanbulWeekRange(now = new Date()): { from: string; to: string } {
  const ymd = istanbulYmd(now);
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const from = shiftYmd(ymd, mondayOffset);
  return { from, to: shiftYmd(from, 6) };
}

export function istanbulMonthRange(now = new Date()): { from: string; to: string } {
  const ymd = istanbulYmd(now);
  const [y, m] = ymd.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${y}-${String(m).padStart(2, '0')}-01`,
    to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  };
}

export function ymdOfIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return istanbulYmd(d);
}

export function inYmdRange(iso: string | null | undefined, from: string, to: string): boolean {
  const key = ymdOfIso(iso);
  if (!key) return false;
  return key >= from && key <= to;
}

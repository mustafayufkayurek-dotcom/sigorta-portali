export type PortalWeeklyPoint = { label: string; count: number };

export type PortalActivityRange =
  | { kind: 'last_days'; days: 7 | 15 | 30 }
  | { kind: 'month'; year: number; month: number } // month 0-11
  | { kind: 'year'; year: number };

type WeeklyActivityFile = {
  lastActivityAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  notificationDate?: string | null;
};

function activityInstant(file: WeeklyActivityFile): number | null {
  const raw =
    file.lastActivityAt ||
    file.notificationDate ||
    file.updatedAt ||
    file.createdAt;
  if (!raw) return null;
  const t = new Date(raw);
  if (Number.isNaN(t.getTime())) return null;
  return t.getTime();
}

function dayStartMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatDayLabel(d: Date, mode: 'weekday' | 'day' | 'monthDay'): string {
  if (mode === 'weekday') {
    return d.toLocaleDateString('tr-TR', { weekday: 'short' }).replace(/\.$/, '');
  }
  if (mode === 'day') {
    return String(d.getDate());
  }
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }).replace(/\.$/, '');
}

function buildDayBuckets(
  files: WeeklyActivityFile[],
  start: Date,
  endExclusive: Date,
  labelMode: 'weekday' | 'day' | 'monthDay',
): PortalWeeklyPoint[] {
  const startMs = dayStartMs(start);
  const endMs = dayStartMs(endExclusive);
  const dayCount = Math.max(0, Math.round((endMs - startMs) / 86_400_000));
  const counts = Array.from({ length: dayCount }, () => 0);
  const labels: string[] = [];

  for (let i = 0; i < dayCount; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    labels.push(formatDayLabel(d, labelMode));
  }

  for (const f of files) {
    const ms = activityInstant(f);
    if (ms == null) continue;
    const t = new Date(ms);
    const ds = dayStartMs(t);
    if (ds < startMs || ds >= endMs) continue;
    const idx = Math.floor((ds - startMs) / 86_400_000);
    if (idx >= 0 && idx < dayCount) counts[idx] += 1;
  }

  return labels.map((label, i) => ({ label, count: counts[i] ?? 0 }));
}

function buildMonthBuckets(files: WeeklyActivityFile[], year: number): PortalWeeklyPoint[] {
  const counts = Array.from({ length: 12 }, () => 0);
  const labels = Array.from({ length: 12 }, (_, m) =>
    new Date(year, m, 1).toLocaleDateString('tr-TR', { month: 'short' }).replace(/\.$/, ''),
  );

  for (const f of files) {
    const ms = activityInstant(f);
    if (ms == null) continue;
    const t = new Date(ms);
    if (t.getFullYear() !== year) continue;
    counts[t.getMonth()] += 1;
  }

  return labels.map((label, i) => ({ label, count: counts[i] ?? 0 }));
}

/** Dosya hareketi — gün / ay / yıl aralığı. */
export function buildPortalActivitySeries(
  files: WeeklyActivityFile[],
  range: PortalActivityRange,
  nowInput?: Date,
): PortalWeeklyPoint[] {
  const now = nowInput ?? new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range.kind === 'last_days') {
    const days = range.days;
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
    const endExclusive = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const labelMode = days <= 7 ? 'weekday' : days <= 15 ? 'day' : 'monthDay';
    return buildDayBuckets(files, start, endExclusive, labelMode);
  }

  if (range.kind === 'month') {
    const start = new Date(range.year, range.month, 1);
    const endExclusive = new Date(range.year, range.month + 1, 1);
    return buildDayBuckets(files, start, endExclusive, 'day');
  }

  return buildMonthBuckets(files, range.year);
}

/** @deprecated — buildPortalActivitySeries({ kind: 'last_days', days: 7 }) kullanın */
export function buildPortalWeeklyActivity(files: WeeklyActivityFile[]): PortalWeeklyPoint[] {
  return buildPortalActivitySeries(files, { kind: 'last_days', days: 7 });
}

export function portalActivityRangeLabel(range: PortalActivityRange): string {
  if (range.kind === 'last_days') {
    if (range.days === 7) return 'Son 7 Gün';
    if (range.days === 15) return 'Son 15 Gün';
    return 'Son 1 Ay';
  }
  if (range.kind === 'month') {
    const name = new Date(range.year, range.month, 1).toLocaleDateString('tr-TR', {
      month: 'long',
      year: 'numeric',
    });
    return name.replace(/^\w/, (c) => c.toLocaleUpperCase('tr-TR'));
  }
  return `${range.year} Yılı`;
}

/** Geriye dönük ay seçenekleri (içinde bulunulan ay dahil son 12 ay). */
export function buildPastMonthOptions(nowInput?: Date): Array<{ year: number; month: number; label: string }> {
  const now = nowInput ?? new Date();
  const out: Array<{ year: number; month: number; label: string }> = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d
      .toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
      .replace(/^\w/, (c) => c.toLocaleUpperCase('tr-TR'));
    out.push({ year: d.getFullYear(), month: d.getMonth(), label });
  }
  return out;
}

/** Geriye dönük yıl seçenekleri (içinde bulunulan yıl dahil son 5 yıl). */
export function buildPastYearOptions(nowInput?: Date): number[] {
  const y = (nowInput ?? new Date()).getFullYear();
  return [y, y - 1, y - 2, y - 3, y - 4];
}

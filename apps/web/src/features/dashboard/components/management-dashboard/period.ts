export type MgmtPeriodPreset = 'bugun' | 'bu_hafta' | 'bu_ay' | 'bu_yil' | 'ozel';

export type MgmtDateRange = {
  dateFrom: string;
  dateTo: string;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTrDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  return copy;
}

export function rangeForPreset(preset: MgmtPeriodPreset, now = new Date()): MgmtDateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'bugun') {
    const iso = toIsoDate(today);
    return { dateFrom: iso, dateTo: iso };
  }
  if (preset === 'bu_hafta') {
    const start = startOfWeekMonday(today);
    return { dateFrom: toIsoDate(start), dateTo: toIsoDate(today) };
  }
  if (preset === 'bu_ay') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { dateFrom: toIsoDate(start), dateTo: toIsoDate(today) };
  }
  if (preset === 'bu_yil') {
    const start = new Date(today.getFullYear(), 0, 1);
    return { dateFrom: toIsoDate(start), dateTo: toIsoDate(today) };
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { dateFrom: toIsoDate(start), dateTo: toIsoDate(today) };
}

export function detectPreset(dateFrom: string, dateTo: string, now = new Date()): MgmtPeriodPreset {
  const presets: MgmtPeriodPreset[] = ['bugun', 'bu_hafta', 'bu_ay', 'bu_yil'];
  for (const preset of presets) {
    const range = rangeForPreset(preset, now);
    if (range.dateFrom === dateFrom && range.dateTo === dateTo) return preset;
  }
  return 'ozel';
}

export const PERIOD_LABELS: Record<MgmtPeriodPreset, string> = {
  bugun: 'Bugün',
  bu_hafta: 'Bu Hafta',
  bu_ay: 'Bu Ay',
  bu_yil: 'Bu Yıl',
  ozel: 'Özel Tarih',
};

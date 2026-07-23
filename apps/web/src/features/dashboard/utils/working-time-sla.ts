/**
 * Çalışma günü / saatine göre bekleyen süre (SLA).
 * Varsayılan: Pzt–Cuma 09:00–18:00 (TR, saat dilimi bilinci olmadan yerel Date).
 */

export const DEFAULT_WORKDAY = {
  startHour: 9,
  endHour: 18,
  /** 0=Pazar … 6=Cumartesi — çalışma günleri */
  workDays: [1, 2, 3, 4, 5] as number[],
};

/** Yeşil / sarı / kırmızı eşikleri (çalışma saati cinsinden) */
export const SLA_WORKING_HOURS = {
  warningAt: 16, // ~2 iş günü
  criticalAt: 32, // ~4 iş günü
} as const;

export type SlaLevel = 'normal' | 'warning' | 'critical';

export function slaLevelFromWorkingHours(
  workingHours: number,
  thresholds: { warningAt: number; criticalAt: number } = SLA_WORKING_HOURS,
): SlaLevel {
  if (workingHours >= thresholds.criticalAt) return 'critical';
  if (workingHours >= thresholds.warningAt) return 'warning';
  return 'normal';
}

/** pendingSince → şimdi arasında biriken çalışma saati */
export function workingHoursBetween(
  from: Date | string,
  to: Date | string = new Date(),
  cfg = DEFAULT_WORKDAY,
): number {
  const start = typeof from === 'string' ? new Date(from) : from;
  const end = typeof to === 'string' ? new Date(to) : to;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;

  let hours = 0;
  const cursor = new Date(start);

  while (cursor < end) {
    const day = cursor.getDay();
    if (!cfg.workDays.includes(day)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(cfg.startHour, 0, 0, 0);
      continue;
    }

    const dayStart = new Date(cursor);
    dayStart.setHours(cfg.startHour, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(cfg.endHour, 0, 0, 0);

    const sliceStart = cursor > dayStart ? cursor : dayStart;
    const sliceEnd = end < dayEnd ? end : dayEnd;

    if (sliceEnd > sliceStart) {
      hours += (sliceEnd.getTime() - sliceStart.getTime()) / (1000 * 60 * 60);
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(cfg.startHour, 0, 0, 0);
  }

  return Math.round(hours * 10) / 10;
}

export function formatWorkingWaitLabel(workingHours: number): string {
  if (workingHours < 1) return '1 Saatten Az';
  if (workingHours < 8) return `${Math.round(workingHours)} Saat`;
  const days = Math.round((workingHours / 8) * 10) / 10;
  return `${days} İş Günü`;
}

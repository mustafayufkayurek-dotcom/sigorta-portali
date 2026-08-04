import {
  getPublicHolidayName,
  isPublicHoliday,
  isWeeklyRestDay,
  parseDateKey,
} from './hr-turkey-calendar.helper';

/** Kurumsal mesai penceresi — Europe/Istanbul. Ayar ekranı sonraki faz. */
export const HR_WORK_HOURS = {
  timeZone: 'Europe/Istanbul',
  weekday: { start: '08:30', end: '18:00' },
  saturday: { start: '08:30', end: '13:00' },
  sunday: null,
  /** Dakika toleransı — nabız/saat sapması için */
  graceMinutes: { lateStart: 5, earlyLeave: 5 },
} as const;

export type WorkHoursWindow = { start: string; end: string };

export type ClockCompliance = {
  expectedStart: string | null;
  expectedEnd: string | null;
  lateStartMinutes: number | null;
  earlyLeaveMinutes: number | null;
  isLateStart: boolean;
  isEarlyLeave: boolean;
  hasClockData: boolean;
  isWorkDay: boolean;
};

export function getWorkHoursSchedule() {
  return {
    timeZone: HR_WORK_HOURS.timeZone,
    weekday: HR_WORK_HOURS.weekday,
    saturday: HR_WORK_HOURS.saturday,
    sunday: HR_WORK_HOURS.sunday,
    graceMinutes: HR_WORK_HOURS.graceMinutes,
    labels: {
      weekday: `Hafta İçi ${HR_WORK_HOURS.weekday.start}–${HR_WORK_HOURS.weekday.end}`,
      saturday: `Cumartesi ${HR_WORK_HOURS.saturday.start}–${HR_WORK_HOURS.saturday.end}`,
      sunday: 'Pazar Ve Resmi Tatiller Çalışılmıyor',
      summary:
        `Hafta İçi ${HR_WORK_HOURS.weekday.start}–${HR_WORK_HOURS.weekday.end} · ` +
        `Cumartesi ${HR_WORK_HOURS.saturday.start}–${HR_WORK_HOURS.saturday.end} · ` +
        'Pazar Ve Resmi Tatiller Çalışılmıyor',
    },
  };
}

/** Beklenen mesai penceresi (YYYY-MM-DD). Tatil / Pazar → null. */
export function expectedWorkWindow(dateKey: string): WorkHoursWindow | null {
  if (isPublicHoliday(dateKey) || isWeeklyRestDay(dateKey)) return null;
  const dow = parseDateKey(dateKey).getUTCDay();
  if (dow === 6) return { ...HR_WORK_HOURS.saturday };
  if (dow === 0) return null;
  return { ...HR_WORK_HOURS.weekday };
}

function parseHmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** ISO anın Europe/Istanbul gün içi dakika değeri. */
export function istanbulMinutesOfDay(iso: string | Date): number {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return 0;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: HR_WORK_HOURS.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  // en-GB can return "24" for midnight in some engines — normalize
  const h = hour === 24 ? 0 : hour;
  return h * 60 + minute;
}

/** Istanbul YYYY-MM-DD for a given instant. */
export function istanbulDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HR_WORK_HOURS.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function formatIstanbulClock(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: HR_WORK_HOURS.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

export type PanelAccessEvaluation = {
  canEnter: boolean;
  notice: 'none' | 'late_entry' | 'closed';
  clockLabel: string;
  dateKey: string;
  expectedStart: string | null;
  expectedEnd: string | null;
  closedReasonLabel: string | null;
};

/**
 * Panel giriş kararı:
 * - Pazar / resmi tatil → kapalı
 * - Mesai bitişinden sonra (ör. Cumartesi 13:01+) → kapalı
 * - Mesai başlangıcından sonra (tolerans üstü) → giriş serbest + masum saat bildirimi
 */
export function evaluatePanelAccess(now: Date = new Date()): PanelAccessEvaluation {
  const dateKey = istanbulDateKey(now);
  const clockLabel = formatIstanbulClock(now);
  const mins = istanbulMinutesOfDay(now);
  const window = expectedWorkWindow(dateKey);

  if (!window) {
    const holidayName = getPublicHolidayName(dateKey);
    return {
      canEnter: false,
      notice: 'closed',
      clockLabel,
      dateKey,
      expectedStart: null,
      expectedEnd: null,
      closedReasonLabel: holidayName
        ? `${holidayName} nedeniyle sisteme giriş kapalıdır.`
        : 'Pazar günü sisteme giriş kapalıdır.',
    };
  }

  const startMin = parseHmToMinutes(window.start);
  const endMin = parseHmToMinutes(window.end);

  if (mins > endMin) {
    return {
      canEnter: false,
      notice: 'closed',
      clockLabel,
      dateKey,
      expectedStart: window.start,
      expectedEnd: window.end,
      closedReasonLabel: `Mesai bitişinden (${window.end}) sonra sisteme giriş kapalıdır.`,
    };
  }

  const grace = HR_WORK_HOURS.graceMinutes.lateStart;
  if (mins > startMin + grace) {
    return {
      canEnter: true,
      notice: 'late_entry',
      clockLabel,
      dateKey,
      expectedStart: window.start,
      expectedEnd: window.end,
      closedReasonLabel: null,
    };
  }

  return {
    canEnter: true,
    notice: 'none',
    clockLabel,
    dateKey,
    expectedStart: window.start,
    expectedEnd: window.end,
    closedReasonLabel: null,
  };
}

/** Mesai bitmeden çıkış — masum bilgilendirme (engel yok). */
export function evaluateEarlyExitNotice(now: Date = new Date()): {
  show: boolean;
  clockLabel: string;
  expectedEnd: string | null;
  dateKey: string;
} {
  const dateKey = istanbulDateKey(now);
  const clockLabel = formatIstanbulClock(now);
  const window = expectedWorkWindow(dateKey);
  if (!window) {
    return { show: false, clockLabel, expectedEnd: null, dateKey };
  }
  const mins = istanbulMinutesOfDay(now);
  const endMin = parseHmToMinutes(window.end);
  const grace = HR_WORK_HOURS.graceMinutes.earlyLeave;
  const show = mins < endMin - grace;
  return { show, clockLabel, expectedEnd: window.end, dateKey };
}

export function evaluateClockCompliance(
  dateKey: string,
  clockInAt: string | null | undefined,
  clockOutAt: string | null | undefined,
  opts?: { skip?: boolean },
): ClockCompliance {
  const window = expectedWorkWindow(dateKey);
  const hasClockData = Boolean(clockInAt || clockOutAt);

  if (!window || opts?.skip) {
    return {
      expectedStart: window?.start ?? null,
      expectedEnd: window?.end ?? null,
      lateStartMinutes: null,
      earlyLeaveMinutes: null,
      isLateStart: false,
      isEarlyLeave: false,
      hasClockData,
      isWorkDay: Boolean(window) && !opts?.skip,
    };
  }

  const graceLate = HR_WORK_HOURS.graceMinutes.lateStart;
  const graceEarly = HR_WORK_HOURS.graceMinutes.earlyLeave;
  const expectedStartMin = parseHmToMinutes(window.start);
  const expectedEndMin = parseHmToMinutes(window.end);

  let lateStartMinutes: number | null = null;
  let earlyLeaveMinutes: number | null = null;

  if (clockInAt) {
    const diff = istanbulMinutesOfDay(clockInAt) - expectedStartMin;
    lateStartMinutes = Math.max(0, diff - graceLate);
  }
  if (clockOutAt) {
    const diff = expectedEndMin - istanbulMinutesOfDay(clockOutAt);
    earlyLeaveMinutes = Math.max(0, diff - graceEarly);
  }

  return {
    expectedStart: window.start,
    expectedEnd: window.end,
    lateStartMinutes,
    earlyLeaveMinutes,
    isLateStart: (lateStartMinutes ?? 0) > 0,
    isEarlyLeave: (earlyLeaveMinutes ?? 0) > 0,
    hasClockData,
    isWorkDay: true,
  };
}

'use client';

type CalendarDay = {
  date: string;
  dayOfMonth: number;
  weekday: number;
  attendanceStatus: string | null;
  statusLabel: string | null;
  minutesWorked: number | null;
  suggestedMinutes: number | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  employeeConfirmedAt: string | null;
  isFuture: boolean;
  isAutoMarked: boolean;
  isLateStart?: boolean;
  isEarlyLeave?: boolean;
  lateStartMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
};

const STATUS_STYLES: Record<string, string> = {
  present: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  absent: 'bg-red-50 border-red-200 text-red-700',
  half_day: 'bg-amber-50 border-amber-200 text-amber-800',
  leave: 'bg-blue-50 border-blue-200 text-blue-800',
  holiday: 'bg-purple-50 border-purple-200 text-purple-800',
  weekly_rest: 'bg-slate-100 border-slate-200 text-slate-500',
};

/** Onaysız geçmiş iş günü — "boş hücre" hissini gidermek için amber vurgu. */
const PENDING_STYLE = 'bg-amber-50 border-amber-200 text-amber-800';
const FUTURE_STYLE = 'bg-white border-slate-100 text-slate-300';

const WEEKDAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const LEGEND_ITEMS = [
  { label: 'Onaylı', dot: 'bg-emerald-500' },
  { label: 'Bekliyor', dot: 'bg-amber-500' },
  { label: 'İzinli', dot: 'bg-blue-500' },
  { label: 'Tatil / Hafta Sonu', dot: 'bg-slate-400' },
  { label: 'Geç / Erken', dot: 'bg-status-warning' },
];

function minutesLabel(minutes: number | null | undefined) {
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  return `${h}s ${m}d`;
}

function confirmedAtTime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function clockRange(clockInAt: string | null, clockOutAt: string | null) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  return `${clockInAt ? fmt(clockInAt) : '—'} – ${clockOutAt ? fmt(clockOutAt) : '—'}`;
}

type Props = {
  days: CalendarDay[];
  year: number;
  month: number;
  isLocked?: boolean;
  onConfirmDay?: (date: string) => void;
  confirmingDate?: string | null;
  /** İlk yükleme: günler yokken ızgara durur */
  waiting?: boolean;
  /** Onay / yenileme: tuşlar silinmez, yerinde soluk şerit */
  busy?: boolean;
};

function ConfirmSlotSkeleton() {
  return (
    <div
      className="mt-auto h-7 w-full shrink-0 animate-pulse rounded-md bg-slate-200 sm:h-6"
      aria-hidden
      data-testid="puantaj-onay-yukleme"
    />
  );
}

export function AttendanceCalendar({
  days,
  year,
  month,
  isLocked = false,
  onConfirmDay,
  confirmingDate,
  waiting = false,
  busy = false,
}: Props) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const blanks = Array.from({ length: firstWeekday }, (_, i) => i);
  const dayMap = new Map(days.map((d) => [d.dayOfMonth, d]));
  const daysInMonth = waiting
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : (days.length > 0 ? Math.max(...days.map((d) => d.dayOfMonth)) : 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white" aria-busy={waiting || busy || Boolean(confirmingDate)}>
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-0.5 py-2 text-center text-[10px] font-semibold text-slate-500 sm:text-xs">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-100">
        {blanks.map((i) => (
          <div key={`blank-${i}`} className="min-h-[4.75rem] bg-white sm:min-h-[88px]" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dom) => {
          if (waiting) {
            return (
              <div
                key={`wait-${dom}`}
                className="flex min-h-[4.75rem] min-w-0 flex-col overflow-visible bg-white p-1 sm:min-h-[88px] sm:p-1.5"
              >
                <div className="h-3 w-4 animate-pulse rounded bg-slate-200" />
                <ConfirmSlotSkeleton />
              </div>
            );
          }
          const day = dayMap.get(dom);
          if (!day) {
            return <div key={dom} className="min-h-[4.75rem] bg-white sm:min-h-[88px]" />;
          }

          const isSpecialStatus =
            day.attendanceStatus === 'weekly_rest' || day.attendanceStatus === 'holiday' || day.attendanceStatus === 'leave';
          const isPending = !day.isFuture && !isSpecialStatus && !day.employeeConfirmedAt;
          const style = day.isFuture
            ? FUTURE_STYLE
            : isSpecialStatus
              ? (STATUS_STYLES[day.attendanceStatus as string] ?? 'bg-white border-slate-100')
              : isPending
                ? PENDING_STYLE
                : STATUS_STYLES.present;

          const canConfirm = !isLocked && !day.isFuture && onConfirmDay && isPending;
          const shortLabel = day.isFuture
            ? ''
            : day.statusLabel
              ?? (isPending ? 'Bekliyor' : day.attendanceStatus ? day.attendanceStatus : '—');
          const confirming = confirmingDate === day.date;

          return (
            <div
              key={day.date}
              className={`flex min-h-[4.75rem] min-w-0 flex-col overflow-visible bg-white p-1 sm:min-h-[88px] sm:p-1.5 border ${style}`}
            >
              <div className="flex items-center justify-between gap-0.5">
                <span className="text-[11px] font-bold sm:text-xs">{dom}</span>
                {day.employeeConfirmedAt && (
                  <span
                    className="text-[10px] text-emerald-600"
                    title={`Personel Tarafından Onaylandı · ${confirmedAtTime(day.employeeConfirmedAt)}`}
                  >
                    ✓
                  </span>
                )}
              </div>
              {shortLabel && (
                <p className="mt-0.5 hidden text-[10px] font-medium leading-tight sm:block sm:truncate">
                  {shortLabel}
                </p>
              )}
              {(day.minutesWorked ?? day.suggestedMinutes) != null && (
                <p className="mt-auto hidden text-[10px] text-slate-500 sm:block">
                  {minutesLabel(day.minutesWorked ?? day.suggestedMinutes)}
                </p>
              )}
              {(day.clockInAt || day.clockOutAt) && (
                <p className="hidden text-[10px] leading-tight text-slate-500 sm:block" title={clockRange(day.clockInAt, day.clockOutAt)}>
                  {clockRange(day.clockInAt, day.clockOutAt)}
                </p>
              )}
              {(day.isLateStart || day.isEarlyLeave) && (
                <p
                  className="hidden text-[10px] font-semibold leading-tight text-status-warning sm:block"
                  title={[
                    day.isLateStart ? `Geç +${day.lateStartMinutes ?? 0} dk` : '',
                    day.isEarlyLeave ? `Erken −${day.earlyLeaveMinutes ?? 0} dk` : '',
                  ].filter(Boolean).join(' · ')}
                >
                  {day.isLateStart ? 'Geç' : ''}
                  {day.isLateStart && day.isEarlyLeave ? ' · ' : ''}
                  {day.isEarlyLeave ? 'Erken' : ''}
                </p>
              )}
              {canConfirm && (busy || confirming) ? (
                <ConfirmSlotSkeleton />
              ) : canConfirm ? (
                <button
                  type="button"
                  disabled={confirming}
                  onClick={() => onConfirmDay?.(day.date)}
                  aria-label={`${dom} Onayla`}
                  className="mt-auto min-h-7 w-full shrink-0 rounded-md bg-brand-600 px-0.5 py-1 text-[10px] font-semibold leading-none text-white hover:bg-brand-700 disabled:opacity-50 sm:mt-1 sm:min-h-0 sm:py-0.5 sm:px-1"
                >
                  <span className="sm:hidden">✓</span>
                  <span className="hidden sm:inline">Onayla</span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-3 py-2">
        {LEGEND_ITEMS.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={`h-2 w-2 rounded-full ${item.dot}`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

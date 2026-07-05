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
};

const STATUS_STYLES: Record<string, string> = {
  present: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  absent: 'bg-red-50 border-red-200 text-red-700',
  half_day: 'bg-amber-50 border-amber-200 text-amber-800',
  leave: 'bg-blue-50 border-blue-200 text-blue-800',
  holiday: 'bg-purple-50 border-purple-200 text-purple-800',
  weekly_rest: 'bg-slate-100 border-slate-200 text-slate-500',
};

const WEEKDAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function minutesLabel(minutes: number | null | undefined) {
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  return `${h}s ${m}d`;
}

type Props = {
  days: CalendarDay[];
  year: number;
  month: number;
  isLocked?: boolean;
  onConfirmDay?: (date: string) => void;
  confirmingDate?: string | null;
};

export function AttendanceCalendar({
  days,
  year,
  month,
  isLocked = false,
  onConfirmDay,
  confirmingDate,
}: Props) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const blanks = Array.from({ length: firstWeekday }, (_, i) => i);
  const dayMap = new Map(days.map((d) => [d.dayOfMonth, d]));

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2 text-center text-xs font-semibold text-slate-500">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-100">
        {blanks.map((i) => (
          <div key={`blank-${i}`} className="min-h-[88px] bg-white" />
        ))}
        {Array.from({ length: days.length > 0 ? Math.max(...days.map((d) => d.dayOfMonth)) : 0 }, (_, i) => i + 1).map((dom) => {
          const day = dayMap.get(dom);
          if (!day) {
            return <div key={dom} className="min-h-[88px] bg-white" />;
          }
          const style = day.attendanceStatus ? STATUS_STYLES[day.attendanceStatus] ?? 'bg-white border-slate-100' : 'bg-white border-slate-100 text-slate-400';
          const canConfirm = !isLocked && !day.isFuture && onConfirmDay
            && day.attendanceStatus !== 'weekly_rest'
            && day.attendanceStatus !== 'holiday'
            && !day.employeeConfirmedAt;

          return (
            <div
              key={day.date}
              className={`min-h-[88px] bg-white p-1.5 flex flex-col border ${style} ${day.isFuture ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold">{dom}</span>
                {day.employeeConfirmedAt && (
                  <span className="text-[10px] text-emerald-600" title="Onaylandı">✓</span>
                )}
              </div>
              <p className="text-[10px] leading-tight mt-1 font-medium truncate">
                {day.statusLabel ?? (day.attendanceStatus ? day.attendanceStatus : '—')}
              </p>
              {(day.minutesWorked ?? day.suggestedMinutes) != null && (
                <p className="text-[10px] text-slate-500 mt-auto">
                  {minutesLabel(day.minutesWorked ?? day.suggestedMinutes)}
                </p>
              )}
              {(day.clockInAt || day.clockOutAt) && (
                <p className="text-[10px] text-slate-500 leading-tight">
                  {day.clockInAt ? new Date(day.clockInAt).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                  {' – '}
                  {day.clockOutAt ? new Date(day.clockOutAt).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                </p>
              )}
              {canConfirm && (
                <button
                  type="button"
                  disabled={confirmingDate === day.date}
                  onClick={() => onConfirmDay(day.date)}
                  className="mt-1 text-[10px] rounded-md bg-[#1a4080] text-white py-0.5 px-1 hover:bg-[#153366] disabled:opacity-50"
                >
                  {confirmingDate === day.date ? '…' : 'Onayla'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

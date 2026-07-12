'use client';

import { CalendarDays, CheckCircle2, ClipboardList, Clock, Sparkles } from 'lucide-react';
import {
  formatWeekLabel,
  type MeetingReadiness,
  type MondayMeetingPayload,
} from './use-monday-meeting-data';

type BriefingStatProps = {
  label: string;
  value: string | number;
  hint?: string;
  accentClass?: string;
  iconBg?: string;
  icon: React.ReactNode;
};

function BriefingStat({
  label,
  value,
  hint,
  accentClass,
  iconBg,
  icon,
}: BriefingStatProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-card dark:border-slate-700 dark:bg-slate-900 ${accentClass ?? 'card-accent-blue'}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg ?? 'bg-blue-50 dark:bg-blue-950/40'}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium leading-none tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-base font-bold tabular-nums leading-tight text-slate-900 dark:text-white">
          {value}
        </p>
        {hint ? (
          <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

const READINESS_LABELS: Record<MeetingReadiness, string> = {
  ready: 'Toplantıya Hazır',
  pending: 'Gündem Bekliyor',
  empty: 'Gündem Oluşturulmalı',
};

const READINESS_ACCENTS: Record<MeetingReadiness, string> = {
  ready: 'card-accent-emerald',
  pending: 'card-accent-amber',
  empty: 'card-accent-blue',
};

const READINESS_ICON_BG: Record<MeetingReadiness, string> = {
  ready: 'bg-emerald-50 dark:bg-emerald-950/40',
  pending: 'bg-amber-50 dark:bg-amber-950/40',
  empty: 'bg-slate-100 dark:bg-slate-800',
};

function BriefingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-[76px] animate-pulse rounded-2xl border border-slate-200/70 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
        />
      ))}
    </div>
  );
}

type MondayMeetingBriefingBandProps = {
  data: MondayMeetingPayload | null;
  loading: boolean;
  openAgenda: number;
  completedThisWeek: number;
  activeTemplates: number;
  readiness: MeetingReadiness;
};

export function MondayMeetingBriefingBand({
  data,
  loading,
  openAgenda,
  completedThisWeek,
  activeTemplates,
  readiness,
}: MondayMeetingBriefingBandProps) {
  if (loading) return <BriefingSkeleton />;

  const todayLabel = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const weekLabel = data ? formatWeekLabel(data.weekKey) : '—';

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <BriefingStat
        label="Bugün"
        value={todayLabel.split(',')[0] ?? todayLabel}
        hint={todayLabel.includes(',') ? todayLabel.split(',').slice(1).join(',').trim() : undefined}
        icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
      />
      <BriefingStat
        label="Toplantı Haftası"
        value={weekLabel.split('·')[0]?.trim() ?? weekLabel}
        hint={weekLabel.includes('·') ? weekLabel.split('·').slice(1).join('·').trim() : undefined}
        accentClass="card-accent-purple"
        iconBg="bg-purple-50 dark:bg-purple-950/40"
        icon={<Clock className="h-4 w-4 text-purple-600" />}
      />
      <BriefingStat
        label="Açık Gündem"
        value={openAgenda}
        hint={openAgenda === 0 ? 'Tamamlanan maddeler arşivlendi' : 'İşaretlenmemiş madde'}
        accentClass="card-accent-amber"
        iconBg="bg-amber-50 dark:bg-amber-950/40"
        icon={<ClipboardList className="h-4 w-4 text-amber-600" />}
      />
      <BriefingStat
        label="Tamamlanan Not"
        value={completedThisWeek}
        hint={`${activeTemplates} mutatap konu tanımlı`}
        accentClass="card-accent-emerald"
        iconBg="bg-emerald-50 dark:bg-emerald-950/40"
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
      />
      <BriefingStat
        label="Hazırlık Durumu"
        value={READINESS_LABELS[readiness]}
        hint={
          readiness === 'ready'
            ? 'Tüm gündem maddeleri tamamlandı'
            : readiness === 'pending'
              ? `${openAgenda} madde toplantıda ele alınacak`
              : 'Mutatap konulardan veya yeni not ekleyin'
        }
        accentClass={READINESS_ACCENTS[readiness]}
        iconBg={READINESS_ICON_BG[readiness]}
        icon={<Sparkles className="h-4 w-4 text-slate-600 dark:text-slate-300" />}
      />
    </div>
  );
}

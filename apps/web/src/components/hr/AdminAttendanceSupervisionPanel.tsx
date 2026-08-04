'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Mail,
  Plane,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  DAY_END_SUPERVISION_PREVIEW,
  type DayEndMissingEmployee,
  type DayEndSupervisionPreview,
} from './attendance-day-end.preview';
import { AdminEmployeeOnboardPanel } from './AdminEmployeeOnboardPanel';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/contexts/ToastContext';

type FilterKey = 'all' | 'ok' | 'missing' | 'leave';

const STATUS_META: Record<
  DayEndMissingEmployee['status'],
  { label: string; className: string }
> = {
  missing: {
    label: 'Onaylamadı',
    className: 'bg-red-50 text-status-danger border border-red-100',
  },
  ok: {
    label: 'Onayladı',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  },
  on_leave: {
    label: 'İzinli',
    className: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
};

type WindowCard = {
  key: FilterKey;
  label: string;
  hint: string;
  value: number;
  icon: LucideIcon;
  tone: 'brand' | 'success' | 'danger' | 'neutral';
};

const TONE_CLASS: Record<
  WindowCard['tone'],
  { wrap: string; icon: string; value: string }
> = {
  brand: {
    wrap: 'border-slate-100 bg-slate-50/70 hover:border-slate-200',
    icon: 'bg-brand-50 text-brand-600',
    value: 'text-content-primary',
  },
  success: {
    wrap: 'border-emerald-100 bg-emerald-50/40 hover:border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-700',
    value: 'text-emerald-700',
  },
  danger: {
    wrap: 'border-red-100 bg-red-50/50 hover:border-red-200',
    icon: 'bg-red-100 text-status-danger',
    value: 'text-status-danger',
  },
  neutral: {
    wrap: 'border-slate-100 bg-slate-50/70 hover:border-slate-200',
    icon: 'bg-slate-200 text-slate-600',
    value: 'text-content-primary',
  },
};

function formatShortDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

type Props = {
  preview?: boolean;
  onOpenEmployeeFile?: (employee: DayEndMissingEmployee) => void;
};

export function AdminAttendanceSupervisionPanel({
  preview = false,
  onOpenEmployeeFile,
}: Props) {
  const { showToast } = useToast();
  const [realData, setRealData] = useState<DayEndSupervisionPreview | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [loadError, setLoadError] = useState(false);
  const [mailSending, setMailSending] = useState(false);

  useEffect(() => {
    if (preview) return;
    let alive = true;
    setLoading(true);
    setLoadError(false);
    apiClient
      .get<DayEndSupervisionPreview>('hr/attendance/day-end-summary')
      .then((res) => {
        if (!alive) return;
        setRealData(res);
      })
      .catch(() => {
        if (!alive) return;
        setLoadError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [preview]);

  const data = preview ? DAY_END_SUPERVISION_PREVIEW : realData;
  const employees = useMemo(() => data?.employees ?? [], [data]);
  const [filter, setFilter] = useState<FilterKey>('missing');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mailNote, setMailNote] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setSelectedId((prev) => prev ?? data.employees.find((e) => e.status === 'missing')?.id ?? data.employees[0]?.id ?? null);
  }, [data]);

  const leaveProxyHint = useMemo(() => {
    const onLeave = employees.filter((e) => e.status === 'on_leave');
    if (onLeave.length === 0) return 'Vekil yok';
    if (onLeave.length === 1) {
      return `Vekil: ${onLeave[0].proxyName ?? '—'}`;
    }
    return `${onLeave.length} kişi · vekiller listede`;
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (filter === 'missing') return e.status === 'missing';
      if (filter === 'ok') return e.status === 'ok';
      if (filter === 'leave') return e.status === 'on_leave';
      return true;
    });
  }, [employees, filter]);

  if (!preview && loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-8 text-center">
        <div className="animate-pulse h-24 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (!preview && (loadError || !data)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Denetim özeti yüklenemedi. Sayfayı yenileyin.
      </div>
    );
  }

  if (!data) return null;

  const windows: WindowCard[] = [
    {
      key: 'all',
      label: 'Toplam Personel',
      hint: 'Tüm aktif kadro',
      value: data.totals.totalEmployees,
      icon: Users,
      tone: 'brand',
    },
    {
      key: 'leave',
      label: 'İzinli',
      hint: leaveProxyHint,
      value: data.totals.onLeave,
      icon: Plane,
      tone: 'neutral',
    },
    {
      key: 'ok',
      label: 'Puantajı Onaylayan',
      hint: 'Gün sonunda oluşur',
      value: data.totals.approved,
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      key: 'missing',
      label: 'Puantajı Onaylamayan',
      hint: 'Bildirim + mail',
      value: data.totals.notApproved,
      icon: AlertTriangle,
      tone: 'danger',
    },
  ];

  const selected =
    data.employees.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  const openFile = (employee: DayEndMissingEmployee) => {
    setSelectedId(employee.id);
    onOpenEmployeeFile?.(employee);
  };

  const selectWindow = (key: FilterKey) => {
    setFilter(key);
  };

  const handleMailMissing = async () => {
    if (preview) {
      setMailNote(
        `${data.totals.notApproved} personele hatırlatma maili hazırlandı (önizleme).`,
      );
      return;
    }
    setMailSending(true);
    try {
      const result = await apiClient.post<{ success: boolean; message: string; sentCount: number }>(
        'hr/attendance/notify-missing',
        {},
      );
      setMailNote(result.message);
      if (result.success) {
        showToast('success', result.message);
      } else {
        showToast('error', result.message);
      }
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Mail Gönderilemedi');
    } finally {
      setMailSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-content-primary">
              Özet Ve Denetim
            </h3>
            {preview && (
              <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Tasarım Önizleme
              </span>
            )}
          </div>
          <p className="text-xs text-content-tertiary mt-1">
            {data.workDateLabel} · Mesai Bitiş / Kesim {data.cutoffLabel}
          </p>
          {data.workHours?.labels.summary ? (
            <p className="text-[11px] text-content-tertiary mt-0.5">
              {data.workHours.labels.summary}
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 min-w-[180px]">
          <p className="text-xs font-medium text-content-tertiary">
            Kalan İznim ({data.myLeaveBalance.leaveTypeLabel})
          </p>
          <p className="text-2xl font-bold text-brand-700 tabular-nums mt-0.5">
            {data.myLeaveBalance.remainingDays}{' '}
            <span className="text-sm font-semibold">gün</span>
          </p>
          <p className="text-[11px] text-content-tertiary mt-1">
            Toplam {data.myLeaveBalance.totalDays} · Kullanılan{' '}
            {data.myLeaveBalance.usedDays} · Bekleyen{' '}
            {data.myLeaveBalance.pendingDays}
          </p>
        </div>
      </div>

      <AdminEmployeeOnboardPanel preview={preview} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {windows.map((card) => {
          const Icon = card.icon;
          const tone = TONE_CLASS[card.tone];
          const active = filter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => selectWindow(card.key)}
              className={`rounded-xl border p-4 text-left transition-colors ${tone.wrap} ${
                active ? 'ring-2 ring-brand-600 ring-offset-1' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone.icon}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className={`text-2xl font-bold tabular-nums ${tone.value}`}>
                  {card.value}
                </p>
              </div>
              <p className="mt-3 text-sm font-semibold text-content-primary">
                {card.label}
              </p>
              <p className="text-xs text-content-tertiary mt-0.5">{card.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-xs text-content-secondary space-y-1">
        <p>
          <span className="font-semibold text-content-primary">Puantajı Onaylayan</span>
          {' '}verileri gün sonunda oluşur.
        </p>
        <p>
          Gün sonunda <span className="font-semibold text-content-primary">Puantajı Onaylamayan</span>
          {' '}yöneticiye bildirim düşer; personele mail gönderilebilir.
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <span className="inline-flex items-center gap-1 font-semibold text-status-warning">
            <Clock3 className="h-3.5 w-3.5" />
            Geç Başlangıç: {data.totals.lateStart ?? 0}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-status-danger">
            Erken Çıkış: {data.totals.earlyLeave ?? 0}
          </span>
          <span className="text-content-tertiary">
            (Panel aktivitesi / kayıtlı saat · 5 dk tolerans)
          </span>
        </p>
      </div>

      {(filter === 'missing' || filter === 'all') && data.totals.notApproved > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-content-tertiary">
            Her kişi yalnızca bir pencerede yer alır.
          </p>
          <button
            type="button"
            disabled={mailSending}
            onClick={handleMailMissing}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-content-primary hover:bg-slate-50 disabled:opacity-50"
          >
            <Mail className="h-3.5 w-3.5 text-brand-600" />
            {mailSending ? 'Gönderiliyor...' : 'Onaylamayanlara Mail Gönder'}
          </button>
        </div>
      )}

      {mailNote && (
        <p className="text-xs font-medium text-brand-700 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
          {mailNote}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-muted/60">
            <p className="text-xs font-medium text-content-tertiary">
              {filter === 'missing'
                ? 'Puantajı Onaylamayan'
                : filter === 'ok'
                  ? 'Puantajı Onaylayan'
                  : filter === 'leave'
                    ? 'İzinli Personel'
                    : 'Personel Listesi'}
              {' · '}
              {filtered.length} Kayıt
            </p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-content-tertiary">
                Bu görünümde personel yok.
              </div>
            ) : (
              filtered.map((employee) => {
                const meta = STATUS_META[employee.status];
                const active = selected?.id === employee.id;
                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => openFile(employee)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      active ? 'bg-brand-50/70' : 'hover:bg-surface-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-content-primary truncate">
                          {employee.fullName}
                        </p>
                        <p className="text-xs text-content-tertiary mt-0.5">
                          {employee.department} · {employee.roleLabel}
                        </p>
                        <p className="text-xs text-content-secondary mt-1">
                          {employee.status === 'on_leave'
                            ? `Vekil: ${employee.proxyName ?? '—'} · Kalan İzin: ${employee.remainingLeaveDays} gün`
                            : `Kalan İzin: ${employee.remainingLeaveDays} gün · Son Onay: ${formatShortDate(employee.lastConfirmedDate)}${
                                employee.missingDates.length > 0
                                  ? ` · Eksik: ${employee.missingDates
                                      .map(formatShortDate)
                                      .join(', ')}`
                                  : ''
                              }`}
                        </p>
                        {(employee.isLateStart || employee.isEarlyLeave) && (
                          <p className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                            {employee.isLateStart ? (
                              <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-status-warning">
                                Geç +{employee.lateStartMinutes ?? 0} dk
                              </span>
                            ) : null}
                            {employee.isEarlyLeave ? (
                              <span className="rounded-full bg-status-danger/10 px-2 py-0.5 text-status-danger">
                                Erken −{employee.earlyLeaveMinutes ?? 0} dk
                              </span>
                            ) : null}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:col-span-2 rounded-xl border border-border bg-surface p-4 space-y-4">
          <p className="text-xs font-medium text-content-tertiary">
            Özlük Dosyası Özeti
          </p>
          {!selected ? (
            <p className="text-sm text-content-tertiary">
              Soldan bir personel seçin.
            </p>
          ) : (
            <>
              <div>
                <p className="text-lg font-semibold text-content-primary">
                  {selected.fullName}
                </p>
                <p className="text-sm text-content-secondary mt-1">
                  {selected.department} · {selected.roleLabel}
                </p>
              </div>

              {selected.status === 'missing' && (
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-status-danger" />
                    <div>
                      <p className="text-sm font-semibold text-content-primary">
                        Puantaj Onaylanmadı
                      </p>
                      <p className="text-xs text-content-secondary mt-1">
                        Eksik gün:{' '}
                        {selected.missingDates.map(formatShortDate).join(', ')}.
                        Gün sonunda yönetici bildirimi oluşur; mail
                        gönderilebilir.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selected.status === 'ok' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                    <p className="text-sm text-content-secondary">
                      Puantaj onayı tamamlanmış.
                    </p>
                  </div>
                </div>
              )}

              {(selected.isLateStart || selected.isEarlyLeave || selected.expectedStart) && (
                <div className="rounded-xl border border-border bg-slate-50/80 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-content-secondary">Mesai Denetimi</p>
                  <p className="text-xs text-content-tertiary">
                    Beklenen:{' '}
                    {selected.expectedStart && selected.expectedEnd
                      ? `${selected.expectedStart} – ${selected.expectedEnd}`
                      : 'Çalışılmıyor / İzin'}
                  </p>
                  {selected.isLateStart ? (
                    <p className="text-xs font-semibold text-status-warning">
                      Geç Başlangıç (+{selected.lateStartMinutes ?? 0} dk)
                    </p>
                  ) : null}
                  {selected.isEarlyLeave ? (
                    <p className="text-xs font-semibold text-status-danger">
                      Erken Çıkış (−{selected.earlyLeaveMinutes ?? 0} dk)
                    </p>
                  ) : null}
                  {!selected.isLateStart && !selected.isEarlyLeave && selected.expectedStart ? (
                    <p className="text-xs font-medium text-status-success">Saatler Uygun</p>
                  ) : null}
                </div>
              )}

              {selected.status === 'on_leave' && (
                <div className="rounded-xl border border-border bg-surface-muted p-3 space-y-2">
                  <p className="text-sm font-semibold text-content-primary">
                    İzinli — Ekran Pasif
                  </p>
                  <p className="text-sm text-content-secondary">
                    Vekil Personel:{' '}
                    <span className="font-semibold text-content-primary">
                      {selected.proxyName ?? '—'}
                    </span>
                  </p>
                  <p className="text-xs text-content-tertiary">
                    Vekalet admin onayından sonra devreye girmiştir.
                  </p>
                </div>
              )}

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-content-tertiary">Kalan İzin</dt>
                  <dd className="font-medium text-content-primary">
                    {selected.remainingLeaveDays} gün
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-content-tertiary">Son Onay</dt>
                  <dd className="font-medium text-content-primary">
                    {formatShortDate(selected.lastConfirmedDate)}
                  </dd>
                </div>
                {selected.status === 'on_leave' && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-content-tertiary">Vekil</dt>
                    <dd className="font-medium text-content-primary">
                      {selected.proxyName ?? '—'}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-content-tertiary">Durum</dt>
                  <dd>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_META[selected.status].className}`}
                    >
                      {STATUS_META[selected.status].label}
                    </span>
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => openFile(selected)}
                className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Özlük Dosyasını Aç
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

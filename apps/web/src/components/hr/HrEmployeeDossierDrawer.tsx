'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, CalendarDays, Clock3, X } from 'lucide-react';
import type { DayEndMissingEmployee } from './attendance-day-end.preview';
import { HrPersonnelDocumentsPanel } from './HrPersonnelDocumentsPanel';
import { HrAssignedAssetsPanel } from './HrAssignedAssetsPanel';
import { HrPersonelUcretPanel } from './HrPersonelUcretPanel';
import { useApiQuery } from '@/hooks/useApi';

export type DossierTab =
  | 'summary'
  | 'attendance'
  | 'leave'
  | 'pay'
  | 'documents'
  | 'assets';

export type RosterEmployee = {
  id: string;
  userId?: string;
  fullName: string;
  email?: string | null;
  department: string;
  roleLabel: string;
  personnelNo?: string | null;
  personalGsm?: string | null;
  companyGsm?: string | null;
  bloodType?: string | null;
  identityNo?: string | null;
  birthDateLabel?: string | null;
  hireDateLabel?: string | null;
  /** 4857 yıllık izin hakedişi (iş günü) */
  entitledLeaveDays?: number;
  usedLeaveDays?: number;
  pendingLeaveDays?: number;
  remainingLeaveDays: number;
  attendanceStatus: 'missing' | 'ok' | 'on_leave';
  attendanceLabel: string;
  lateStart?: boolean;
  earlyLeave?: boolean;
  lateStartMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  proxyName?: string | null;
  lastConfirmedDate?: string | null;
  missingDates?: string[];
  documentsLabel?: string;
  missingDocsCount?: number | null;
  assetsCount?: number | null;
};

type LeaveDetailKey = 'entitled' | 'used' | 'pending' | 'remaining';

type LeaveApiRow = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  dayCount: number | null;
  status: string;
  reason?: string | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  employeeProfileId?: string;
  employeeProfile?: { id?: string } | null;
};

type Props = {
  open: boolean;
  employee: RosterEmployee | null;
  preview?: boolean;
  canManageDocuments?: boolean;
  /** Açılışta seçili sekme (ör. Evraklar ikonundan) */
  initialTab?: DossierTab;
  onClose: () => void;
  onOpenFullAttendance?: (employee: RosterEmployee) => void;
};

const TABS: { key: DossierTab; label: string }[] = [
  { key: 'summary', label: 'Özet' },
  { key: 'attendance', label: 'Devam' },
  { key: 'leave', label: 'İzin' },
  { key: 'pay', label: 'Ücret' },
  { key: 'documents', label: 'Evrak' },
  { key: 'assets', label: 'Zimmet' },
];

const STATUS_CLASS: Record<RosterEmployee['attendanceStatus'], string> = {
  missing: 'bg-status-danger/10 text-status-danger',
  ok: 'bg-status-success/10 text-status-success',
  on_leave: 'bg-slate-100 text-slate-600',
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: 'Yıllık Ücretli İzin',
  sick: 'Hastalık / Raporlu İzin',
  maternity: 'Analık İzni',
  paternity: 'Babalık İzni',
  marriage: 'Evlilik İzni',
  bereavement: 'Ölüm İzni',
  unpaid: 'Ücretsiz İzin',
};

const LEAVE_STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  pending: 'Onay Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

const PREVIEW_LEAVE_ROWS: LeaveApiRow[] = [
  {
    id: 'pv-used-1',
    leaveType: 'annual',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
    dayCount: 5,
    status: 'approved',
    reason: 'Aile ziyareti',
    submittedAt: '2026-05-20T09:15:00',
    decidedAt: '2026-05-21T11:40:00',
    employeeProfileId: 'preview',
  },
  {
    id: 'pv-pending-1',
    leaveType: 'annual',
    startDate: '2026-08-11',
    endDate: '2026-08-15',
    dayCount: 5,
    status: 'pending',
    reason: 'Tatil',
    submittedAt: '2026-08-01T14:22:00',
    employeeProfileId: 'preview',
  },
];

function formatDayLabel(raw: string): string {
  const iso = raw.includes('T') ? raw : `${raw}T12:00:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTimeLabel(raw?: string | null): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function leaveTypeLabel(code: string): string {
  return LEAVE_TYPE_LABEL[code] ?? code;
}

/**
 * Özlük dosyası — aynı sayfada sağ panel; Özet/Devam/İzin/Evrak/Zimmet.
 */
export function HrEmployeeDossierDrawer({
  open,
  employee,
  preview = false,
  canManageDocuments = true,
  initialTab = 'summary',
  onClose,
  onOpenFullAttendance,
}: Props) {
  const [tab, setTab] = useState<DossierTab>(initialTab);
  const [leaveDetail, setLeaveDetail] = useState<LeaveDetailKey | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setLeaveDetail(null);
  }, [open, employee?.id, initialTab]);

  const leavesQuery = useApiQuery<LeaveApiRow[]>(
    ['hr-leave-requests-all', employee?.id || ''],
    'hr/leave-requests/all',
    {
      enabled: open && !preview && Boolean(employee?.id) && tab === 'leave',
    },
  );

  const leaveRows = useMemo(() => {
    if (!employee) return [] as LeaveApiRow[];
    if (preview) {
      return PREVIEW_LEAVE_ROWS.map((row) => ({
        ...row,
        employeeProfileId: employee.id,
      }));
    }
    const all = Array.isArray(leavesQuery.data) ? leavesQuery.data : [];
    return all.filter(
      (row) => (row.employeeProfileId || row.employeeProfile?.id) === employee.id,
    );
  }, [employee, preview, leavesQuery.data]);

  const usedLeaves = useMemo(
    () => leaveRows.filter((r) => r.status === 'approved'),
    [leaveRows],
  );
  const pendingLeaves = useMemo(
    () => leaveRows.filter((r) => r.status === 'pending'),
    [leaveRows],
  );

  if (!open || !employee) return null;

  const missingCount = employee.missingDates?.length ?? 0;
  const mesaiLabel =
    employee.lateStart || employee.earlyLeave
      ? [
          employee.lateStart ? `Geç +${employee.lateStartMinutes ?? 0} dk` : null,
          employee.earlyLeave ? `Erken −${employee.earlyLeaveMinutes ?? 0} dk` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'Uygun';

  const detailRows =
    leaveDetail === 'used'
      ? usedLeaves
      : leaveDetail === 'pending'
        ? pendingLeaves
        : leaveDetail === 'entitled' || leaveDetail === 'remaining'
          ? leaveRows.filter((r) => r.leaveType === 'annual')
          : [];

  const detailTitle =
    leaveDetail === 'used'
      ? 'Kullanılan İzinler'
      : leaveDetail === 'pending'
        ? 'Onay Bekleyen İzinler'
        : leaveDetail === 'entitled'
          ? 'Hakedişe Bağlı İzin Kayıtları'
          : leaveDetail === 'remaining'
            ? 'Yıllık İzin Kayıtları'
            : '';

  return (
    <>
      <button
        type="button"
        aria-label="Kapat"
        className="fixed inset-0 z-40 bg-slate-900/30"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-white shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-content-primary truncate">
                {employee.fullName}
              </p>
              <p className="mt-0.5 text-xs text-content-tertiary">
                {employee.roleLabel}
                {employee.personnelNo ? ` · Sicil ${employee.personnelNo}` : ''}
              </p>
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASS[employee.attendanceStatus]}`}
              >
                {employee.attendanceLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border p-2 text-content-secondary hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  if (t.key !== 'leave') setLeaveDetail(null);
                }}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  tab === t.key
                    ? 'bg-brand-600 text-white'
                    : 'text-content-secondary hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'summary' ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-content-tertiary">Görevi</dt>
                <dd className="font-medium text-content-primary">{employee.roleLabel || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-content-tertiary">Sicil No</dt>
                <dd className="font-medium text-content-primary">
                  {employee.personnelNo || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-content-tertiary">T.C. Kimlik No</dt>
                <dd className="font-medium text-content-primary">
                  {employee.identityNo || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-content-tertiary">Doğum Tarihi</dt>
                <dd className="font-medium text-content-primary">
                  {employee.birthDateLabel || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-content-tertiary">Kişisel GSM No</dt>
                <dd className="font-medium text-content-primary">
                  {employee.personalGsm || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-content-tertiary">Şirket GSM No</dt>
                <dd className="font-medium text-content-primary">
                  {employee.companyGsm || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-content-tertiary">Kan Grubu</dt>
                <dd className="font-medium text-content-primary">
                  {employee.bloodType || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-content-tertiary">Departman</dt>
                <dd className="font-medium text-content-primary">{employee.department || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-content-tertiary">İşe Giriş</dt>
                <dd className="font-medium text-content-primary">
                  {employee.hireDateLabel || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-content-tertiary">Kalan İzin</dt>
                <dd className="font-medium text-content-primary">
                  {employee.remainingLeaveDays} gün
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-content-tertiary">Son Devam Onayı</dt>
                <dd className="font-medium text-content-primary">
                  {employee.lastConfirmedDate || '—'}
                </dd>
              </div>
              {employee.attendanceStatus === 'on_leave' ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-content-tertiary">Vekil</dt>
                  <dd className="font-medium text-content-primary">
                    {employee.proxyName || '—'}
                  </dd>
                </div>
              ) : null}
              {(employee.lateStart || employee.earlyLeave) && (
                <div className="rounded-xl border border-border bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold text-content-secondary">Mesai Denetimi</p>
                  {employee.lateStart ? (
                    <p className="mt-1 text-xs font-semibold text-status-warning">
                      Geç Başlangıç (+{employee.lateStartMinutes ?? 0} dk)
                    </p>
                  ) : null}
                  {employee.earlyLeave ? (
                    <p className="mt-1 text-xs font-semibold text-status-danger">
                      Erken Çıkış (−{employee.earlyLeaveMinutes ?? 0} dk)
                    </p>
                  ) : null}
                </div>
              )}
            </dl>
          ) : null}

          {tab === 'attendance' ? (
            <div className="space-y-4" data-testid="personel-devam-ozeti">
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                    <CalendarCheck2 className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-content-primary">Devam Özeti</h3>
                    <p className="mt-0.5 text-xs text-content-secondary">
                      Bugünkü durum, eksik günler ve mesai denetimi bu personel için özetlenir.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
                    <p className="text-xs text-content-tertiary">Bugün</p>
                    <p className="mt-1 text-sm font-bold text-content-primary">
                      {employee.attendanceLabel}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
                    <p className="text-xs text-content-tertiary">Son Onay</p>
                    <p className="mt-1 text-sm font-bold tabular-nums text-content-primary">
                      {employee.lastConfirmedDate
                        ? formatDayLabel(employee.lastConfirmedDate)
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
                    <p className="text-xs text-content-tertiary">Eksik Gün</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-content-primary">
                      {missingCount}
                      <span className="ml-1 text-xs font-medium text-content-tertiary">gün</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
                    <p className="text-xs text-content-tertiary">Mesai</p>
                    <p className="mt-1 text-sm font-bold text-content-primary">{mesaiLabel}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Clock3 className="h-4 w-4 text-brand-600" />
                  <h4 className="text-sm font-semibold text-content-primary">Eksik Gün Listesi</h4>
                </div>
                {missingCount === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-content-tertiary">
                    Eksik devam günü yok.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {(employee.missingDates ?? []).map((day) => (
                      <li
                        key={day}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <span className="font-medium tabular-nums text-content-primary">
                          {formatDayLabel(day)}
                        </span>
                        <span className="text-xs font-semibold text-status-danger">Onaylamadı</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {onOpenFullAttendance ? (
                <button
                  type="button"
                  onClick={() => onOpenFullAttendance(employee)}
                  className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-content-primary hover:bg-slate-50"
                >
                  Tam Devam Sayfasına Git
                </button>
              ) : null}
            </div>
          ) : null}

          {tab === 'leave' ? (
            <div className="space-y-4" data-testid="personel-izin-ozeti">
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                    <CalendarDays className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-content-primary">İzin Özeti</h3>
                    <p className="mt-0.5 text-xs text-content-secondary">
                      Karta tıklayınca tarih ve saat listesi açılır. Bekleyen talepler İzin
                      Onayları kuyruğunda da yönetilir.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      {
                        key: 'entitled' as const,
                        label: 'Hakedilen',
                        value: employee.entitledLeaveDays ?? employee.remainingLeaveDays,
                      },
                      {
                        key: 'used' as const,
                        label: 'Kullanılan',
                        value: employee.usedLeaveDays ?? 0,
                      },
                      {
                        key: 'pending' as const,
                        label: 'Onay Bekleyen',
                        value: employee.pendingLeaveDays ?? 0,
                      },
                      {
                        key: 'remaining' as const,
                        label: 'Kalan',
                        value: employee.remainingLeaveDays,
                      },
                    ] as const
                  ).map((card) => {
                    const active = leaveDetail === card.key;
                    return (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() =>
                          setLeaveDetail((prev) => (prev === card.key ? null : card.key))
                        }
                        className={`rounded-xl border p-3 text-left shadow-sm transition-colors ${
                          active
                            ? 'border-brand-300 bg-brand-50'
                            : 'border-border bg-white hover:border-brand-200 hover:bg-slate-50'
                        }`}
                        aria-pressed={active}
                      >
                        <p className="text-xs text-content-tertiary">{card.label}</p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-content-primary">
                          {card.value}
                          <span className="ml-1 text-xs font-medium text-content-tertiary">
                            gün
                          </span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {leaveDetail ? (
                <div
                  className="rounded-2xl border border-border bg-white"
                  data-testid="personel-izin-detay"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <h4 className="text-sm font-semibold text-content-primary">{detailTitle}</h4>
                    <button
                      type="button"
                      onClick={() => setLeaveDetail(null)}
                      className="text-xs font-semibold text-content-secondary hover:text-content-primary"
                    >
                      Kapat
                    </button>
                  </div>
                  {!preview && leavesQuery.isLoading ? (
                    <div className="h-20 animate-pulse bg-slate-100" />
                  ) : !preview && leavesQuery.isError ? (
                    <div className="space-y-3 px-4 py-6 text-center">
                      <p className="text-sm text-status-danger">
                        İzin listesi yüklenemedi. Lütfen tekrar deneyin.
                      </p>
                      <button
                        type="button"
                        onClick={() => void leavesQuery.refetch()}
                        className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-content-primary hover:bg-slate-50"
                      >
                        Tekrar Dene
                      </button>
                    </div>
                  ) : detailRows.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-content-tertiary">
                      Bu başlıkta listelenecek izin kaydı yok.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {detailRows.map((row) => (
                        <li key={row.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-content-primary">
                                {leaveTypeLabel(row.leaveType)}
                              </p>
                              <p className="mt-0.5 text-xs tabular-nums text-content-secondary">
                                {formatDayLabel(row.startDate)}
                                {row.endDate && row.endDate !== row.startDate
                                  ? ` – ${formatDayLabel(row.endDate)}`
                                  : ''}
                                {row.dayCount != null ? ` · ${row.dayCount} gün` : ''}
                              </p>
                              <p className="mt-1 text-[11px] text-content-tertiary">
                                Talep: {formatDateTimeLabel(row.submittedAt)}
                                {row.decidedAt
                                  ? ` · Karar: ${formatDateTimeLabel(row.decidedAt)}`
                                  : ''}
                              </p>
                              {row.reason ? (
                                <p className="mt-1 text-xs text-content-secondary">{row.reason}</p>
                              ) : null}
                            </div>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-content-secondary">
                              {LEAVE_STATUS_LABEL[row.status] ?? row.status}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-xs text-content-tertiary">
                  Detay için yukarıdaki kartlardan birine tıklayın.
                </p>
              )}
            </div>
          ) : null}

          {tab === 'pay' ? (
            <HrPersonelUcretPanel
              employeeProfileId={employee.id}
              hireDateLabel={employee.hireDateLabel}
              preview={preview}
            />
          ) : null}

          {tab === 'documents' ? (
            <HrPersonnelDocumentsPanel
              preview={preview}
              employeeName={employee.fullName}
              canUpload={canManageDocuments}
              canSelectEmployee={false}
            />
          ) : null}

          {tab === 'assets' ? (
            <HrAssignedAssetsPanel
              preview={preview}
              canAdd={canManageDocuments && !preview}
              employeeProfileId={employee.id}
              employeeName={employee.fullName}
            />
          ) : null}
        </div>
      </aside>
    </>
  );
}

export function dayEndToRosterPartial(
  e: DayEndMissingEmployee,
): Pick<
  RosterEmployee,
  | 'id'
  | 'fullName'
  | 'department'
  | 'roleLabel'
  | 'remainingLeaveDays'
  | 'attendanceStatus'
  | 'attendanceLabel'
  | 'lateStart'
  | 'earlyLeave'
  | 'lateStartMinutes'
  | 'earlyLeaveMinutes'
  | 'proxyName'
  | 'lastConfirmedDate'
  | 'missingDates'
> {
  const label =
    e.status === 'missing' ? 'Onaylamadı' : e.status === 'ok' ? 'Onayladı' : 'İzinli';
  return {
    id: e.id,
    fullName: e.fullName,
    department: e.department,
    roleLabel: e.roleLabel,
    remainingLeaveDays: e.remainingLeaveDays,
    attendanceStatus: e.status,
    attendanceLabel: label,
    lateStart: e.isLateStart,
    earlyLeave: e.isEarlyLeave,
    lateStartMinutes: e.lateStartMinutes,
    earlyLeaveMinutes: e.earlyLeaveMinutes,
    proxyName: e.proxyName,
    lastConfirmedDate: e.lastConfirmedDate,
    missingDates: e.missingDates,
  };
}

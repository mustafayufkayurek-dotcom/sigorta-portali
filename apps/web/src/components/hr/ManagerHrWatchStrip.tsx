'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Archive,
  Check,
  CheckCircle2,
  ClipboardList,
  History,
  Mail,
  Paperclip,
  Pencil,
  UserX,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

export type LeaveApprovalItem = {
  id: string;
  employeeName: string;
  department?: string | null;
  leaveType?: string | null;
  leaveTypeLabel: string;
  startDateLabel: string;
  endDateLabel: string;
  dayCount?: number | null;
  reason?: string | null;
  status: string;
  statusLabel: string;
  statusBadgeClass: string;
  decidedByName?: string | null;
  decidedAtLabel?: string | null;
  /** 4857 hakediş */
  entitledDays?: number | null;
  usedDays?: number | null;
  pendingDays?: number | null;
  remainingDays?: number | null;
};

type ArchiveEntry = {
  id: string;
  atLabel: string;
  action: string;
  employeeName: string;
  detail: string;
  mailed: boolean;
};

type ListSegment = 'pending' | 'history';

const WINDOW_TONE = {
  warning: {
    wrap: 'border-amber-100 bg-amber-50/40 hover:border-amber-200',
    icon: 'bg-amber-100 text-status-warning',
    value: 'text-status-warning',
  },
  success: {
    wrap: 'border-emerald-100 bg-emerald-50/40 hover:border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-700',
    value: 'text-emerald-700',
  },
  brand: {
    wrap: 'border-slate-100 bg-slate-50/70 hover:border-slate-200',
    icon: 'bg-brand-50 text-brand-600',
    value: 'text-content-primary',
  },
} as const;

function balanceLine(item: LeaveApprovalItem): string {
  const parts = [
    `Hakedilen ${item.entitledDays ?? '—'}`,
    `Kullanılan ${item.usedDays ?? '—'}`,
    `Onay Bekleyen ${item.pendingDays ?? item.dayCount ?? '—'}`,
    `Kalan ${item.remainingDays ?? '—'}`,
  ];
  return parts.join(' · ');
}
type WatchItem = {
  key: string;
  label: string;
  hint: string;
  count: number;
  tone: 'warning' | 'danger' | 'brand';
  icon: LucideIcon;
  onClick: () => void;
};

const TONE: Record<WatchItem['tone'], string> = {
  warning: 'border-status-warning/30 bg-status-warning/10 hover:bg-status-warning/15',
  danger: 'border-status-danger/30 bg-status-danger/5 hover:bg-status-danger/10',
  brand: 'border-brand-200 bg-brand-50/50 hover:bg-brand-50',
};

const COUNT_TONE: Record<WatchItem['tone'], string> = {
  warning: 'text-status-warning',
  danger: 'text-status-danger',
  brand: 'text-brand-700',
};

type Props = {
  leavePendingCount: number;
  attendanceMissingCount: number;
  assignmentPendingCount?: number | null;
  onOpenLeaveApprovals: () => void;
  onOpenAttendance: () => void;
  onOpenDuty?: () => void;
  showDuty?: boolean;
};

/**
 * Yönetici Denetim Özeti — zaman kaybetmeden kuyruğa git.
 */
export function ManagerHrWatchStrip({
  leavePendingCount,
  attendanceMissingCount,
  assignmentPendingCount = null,
  onOpenLeaveApprovals,
  onOpenAttendance,
  onOpenDuty,
  showDuty = false,
}: Props) {
  const items: WatchItem[] = [
    {
      key: 'leave',
      label: 'İzin Onayı',
      hint: 'Talepler burada düşer ve onaylanır',
      count: leavePendingCount,
      tone: 'warning',
      icon: ClipboardList,
      onClick: onOpenLeaveApprovals,
    },
    {
      key: 'attendance',
      label: 'Devam Onaylamayan',
      hint: 'Gün sonu devam kontrolü',
      count: attendanceMissingCount,
      tone: 'danger',
      icon: UserX,
      onClick: onOpenAttendance,
    },
  ];

  if (showDuty && onOpenDuty) {
    items.push({
      key: 'duty',
      label: 'Atama Onayı',
      hint: 'Görev Ve Sorumluluk',
      count: assignmentPendingCount ?? 0,
      tone: 'brand',
      icon: CheckCircle2,
      onClick: onOpenDuty,
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-content-primary">Yönetici İzleme</p>
        <p className="mt-0.5 text-xs text-content-tertiary">
          Bekleyen işe tek tıkla geçin — değerlendirme ve onay burada başlar
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={`rounded-xl border px-4 py-3.5 text-left transition-colors ${TONE[item.tone]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70">
                  <item.icon className={`h-4 w-4 ${COUNT_TONE[item.tone]}`} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-content-primary">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-content-tertiary">{item.hint}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-2xl font-bold tabular-nums ${COUNT_TONE[item.tone]}`}>
                  {item.count}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-brand-600">Aç →</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const iconBtnClass =
  'inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40';

const ACTIONS_COL_WIDTH = 220;

function LeavePendingRowActions({
  onApprove,
  onReject,
  onEdit,
}: {
  onApprove: () => void;
  onReject: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="relative flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="Onayla — personele mail gider"
        aria-label="Onayla"
        className={`${iconBtnClass} border-status-success/30 text-status-success hover:bg-status-success/10`}
        onClick={onApprove}
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        Onayla
      </button>
      <button
        type="button"
        title="Reddet — personele mail gider"
        aria-label="Reddet"
        className={`${iconBtnClass} border-status-danger/30 text-status-danger hover:bg-status-danger/10`}
        onClick={onReject}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        Reddet
      </button>
      {onEdit ? (
        <button
          type="button"
          title="Düzenle — personele bildirim gider"
          aria-label="Düzenle"
          className={iconBtnClass}
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Düzenle
        </button>
      ) : null}
    </div>
  );
}

type ApprovalsProps = {
  pending: LeaveApprovalItem[];
  history: LeaveApprovalItem[];
  pendingLoading?: boolean;
  historyLoading?: boolean;
  pendingError?: string | null;
  historyError?: string | null;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit?: (id: string) => void;
  documentsSlot?: (id: string) => ReactNode;
  preview?: boolean;
  /** Dışarıdan personel arşivine odak */
  initialPersonFilter?: string | null;
};

/**
 * İzin taleplerinin düştüğü ve onaylandığı yönetici yüzeyi.
 * Tek tablo + Bekleyen/Geçmiş segment; arşiv sağ panelde.
 */
export function HrLeaveApprovalsPanel({
  pending,
  history,
  pendingLoading,
  historyLoading,
  pendingError,
  historyError,
  expandedId,
  onToggleExpand,
  onApprove,
  onReject,
  onEdit,
  documentsSlot,
  preview = false,
  initialPersonFilter = null,
}: ApprovalsProps) {
  const { showToast } = useToast();
  const canDocuments = Boolean(!preview && documentsSlot);
  const [segment, setSegment] = useState<ListSegment>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [archivePerson, setArchivePerson] = useState<string | null>(null);
  const [archive, setArchive] = useState<ArchiveEntry[]>([
    {
      id: 'a0',
      atLabel: '28 Haz 14:20',
      action: 'Onay',
      employeeName: 'Ayşe Yılmaz',
      detail: 'Yıllık Ücretli İzin · 5 iş günü',
      mailed: true,
    },
  ]);

  useEffect(() => {
    if (initialPersonFilter) {
      setArchivePerson(initialPersonFilter);
    }
  }, [initialPersonFilter]);

  const openArchive = (name: string) => setArchivePerson(name);

  const personOptions = useMemo(() => {
    const names = new Set<string>();
    [...pending, ...history].forEach((r) => names.add(r.employeeName));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [pending, history]);

  const typeOptions = useMemo(() => {
    const map = new Map<string, string>();
    [...pending, ...history].forEach((r) => {
      const key = r.leaveType || r.leaveTypeLabel;
      map.set(key, r.leaveTypeLabel);
    });
    return Array.from(map.entries());
  }, [pending, history]);

  const filterRows = (rows: LeaveApprovalItem[]) =>
    rows.filter((r) => {
      if (personFilter !== 'all' && r.employeeName !== personFilter) return false;
      if (typeFilter !== 'all') {
        const key = r.leaveType || r.leaveTypeLabel;
        if (key !== typeFilter) return false;
      }
      return true;
    });

  const pendingView = filterRows(pending);
  const historyView = filterRows(history);
  const approvedCount = history.filter((h) => h.status === 'approved').length;
  const archiveDrawerRows = archivePerson
    ? archive.filter((row) => row.employeeName === archivePerson)
    : [];

  const windows = [
    {
      key: 'pending' as const,
      label: 'Onay Bekleyen',
      hint: 'İşlem bekleyen talep',
      value: pending.length,
      icon: ClipboardList,
      tone: 'warning' as const,
      onClick: () => setSegment('pending'),
    },
    {
      key: 'approved' as const,
      label: 'Bu Ay Onaylanan',
      hint: 'Onay geçmişi',
      value: approvedCount,
      icon: History,
      tone: 'success' as const,
      onClick: () => setSegment('history'),
    },
    {
      key: 'archive' as const,
      label: 'Arşiv Kaydı',
      hint: 'Mail ve hareket',
      value: archive.length,
      icon: Archive,
      tone: 'brand' as const,
      onClick: () => {
        const name =
          archive[0]?.employeeName ?? personOptions[0] ?? null;
        if (name) openArchive(name);
      },
    },
  ];

  const pushArchive = (action: string, item: LeaveApprovalItem) => {
    setArchive((list) => [
      {
        id: `a-${Date.now()}`,
        atLabel: 'Şimdi',
        action,
        employeeName: item.employeeName,
        detail: `${item.leaveTypeLabel} · ${item.dayCount ?? '—'} iş günü`,
        mailed: true,
      },
      ...list,
    ]);
  };

  const handleApprove = (id: string) => {
    const item = pending.find((p) => p.id === id);
    onApprove(id);
    if (item) {
      pushArchive('Onay', item);
      showToast('success', `${item.employeeName} — Onay Maili Gönderildi (Önizleme)`);
    }
  };

  const handleReject = (id: string) => {
    const item = pending.find((p) => p.id === id);
    onReject(id);
    if (item) {
      pushArchive('Red', item);
      showToast('success', `${item.employeeName} — Red Maili Gönderildi (Önizleme)`);
    }
  };

  const handleEdit = (id: string) => {
    const item = pending.find((p) => p.id === id);
    onEdit?.(id);
    if (item) {
      pushArchive('Düzenleme', item);
      showToast('info', `${item.employeeName} talebi düzenleme — personele bildirim (önizleme)`);
    }
  };

  const loading = segment === 'pending' ? pendingLoading : historyLoading;
  const error = segment === 'pending' ? pendingError : historyError;
  const emptyLabel =
    segment === 'pending' ? 'Onay bekleyen izin talebi yok.' : 'Henüz izin kaydı yok.';

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100/90 px-4 py-3 sm:px-5">
          <h3 className="text-base font-semibold text-content-primary">İzin Onayları</h3>
          {preview ? (
            <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-content-tertiary">
              Tasarım Önizleme
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 bg-slate-50/50 p-4 sm:grid-cols-3 sm:p-5">
          {windows.map((card) => {
            const Icon = card.icon;
            const tone = WINDOW_TONE[card.tone];
            const active =
              (card.key === 'pending' && segment === 'pending') ||
              (card.key === 'approved' && segment === 'history');
            return (
              <button
                key={card.key}
                type="button"
                onClick={card.onClick}
                className={`rounded-xl border bg-white p-4 text-left transition-colors ${tone.wrap} ${
                  active ? 'ring-2 ring-brand-600 ring-offset-1' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone.icon}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${tone.value}`}>{card.value}</p>
                </div>
                <p className="mt-3 text-sm font-semibold text-content-primary">{card.label}</p>
                <p className="mt-0.5 text-xs text-content-tertiary">{card.hint}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="table-container">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-slate-50/80 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'pending' as const, label: 'Bekleyen', count: pendingView.length },
                { key: 'history' as const, label: 'Geçmiş', count: historyView.length },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSegment(item.key)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  segment === item.key
                    ? 'bg-brand-600 text-white'
                    : 'border border-border bg-white text-content-secondary hover:bg-slate-50'
                }`}
              >
                {item.label}
                <span className="ml-1.5 tabular-nums opacity-80">{item.count}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-xl border border-border bg-white px-3 py-2 text-xs"
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
            >
              <option value="all">Tüm Personel</option>
              {personOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-border bg-white px-3 py-2 text-xs"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">Tüm İzin Türleri</option>
              {typeOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse bg-slate-100" />
        ) : error ? (
          <div className="px-4 py-3 text-sm text-status-danger">{error}</div>
        ) : (segment === 'pending' ? pendingView : historyView).length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-content-tertiary">{emptyLabel}</div>
        ) : segment === 'pending' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="table-head-row">
                <tr>
                  <th className="table-th text-left">Personel</th>
                  <th className="table-th text-left">Tür</th>
                  <th className="table-th">Başlangıç</th>
                  <th className="table-th">Bitiş</th>
                  <th className="table-th">İş Günü</th>
                  <th className="table-th text-left">Açıklama</th>
                  <th
                    className="sticky right-0 z-[1] border-l border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-xs font-semibold tracking-wide text-slate-500 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                    style={{ width: ACTIONS_COL_WIDTH, minWidth: ACTIONS_COL_WIDTH }}
                  >
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="table-body">
                {pendingView.map((item) => (
                  <Fragment key={item.id}>
                    <tr className="table-row">
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          className="text-left font-medium text-brand-700 hover:underline"
                          title="Hareket Arşivi"
                          onClick={() => openArchive(item.employeeName)}
                        >
                          {item.employeeName}
                        </button>
                        {item.department ? (
                          <p className="text-xs text-content-tertiary">{item.department}</p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-content-tertiary">{balanceLine(item)}</p>
                      </td>
                      <td className="px-5 py-3 text-content-secondary">{item.leaveTypeLabel}</td>
                      <td className="px-4 py-3 text-center text-content-secondary">
                        {item.startDateLabel}
                      </td>
                      <td className="px-4 py-3 text-center text-content-secondary">
                        {item.endDateLabel}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{item.dayCount ?? '—'}</td>
                      <td className="max-w-[160px] truncate px-5 py-3 text-content-secondary">
                        {item.reason || '—'}
                      </td>
                      <td
                        className="sticky right-0 z-[1] border-l border-slate-100 bg-white px-3 py-3 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                        style={{ width: ACTIONS_COL_WIDTH, minWidth: ACTIONS_COL_WIDTH }}
                      >
                        <LeavePendingRowActions
                          onApprove={() => handleApprove(item.id)}
                          onReject={() => handleReject(item.id)}
                          onEdit={
                            onEdit || preview ? () => handleEdit(item.id) : undefined
                          }
                        />
                      </td>
                    </tr>
                    {expandedId === item.id && documentsSlot ? (
                      <tr>
                        <td colSpan={7} className="border-t border-border bg-slate-50/50 p-4">
                          {documentsSlot(item.id)}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="table-head-row">
                <tr>
                  <th className="table-th text-left">Personel</th>
                  <th className="table-th text-left">Tür</th>
                  <th className="table-th">Başlangıç</th>
                  <th className="table-th">Bitiş</th>
                  <th className="table-th">İş Günü</th>
                  <th className="table-th">Durum</th>
                  <th className="table-th text-left">Onaylayan</th>
                  <th className="table-th">Onay Tarihi</th>
                  <th
                    className="sticky right-0 z-[1] border-l border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-xs font-semibold tracking-wide text-slate-500 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                    style={{ width: 88, minWidth: 88 }}
                  >
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="table-body">
                {historyView.map((item) => (
                  <Fragment key={item.id}>
                    <tr className="table-row">
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          className="text-left font-medium text-brand-700 hover:underline"
                          onClick={() => openArchive(item.employeeName)}
                        >
                          {item.employeeName}
                        </button>
                        {item.department ? (
                          <p className="text-xs text-content-tertiary">{item.department}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-content-secondary">{item.leaveTypeLabel}</td>
                      <td className="px-4 py-3 text-center text-content-secondary">
                        {item.startDateLabel}
                      </td>
                      <td className="px-4 py-3 text-center text-content-secondary">
                        {item.endDateLabel}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{item.dayCount ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.statusBadgeClass}`}
                        >
                          {item.statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-content-secondary">
                        {item.decidedByName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-content-secondary">
                        {item.decidedAtLabel ?? '—'}
                      </td>
                      <td
                        className="sticky right-0 z-[1] border-l border-slate-100 bg-white px-3 py-3 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                        style={{ width: 88, minWidth: 88 }}
                      >
                        {canDocuments ? (
                          <button
                            type="button"
                            title="İzin Evrakları"
                            aria-label="İzin Evrakları"
                            className={iconBtnClass}
                            onClick={() => onToggleExpand(item.id)}
                          >
                            <Paperclip className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-content-tertiary">
                            <Mail className="h-3.5 w-3.5" />
                            Mail
                          </span>
                        )}
                      </td>
                    </tr>
                    {expandedId === item.id && documentsSlot ? (
                      <tr>
                        <td colSpan={9} className="border-t border-border bg-slate-50/50 p-4">
                          {documentsSlot(item.id)}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {archivePerson ? (
        <div className="fixed inset-0 z-[60] flex justify-end" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/30"
            aria-label="Kapat"
            onClick={() => setArchivePerson(null)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-content-primary">Hareket Arşivi</p>
                <p className="mt-0.5 text-xs text-content-tertiary">{archivePerson}</p>
              </div>
              <button
                type="button"
                onClick={() => setArchivePerson(null)}
                className="rounded-lg border border-border p-2 text-content-tertiary hover:bg-slate-50 hover:text-content-primary"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {archiveDrawerRows.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-content-tertiary">
                  Bu personel için arşiv kaydı yok.
                </p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="table-head-row sticky top-0">
                    <tr>
                      <th className="table-th text-left">Zaman</th>
                      <th className="table-th text-left">İşlem</th>
                      <th className="table-th text-left">Detay</th>
                      <th className="table-th">Mail</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {archiveDrawerRows.map((row) => (
                      <tr key={row.id} className="table-row">
                        <td className="px-5 py-3 text-content-secondary">{row.atLabel}</td>
                        <td className="px-5 py-3 font-medium text-content-primary">{row.action}</td>
                        <td className="px-5 py-3 text-content-secondary">{row.detail}</td>
                        <td className="px-4 py-3 text-center text-xs font-semibold text-status-success">
                          {row.mailed ? 'Gönderildi' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { DayEndMissingEmployee } from './attendance-day-end.preview';
import { HrPersonnelDocumentsPanel } from './HrPersonnelDocumentsPanel';
import { HrAssignedAssetsPanel } from './HrAssignedAssetsPanel';

export type DossierTab = 'summary' | 'attendance' | 'leave' | 'documents' | 'assets';

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
  { key: 'documents', label: 'Evrak' },
  { key: 'assets', label: 'Zimmet' },
];

const STATUS_CLASS: Record<RosterEmployee['attendanceStatus'], string> = {
  missing: 'bg-status-danger/10 text-status-danger',
  ok: 'bg-status-success/10 text-status-success',
  on_leave: 'bg-slate-100 text-slate-600',
};

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

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, employee?.id, initialTab]);

  if (!open || !employee) return null;

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
                onClick={() => setTab(t.key)}
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
            <div className="space-y-3">
              <p className="text-sm text-content-secondary">
                Bugün: <strong className="text-content-primary">{employee.attendanceLabel}</strong>
              </p>
              {employee.missingDates && employee.missingDates.length > 0 ? (
                <p className="text-xs text-content-tertiary">
                  Eksik günler: {employee.missingDates.join(', ')}
                </p>
              ) : (
                <p className="text-xs text-content-tertiary">Eksik devam günü yok.</p>
              )}
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
            <div className="space-y-2 text-sm">
              <p className="text-content-secondary">
                Kalan yıllık izin:{' '}
                <strong className="text-content-primary">{employee.remainingLeaveDays} gün</strong>
              </p>
              <p className="text-xs text-content-tertiary">
                Bekleyen izin talepleri İzin Onayları kuyruğunda yönetilir. Bu panelde kişi
                bakiyesi ve durum özeti gösterilir.
              </p>
            </div>
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

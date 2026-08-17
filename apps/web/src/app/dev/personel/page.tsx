'use client';

import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import { AdminAttendanceSupervisionPanel } from '@/components/hr/AdminAttendanceSupervisionPanel';
import { PerformanceManagementPanel } from '@/components/hr/PerformanceManagementPanel';
import {
  HrLeaveApprovalsPanel,
  ManagerHrWatchStrip,
  type LeaveApprovalItem,
} from '@/components/hr/ManagerHrWatchStrip';
import { HrAttendancePreviewPanel } from '@/components/hr/HrAttendancePreviewPanel';
import { HrMyLeavesPanel } from '@/components/hr/HrMyLeavesPanel';
import { HrDocumentsAuditPanel } from '@/components/hr/HrDocumentsAuditPanel';
import { HrPersonnelDocumentsPanel } from '@/components/hr/HrPersonnelDocumentsPanel';
import { HrAssignedAssetsPanel } from '@/components/hr/HrAssignedAssetsPanel';
import { DAY_END_SUPERVISION_PREVIEW } from '@/components/hr/attendance-day-end.preview';

type PageSection = 'hr' | 'duty';
type HrTab = 'summary' | 'leave-approvals' | 'attendance' | 'leaves' | 'documents' | 'assets';

const PREVIEW_PENDING: LeaveApprovalItem[] = [
  {
    id: 'lp1',
    employeeName: 'Aslı Güngör',
    department: 'Operasyon',
    leaveType: 'annual',
    leaveTypeLabel: 'Yıllık İzin',
    startDateLabel: '11.08.2026',
    endDateLabel: '15.08.2026',
    dayCount: 5,
    reason: 'Aile ziyareti',
    status: 'pending',
    statusLabel: 'Onay Bekliyor',
    statusBadgeClass: 'bg-amber-100 text-amber-800',
    entitledDays: 20,
    usedDays: 2,
    pendingDays: 5,
    remainingDays: 18,
  },
  {
    id: 'lp2',
    employeeName: 'Mehmet Demir',
    department: 'Saha',
    leaveType: 'sick',
    leaveTypeLabel: 'Hastalık / Raporlu İzin',
    startDateLabel: '06.08.2026',
    endDateLabel: '07.08.2026',
    dayCount: 2,
    reason: 'Raporlu',
    status: 'pending',
    statusLabel: 'Onay Bekliyor',
    statusBadgeClass: 'bg-amber-100 text-amber-800',
    entitledDays: 16,
    usedDays: 0,
    pendingDays: 2,
    remainingDays: 14,
  },
  {
    id: 'lp3',
    employeeName: 'Elif Kaya',
    department: 'Operasyon',
    leaveType: 'annual',
    leaveTypeLabel: 'Yıllık Ücretli İzin',
    startDateLabel: '18.08.2026',
    endDateLabel: '22.08.2026',
    dayCount: 5,
    reason: null,
    status: 'pending',
    statusLabel: 'Onay Bekliyor',
    statusBadgeClass: 'bg-amber-100 text-amber-800',
    entitledDays: 14,
    usedDays: 5,
    pendingDays: 5,
    remainingDays: 9,
  },
];

const PREVIEW_HISTORY: LeaveApprovalItem[] = [
  {
    id: 'lh1',
    employeeName: 'Ayşe Yılmaz',
    department: 'Operasyon',
    leaveType: 'annual',
    leaveTypeLabel: 'Yıllık Ücretli İzin',
    startDateLabel: '01.07.2026',
    endDateLabel: '05.07.2026',
    dayCount: 5,
    status: 'approved',
    statusLabel: 'Onaylandı',
    statusBadgeClass: 'bg-green-100 text-green-800',
    decidedByName: 'Mustafa Yürek',
    decidedAtLabel: '28 Haz 14:20',
    entitledDays: 20,
    usedDays: 6,
    pendingDays: 0,
    remainingDays: 14,
  },
];

function PersonelPreviewInner() {
  const { showToast } = useToast();
  const [section, setSection] = useState<PageSection>('hr');
  const [hrTab, setHrTab] = useState<HrTab>('summary');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, setPending] = useState(PREVIEW_PENDING);
  const [history, setHistory] = useState(PREVIEW_HISTORY);
  const [docWorkScope, setDocWorkScope] = useState<'office' | 'field' | 'hazardous'>('office');
  const [archivePerson, setArchivePerson] = useState<string | null>(null);
  const [docDetailName, setDocDetailName] = useState<string | null>(null);

  const openArchive = (fullName: string) => {
    setArchivePerson(fullName);
    setHrTab('leave-approvals');
  };

  const attendancePendingCount = DAY_END_SUPERVISION_PREVIEW.totals.notApproved;

  const hrTabs: { key: HrTab; label: string; badge?: number; badgeTone?: 'warning' | 'danger' }[] =
    useMemo(
      () => [
        { key: 'summary', label: 'Kadro Özeti' },
        {
          key: 'leave-approvals',
          label: 'İzin Onayları',
          badge: pending.length || undefined,
          badgeTone: 'warning',
        },
        {
          key: 'attendance',
          label: 'Devam',
          badge: attendancePendingCount || undefined,
          badgeTone: 'danger',
        },
        { key: 'leaves', label: 'İzin' },
        { key: 'documents', label: 'Özlük Evrakları' },
        { key: 'assets', label: 'Zimmet' },
      ],
      [pending.length, attendancePendingCount],
    );

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-none space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-content-tertiary mb-1">
              Geliştirme / Personel
            </p>
            <h1 className="text-2xl font-bold text-content-primary">Personel</h1>
          </div>
          <span className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white">
            Local Önizleme
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-4 pb-3 pt-4 sm:px-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSection('hr');
                  setHrTab('summary');
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  section === 'hr'
                    ? 'bg-brand-600 text-white'
                    : 'border border-border bg-white text-content-secondary hover:bg-slate-50'
                }`}
              >
                Personel İşlemleri
              </button>
              <button
                type="button"
                onClick={() => setSection('duty')}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  section === 'duty'
                    ? 'bg-brand-600 text-white'
                    : 'border border-border bg-white text-content-secondary hover:bg-slate-50'
                }`}
              >
                Görev Ve Sorumluluk
              </button>
            </div>
          </div>

          {section === 'hr' ? (
            <div className="flex overflow-x-auto border-b border-border">
              {hrTabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setHrTab(item.key)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-4 text-sm font-medium transition-colors ${
                    hrTab === item.key
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-content-tertiary hover:text-content-secondary'
                  }`}
                >
                  {item.label}
                  {item.badge ? (
                    <span
                      className={`ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white ${
                        item.badgeTone === 'danger' ? 'bg-status-danger' : 'bg-orange-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <div className="p-6">
            {section === 'duty' ? (
              <PerformanceManagementPanel embedded preview />
            ) : hrTab === 'summary' ? (
              <div className="space-y-6">
                <ManagerHrWatchStrip
                  leavePendingCount={pending.length}
                  attendanceMissingCount={DAY_END_SUPERVISION_PREVIEW.totals.notApproved}
                  assignmentPendingCount={3}
                  showDuty
                  onOpenLeaveApprovals={() => setHrTab('leave-approvals')}
                  onOpenAttendance={() => setHrTab('attendance')}
                  onOpenDuty={() => setSection('duty')}
                />
                <AdminAttendanceSupervisionPanel
                  preview
                  canAddEmployee
                  canManageDocuments
                  onOpenEmployeeArchive={(emp) => openArchive(emp.fullName)}
                />
              </div>
            ) : hrTab === 'leave-approvals' ? (
              <HrLeaveApprovalsPanel
                preview
                pending={pending}
                history={history}
                expandedId={expandedId}
                initialPersonFilter={archivePerson}
                onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
                onApprove={(id) => {
                  const row = pending.find((p) => p.id === id);
                  if (!row) return;
                  setPending((list) => list.filter((p) => p.id !== id));
                  setHistory((list) => [
                    {
                      ...row,
                      status: 'approved',
                      statusLabel: 'Onaylandı',
                      statusBadgeClass: 'bg-green-100 text-green-800',
                      decidedByName: 'Önizleme Yöneticisi',
                      decidedAtLabel: 'Şimdi',
                      pendingDays: 0,
                    },
                    ...list,
                  ]);
                  showToast('success', 'İzin Onaylandı');
                }}
                onReject={(id) => {
                  const row = pending.find((p) => p.id === id);
                  if (!row) return;
                  setPending((list) => list.filter((p) => p.id !== id));
                  setHistory((list) => [
                    {
                      ...row,
                      status: 'rejected',
                      statusLabel: 'Reddedildi',
                      statusBadgeClass: 'bg-red-100 text-red-800',
                      decidedByName: 'Önizleme Yöneticisi',
                      decidedAtLabel: 'Şimdi',
                      pendingDays: 0,
                    },
                    ...list,
                  ]);
                  showToast('success', 'İzin Reddedildi');
                }}
              />
            ) : hrTab === 'attendance' ? (
              <HrAttendancePreviewPanel />
            ) : hrTab === 'leaves' ? (
              <HrMyLeavesPanel preview />
            ) : hrTab === 'documents' ? (
              docDetailName ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setDocDetailName(null)}
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    ← Kadro Denetimine Dön
                  </button>
                  <HrPersonnelDocumentsPanel
                    preview
                    workScope={docWorkScope}
                    onWorkScopeChange={setDocWorkScope}
                    employeeName={docDetailName}
                  />
                </div>
              ) : (
                <HrDocumentsAuditPanel
                  onOpenEmployee={(_id, name) => setDocDetailName(name)}
                />
              )
            ) : hrTab === 'assets' ? (
              <HrAssignedAssetsPanel
                preview
                canAdd
                onOpenEmployee={(_profileId, name) => {
                  showToast('info', `${name} özlük — evrak denetimine geçildi`);
                  setDocDetailName(name);
                  setHrTab('documents');
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PersonelUnifiedPreviewPage() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <PersonelPreviewInner />
      </ToastProvider>
    </QueryClientProvider>
  );
}

'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { usePanelRoleCode } from '@/hooks/usePanelRole';
import { useToast } from '@/contexts/ToastContext';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { isCompleteTrDateValue, normalizeTrDateValue } from '@/utils/tr-date-input';
import { apiClient } from '@/lib/api-client';
import { AttendanceCalendar } from '@/components/hr/AttendanceCalendar';
import { AttendanceAccountantPanel } from '@/components/hr/AttendanceAccountantPanel';
import { AttendanceBulkAccountantPanel } from '@/components/hr/AttendanceBulkAccountantPanel';
import { AttendanceMonthCloseBanner } from '@/components/hr/AttendanceMonthCloseBanner';
import { AttendanceSignatureModal } from '@/components/hr/AttendanceSignatureModal';
import { AttendanceDayEndBanner } from '@/components/hr/AttendanceDayEndBanner';
import { AdminAttendanceSupervisionPanel } from '@/components/hr/AdminAttendanceSupervisionPanel';
import { PuantajProcessGuide } from '@/components/hr/PuantajProcessGuide';
import { HrPersonnelDocumentsPanel } from '@/components/hr/HrPersonnelDocumentsPanel';
import { HrAssignedAssetsPanel } from '@/components/hr/HrAssignedAssetsPanel';
import { EntityDocumentsTab } from '@/components/EntityDocumentsTab';
import { Paperclip } from 'lucide-react';

type TabKey = 'attendance' | 'leaves' | 'summary' | 'documents' | 'assets';

type HrSummary = {
  profile: {
    id?: string;
    user: { firstName: string; lastName: string; email: string };
    department?: { name: string } | null;
    manager?: { firstName: string; lastName: string } | null;
    personnelNo?: string | null;
    hireDate?: string | null;
  };
  leaveBalance: {
    leaveTypeLabel: string;
    year: number;
    totalDays: number;
    usedDays: number;
    pendingDays: number;
    remainingDays: number;
  };
  stats: {
    pendingLeaveRequests: number;
    approvedLeavesThisYear: number;
    attendanceRecordsThisMonth: number;
    pendingApprovalQueue: number;
  };
  canApprove: boolean;
  canSupervise?: boolean;
  /** Admin false — denetleyen; Finans true — kendi puantajını da tutar */
  mustConfirmOwnAttendance?: boolean;
  /** Finans + yetkili; Admin false */
  canManagePersonnelDocuments?: boolean;
  dayEndWarning?: {
    pending: boolean;
    workDateLabel: string;
    cutoffLabel: string;
    message: string | null;
  };
};

type AttendanceDay = {
  date: string;
  dayOfMonth: number;
  weekday: number;
  attendanceStatus: string | null;
  statusLabel: string | null;
  minutesWorked: number | null;
  suggestedMinutes: number | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  source: string | null;
  entryId: string | null;
  hasManualEntry: boolean;
  employeeConfirmedAt: string | null;
  isFuture: boolean;
  isAutoMarked: boolean;
};

type EmployeeListItem = {
  id: string;
  userId: string;
  personnelNo?: string | null;
  user: { firstName: string; lastName: string; email: string };
  department?: { name: string } | null;
};

type AttendanceResponse = {
  year: number;
  month: number;
  days: AttendanceDay[];
  employee?: { id: string; userId: string; name: string; department: string | null };
  periodLock?: {
    employeeConfirmedAt: string | null;
    employeeSignature: string | null;
    employeeSignatureAt: string | null;
    managerConfirmedAt: string | null;
    managerSignature: string | null;
    managerSignatureAt: string | null;
    lockedAt: string | null;
    isLocked: boolean;
  };
  summary?: {
    confirmedDays: number;
    pastWorkDays: number;
    pendingConfirmationDays: number;
  };
};

type LeaveRequest = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  dayCount: number | null;
  status: string;
  reason?: string | null;
  submittedAt?: string | null;
  rejectionReason?: string | null;
  employeeName?: string;
  employeeProfile?: {
    user: { firstName: string; lastName: string };
    department?: { name: string } | null;
  };
  department?: string | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
};

/** Ayarlar → Tanımlar → Personel'den yönetilen izin türü listesi alınamazsa kullanılan varsayılan. */
const DEFAULT_LEAVE_TYPE_OPTIONS = [
  { value: 'annual', label: 'Yıllık İzin' },
  { value: 'sick', label: 'Hastalık İzni' },
  { value: 'unpaid', label: 'Ücretsiz İzin' },
  { value: 'other', label: 'Diğer' },
];

type HrLeaveTypeOption = { code: string; label: string; active: boolean };

const STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  pending: 'Beklemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const ATTENDANCE_LABELS: Record<string, string> = {
  present: 'Devam',
  absent: 'Devamsız',
  half_day: 'Yarım Gün',
  leave: 'İzinli',
  holiday: 'Resmi Tatil',
  weekly_rest: 'Hafta Tatili',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return `${formatDate(value)} · ${formatClockTime(value)}`;
}

function formatClockTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function minutesToHours(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  return `${h} sa ${m} dk`;
}

export default function PersonelOzlukPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const roleCode = usePanelRoleCode();
  const canApproveByRole =
    roleCode === 'admin' ||
    roleCode === 'manager' ||
    roleCode === 'finance' ||
    roleCode === 'finans' ||
    roleCode === 'accountant';
  const canSuperviseByRole =
    roleCode === 'admin' ||
    roleCode === 'manager' ||
    roleCode === 'finance' ||
    roleCode === 'finans' ||
    roleCode === 'accountant';
  const designPreview = searchParams.get('tasarim') === '1';
  const now = new Date();
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [confirmingDate, setConfirmingDate] = useState<string | null>(null);
  const [monthConfirmLoading, setMonthConfirmLoading] = useState(false);
  const [bulkConfirmLoading, setBulkConfirmLoading] = useState(false);
  const [signatureModal, setSignatureModal] = useState<'month' | 'lock' | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [expandedLeaveId, setExpandedLeaveId] = useState<string | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'annual',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'supervision') {
      setActiveTab('summary');
    } else if (
      tab === 'attendance' ||
      tab === 'leaves' ||
      tab === 'summary' ||
      tab === 'documents' ||
      tab === 'assets'
    ) {
      setActiveTab(tab);
    }
    const y = Number(searchParams.get('year'));
    const m = Number(searchParams.get('month'));
    if (y >= 2000 && y <= 2100) setYear(y);
    if (m >= 1 && m <= 12) setMonth(m);
  }, [searchParams]);

  const { data: summaryRaw, isLoading: summaryLoading, isError: summaryError } = useApiQuery<HrSummary>(
    ['hr-summary'],
    'hr/summary',
  );
  const summary = summaryRaw as HrSummary | undefined;

  const canSupervise =
    designPreview ||
    Boolean(summary?.canSupervise) ||
    canSuperviseByRole ||
    canApproveByRole;

  const isAdminRole = roleCode === 'admin';
  const isFinanceRole =
    roleCode === 'finance' || roleCode === 'finans' || roleCode === 'accountant';
  const mustConfirmOwnAttendance =
    designPreview
      ? true
      : summary?.mustConfirmOwnAttendance != null
        ? Boolean(summary.mustConfirmOwnAttendance)
        : !isAdminRole;
  const canManagePersonnelDocuments =
    designPreview
      ? true
      : summary?.canManagePersonnelDocuments != null
        ? Boolean(summary.canManagePersonnelDocuments)
        : isFinanceRole;
  /** Admin: yalnız denetim — kendi puantaj akışına düşmez */
  const attendanceSuperviseOnly = canSupervise && !mustConfirmOwnAttendance;

  const { data: employeesRaw } = useApiQuery<EmployeeListItem[]>(
    ['hr-employees-list'],
    'hr/employees',
    {
      enabled:
        (canSupervise || canManagePersonnelDocuments) &&
        (activeTab === 'attendance' || activeTab === 'assets' || activeTab === 'documents' || activeTab === 'summary'),
    },
  );
  const employeeList = Array.isArray(employeesRaw) ? employeesRaw : [];
  const isViewingOther = canSupervise && Boolean(selectedEmployeeId);
  /** Admin puantajda personel seçmeden kendi kaydına düşmez */
  const needsAttendanceEmployeePick = attendanceSuperviseOnly && !selectedEmployeeId;

  const {
    data: attendanceRaw,
    isLoading: attendanceLoading,
    isError: attendanceError,
    error: attendanceErr,
  } = useApiQuery<AttendanceResponse>(
    ['hr-attendance', year, month, selectedEmployeeId, mustConfirmOwnAttendance],
    'hr/attendance',
    {
      params: { year, month, employeeProfileId: selectedEmployeeId || undefined },
      enabled:
        activeTab === 'attendance' &&
        (mustConfirmOwnAttendance || Boolean(selectedEmployeeId)),
    },
  );
  const attendance = attendanceRaw as AttendanceResponse | undefined;

  const { data: leavesRaw, isLoading: leavesLoading, isError: leavesError } = useApiQuery<LeaveRequest[]>(
    ['hr-leaves'],
    'hr/leave-requests',
    { enabled: activeTab === 'leaves' },
  );
  const leaves = Array.isArray(leavesRaw) ? leavesRaw : [];

  const { data: leaveTypesRaw } = useApiQuery<HrLeaveTypeOption[]>(
    ['hr-leave-types'],
    'system-settings/hr-leave-types',
  );
  const leaveTypeOptions = useMemo(() => {
    const active = (Array.isArray(leaveTypesRaw) ? leaveTypesRaw : []).filter((t) => t.active !== false);
    if (active.length === 0) return DEFAULT_LEAVE_TYPE_OPTIONS;
    return active.map((t) => ({ value: t.code, label: t.label }));
  }, [leaveTypesRaw]);

  const canApproveLeaves = Boolean(summary?.canApprove) || canApproveByRole;

  const {
    data: pendingRaw,
    isLoading: pendingLoading,
    isError: pendingError,
    error: pendingErr,
  } = useApiQuery<LeaveRequest[]>(
    ['hr-pending-approval'],
    'hr/leave-requests/pending-approval',
    { enabled: activeTab === 'leaves' && canApproveLeaves },
  );
  const pending = Array.isArray(pendingRaw) ? pendingRaw : [];

  const {
    data: allLeavesRaw,
    isLoading: allLeavesLoading,
    isError: allLeavesError,
  } = useApiQuery<LeaveRequest[]>(
    ['hr-leaves-all'],
    'hr/leave-requests/all',
    { enabled: activeTab === 'leaves' && canApproveLeaves },
  );
  const allLeaves = Array.isArray(allLeavesRaw) ? allLeavesRaw : [];

  const createLeave = useApiMutation<LeaveRequest, typeof leaveForm & { submit?: boolean }>(
    'hr/leave-requests',
    'post',
    {
      onSuccess: () => {
        showToast('success', 'İzin Talebi Kaydedildi');
        setLeaveForm({ leaveType: 'annual', startDate: '', endDate: '', reason: '' });
        queryClient.invalidateQueries({ queryKey: ['hr-leaves'] });
        queryClient.invalidateQueries({ queryKey: ['hr-leaves-all'] });
        queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
        queryClient.invalidateQueries({ queryKey: ['hr-pending-approval'] });
      },
      onError: (e) => showToast('error', e.message || 'İzin Talebi Kaydedilemedi'),
    },
  );

  const canManagePuantaj = summary?.canApprove || canApproveByRole;
  /** Admin veya Finans — personel aylık onayından sonra tek onay yeter */
  const canLockAttendance = Boolean(summary?.canApprove) || canApproveByRole;

  const tabs = useMemo(() => {
    const leavesBadge =
      (summary?.stats.pendingLeaveRequests || 0) +
      (canApproveLeaves ? summary?.stats.pendingApprovalQueue || 0 : 0);
    const items: { key: TabKey; label: string; badge?: number }[] = [
      {
        key: 'summary',
        label: canSupervise ? 'Özet Ve Denetim' : 'Özet',
        badge: canSupervise && designPreview ? 4 : undefined,
      },
      { key: 'attendance', label: 'Puantaj' },
      { key: 'leaves', label: 'İzinlerim', badge: leavesBadge || undefined },
      { key: 'documents', label: 'Özlük Evrakları' },
      { key: 'assets', label: 'Zimmet' },
    ];
    return items;
  }, [summary, canApproveLeaves, canSupervise, designPreview]);

  const handleCreateLeave = () => {
    if (!isCompleteTrDateValue(leaveForm.startDate) || !isCompleteTrDateValue(leaveForm.endDate)) {
      showToast('warning', 'Geçerli Başlangıç Ve Bitiş Tarihi Girin (GG.AA.YYYY)');
      return;
    }
    const startDate = normalizeTrDateValue(leaveForm.startDate);
    const endDate = normalizeTrDateValue(leaveForm.endDate);
    if (endDate < startDate) {
      showToast('warning', 'Bitiş Tarihi Başlangıçtan Önce Olamaz');
      return;
    }
    createLeave.mutate({
      ...leaveForm,
      startDate,
      endDate,
      reason: leaveForm.reason.trim() ? toTitleCaseTR(leaveForm.reason.trim()) : '',
      submit: true,
    });
  };

  const handleConfirmDay = async (date: string) => {
    if (attendance?.periodLock?.isLocked) {
      showToast('warning', 'Bu Ay Kilitli');
      return;
    }
    setConfirmingDate(date);
    try {
      await apiClient.post('hr/attendance/confirm-day', { workDate: date });
      showToast('success', 'Gün Onaylandı');
      queryClient.invalidateQueries({ queryKey: ['hr-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Onay Başarısız');
    } finally {
      setConfirmingDate(null);
    }
  };

  const handleConfirmPendingDays = async () => {
    if (attendance?.periodLock?.isLocked) {
      showToast('warning', 'Bu Ay Kilitli');
      return;
    }
    setBulkConfirmLoading(true);
    try {
      const result = await apiClient.post<{ confirmedCount: number }>('hr/attendance/confirm-pending', {
        year,
        month,
      });
      showToast(
        'success',
        result.confirmedCount > 0 ? `${result.confirmedCount} Gün Onaylandı` : 'Onaylanacak Bekleyen Gün Yok',
      );
      queryClient.invalidateQueries({ queryKey: ['hr-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Toplu Onay Başarısız');
    } finally {
      setBulkConfirmLoading(false);
    }
  };

  const handleConfirmMonth = () => {
    setSignatureModal('month');
  };

  const handleLockMonth = () => {
    setSignatureModal('lock');
  };

  const submitSignatureAction = async (signature: string) => {
    setMonthConfirmLoading(true);
    try {
      if (signatureModal === 'month') {
        await apiClient.post('hr/attendance/confirm-month', { year, month, signature });
        showToast('success', 'Aylık Puantaj Onaylandı');
      } else if (signatureModal === 'lock') {
        await apiClient.post('hr/attendance/lock-month', {
          year,
          month,
          signature,
          employeeProfileId: selectedEmployeeId || undefined,
        });
        showToast('success', 'Puantaj Onaylandı Ve Ay Kilitlendi');
      }
      setSignatureModal(null);
      queryClient.invalidateQueries({ queryKey: ['hr-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'İşlem Başarısız');
    } finally {
      setMonthConfirmLoading(false);
    }
  };

  const expectedFullName = summary?.profile?.user
    ? `${summary.profile.user.firstName ?? ''} ${summary.profile.user.lastName ?? ''}`.trim()
    : null;

  const handleApprove = async (id: string) => {
    try {
      await apiClient.patch(`hr/leave-requests/${id}/approve`);
      showToast('success', 'İzin Onaylandı');
      queryClient.invalidateQueries({ queryKey: ['hr-pending-approval'] });
      queryClient.invalidateQueries({ queryKey: ['hr-leaves-all'] });
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
    } catch {
      showToast('error', 'Onay Başarısız');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await apiClient.patch(`hr/leave-requests/${id}/reject`, { rejectionReason: 'Yönetici tarafından reddedildi' });
      showToast('success', 'İzin Reddedildi');
      queryClient.invalidateQueries({ queryKey: ['hr-pending-approval'] });
      queryClient.invalidateQueries({ queryKey: ['hr-leaves-all'] });
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
    } catch {
      showToast('error', 'Reddetme Başarısız');
    }
  };

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <a href="/panel" className="hover:text-brand-600 transition-colors">Dashboard</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Personel Özlük</span>
      </nav>

      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="page-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="page-title">Personel Özlük</h2>
            <p className="page-subtitle">
              {designPreview
                ? 'Tasarım Önizleme — Admin Denetim Ve Gün Sonu Puantaj Uyarısı'
                : attendanceSuperviseOnly
                  ? 'Puantaj Denetimi, İzin Onayı Ve Personel Takibi'
                  : canSupervise
                    ? 'Denetim, Kendi Puantajınız, İzin Ve Özlük Takibi'
                    : 'Puantaj, İzin Talebi Ve Onay Takibi'}
            </p>
          </div>
        </div>
      </div>

      {designPreview && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-content-secondary">
          Bu ekran <span className="font-semibold text-content-primary">lokal tasarım önizlemesidir</span>.
          Veriler örnek; API ve bildirimler henüz bağlanmadı. Onaylarsanız bir sonraki adımda gerçek veriye geçeriz.
        </div>
      )}

      {mustConfirmOwnAttendance && (
        <AttendanceDayEndBanner
          preview={designPreview}
          message={designPreview ? undefined : summary?.dayEndWarning?.message ?? undefined}
          workDateLabel={designPreview ? undefined : summary?.dayEndWarning?.workDateLabel}
          cutoffLabel={designPreview ? undefined : summary?.dayEndWarning?.cutoffLabel}
        />
      )}

      <AttendanceMonthCloseBanner />

      {canManagePuantaj && !designPreview && (
        <PuantajProcessGuide onGoToAttendance={() => setActiveTab('attendance')} />
      )}
      {attendanceSuperviseOnly && !designPreview && (
        <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm text-content-secondary">
          Admin olarak kendi puantajınızı oluşturmazsınız; personeli denetler ve gerektiğinde{' '}
          <span className="font-semibold text-content-primary">Onayla Ve Kilitle</span> uygularsınız.
          Finans da aynı onayı verebilir — birinin onayı yeter, çift onay aranmaz.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
              }`}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-0.5 flex items-center justify-center min-w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold px-1.5">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {canSupervise ? (
                <AdminAttendanceSupervisionPanel
                  preview={designPreview}
                  onOpenEmployeeFile={(employee) => {
                    if (designPreview) return;
                    setSelectedEmployeeId(employee.id);
                    setActiveTab('attendance');
                  }}
                />
              ) : summaryLoading ? (
                <div className="animate-pulse h-32 bg-slate-100 rounded-xl" />
              ) : summaryError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  Özet yüklenemedi. Sayfayı yenileyin (Cmd+Shift+R). Personel modülü kapalıysa yöneticinize bildirin.
                </div>
              ) : summary ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-100 p-5 bg-slate-50/50">
                      <p className="text-xs font-medium text-slate-500 mb-2">Personel Bilgisi</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {summary.profile.user.firstName} {summary.profile.user.lastName}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">{summary.profile.user.email}</p>
                      {summary.profile.department && (
                        <p className="text-sm text-slate-600 mt-2">Departman: {summary.profile.department.name}</p>
                      )}
                      {summary.profile.manager && (
                        <p className="text-sm text-slate-600">
                          Yönetici: {summary.profile.manager.firstName} {summary.profile.manager.lastName}
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-brand-100 p-5 bg-brand-50/40">
                      <p className="text-xs font-medium text-slate-500 mb-2">{summary.leaveBalance.leaveTypeLabel} ({summary.leaveBalance.year})</p>
                      <p className="text-3xl font-bold text-brand-700">{summary.leaveBalance.remainingDays} gün</p>
                      <p className="text-sm text-slate-600 mt-2">
                        Toplam {summary.leaveBalance.totalDays} · Kullanılan {summary.leaveBalance.usedDays} · Bekleyen {summary.leaveBalance.pendingDays}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="stat-card card-accent-orange">
                      <p className="text-2xl font-bold text-orange-700">{summary.stats.pendingLeaveRequests}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Bekleyen İzinlerim</p>
                    </div>
                    <div className="stat-card card-accent-emerald">
                      <p className="text-2xl font-bold text-green-700">{summary.stats.approvedLeavesThisYear}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Onaylanan (Bu Yıl)</p>
                    </div>
                    <div className="stat-card card-accent-blue">
                      <p className="text-2xl font-bold text-blue-700">{summary.stats.attendanceRecordsThisMonth}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Puantaj Kaydı (Bu Ay)</p>
                    </div>
                    {summary.canApprove && (
                      <div className="stat-card card-accent-purple">
                        <p className="text-2xl font-bold text-purple-700">{summary.stats.pendingApprovalQueue}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Onay Kuyruğu</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Özet yüklenemedi.</p>
              )}
              {canSupervise && (
                <HrAssignedAssetsPanel
                  preview={designPreview}
                  canAdd={!designPreview}
                  onOpenEmployee={(profileId) => {
                    setSelectedEmployeeId(profileId);
                    setActiveTab('documents');
                  }}
                />
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6" id="hr-ozluk-evraklari">
              {(canSupervise || canManagePersonnelDocuments) && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <label className="text-xs font-medium text-content-tertiary">Personel</label>
                  <select
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  >
                    <option value="">
                      {canManagePersonnelDocuments ? 'Personel seçin' : 'Personel seçin (denetim)'}
                    </option>
                    {employeeList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.user.firstName} {emp.user.lastName}
                        {emp.department ? ` · ${emp.department.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!canManagePersonnelDocuments && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-content-secondary">
                  {attendanceSuperviseOnly || isAdminRole
                    ? 'Özlük evrak yükleme Finans veya yetkili personel tarafından yapılır. Siz denetler, gerektiğinde talimat verirsiniz.'
                    : 'Özlük evraklarınızı Finans takip eder. Eksik belge için Finans ile iletişime geçin; yükleme personel ekranından yapılmaz.'}
                </div>
              )}

              {canManagePersonnelDocuments && !selectedEmployeeId && !designPreview && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-content-tertiary">
                  Evrak yüklemek veya takip etmek için personel seçin. İşe giriş / çıkış ve çalışma süreci evrakları buradan imzalatılır ve saklanır.
                </div>
              )}

              {(selectedEmployeeId || (!canSupervise && !canManagePersonnelDocuments && summary?.profile?.id) || designPreview) && (
                <>
                  <HrPersonnelDocumentsPanel
                    preview={designPreview}
                    employeeName={
                      selectedEmployeeId
                        ? (() => {
                            const emp = employeeList.find((e) => e.id === selectedEmployeeId);
                            return emp
                              ? `${emp.user.firstName} ${emp.user.lastName}`.trim()
                              : 'Personel';
                          })()
                        : summary
                          ? `${summary.profile.user.firstName} ${summary.profile.user.lastName}`.trim()
                          : 'Personel'
                    }
                    canSelectEmployee={false}
                    canUpload={canManagePersonnelDocuments}
                    onUploadRequest={() => {
                      if (!canManagePersonnelDocuments) return;
                      const el = document.getElementById('hr-ozluk-yukleme');
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  />
                  {!designPreview && canManagePersonnelDocuments && selectedEmployeeId && (
                    <div id="hr-ozluk-yukleme" className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-content-primary">Evrak Yükleme</h3>
                      <p className="text-xs text-content-secondary">
                        Islak imzalı PDF/JPG dosyalarını buradan yükleyin. Dosya adında evrak türünü belirtin
                        (ör. Kvkk-Aydinlatma.pdf).
                      </p>
                      <EntityDocumentsTab
                        mode="entity"
                        entityType="hr_employee_profile"
                        entityId={selectedEmployeeId}
                      />
                    </div>
                  )}
                  {!designPreview && !canManagePersonnelDocuments && (selectedEmployeeId || summary?.profile?.id) && (
                    <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-content-primary">Yüklenen Evraklar</h3>
                      <EntityDocumentsTab
                        mode="entity"
                        entityType="hr_employee_profile"
                        entityId={selectedEmployeeId || summary!.profile.id!}
                        readOnly
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="space-y-4">
              <HrAssignedAssetsPanel
                preview={designPreview}
                employeeProfileId={canSupervise ? undefined : summary?.profile?.id}
                employeeName={
                  canSupervise
                    ? undefined
                    : summary
                      ? `${summary.profile.user.firstName} ${summary.profile.user.lastName}`.trim()
                      : undefined
                }
                canAdd={canSupervise && !designPreview}
                onOpenEmployee={(profileId) => {
                  setSelectedEmployeeId(profileId);
                  setActiveTab('documents');
                }}
              />
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {canSupervise && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <label className="text-xs font-medium text-content-tertiary">Personel</label>
                  <select
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  >
                    <option value="">
                      {mustConfirmOwnAttendance ? 'Kendi Puantajım' : 'Personel seçin (denetim)'}
                    </option>
                    {employeeList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.user.firstName} {emp.user.lastName}
                        {emp.department ? ` · ${emp.department.name}` : ''}
                      </option>
                    ))}
                  </select>
                  {isViewingOther && (
                    <span className="ml-auto text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-3 py-1">
                      Salt Okunur — {attendance?.employee?.name ?? 'Seçili Personel'}
                    </span>
                  )}
                  {attendanceSuperviseOnly && !selectedEmployeeId && (
                    <span className="ml-auto text-xs font-semibold text-content-secondary bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
                      Denetim Modu — Personel Seçin
                    </span>
                  )}
                </div>
              )}

              {needsAttendanceEmployeePick ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-2">
                  <p className="text-sm font-semibold text-content-primary">Puantaj Denetimi Ve Onay</p>
                  <p className="text-sm text-content-secondary max-w-lg mx-auto">
                    Personel seçerek puantajı inceleyin. Personel aylık onay gönderdikten sonra
                    <span className="font-semibold text-content-primary"> Onayla Ve Kilitle </span>
                    ile tamamlayın. Finans aynı onayı vermişse tekrar Admin onayı gerekmez.
                  </p>
                  {canSupervise && <AttendanceBulkAccountantPanel year={year} month={month} />}
                </div>
              ) : (
              <>
              <div className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <select
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>{m}. Ay</option>
                        ))}
                      </select>
                      <select
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                      >
                        {[year - 1, year, year + 1].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Onaylı {attendance?.summary?.confirmedDays ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Bekleyen {attendance?.summary?.pendingConfirmationDays ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      İzinli {(attendance?.days ?? []).filter((d) => !d.isFuture && d.attendanceStatus === 'leave').length}
                    </span>
                  </div>

                  {attendance?.periodLock?.isLocked ? (
                    <span className="text-xs font-semibold text-status-danger">
                      Onaylandı Ve Kilitli
                      {attendance.periodLock.managerSignature
                        ? ` · ${attendance.periodLock.managerSignature}`
                        : ''}
                    </span>
                  ) : isViewingOther ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {!attendance?.periodLock?.employeeConfirmedAt ? (
                        <span className="text-xs text-content-tertiary">
                          Personel Aylık Onayı Bekleniyor
                        </span>
                      ) : canLockAttendance ? (
                        <>
                          <button
                            type="button"
                            disabled={monthConfirmLoading}
                            onClick={handleLockMonth}
                            className="rounded-lg bg-brand-600 text-white text-xs font-semibold px-3 py-2 hover:bg-brand-700 disabled:opacity-50"
                          >
                            Onayla Ve Kilitle
                          </button>
                          <span className="text-[11px] text-content-tertiary max-w-[220px]">
                            Admin veya Finans — biri yeterli
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-content-tertiary">
                          Personel onayladı; yetkili onay bekleniyor
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={bulkConfirmLoading || (attendance?.summary?.pendingConfirmationDays ?? 0) === 0}
                        onClick={handleConfirmPendingDays}
                        className="rounded-lg bg-emerald-600 text-white text-xs font-semibold px-3 py-2 hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {bulkConfirmLoading ? 'Onaylanıyor...' : 'Bekleyenleri Onayla'}
                      </button>
                      <button
                        type="button"
                        disabled={monthConfirmLoading || (attendance?.summary?.pendingConfirmationDays ?? 0) > 0}
                        onClick={handleConfirmMonth}
                        className="rounded-lg bg-brand-600 text-white text-xs font-semibold px-3 py-2 hover:bg-brand-700 disabled:opacity-50"
                      >
                        Aylık Onay
                      </button>
                      {canLockAttendance && attendance?.periodLock?.employeeConfirmedAt && (
                        <button
                          type="button"
                          disabled={monthConfirmLoading}
                          onClick={handleLockMonth}
                          className="rounded-lg border border-slate-300 text-xs font-semibold px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Onayla Ve Kilitle
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-content-tertiary">
                  Mesai: Hafta İçi 08:30–18:00 · Cumartesi 08:30–13:00 · Pazar Ve Resmi Tatiller Çalışılmıyor.
                  Resmi tatil ve hafta tatili otomatik işaretlenir; onaylı izinler &quot;İzinli&quot; görünür.
                  {isViewingOther
                    ? ' Personel aylık onay gönderir; Admin veya Finans’tan biri Onayla Ve Kilitle ile tamamlar (çift onay aranmaz).'
                    : ' Ay sonunda Aylık Onay verin; Admin veya Finans Onayla Ve Kilitle uygular.'}
                </p>

                {attendance?.periodLock && (attendance.periodLock.employeeConfirmedAt || attendance.periodLock.managerSignature) && (
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                    {attendance.periodLock.employeeConfirmedAt && (
                      <span className="text-emerald-700">
                        Personel aylık onay: {formatDate(attendance.periodLock.employeeConfirmedAt)}
                        {attendance.periodLock.employeeSignature ? ` (${attendance.periodLock.employeeSignature})` : ''}
                      </span>
                    )}
                    {attendance.periodLock.managerSignature && (
                      <span className="text-blue-700">
                        Yetkili onay: {attendance.periodLock.managerSignature}
                        {attendance.periodLock.managerConfirmedAt
                          ? ` · ${formatDate(attendance.periodLock.managerConfirmedAt)}`
                          : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!isViewingOther && !attendanceLoading && !attendanceError && attendance && (
                <AttendanceAccountantPanel
                  year={year}
                  month={month}
                  summary={attendance.summary}
                  periodLock={attendance.periodLock}
                  defaultExpanded={canManagePuantaj}
                />
              )}

              {canSupervise && <AttendanceBulkAccountantPanel year={year} month={month} />}

              {attendanceLoading ? (
                <div className="animate-pulse h-64 bg-slate-100 rounded-xl" />
              ) : attendanceError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  Puantaj listesi alınamadı: {(attendanceErr as Error)?.message ?? 'Bağlantı hatası'}. Cmd+Shift+R ile yenileyin.
                </div>
              ) : (attendance?.days ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  Bu ay için puantaj satırı oluşturulamadı.
                </div>
              ) : (
                <>
                  <AttendanceCalendar
                    days={attendance?.days ?? []}
                    year={year}
                    month={month}
                    isLocked={isViewingOther || attendance?.periodLock?.isLocked}
                    onConfirmDay={isViewingOther ? undefined : handleConfirmDay}
                    confirmingDate={confirmingDate}
                  />
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <p className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50/50">
                      Liste Görünümü — {attendance?.days.length ?? 0} gün
                    </p>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Tarih</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Durum</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Mesai Giriş</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Mesai Bitiş</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Kayıtlı Süre</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Önerilen</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Onay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(attendance?.days ?? []).filter((d) => !d.isFuture).map((day) => (
                          <tr key={day.date} className={day.employeeConfirmedAt ? 'bg-emerald-50/20' : ''}>
                            <td className="px-4 py-2.5">{formatDate(day.date)}</td>
                            <td className="px-4 py-2.5">
                              {day.statusLabel ?? (day.attendanceStatus ? (ATTENDANCE_LABELS[day.attendanceStatus] ?? day.attendanceStatus) : 'Kayıt Yok')}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums">{formatClockTime(day.clockInAt)}</td>
                            <td className="px-4 py-2.5 tabular-nums">{formatClockTime(day.clockOutAt)}</td>
                            <td className="px-4 py-2.5">{minutesToHours(day.minutesWorked)}</td>
                            <td className="px-4 py-2.5 text-slate-600">{minutesToHours(day.suggestedMinutes)}</td>
                            <td className="px-4 py-2.5 text-xs">
                              {day.employeeConfirmedAt ? (
                                <span className="text-emerald-700">
                                  Personel Tarafından Onaylandı
                                  <span className="block text-slate-400 text-[11px]">
                                    {formatClockTime(day.employeeConfirmedAt)}
                                  </span>
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              </>
              )}
            </div>
          )}

          {activeTab === 'leaves' && (
            <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">İzin Geçmişim</h3>
                {leavesLoading ? (
                  <div className="animate-pulse h-24 bg-slate-100 rounded-xl" />
                ) : leavesError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    İzin listesi alınamadı. Sayfayı yenileyin veya yöneticinize bildirin.
                  </div>
                ) : leaves.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                    Henüz izin talebiniz yok. Sağdaki formdan yeni talep oluşturabilirsiniz.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaves.map((leave) => (
                      <div key={leave.id} className="rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {leaveTypeOptions.find((o) => o.value === leave.leaveType)?.label ?? leave.leaveType}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                              {leave.dayCount ? ` · ${leave.dayCount} gün` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[leave.status] ?? 'bg-slate-100 text-slate-600'}`}>
                              {STATUS_LABELS[leave.status] ?? leave.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedLeaveId((cur) => (cur === leave.id ? null : leave.id))}
                              title="İzin Evrakları"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {expandedLeaveId === leave.id && (
                          <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                            <EntityDocumentsTab
                              mode="entity"
                              entityType="hr_leave_request"
                              entityId={leave.id}
                              title="İzin Evrakları"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-100 p-5 bg-slate-50/40 h-fit">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Yeni İzin Talebi</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">İzin Tipi</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                      value={leaveForm.leaveType}
                      onChange={(e) => setLeaveForm((p) => ({ ...p, leaveType: e.target.value }))}
                    >
                      {leaveTypeOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Başlangıç</label>
                    <TrDateInput
                      value={leaveForm.startDate}
                      onChange={(startDate) => setLeaveForm((p) => ({ ...p, startDate }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                      aria-label="İzin başlangıç tarihi"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Bitiş</label>
                    <TrDateInput
                      value={leaveForm.endDate}
                      onChange={(endDate) => setLeaveForm((p) => ({ ...p, endDate }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                      aria-label="İzin bitiş tarihi"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Açıklama</label>
                    <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white min-h-[80px]"
                      value={leaveForm.reason}
                      onBlur={(e) => setLeaveForm((p) => ({ ...p, reason: toTitleCaseTR(e.target.value.trim()) }))}
                      onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))} />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateLeave}
                    disabled={createLeave.isPending}
                    className="w-full bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createLeave.isPending ? 'Gönderiliyor...' : 'Onaya Gönder'}
                  </button>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Talep oluşturduktan sonra soldaki listeden ataç ikonuna tıklayarak fiziki izin evrağınızı (ör. rapor) yükleyebilirsiniz.
                  </p>
                </div>
              </div>
            </div>

            {canApproveLeaves && (
              <div className="space-y-8 border-t border-slate-100 pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">Bekleyen Onaylar</h3>
                    <span className="text-xs font-medium text-orange-600">{pending.length} talep</span>
                  </div>
                  {pendingLoading ? (
                    <div className="animate-pulse h-24 bg-slate-100 rounded-xl" />
                  ) : pendingError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      Onay kuyruğu alınamadı: {(pendingErr as Error)?.message ?? 'Bağlantı hatası'}.
                    </div>
                  ) : pending.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                      Onay bekleyen izin talebi yok.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pending.map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-100">
                          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-slate-800">
                                {item.employeeName ?? `${item.employeeProfile?.user.firstName ?? ''} ${item.employeeProfile?.user.lastName ?? ''}`.trim()}
                              </p>
                              <p className="text-xs text-slate-500">
                                {leaveTypeOptions.find((o) => o.value === item.leaveType)?.label ?? item.leaveType} · {formatDate(item.startDate)} – {formatDate(item.endDate)}
                                {item.dayCount ? ` · ${item.dayCount} gün` : ''}
                              </p>
                              {item.reason && <p className="text-xs text-slate-600 mt-1">{item.reason}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedLeaveId((cur) => (cur === item.id ? null : item.id))}
                                title="İzin Evrakları"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleApprove(item.id)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
                                Onayla
                              </button>
                              <button type="button" onClick={() => handleReject(item.id)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100">
                                Reddet
                              </button>
                            </div>
                          </div>
                          {expandedLeaveId === item.id && (
                            <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                              <EntityDocumentsTab
                                mode="entity"
                                entityType="hr_leave_request"
                                entityId={item.id}
                                title="İzin Evrakları"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">Tüm Personel İzin Geçmişi</h3>
                  {allLeavesLoading ? (
                    <div className="animate-pulse h-24 bg-slate-100 rounded-xl" />
                  ) : allLeavesError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      İzin geçmişi alınamadı. Sayfayı yenileyin veya yöneticinize bildirin.
                    </div>
                  ) : allLeaves.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                      Henüz izin kaydı yok.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-2.5 font-medium">Personel</th>
                            <th className="px-4 py-2.5 font-medium">Tür</th>
                            <th className="px-4 py-2.5 font-medium">Başlangıç</th>
                            <th className="px-4 py-2.5 font-medium">Bitiş</th>
                            <th className="px-4 py-2.5 font-medium">Gün</th>
                            <th className="px-4 py-2.5 font-medium">Durum</th>
                            <th className="px-4 py-2.5 font-medium">Onaylayan</th>
                            <th className="px-4 py-2.5 font-medium">Onay Tarihi/Saati</th>
                            <th className="px-4 py-2.5 font-medium">Ek</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allLeaves.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/60">
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-slate-800">
                                  {item.employeeName ?? `${item.employeeProfile?.user.firstName ?? ''} ${item.employeeProfile?.user.lastName ?? ''}`.trim()}
                                </p>
                                {item.department && <p className="text-slate-400">{item.department}</p>}
                              </td>
                              <td className="px-4 py-2.5">
                                {leaveTypeOptions.find((o) => o.value === item.leaveType)?.label ?? item.leaveType}
                              </td>
                              <td className="px-4 py-2.5">{formatDate(item.startDate)}</td>
                              <td className="px-4 py-2.5">{formatDate(item.endDate)}</td>
                              <td className="px-4 py-2.5">{item.dayCount ?? '—'}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[item.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                  {STATUS_LABELS[item.status] ?? item.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">{item.decidedByName ?? '—'}</td>
                              <td className="px-4 py-2.5">{formatDateTime(item.decidedAt)}</td>
                              <td className="px-4 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => setExpandedLeaveId((cur) => (cur === item.id ? null : item.id))}
                                  title="İzin Evrakları"
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                                >
                                  <Paperclip className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {allLeaves.some((item) => expandedLeaveId === item.id) && (
                        <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                          <EntityDocumentsTab
                            mode="entity"
                            entityType="hr_leave_request"
                            entityId={expandedLeaveId as string}
                            title="İzin Evrakları"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          )}
        </div>
      </div>

      <AttendanceSignatureModal
        open={signatureModal !== null}
        title={signatureModal === 'lock' ? 'Onayla Ve Kilitle — Dijital İmza' : 'Aylık Puantaj Onayı — Dijital İmza'}
        description={
          signatureModal === 'lock'
            ? 'Personelin aylık onayını incelediniz. Onayladığınızda ay kilitlenir. Admin veya Finans’tan biri yeterli; çift onay aranmaz.'
            : 'Ay sonu puantajınızı incelediğinizi ad-soyad yazarak onaylayın.'
        }
        confirmLabel={signatureModal === 'lock' ? 'Onayla Ve Kilitle' : 'Aylık Onay Ver'}
        expectedFullName={expectedFullName}
        loading={monthConfirmLoading}
        onClose={() => !monthConfirmLoading && setSignatureModal(null)}
        onConfirm={submitSignatureAction}
      />
    </div>
  );
}

'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { usePanelRoleCode } from '@/hooks/usePanelRole';
import { useToast } from '@/contexts/ToastContext';
import { isoToTrDateDisplay } from '@/utils/tr-date-input';
import { apiClient, getBaseUrl } from '@/lib/api-client';
import { getAccessToken } from '@/utils/auth-session';
import { AttendanceCalendar } from '@/components/hr/AttendanceCalendar';
import { AttendanceAccountantPanel } from '@/components/hr/AttendanceAccountantPanel';
import { AttendanceBulkAccountantPanel } from '@/components/hr/AttendanceBulkAccountantPanel';
import { AttendanceMonthCloseBanner } from '@/components/hr/AttendanceMonthCloseBanner';
import { AttendanceSignatureModal } from '@/components/hr/AttendanceSignatureModal';
import { AttendanceDayEndBanner } from '@/components/hr/AttendanceDayEndBanner';
import { AdminAttendanceSupervisionPanel } from '@/components/hr/AdminAttendanceSupervisionPanel';
import { WorkHoursPreviewNote } from '@/components/hr/WorkHoursPreviewNote';
import { PuantajProcessGuide } from '@/components/hr/PuantajProcessGuide';
import { PerformanceManagementPanel } from '@/components/hr/PerformanceManagementPanel';
import { HrPersonnelDocumentsPanel } from '@/components/hr/HrPersonnelDocumentsPanel';
import { HrAssignedAssetsPanel } from '@/components/hr/HrAssignedAssetsPanel';
import {
  HrLeaveApprovalsPanel,
  ManagerHrWatchStrip,
  type LeaveApprovalItem,
} from '@/components/hr/ManagerHrWatchStrip';
import {
  HrMyLeavesPanel,
  type LeaveRow,
  type LeaveSubmitPayload,
} from '@/components/hr/HrMyLeavesPanel';
import { DAY_END_SUPERVISION_PREVIEW } from '@/components/hr/attendance-day-end.preview';
import { EntityDocumentsTab } from '@/components/EntityDocumentsTab';

function readSessionUserLabel(): { name: string; email: string } {
  if (typeof window === 'undefined') return { name: 'Personel', email: '' };
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}') as {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return { name: name || 'Personel', email: u.email?.trim() || '' };
  } catch {
    return { name: 'Personel', email: '' };
  }
}

type TabKey =
  | 'attendance'
  | 'leaves'
  | 'leave-approvals'
  | 'summary'
  | 'documents'
  | 'assets'
  | 'performance';
/** İK prosedür vs görev/sorumluluk — bilgi mimarisi */
type PageSection = 'hr' | 'duty';

const HR_TAB_KEYS: TabKey[] = [
  'summary',
  'leave-approvals',
  'attendance',
  'leaves',
  'documents',
  'assets',
];

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
  workHours?: {
    labels: { summary: string; weekday: string; saturday: string; sunday: string };
  };
  dayEndWarning?: {
    pending: boolean;
    workDateLabel: string;
    cutoffLabel: string;
    scheduleLabel?: string;
    message: string | null;
  };
  workHoursWarning?: {
    active: boolean;
    workDateLabel: string;
    expectedStart: string | null;
    expectedEnd: string | null;
    isLateStart: boolean;
    isEarlyLeave: boolean;
    lateStartMinutes: number | null;
    earlyLeaveMinutes: number | null;
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
  expectedStart?: string | null;
  expectedEnd?: string | null;
  lateStartMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  isLateStart?: boolean;
  isEarlyLeave?: boolean;
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
  workHours?: {
    labels: { summary: string; weekday: string; saturday: string; sunday: string };
  };
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

/** Ayarlar → Tanımlar → Personel'den yönetilen izin türü listesi alınamazsa — 4857 türleri (Diğer yok). */
const DEFAULT_LEAVE_TYPE_OPTIONS = [
  { value: 'annual', label: 'Yıllık Ücretli İzin' },
  { value: 'sick', label: 'Hastalık / Raporlu İzin' },
  { value: 'maternity', label: 'Analık İzni' },
  { value: 'paternity', label: 'Babalık İzni' },
  { value: 'marriage', label: 'Evlilik İzni' },
  { value: 'bereavement', label: 'Ölüm İzni' },
  { value: 'unpaid', label: 'Ücretsiz İzin' },
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
  const [pageSection, setPageSection] = useState<PageSection>('hr');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [confirmingDate, setConfirmingDate] = useState<string | null>(null);
  const [monthConfirmLoading, setMonthConfirmLoading] = useState(false);
  const [bulkConfirmLoading, setBulkConfirmLoading] = useState(false);
  const [signatureModal, setSignatureModal] = useState<'month' | 'lock' | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [expandedLeaveId, setExpandedLeaveId] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'supervision') {
      setActiveTab('summary');
      setPageSection('hr');
    } else if (
      tab === 'attendance' ||
      tab === 'leaves' ||
      tab === 'leave-approvals' ||
      tab === 'summary' ||
      tab === 'documents' ||
      tab === 'assets' ||
      tab === 'performance'
    ) {
      setActiveTab(tab);
      setPageSection(tab === 'performance' ? 'duty' : 'hr');
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
  const sessionUser = useMemo(() => readSessionUserLabel(), [summaryLoading, summaryError]);
  const selfDisplayName = summary
    ? `${summary.profile.user.firstName} ${summary.profile.user.lastName}`.trim()
    : sessionUser.name;
  const selfDisplayEmail = summary?.profile.user.email ?? sessionUser.email;
  /** Profil / API yokken de personel sekmeleri sıfır/boş enterprise durum gösterir */
  const emptyLeaveEntitlement = {
    total: 0,
    used: 0,
    pending: 0,
    remaining: 0,
    rule: `Yıllık İzin (${year})`,
  };

  const canSupervise =
    designPreview ||
    Boolean(summary?.canSupervise) ||
    canSuperviseByRole ||
    canApproveByRole;

  const isAdminRole = roleCode === 'admin';
  const isFinanceRole =
    roleCode === 'finance' || roleCode === 'finans' || roleCode === 'accountant';
  const canSeePerformance =
    designPreview ||
    roleCode === 'admin' ||
    roleCode === 'manager';
  const mustConfirmOwnAttendance =
    designPreview
      ? false /* Admin kuşbaşı önizleme */
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

  const { data: dayEndRaw } = useApiQuery<{ totals?: { notApproved?: number } }>(
    ['hr-day-end-summary-watch'],
    'hr/attendance/day-end-summary',
    { enabled: canSupervise && !designPreview && pageSection === 'hr' },
  );

  const { data: employeesRaw } = useApiQuery<EmployeeListItem[]>(
    ['hr-employees-list'],
    'hr/employees',
    {
      enabled:
        (canSupervise || canManagePersonnelDocuments || activeTab === 'leaves') &&
        (activeTab === 'attendance' ||
          activeTab === 'assets' ||
          activeTab === 'documents' ||
          activeTab === 'summary' ||
          activeTab === 'leaves'),
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
    const active = (Array.isArray(leaveTypesRaw) ? leaveTypesRaw : [])
      .filter((t) => t.active !== false)
      .filter((t) => t.code !== 'other' && t.label.trim().toLocaleLowerCase('tr-TR') !== 'diğer');
    if (active.length === 0) return DEFAULT_LEAVE_TYPE_OPTIONS;
    return active.map((t) => ({ value: t.code, label: t.label }));
  }, [leaveTypesRaw]);

  const canApproveLeaves = Boolean(summary?.canApprove) || canApproveByRole;

  const {
    data: pendingRaw,
    isLoading: pendingLoading,
    isError: pendingError,
  } = useApiQuery<LeaveRequest[]>(
    ['hr-pending-approval'],
    'hr/leave-requests/pending-approval',
    { enabled: activeTab === 'leave-approvals' && canApproveLeaves },
  );
  const pending = (Array.isArray(pendingRaw) ? pendingRaw : []) as LeaveRequest[];

  const {
    data: allLeavesRaw,
    isLoading: allLeavesLoading,
    isError: allLeavesError,
  } = useApiQuery<LeaveRequest[]>(
    ['hr-leaves-all'],
    'hr/leave-requests/all',
    { enabled: activeTab === 'leave-approvals' && canApproveLeaves },
  );
  const allLeaves = (Array.isArray(allLeavesRaw) ? allLeavesRaw : []) as LeaveRequest[];

  const createLeave = useApiMutation<
    LeaveRequest,
    { leaveType: string; startDate: string; endDate: string; reason?: string; submit?: boolean }
  >('hr/leave-requests', 'post', {
    onSuccess: () => {
      showToast('success', 'İzin Talebi Kaydedildi');
      queryClient.invalidateQueries({ queryKey: ['hr-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['hr-leaves-all'] });
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
      queryClient.invalidateQueries({ queryKey: ['hr-pending-approval'] });
    },
    onError: (e) => showToast('error', e.message || 'İzin Talebi Kaydedilemedi'),
  });

  const canManagePuantaj = summary?.canApprove || canApproveByRole;
  /** Admin veya Finans — personel aylık onayından sonra tek onay yeter */
  const canLockAttendance = Boolean(summary?.canApprove) || canApproveByRole;

  const hrTabs = useMemo(() => {
    const myLeaveBadge = summary?.stats.pendingLeaveRequests || 0;
    const approvalBadge = canApproveLeaves
      ? designPreview
        ? 3
        : summary?.stats.pendingApprovalQueue || 0
      : 0;
    const items: { key: TabKey; label: string; badge?: number }[] = [
      {
        key: 'summary',
        label: canSupervise ? 'Kadro Özeti' : 'Özet',
        badge: canSupervise && designPreview ? 4 : undefined,
      },
    ];
    if (canApproveLeaves) {
      items.push({
        key: 'leave-approvals',
        label: 'İzin Onayları',
        badge: approvalBadge || undefined,
      });
    }
    items.push(
      {
        key: 'attendance',
        label: attendanceSuperviseOnly ? 'Devam Denetimi' : 'Devam',
      },
      { key: 'leaves', label: 'İzin', badge: myLeaveBadge || undefined },
      { key: 'documents', label: 'Özlük Evrakları' },
      { key: 'assets', label: 'Zimmet' },
    );
    return items;
  }, [summary, canApproveLeaves, canSupervise, designPreview, attendanceSuperviseOnly]);

  const selectSection = (section: PageSection) => {
    setPageSection(section);
    if (section === 'duty') {
      setActiveTab('performance');
      return;
    }
    if (activeTab === 'performance' || !HR_TAB_KEYS.includes(activeTab)) {
      setActiveTab('summary');
    }
  };

  const handleCreateLeaveFromPanel = async (payload: LeaveSubmitPayload) => {
    if (payload.endDate < payload.startDate) {
      showToast('warning', 'Bitiş Tarihi Başlangıçtan Önce Olamaz');
      return;
    }
    try {
      const created = await createLeave.mutateAsync({
        leaveType: payload.leaveType,
        startDate: payload.startDate,
        endDate: payload.endDate,
        reason: payload.reason,
        submit: true,
      });
      if (payload.documentFile && created?.id) {
        try {
          const fd = new FormData();
          fd.append('file', payload.documentFile);
          fd.append('entityType', 'hr_leave_request');
          fd.append('entityId', created.id);
          const token = getAccessToken();
          const res = await fetch(`${getBaseUrl().replace(/\/$/, '')}/entity-documents`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: fd,
          });
          if (!res.ok) throw new Error('upload failed');
          showToast('success', 'İzin Evrakı Yüklendi');
        } catch {
          showToast(
            'warning',
            'Talep Oluştu; Evrak Yüklenemedi — Listeden Ataç İle Tekrar Yükleyin',
          );
        }
      }
    } catch {
      /* toast from mutation onError */
    }
  };

  const myLeaveRows: LeaveRow[] = useMemo(() => {
    return leaves.map((leave) => {
      const status = (['draft', 'pending', 'approved', 'rejected'].includes(leave.status)
        ? leave.status
        : 'pending') as LeaveRow['status'];
      const label =
        leaveTypeOptions.find((o) => o.value === leave.leaveType)?.label ?? leave.leaveType;
      const reason = leave.reason ?? null;
      const proxyMatch = reason?.match(/Vekil:\s*(.+)$/i);
      return {
        id: leave.id,
        leaveType: leave.leaveType,
        leaveTypeLabel: label,
        startDateLabel: isoToTrDateDisplay(String(leave.startDate).slice(0, 10)),
        endDateLabel: isoToTrDateDisplay(String(leave.endDate).slice(0, 10)),
        dayCount: leave.dayCount ?? 0,
        reason,
        status,
        proxyName: proxyMatch?.[1]?.trim() ?? null,
        hasDocument: false,
      };
    });
  }, [leaves, leaveTypeOptions]);

  const leaveProxyOptions = useMemo(() => {
    const list = Array.isArray(employeesRaw) ? employeesRaw : [];
    return list.map((e) => ({
      id: e.id,
      name: `${e.user.firstName} ${e.user.lastName}`.trim(),
      role: e.department?.name ?? undefined,
    }));
  }, [employeesRaw]);

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
        showToast('success', 'Aylık Devam Onaylandı');
      } else if (signatureModal === 'lock') {
        await apiClient.post('hr/attendance/lock-month', {
          year,
          month,
          signature,
          employeeProfileId: selectedEmployeeId || undefined,
        });
        showToast('success', 'Devam Onaylandı Ve Ay Kilitlendi');
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

  const toLeaveApprovalItem = useCallback(
    (item: LeaveRequest): LeaveApprovalItem => ({
      id: item.id,
      employeeName:
        item.employeeName ||
        `${item.employeeProfile?.user.firstName ?? ''} ${item.employeeProfile?.user.lastName ?? ''}`.trim() ||
        '—',
      department: item.department ?? item.employeeProfile?.department?.name ?? null,
      leaveType: item.leaveType,
      leaveTypeLabel:
        leaveTypeOptions.find((o) => o.value === item.leaveType)?.label ?? item.leaveType,
      startDateLabel: formatDate(item.startDate),
      endDateLabel: formatDate(item.endDate),
      dayCount: item.dayCount,
      reason: item.reason,
      status: item.status,
      statusLabel: STATUS_LABELS[item.status] ?? item.status,
      statusBadgeClass: STATUS_BADGE[item.status] ?? 'bg-slate-100 text-slate-600',
      decidedByName: item.decidedByName,
      decidedAtLabel: item.decidedAt
        ? new Date(item.decidedAt).toLocaleString('tr-TR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : null,
    }),
    [leaveTypeOptions],
  );

  const previewLeavePending: LeaveApprovalItem[] = useMemo(
    () => [
      {
        id: 'lp1',
        employeeName: 'Aslı Güngör',
        department: 'Operasyon',
        leaveTypeLabel: 'Yıllık İzin',
        startDateLabel: '11.08.2026',
        endDateLabel: '15.08.2026',
        dayCount: 5,
        reason: 'Aile ziyareti',
        status: 'pending',
        statusLabel: 'Beklemede',
        statusBadgeClass: STATUS_BADGE.pending,
      },
      {
        id: 'lp2',
        employeeName: 'Mehmet Demir',
        department: 'Saha',
        leaveTypeLabel: 'Hastalık İzni',
        startDateLabel: '06.08.2026',
        endDateLabel: '07.08.2026',
        dayCount: 2,
        reason: 'Raporlu',
        status: 'pending',
        statusLabel: 'Beklemede',
        statusBadgeClass: STATUS_BADGE.pending,
      },
      {
        id: 'lp3',
        employeeName: 'Elif Kaya',
        department: 'Operasyon',
        leaveTypeLabel: 'Yıllık İzin',
        startDateLabel: '18.08.2026',
        endDateLabel: '22.08.2026',
        dayCount: 5,
        reason: null,
        status: 'pending',
        statusLabel: 'Beklemede',
        statusBadgeClass: STATUS_BADGE.pending,
      },
    ],
    [],
  );

  const previewLeaveHistory: LeaveApprovalItem[] = useMemo(
    () => [
      {
        id: 'lh1',
        employeeName: 'Ayşe Yılmaz',
        department: 'Operasyon',
        leaveTypeLabel: 'Yıllık İzin',
        startDateLabel: '01.07.2026',
        endDateLabel: '05.07.2026',
        dayCount: 5,
        status: 'approved',
        statusLabel: 'Onaylandı',
        statusBadgeClass: STATUS_BADGE.approved,
        decidedByName: 'Mustafa Yürek',
        decidedAtLabel: '28 Haz 14:20',
      },
    ],
    [],
  );

  const leaveApprovalPendingItems = designPreview
    ? previewLeavePending
    : pendingError
      ? []
      : pending.map(toLeaveApprovalItem);
  const leaveApprovalHistoryItems = designPreview
    ? previewLeaveHistory
    : allLeavesError
      ? []
      : allLeaves.map(toLeaveApprovalItem);

  const leavePendingWatchCount = designPreview
    ? previewLeavePending.length
    : summary?.stats.pendingApprovalQueue ?? pending.length;
  const attendanceMissingWatchCount = designPreview
    ? DAY_END_SUPERVISION_PREVIEW.totals.notApproved
    : Number(dayEndRaw?.totals?.notApproved ?? 0);

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <a href="/panel" className="hover:text-brand-600 transition-colors">Dashboard</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Personel</span>
      </nav>

      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="page-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="page-title">Personel</h2>
          </div>
        </div>
      </div>

      {designPreview && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-content-secondary">
          Bu ekran <span className="font-semibold text-content-primary">lokal tasarım önizlemesidir</span>.
          Veriler örnek; API ve bildirimler henüz bağlanmadı. Onaylarsanız bir sonraki adımda gerçek veriye geçeriz.
        </div>
      )}

      {mustConfirmOwnAttendance && activeTab !== 'performance' && (
        <AttendanceDayEndBanner
          preview={designPreview}
          message={designPreview ? undefined : summary?.dayEndWarning?.message ?? undefined}
          workDateLabel={designPreview ? undefined : summary?.dayEndWarning?.workDateLabel}
          cutoffLabel={designPreview ? undefined : summary?.dayEndWarning?.cutoffLabel}
        />
      )}

      {activeTab !== 'performance' && (
        <AttendanceMonthCloseBanner superviseOnly={attendanceSuperviseOnly} />
      )}

      {/* Admin kuşbaşı denetimde süreç CTA yok; Finans kısa özet görür */}
      {canManagePuantaj && !attendanceSuperviseOnly && !designPreview && activeTab !== 'performance' && (
        <PuantajProcessGuide compact />
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
        {/* Bölüm seçici: İK prosedür vs görev/sorumluluk */}
        <div className="border-b border-slate-100 px-4 pt-4 pb-3 sm:px-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectSection('hr')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                pageSection === 'hr'
                  ? 'bg-brand-600 text-white'
                  : 'border border-border bg-white text-content-secondary hover:bg-slate-50'
              }`}
            >
              Personel İşlemleri
            </button>
            {canSeePerformance ? (
              <button
                type="button"
                onClick={() => selectSection('duty')}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  pageSection === 'duty'
                    ? 'bg-brand-600 text-white'
                    : 'border border-border bg-white text-content-secondary hover:bg-slate-50'
                }`}
              >
                Görev Ve Sorumluluk
              </button>
            ) : null}
          </div>
        </div>

        {pageSection === 'hr' ? (
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {hrTabs.map((tab) => (
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
        ) : null}

        <div className="p-6">
          {pageSection === 'duty' && canSeePerformance && (
            <PerformanceManagementPanel embedded preview={designPreview} />
          )}

          {pageSection === 'hr' && activeTab === 'summary' && (
            <div className="space-y-6">
              {canSupervise ? (
                <>
                  <ManagerHrWatchStrip
                    leavePendingCount={leavePendingWatchCount}
                    attendanceMissingCount={attendanceMissingWatchCount}
                    assignmentPendingCount={designPreview ? 3 : null}
                    showDuty={canSeePerformance}
                    onOpenLeaveApprovals={() => {
                      if (canApproveLeaves) setActiveTab('leave-approvals');
                    }}
                    onOpenAttendance={() => setActiveTab('attendance')}
                    onOpenDuty={() => selectSection('duty')}
                  />
                  <AdminAttendanceSupervisionPanel
                    preview={designPreview}
                    canAddEmployee={designPreview || isAdminRole || roleCode === 'manager'}
                    canManageDocuments={canManagePersonnelDocuments || designPreview}
                    onOpenEmployeeAttendance={(employee) => {
                      if (designPreview) return;
                      setSelectedEmployeeId(employee.id);
                      setActiveTab('attendance');
                    }}
                  />
                </>
              ) : summaryLoading ? (
                <div className="animate-pulse h-32 bg-slate-100 rounded-xl" />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-100 p-5 bg-slate-50/50">
                      <p className="text-xs font-medium text-slate-500 mb-2">Personel Bilgisi</p>
                      <p className="text-lg font-semibold text-slate-900">{selfDisplayName}</p>
                      {selfDisplayEmail ? (
                        <p className="text-sm text-slate-500 mt-1">{selfDisplayEmail}</p>
                      ) : null}
                      {summary?.profile.department && (
                        <p className="text-sm text-slate-600 mt-2">
                          Departman: {summary.profile.department.name}
                        </p>
                      )}
                      {summary?.profile.manager && (
                        <p className="text-sm text-slate-600">
                          Yönetici: {summary.profile.manager.firstName}{' '}
                          {summary.profile.manager.lastName}
                        </p>
                      )}
                      {!summary ? (
                        <p className="mt-2 text-xs text-content-tertiary">
                          Özlük kartı henüz oluşmamış olabilir. Özet değerleri sıfır gösterilir.
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-brand-100 p-5 bg-brand-50/40">
                      <p className="text-xs font-medium text-slate-500 mb-2">
                        {summary?.leaveBalance.leaveTypeLabel ?? 'Yıllık İzin'} (
                        {summary?.leaveBalance.year ?? year})
                      </p>
                      <p className="text-3xl font-bold text-brand-700">
                        {summary?.leaveBalance.remainingDays ?? 0} gün
                      </p>
                      <p className="text-sm text-slate-600 mt-2">
                        Toplam {summary?.leaveBalance.totalDays ?? 0} · Kullanılan{' '}
                        {summary?.leaveBalance.usedDays ?? 0} · Bekleyen{' '}
                        {summary?.leaveBalance.pendingDays ?? 0}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="stat-card card-accent-orange">
                      <p className="text-2xl font-bold text-orange-700">
                        {summary?.stats.pendingLeaveRequests ?? 0}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Bekleyen İzinlerim</p>
                    </div>
                    <div className="stat-card card-accent-emerald">
                      <p className="text-2xl font-bold text-green-700">
                        {summary?.stats.approvedLeavesThisYear ?? 0}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Onaylanan (Bu Yıl)</p>
                    </div>
                    <div className="stat-card card-accent-blue">
                      <p className="text-2xl font-bold text-blue-700">
                        {summary?.stats.attendanceRecordsThisMonth ?? 0}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Devam Kaydı (Bu Ay)</p>
                    </div>
                    {(summary?.canApprove || canApproveByRole) && (
                      <div className="stat-card card-accent-purple">
                        <p className="text-2xl font-bold text-purple-700">
                          {summary?.stats.pendingApprovalQueue ?? 0}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">Onay Kuyruğu</p>
                      </div>
                    )}
                  </div>
                </>
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

              {(selectedEmployeeId
                || designPreview
                || (!canSupervise && !canManagePersonnelDocuments)) && (
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
                        : selfDisplayName
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
                  {!designPreview
                    && !canManagePersonnelDocuments
                    && (selectedEmployeeId || summary?.profile?.id) && (
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
                    : selfDisplayName
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
                      {mustConfirmOwnAttendance ? 'Kendi Devamım' : 'Personel seçin (denetim)'}
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
                <div className="rounded-xl border border-border bg-surface p-8 text-center space-y-3">
                  <p className="text-sm font-semibold text-content-primary">Devam Denetimi</p>
                  <p className="text-sm text-content-secondary max-w-lg mx-auto">
                    Üstteki personel listesinden birini seçerek devam kaydını inceleyin. Personel aylık
                    onay gönderdikten sonra{' '}
                    <span className="font-semibold text-content-primary">Onayla Ve Kilitle</span> ile
                    tamamlayın. Finans aynı onayı vermişse tekrar Admin onayı gerekmez.
                  </p>
                  <p className="text-xs text-content-tertiary">
                    Kadro özeti için Kadro Özeti sekmesini kullanın — kendi devam kaydı
                    oluşturulmaz.
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

                <div className="mt-3 pt-3 border-t border-slate-100">
                  <WorkHoursPreviewNote
                    preview={designPreview}
                    summaryLabel={
                      attendance?.workHours?.labels.summary
                      ?? summary?.workHours?.labels.summary
                    }
                    weekdayLabel={
                      attendance?.workHours?.labels.weekday
                      ?? summary?.workHours?.labels.weekday
                      ?? 'Hafta İçi: 08:30 – 18:00'
                    }
                    saturdayLabel={
                      attendance?.workHours?.labels.saturday
                      ?? summary?.workHours?.labels.saturday
                      ?? 'Cumartesi: 08:30 – 13:00'
                    }
                    sundayLabel={
                      attendance?.workHours?.labels.sunday
                      ?? summary?.workHours?.labels.sunday
                      ?? 'Pazar Ve Resmi Tatiller: Çalışılmıyor'
                    }
                  />
                  <p className="mt-2 text-xs text-content-tertiary">
                    Resmi tatil ve hafta tatili otomatik işaretlenir; onaylı izinler &quot;İzinli&quot; görünür.
                    {isViewingOther
                      ? ' Personel aylık onay gönderir; Admin veya Finans’tan biri Onayla Ve Kilitle ile tamamlar (çift onay aranmaz).'
                      : ' Ay sonunda Aylık Onay verin; Admin veya Finans Onayla Ve Kilitle uygular.'}
                  </p>
                </div>

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
              ) : attendanceError || (attendance?.days ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  Bu ay için devam kaydı yok.
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
                          <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Denetim</th>
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
                            <td className={`px-4 py-2.5 tabular-nums ${day.isLateStart ? 'text-status-warning font-semibold' : ''}`}>
                              {formatClockTime(day.clockInAt)}
                              {day.expectedStart ? (
                                <span className="block text-[10px] font-normal text-content-tertiary">
                                  Beklenen {day.expectedStart}
                                </span>
                              ) : null}
                            </td>
                            <td className={`px-4 py-2.5 tabular-nums ${day.isEarlyLeave ? 'text-status-warning font-semibold' : ''}`}>
                              {formatClockTime(day.clockOutAt)}
                              {day.expectedEnd ? (
                                <span className="block text-[10px] font-normal text-content-tertiary">
                                  Beklenen {day.expectedEnd}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              {day.isLateStart || day.isEarlyLeave ? (
                                <div className="flex flex-col items-center gap-1">
                                  {day.isLateStart ? (
                                    <span className="rounded-full bg-status-warning/10 px-2 py-0.5 font-semibold text-status-warning">
                                      Geç +{day.lateStartMinutes} dk
                                    </span>
                                  ) : null}
                                  {day.isEarlyLeave ? (
                                    <span className="rounded-full bg-status-danger/10 px-2 py-0.5 font-semibold text-status-danger">
                                      Erken −{day.earlyLeaveMinutes} dk
                                    </span>
                                  ) : null}
                                </div>
                              ) : day.expectedStart ? (
                                <span className="text-content-tertiary">Uygun</span>
                              ) : (
                                '—'
                              )}
                            </td>
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

          {pageSection === 'hr' && activeTab === 'leave-approvals' && canApproveLeaves && (
            <HrLeaveApprovalsPanel
              preview={designPreview}
              pending={leaveApprovalPendingItems}
              history={leaveApprovalHistoryItems}
              pendingLoading={!designPreview && pendingLoading}
              historyLoading={!designPreview && allLeavesLoading}
              pendingError={null}
              historyError={null}
              expandedId={expandedLeaveId}
              onToggleExpand={(id) => setExpandedLeaveId((cur) => (cur === id ? null : id))}
              onApprove={(id) => {
                if (designPreview) {
                  showToast('success', 'Önizleme — İzin Onaylandı');
                  return;
                }
                void handleApprove(id);
              }}
              onReject={(id) => {
                if (designPreview) {
                  showToast('success', 'Önizleme — İzin Reddedildi');
                  return;
                }
                void handleReject(id);
              }}
              documentsSlot={
                designPreview
                  ? undefined
                  : (id) => (
                      <EntityDocumentsTab
                        mode="entity"
                        entityType="hr_leave_request"
                        entityId={id}
                        title="İzin Evrakları"
                      />
                    )
              }
            />
          )}

          {activeTab === 'leaves' && (
            <HrMyLeavesPanel
              preview={designPreview}
              leaveTypes={leaveTypeOptions.map((o) => ({ code: o.value, label: o.label }))}
              proxyOptions={leaveProxyOptions}
              entitlement={
                summary?.leaveBalance
                  ? {
                      total: summary.leaveBalance.totalDays,
                      used: summary.leaveBalance.usedDays,
                      pending: summary.leaveBalance.pendingDays,
                      remaining: summary.leaveBalance.remainingDays,
                      rule: `${summary.leaveBalance.leaveTypeLabel} (${summary.leaveBalance.year})`,
                    }
                  : emptyLeaveEntitlement
              }
              leaves={designPreview ? undefined : leavesError ? [] : myLeaveRows}
              leavesLoading={!designPreview && leavesLoading}
              leavesError={false}
              submitting={createLeave.isPending}
              onSubmitLive={designPreview ? undefined : handleCreateLeaveFromPanel}
              documentsSlot={
                designPreview
                  ? undefined
                  : (id) => (
                      <EntityDocumentsTab
                        mode="entity"
                        entityType="hr_leave_request"
                        entityId={id}
                        title="İzin Evrakları"
                      />
                    )
              }
            />
          )}
        </div>
      </div>

      <AttendanceSignatureModal
        open={signatureModal !== null}
        title={signatureModal === 'lock' ? 'Onayla Ve Kilitle — Dijital İmza' : 'Aylık Devam Onayı — Dijital İmza'}
        description={
          signatureModal === 'lock'
            ? 'Personelin aylık onayını incelediniz. Onayladığınızda ay kilitlenir. Admin veya Finans’tan biri yeterli; çift onay aranmaz.'
            : 'Ay sonu devam kaydınızı incelediğinizi ad-soyad yazarak onaylayın.'
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

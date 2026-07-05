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
import { AttendanceMonthCloseBanner } from '@/components/hr/AttendanceMonthCloseBanner';
import { AttendanceSignatureModal } from '@/components/hr/AttendanceSignatureModal';
import { PuantajProcessGuide } from '@/components/hr/PuantajProcessGuide';

type TabKey = 'attendance' | 'leaves' | 'approval' | 'summary';

type HrSummary = {
  profile: {
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

type AttendanceResponse = {
  year: number;
  month: number;
  days: AttendanceDay[];
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
};

const LEAVE_TYPE_OPTIONS = [
  { value: 'annual', label: 'Yıllık İzin' },
  { value: 'sick', label: 'Hastalık İzni' },
  { value: 'unpaid', label: 'Ücretsiz İzin' },
  { value: 'other', label: 'Diğer' },
];

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
  const canApproveByRole = roleCode === 'admin' || roleCode === 'manager';
  const now = new Date();
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [confirmingDate, setConfirmingDate] = useState<string | null>(null);
  const [monthConfirmLoading, setMonthConfirmLoading] = useState(false);
  const [signatureModal, setSignatureModal] = useState<'month' | 'lock' | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'annual',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'attendance' || tab === 'leaves' || tab === 'approval' || tab === 'summary') {
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

  const {
    data: attendanceRaw,
    isLoading: attendanceLoading,
    isError: attendanceError,
    error: attendanceErr,
  } = useApiQuery<AttendanceResponse>(
    ['hr-attendance', year, month],
    'hr/attendance',
    { params: { year, month }, enabled: activeTab === 'attendance' },
  );
  const attendance = attendanceRaw as AttendanceResponse | undefined;

  const { data: leavesRaw, isLoading: leavesLoading, isError: leavesError } = useApiQuery<LeaveRequest[]>(
    ['hr-leaves'],
    'hr/leave-requests',
    { enabled: activeTab === 'leaves' },
  );
  const leaves = Array.isArray(leavesRaw) ? leavesRaw : [];

  const {
    data: pendingRaw,
    isLoading: pendingLoading,
    isError: pendingError,
    error: pendingErr,
  } = useApiQuery<LeaveRequest[]>(
    ['hr-pending-approval'],
    'hr/leave-requests/pending-approval',
    { enabled: activeTab === 'approval' && Boolean(summary?.canApprove) },
  );
  const pending = Array.isArray(pendingRaw) ? pendingRaw : [];

  const createLeave = useApiMutation<LeaveRequest, typeof leaveForm & { submit?: boolean }>(
    'hr/leave-requests',
    'post',
    {
      onSuccess: () => {
        showToast('success', 'İzin Talebi Kaydedildi');
        setLeaveForm({ leaveType: 'annual', startDate: '', endDate: '', reason: '' });
        queryClient.invalidateQueries({ queryKey: ['hr-leaves'] });
        queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
        queryClient.invalidateQueries({ queryKey: ['hr-pending-approval'] });
      },
      onError: (e) => showToast('error', e.message || 'İzin Talebi Kaydedilemedi'),
    },
  );

  const canManagePuantaj = summary?.canApprove || canApproveByRole;

  const tabs = useMemo(() => {
    const items: { key: TabKey; label: string; badge?: number }[] = [
      { key: 'summary', label: 'Özet' },
      { key: 'attendance', label: 'Puantaj' },
      { key: 'leaves', label: 'İzinlerim', badge: summary?.stats.pendingLeaveRequests || undefined },
    ];
    if (summary?.canApprove || canApproveByRole) {
      items.push({
        key: 'approval',
        label: 'İzin Onay',
        badge: summary?.stats.pendingApprovalQueue || undefined,
      });
    }
    return items;
  }, [summary, canApproveByRole]);

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
        await apiClient.post('hr/attendance/lock-month', { year, month, signature });
        showToast('success', 'Ay Kilitlendi');
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
      queryClient.invalidateQueries({ queryKey: ['hr-summary'] });
    } catch {
      showToast('error', 'Reddetme Başarısız');
    }
  };

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
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
            <p className="page-subtitle">Puantaj, İzin Talebi Ve Onay Takibi</p>
          </div>
        </div>
      </div>

      <AttendanceMonthCloseBanner />

      {canManagePuantaj && (
        <PuantajProcessGuide onGoToAttendance={() => setActiveTab('attendance')} />
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
                  ? 'border-blue-600 text-blue-600'
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
              {summaryLoading ? (
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
                    <div className="rounded-xl border border-blue-100 p-5 bg-blue-50/40">
                      <p className="text-xs font-medium text-slate-500 mb-2">{summary.leaveBalance.leaveTypeLabel} ({summary.leaveBalance.year})</p>
                      <p className="text-3xl font-bold text-blue-700">{summary.leaveBalance.remainingDays} gün</p>
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
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-800 mb-1">Puantaj Onay Akışı</p>
                <p>
                  Resmi tatil ve hafta tatili (Pazar) otomatik işaretlenir. Onaylı izinler &quot;İzinli&quot; görünür.
                  Çalıştığınız günlerde <strong>Onayla</strong> ile dijital teyit verin; ay sonunda Aylık Onay, yönetici Ay Kilitle.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Hukuki not: Aylık onay ve ay kilidi ad-soyad dijital imza ile kaydedilir; 5070 nitelikli e-imza değildir.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-medium text-slate-500">Ay Seç</label>
                <select
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}. Ay</option>
                  ))}
                </select>
                <select
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {[year - 1, year, year + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {attendance?.periodLock?.isLocked ? (
                  <span className="text-xs font-medium text-red-600 ml-auto">Ay Kilitli</span>
                ) : (
                  <div className="ml-auto flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={monthConfirmLoading || (attendance?.summary?.pendingConfirmationDays ?? 0) > 0}
                      onClick={handleConfirmMonth}
                      className="rounded-lg bg-[#1a4080] text-white text-xs font-medium px-3 py-2 hover:bg-[#153366] disabled:opacity-50"
                    >
                      Aylık Onay
                    </button>
                    {(summary?.canApprove || canApproveByRole) && attendance?.periodLock?.employeeConfirmedAt && (
                      <button
                        type="button"
                        disabled={monthConfirmLoading}
                        onClick={handleLockMonth}
                        className="rounded-lg border border-slate-300 text-xs font-medium px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Ayı Kilitle (İK)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {attendance?.summary && (
                <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                  <span>Onaylı Gün: {attendance.summary.confirmedDays}</span>
                  <span>Bekleyen: {attendance.summary.pendingConfirmationDays}</span>
                  {attendance.periodLock?.employeeConfirmedAt && (
                    <span className="text-emerald-700">
                      Personel aylık onay: {formatDate(attendance.periodLock.employeeConfirmedAt)}
                      {attendance.periodLock.employeeSignature ? ` (${attendance.periodLock.employeeSignature})` : ''}
                    </span>
                  )}
                  {attendance.periodLock?.managerSignature && (
                    <span className="text-blue-700">
                      İK imza: {attendance.periodLock.managerSignature}
                    </span>
                  )}
                </div>
              )}

              {!attendanceLoading && !attendanceError && attendance && (
                <AttendanceAccountantPanel
                  year={year}
                  month={month}
                  summary={attendance.summary}
                  periodLock={attendance.periodLock}
                  defaultExpanded={canManagePuantaj}
                />
              )}

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
                    isLocked={attendance?.periodLock?.isLocked}
                    onConfirmDay={handleConfirmDay}
                    confirmingDate={confirmingDate}
                  />
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <p className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50/50">
                      Liste Görünümü — {attendance?.days.length ?? 0} gün
                    </p>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Tarih</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Durum</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Mesai Giriş</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Mesai Bitiş</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Kayıtlı Süre</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Önerilen</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Onay</th>
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
                              {day.employeeConfirmedAt ? '✓ Onaylı' : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'leaves' && (
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
                      <div key={leave.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {LEAVE_TYPE_OPTIONS.find((o) => o.value === leave.leaveType)?.label ?? leave.leaveType}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                            {leave.dayCount ? ` · ${leave.dayCount} gün` : ''}
                          </p>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[leave.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[leave.status] ?? leave.status}
                        </span>
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
                      {LEAVE_TYPE_OPTIONS.map((o) => (
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
                    className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createLeave.isPending ? 'Gönderiliyor...' : 'Onaya Gönder'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'approval' && (summary?.canApprove || canApproveByRole) && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Bekleyen izin talepleri: <span className="font-semibold text-orange-600">{pending.length}</span>
              </p>
              {pendingLoading ? (
                <div className="animate-pulse h-24 bg-slate-100 rounded-xl" />
              ) : pendingError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  Onay kuyruğu alınamadı: {(pendingErr as Error)?.message ?? 'Bağlantı hatası'}.
                </div>
              ) : pending.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                  Onay bekleyen izin talebi yok.
                </div>
              ) : (
                <div className="space-y-2">
                  {pending.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {item.employeeName ?? `${item.employeeProfile?.user.firstName ?? ''} ${item.employeeProfile?.user.lastName ?? ''}`.trim()}
                        </p>
                        <p className="text-xs text-slate-500">
                          {LEAVE_TYPE_OPTIONS.find((o) => o.value === item.leaveType)?.label} · {formatDate(item.startDate)} – {formatDate(item.endDate)}
                          {item.dayCount ? ` · ${item.dayCount} gün` : ''}
                        </p>
                        {item.reason && <p className="text-xs text-slate-600 mt-1">{item.reason}</p>}
                      </div>
                      <div className="flex items-center gap-2">
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
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AttendanceSignatureModal
        open={signatureModal !== null}
        title={signatureModal === 'lock' ? 'Ay Kilidi — Dijital İmza' : 'Aylık Puantaj Onayı — Dijital İmza'}
        description={
          signatureModal === 'lock'
            ? 'Ayı kilitlemeden önce puantaj kayıtlarını incelediğinizi ad-soyad yazarak onaylayın.'
            : 'Ay sonu puantajınızı incelediğinizi ad-soyad yazarak onaylayın.'
        }
        confirmLabel={signatureModal === 'lock' ? 'Ayı Kilitle' : 'Aylık Onay Ver'}
        expectedFullName={expectedFullName}
        loading={monthConfirmLoading}
        onClose={() => !monthConfirmLoading && setSignatureModal(null)}
        onConfirm={submitSignatureAction}
      />
    </div>
  );
}

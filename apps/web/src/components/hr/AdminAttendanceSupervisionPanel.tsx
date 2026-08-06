'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Mail,
  Plane,
  Search,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  DAY_END_SUPERVISION_PREVIEW,
  type DayEndSupervisionPreview,
} from './attendance-day-end.preview';
import { PersonelEklePanel } from './PersonelEklePanel';
import {
  dayEndToRosterPartial,
  HrEmployeeDossierDrawer,
  type DossierTab,
  type RosterEmployee,
} from './HrEmployeeDossierDrawer';
import { HrEmployeeRowActions } from './HrEmployeeRowActions';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableColGroup,
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/contexts/ToastContext';
import { isoToTrDateDisplay } from '@/utils/tr-date-input';

type FilterKey = 'all' | 'ok' | 'missing' | 'leave';
type AttendanceDetailKind = 'lateStart' | 'earlyLeave';

type EmployeeApiRow = {
  id: string;
  userId: string;
  personnelNo?: string | null;
  personalGsm?: string | null;
  companyGsm?: string | null;
  bloodType?: string | null;
  hireDate?: string | null;
  identityNo?: string | null;
  birthDate?: string | null;
  jobTitle?: string | null;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role?: { code: string; name: string } | null;
  };
  department?: { name: string } | null;
  leaveBalance?: {
    remainingDays: number;
    totalDays?: number;
    usedDays?: number;
    pendingDays?: number;
  };
  leaveEntitlement?: { totalDays?: number };
};

type WindowCard = {
  key: FilterKey;
  label: string;
  hint: string;
  value: number;
  icon: LucideIcon;
  tone: 'brand' | 'success' | 'danger' | 'neutral';
};

const TABLE_ACTIONS_COL_WIDTH = 188;

const TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'personel', label: 'Personel', defaultWidth: 160, minWidth: 130 },
  { id: 'gorevi', label: 'Görevi', defaultWidth: 130, minWidth: 110 },
  { id: 'sicil', label: 'Sicil No', defaultWidth: 90, minWidth: 72, defaultVisible: false },
  { id: 'departman', label: 'Departman', defaultWidth: 110, minWidth: 90 },
  { id: 'iseGiris', label: 'İşe Giriş', defaultWidth: 100, minWidth: 88, defaultVisible: false },
  { id: 'hakedilen', label: 'Hakedilen', defaultWidth: 88, minWidth: 72 },
  { id: 'kullanilan', label: 'Kullanılan', defaultWidth: 88, minWidth: 72 },
  { id: 'bekleyenIzin', label: 'Onay Bekleyen', defaultWidth: 110, minWidth: 96 },
  { id: 'izinKalan', label: 'Kalan', defaultWidth: 72, minWidth: 64 },
  { id: 'bugunDevam', label: 'Bugün Devam', defaultWidth: 130, minWidth: 110 },
  { id: 'evrak', label: 'Evrak', defaultWidth: 80, minWidth: 64 },
  { id: 'zimmet', label: 'Zimmet', defaultWidth: 72, minWidth: 64, defaultVisible: false },
  {
    id: 'actions',
    label: 'İşlemler',
    defaultWidth: TABLE_ACTIONS_COL_WIDTH,
    minWidth: TABLE_ACTIONS_COL_WIDTH,
    pin: 'end',
    resizable: false,
  },
];

const ACTIONS_STICKY =
  'sticky right-0 z-[1] border-l border-slate-100 bg-white shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]';

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

const ATT_BADGE: Record<RosterEmployee['attendanceStatus'], string> = {
  missing: 'bg-status-danger/10 text-status-danger',
  ok: 'bg-status-success/10 text-status-success',
  on_leave: 'bg-slate-100 text-slate-600',
};

function rosterSortValue(row: RosterEmployee, key: string): string | number | null | undefined {
  switch (key) {
    case 'personel':
      return row.fullName;
    case 'gorevi':
      return row.roleLabel;
    case 'sicil':
      return row.personnelNo ?? '';
    case 'departman':
      return row.department;
    case 'iseGiris':
      return row.hireDateLabel ?? '';
    case 'hakedilen':
      return row.entitledLeaveDays ?? 0;
    case 'kullanilan':
      return row.usedLeaveDays ?? 0;
    case 'bekleyenIzin':
      return row.pendingLeaveDays ?? 0;
    case 'izinKalan':
      return row.remainingLeaveDays;
    case 'bugunDevam':
      return row.attendanceLabel;
    case 'evrak':
      return row.documentsLabel ?? '';
    case 'zimmet':
      return row.assetsCount ?? -1;
    default:
      return '';
  }
}

function AttendanceDetailOverlay({
  kind,
  roster,
  onClose,
}: {
  kind: AttendanceDetailKind;
  roster: RosterEmployee[];
  onClose: () => void;
}) {
  const title = kind === 'lateStart' ? 'Geç Başlangıç' : 'Erken Çıkış';
  const items = roster.filter((e) => (kind === 'lateStart' ? e.lateStart : e.earlyLeave));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-detail-title"
    >
      <button
        type="button"
        aria-label="Kapat"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h4 id="attendance-detail-title" className="text-sm font-semibold text-content-primary">
            {title}
          </h4>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-slate-100 hover:text-content-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-content-tertiary">
              Kayıt bulunamadı.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((emp) => {
                const minutes =
                  kind === 'lateStart'
                    ? emp.lateStartMinutes ?? 0
                    : emp.earlyLeaveMinutes ?? 0;
                const minuteLabel =
                  kind === 'lateStart' ? `+${minutes} dk` : `−${minutes} dk`;
                return (
                  <li key={emp.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-content-primary">
                        {emp.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-content-tertiary">{emp.department}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-content-primary">
                        {minuteLabel}
                      </p>
                      <p className="mt-0.5 text-[11px] text-content-secondary">
                        {emp.attendanceLabel}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

type Props = {
  preview?: boolean;
  canAddEmployee?: boolean;
  canManageDocuments?: boolean;
  onOpenEmployeeAttendance?: (employee: { id: string; fullName: string }) => void;
  /** Personel adına tıklanınca izin / işlem arşivi */
  onOpenEmployeeArchive?: (employee: { id: string; fullName: string }) => void;
};

/**
 * Kadro Özeti — izleme penceresi + personel listesi + özlük paneli.
 */
export function AdminAttendanceSupervisionPanel({
  preview = false,
  canAddEmployee = true,
  canManageDocuments = true,
  onOpenEmployeeAttendance,
  onOpenEmployeeArchive,
}: Props) {
  const { showToast } = useToast();
  const tableColumns = usePanelTableColumns('table-cols:hr-kadro-ozeti-v5', TABLE_COLUMNS);
  const [realData, setRealData] = useState<DayEndSupervisionPreview | null>(null);
  const [apiEmployees, setApiEmployees] = useState<EmployeeApiRow[]>([]);
  const [loading, setLoading] = useState(!preview);
  const [loadError, setLoadError] = useState(false);
  const [mailSending, setMailSending] = useState(false);
  const [mailNote, setMailNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const [attendanceDetail, setAttendanceDetail] = useState<AttendanceDetailKind | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [dossierTab, setDossierTab] = useState<DossierTab>('summary');
  const [rosterVersion, setRosterVersion] = useState(0);

  const openDossier = (id: string, tab: DossierTab = 'summary') => {
    setDossierTab(tab);
    setDossierId(id);
  };

  const reload = () => setRosterVersion((v) => v + 1);

  useEffect(() => {
    if (preview) return;
    let alive = true;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      apiClient.get<DayEndSupervisionPreview>('hr/attendance/day-end-summary'),
      apiClient.get<EmployeeApiRow[]>('hr/employees'),
    ])
      .then(([dayEnd, emp]) => {
        if (!alive) return;
        setRealData(dayEnd);
        setApiEmployees(Array.isArray(emp) ? emp : []);
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
  }, [preview, rosterVersion]);

  const data = preview ? DAY_END_SUPERVISION_PREVIEW : realData;

  const roster: RosterEmployee[] = useMemo(() => {
    if (!data) return [];
    const dayMap = new Map(data.employees.map((e) => [e.id, e]));

    if (preview) {
      return data.employees.map((e, idx) => {
        const base = dayEndToRosterPartial(e);
        const blood = ['A Rh+', '0 Rh+', 'B Rh-', 'AB Rh+'][idx % 4];
        // 2018 işe giriş → ~8 yıl → 4857: 20 iş günü
        const entitled = 20;
        const used = [2, 5, 0, 8, 1, 3, 6, 4][idx % 8];
        const pending = [5, 0, 2, 0, 0, 1, 0, 0][idx % 8];
        const remaining = entitled - used; // kalan = hakedilen − kullanılan
        return {
          ...base,
          userId: `preview-user-${idx}`,
          email: `preview${idx}@meridyen.local`,
          personnelNo: `PRV-${1000 + idx}`,
          identityNo: `1000000000${idx}`.slice(0, 11),
          birthDateLabel: '15.05.1990',
          personalGsm: `0532 ${100 + idx}${idx} ${20 + idx} ${30 + idx}`,
          companyGsm: `0533 ${200 + idx}${idx} ${40 + idx} ${50 + idx}`,
          bloodType: blood,
          hireDateLabel: '12.03.2018',
          entitledLeaveDays: entitled,
          usedLeaveDays: used,
          pendingLeaveDays: pending,
          remainingLeaveDays: remaining,
          documentsLabel: idx % 3 === 0 ? 'Eksik' : 'Tamam',
          missingDocsCount: idx % 3 === 0 ? 2 + (idx % 2) : 0,
          assetsCount: idx % 2 === 0 ? 2 : 1,
        };
      });
    }

    if (apiEmployees.length > 0) {
      return apiEmployees.map((row) => {
        const day = dayMap.get(row.id);
        const fullName = `${row.user.firstName} ${row.user.lastName}`.trim();
        const roleLabel =
          row.jobTitle || row.user.role?.name || day?.roleLabel || 'Personel';
        if (day) {
          const base = dayEndToRosterPartial(day);
          return {
            ...base,
            userId: row.userId,
            email: row.user.email,
            roleLabel,
            personnelNo: row.personnelNo,
            identityNo: row.identityNo,
            birthDateLabel: row.birthDate
              ? isoToTrDateDisplay(row.birthDate.slice(0, 10))
              : '—',
            personalGsm: row.personalGsm,
            companyGsm: row.companyGsm,
            bloodType: row.bloodType,
            hireDateLabel: row.hireDate
              ? isoToTrDateDisplay(row.hireDate.slice(0, 10))
              : '—',
            remainingLeaveDays:
              row.leaveBalance?.remainingDays ?? base.remainingLeaveDays,
            entitledLeaveDays:
              row.leaveBalance?.totalDays ??
              row.leaveEntitlement?.totalDays ??
              base.remainingLeaveDays,
            usedLeaveDays: row.leaveBalance?.usedDays ?? 0,
            pendingLeaveDays: row.leaveBalance?.pendingDays ?? 0,
            documentsLabel: '—',
            assetsCount: null,
          };
        }
        return {
          id: row.id,
          userId: row.userId,
          email: row.user.email,
          fullName,
          department: row.department?.name ?? '—',
          roleLabel,
          personnelNo: row.personnelNo,
          identityNo: row.identityNo,
          birthDateLabel: row.birthDate
            ? isoToTrDateDisplay(row.birthDate.slice(0, 10))
            : '—',
          personalGsm: row.personalGsm,
          companyGsm: row.companyGsm,
          bloodType: row.bloodType,
          hireDateLabel: row.hireDate
            ? isoToTrDateDisplay(row.hireDate.slice(0, 10))
            : '—',
          remainingLeaveDays: row.leaveBalance?.remainingDays ?? 0,
          entitledLeaveDays:
            row.leaveBalance?.totalDays ?? row.leaveEntitlement?.totalDays ?? 14,
          usedLeaveDays: row.leaveBalance?.usedDays ?? 0,
          pendingLeaveDays: row.leaveBalance?.pendingDays ?? 0,
          attendanceStatus: 'ok' as const,
          attendanceLabel: '—',
          documentsLabel: '—',
          assetsCount: null,
        };
      });
    }

    return data.employees.map((e) => ({
      ...dayEndToRosterPartial(e),
      hireDateLabel: '—',
      documentsLabel: '—',
      assetsCount: null,
    }));
  }, [apiEmployees, data, preview]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return roster.filter((e) => {
      if (filter === 'missing' && e.attendanceStatus !== 'missing') return false;
      if (filter === 'ok' && e.attendanceStatus !== 'ok') return false;
      if (filter === 'leave' && e.attendanceStatus !== 'on_leave') return false;
      if (!q) return true;
      const hay = `${e.fullName} ${e.personnelNo ?? ''} ${e.department} ${e.roleLabel}`.toLocaleLowerCase(
        'tr-TR',
      );
      return hay.includes(q);
    });
  }, [filter, roster, search]);

  const sortedFiltered = useMemo(
    () => sortRowsByClientSort(filtered, clientSort, rosterSortValue),
    [filtered, clientSort],
  );

  const selected = roster.find((e) => e.id === dossierId) ?? null;

  const leaveProxyHint = useMemo(() => {
    const onLeave = roster.filter((e) => e.attendanceStatus === 'on_leave');
    if (onLeave.length === 0) return 'Vekil yok';
    if (onLeave.length === 1) return `Vekil: ${onLeave[0].proxyName ?? '—'}`;
    return `${onLeave.length} kişi · vekiller listede`;
  }, [roster]);

  if (!preview && loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-8 text-center">
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (!preview && (loadError || !data)) {
    // API yoksa / hata: sıfır kadro — kırmızı hata yerine enterprise boş durum
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Toplam Personel', value: 0 },
            { label: 'İzinli', value: 0 },
            { label: 'Devamı Onaylayan', value: 0 },
            { label: 'Devamı Onaylamayan', value: 0 },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"
            >
              <p className="text-2xl font-bold tabular-nums text-content-primary">{card.value}</p>
              <p className="mt-1 text-xs font-medium text-content-tertiary">{card.label}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-content-tertiary">
          Kadro listesinde personel yok.
        </div>
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
      label: 'Devamı Onaylayan',
      hint: 'Gün sonunda oluşur',
      value: data.totals.approved,
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      key: 'missing',
      label: 'Devamı Onaylamayan',
      hint: 'Bildirim + mail',
      value: data.totals.notApproved,
      icon: AlertTriangle,
      tone: 'danger',
    },
  ];

  const handleMailMissing = async () => {
    if (preview) {
      setMailNote(
        `${data.totals.notApproved} personele hatırlatma maili hazırlandı (önizleme).`,
      );
      return;
    }
    setMailSending(true);
    try {
      const result = await apiClient.post<{
        success: boolean;
        message: string;
        sentCount: number;
      }>('hr/attendance/notify-missing', {});
      setMailNote(result.message);
      if (result.success) showToast('success', result.message);
      else showToast('error', result.message);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Mail Gönderilemedi');
    } finally {
      setMailSending(false);
    }
  };

  const openAdd = () => {
    setEditUserId(null);
    setAddOpen(true);
  };

  const openEdit = (userId?: string) => {
    setEditUserId(userId ?? null);
    setAddOpen(true);
  };

  const renderRosterCell = (colId: string, row: RosterEmployee) => {
    switch (colId) {
      case 'personel':
        return (
          <PanelTableTd colId="personel" className="px-4 py-3">
            <button
              type="button"
              className="truncate text-left font-medium text-brand-700 hover:underline"
              title="İzin Ve İşlem Arşivi"
              onClick={() => {
                if (onOpenEmployeeArchive) {
                  onOpenEmployeeArchive({ id: row.id, fullName: row.fullName });
                  return;
                }
                openDossier(row.id, 'leave');
              }}
            >
              {row.fullName}
            </button>
          </PanelTableTd>
        );
      case 'gorevi':
        return (
          <PanelTableTd colId="gorevi" className="px-4 py-3 text-content-secondary">
            <span className="truncate">{row.roleLabel}</span>
          </PanelTableTd>
        );
      case 'sicil':
        return (
          <PanelTableTd colId="sicil" className="px-4 py-3 text-content-secondary">
            <span className="truncate">{row.personnelNo || '—'}</span>
          </PanelTableTd>
        );
      case 'departman':
        return (
          <PanelTableTd colId="departman" className="px-4 py-3 text-content-secondary">
            <span className="truncate">{row.department}</span>
          </PanelTableTd>
        );
      case 'iseGiris':
        return (
          <PanelTableTd colId="iseGiris" className="px-4 py-3 text-content-secondary">
            <span className="truncate">{row.hireDateLabel || '—'}</span>
          </PanelTableTd>
        );
      case 'hakedilen':
        return (
          <PanelTableTd colId="hakedilen" align="right" className="px-4 py-3 tabular-nums text-content-primary">
            {row.entitledLeaveDays ?? '—'}
          </PanelTableTd>
        );
      case 'kullanilan':
        return (
          <PanelTableTd colId="kullanilan" align="right" className="px-4 py-3 tabular-nums text-content-secondary">
            {row.usedLeaveDays ?? '—'}
          </PanelTableTd>
        );
      case 'bekleyenIzin':
        return (
          <PanelTableTd colId="bekleyenIzin" align="right" className="px-4 py-3 tabular-nums text-status-warning">
            {row.pendingLeaveDays ?? 0}
          </PanelTableTd>
        );
      case 'izinKalan':
        return (
          <PanelTableTd colId="izinKalan" align="right" className="px-4 py-3 tabular-nums font-semibold text-content-primary">
            {row.remainingLeaveDays}
          </PanelTableTd>
        );
      case 'bugunDevam':
        return (
          <PanelTableTd colId="bugunDevam" className="px-4 py-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${ATT_BADGE[row.attendanceStatus]}`}
            >
              {row.attendanceLabel}
            </span>
            {(row.lateStart || row.earlyLeave) && (
              <span className="ml-1 text-[10px] text-content-tertiary">
                {row.lateStart ? `Geç +${row.lateStartMinutes ?? 0}` : ''}
                {row.lateStart && row.earlyLeave ? ' · ' : ''}
                {row.earlyLeave ? `Erken −${row.earlyLeaveMinutes ?? 0}` : ''}
              </span>
            )}
          </PanelTableTd>
        );
      case 'evrak':
        return (
          <PanelTableTd colId="evrak" className="px-4 py-3 text-content-secondary">
            <span className="truncate">{row.documentsLabel ?? '—'}</span>
          </PanelTableTd>
        );
      case 'zimmet':
        return (
          <PanelTableTd colId="zimmet" align="right" className="px-4 py-3 tabular-nums text-content-secondary">
            {row.assetsCount == null ? '—' : row.assetsCount}
          </PanelTableTd>
        );
      case 'actions':
        return (
          <td
            key={`${row.id}-actions`}
            className={`box-border px-3 py-3 align-middle ${ACTIONS_STICKY} ${
              dossierId === row.id ? 'bg-brand-50/50' : ''
            }`}
            style={{
              width: TABLE_ACTIONS_COL_WIDTH,
              minWidth: TABLE_ACTIONS_COL_WIDTH,
            }}
          >
            <HrEmployeeRowActions
              fullName={row.fullName}
              email={row.email}
              personalGsm={row.personalGsm}
              companyGsm={row.companyGsm}
              canEdit={canAddEmployee}
              canOpenAttendance={Boolean(onOpenEmployeeAttendance)}
              onOpenDossier={() => openDossier(row.id, 'summary')}
              onOpenDocuments={() => openDossier(row.id, 'documents')}
              onEdit={
                canAddEmployee && row.userId
                  ? () => openEdit(row.userId!)
                  : undefined
              }
              onOpenAttendance={
                onOpenEmployeeAttendance
                  ? () =>
                      onOpenEmployeeAttendance({
                        id: row.id,
                        fullName: row.fullName,
                      })
                  : undefined
              }
            />
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      {/* İzleme penceresi — Yönetici İzleme kuyruğundan ayrı, kadro durumu */}
      <section
        aria-label="Kadro Özeti İzleme Penceresi"
        className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100/90 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-content-primary">Kadro Özeti</h3>
              {preview ? (
                <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-content-tertiary">
                  Tasarım Önizleme
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-content-secondary">
              {data.workDateLabel} · Mesai Bitiş / Kesim {data.cutoffLabel}
            </p>
            {data.workHours?.labels.summary ? (
              <p className="mt-0.5 text-xs text-content-tertiary">
                {data.workHours.labels.summary}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setAttendanceDetail('lateStart')}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-semibold text-status-warning transition-colors hover:border-amber-300 hover:bg-amber-100"
            >
              <Clock3 className="h-3.5 w-3.5" />
              Geç Başlangıç: {data.totals.lateStart ?? 0}
            </button>
            <button
              type="button"
              onClick={() => setAttendanceDetail('earlyLeave')}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 font-semibold text-status-danger transition-colors hover:border-red-300 hover:bg-red-100"
            >
              Erken Çıkış: {data.totals.earlyLeave ?? 0}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-4 md:grid-cols-4 sm:p-5">
          {windows.map((card) => {
            const Icon = card.icon;
            const tone = TONE_CLASS[card.tone];
            const active = filter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setFilter(card.key)}
                className={`rounded-xl border bg-white p-4 text-left transition-colors ${tone.wrap} ${
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
                <p className="mt-3 text-sm font-semibold text-content-primary">{card.label}</p>
                <p className="mt-0.5 text-xs text-content-tertiary">{card.hint}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, sicil veya departman ara"
            className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(filter === 'missing' || filter === 'all') && data.totals.notApproved > 0 ? (
            <button
              type="button"
              disabled={mailSending}
              onClick={() => void handleMailMissing()}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-content-primary hover:bg-slate-50 disabled:opacity-50"
            >
              <Mail className="h-4 w-4 text-brand-600" />
              {mailSending ? 'Gönderiliyor...' : 'Onaylamayanlara Mail'}
            </button>
          ) : null}
          {canAddEmployee ? (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <UserPlus className="h-4 w-4" />
              Personel Ekle
            </button>
          ) : null}
        </div>
      </div>

      {mailNote ? (
        <p className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
          {mailNote}
        </p>
      ) : null}

      <TableColumnsProvider value={tableColumns}>
        <div className="table-container">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-slate-50/80 px-4 py-3">
            <p className="text-sm font-semibold text-content-primary">Personel Listesi</p>
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
          {sortedFiltered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-content-tertiary">
              {roster.length === 0
                ? 'Henüz özlük kartı yok. Personel Ekle ile başlayın.'
                : 'Bu görünümde personel yok.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
                <PanelTableColGroup />
                <thead className="table-head-row">
                  <tr>
                    {tableColumns.prefs.orderedVisibleColumns.map((col) =>
                      col.id === 'actions' ? (
                        <th
                          key={col.id}
                          className={`box-border px-4 py-3.5 text-center text-xs font-semibold tracking-wide text-slate-500 ${ACTIONS_STICKY} bg-slate-50`}
                          style={{
                            width: TABLE_ACTIONS_COL_WIDTH,
                            minWidth: TABLE_ACTIONS_COL_WIDTH,
                          }}
                        >
                          İşlemler
                        </th>
                      ) : (
                        <SortablePanelTableTh
                          key={col.id}
                          colId={col.id}
                          sortKey={col.id}
                          activeSortKey={clientSort?.key ?? null}
                          sortDir={clientSort?.dir ?? 'asc'}
                          onSort={(key) => setClientSort((prev) => cycleClientSort(prev, key))}
                          className="table-th-center"
                        >
                          {col.label}
                        </SortablePanelTableTh>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="table-body">
                  {sortedFiltered.map((row) => (
                    <tr
                      key={row.id}
                      className={`table-row ${
                        dossierId === row.id ? 'bg-brand-50/50' : ''
                      }`}
                    >
                      {tableColumns.prefs.orderedVisibleColumns.map((col) => (
                        <Fragment key={col.id}>{renderRosterCell(col.id, row)}</Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TableColumnsProvider>

      {attendanceDetail ? (
        <AttendanceDetailOverlay
          kind={attendanceDetail}
          roster={roster}
          onClose={() => setAttendanceDetail(null)}
        />
      ) : null}

      <PersonelEklePanel
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditUserId(null);
        }}
        preview={preview}
        initialUserId={editUserId}
        onSaved={(saved) => {
          reload();
          if (!saved.keepOpen) {
            openDossier(saved.profileId, 'summary');
          }
          showToast('success', `${saved.fullName} özlük kartı kaydedildi`);
        }}
      />

      <HrEmployeeDossierDrawer
        open={Boolean(dossierId && selected)}
        employee={selected}
        preview={preview}
        canManageDocuments={canManageDocuments}
        initialTab={dossierTab}
        onClose={() => setDossierId(null)}
        onOpenFullAttendance={(emp) => {
          setDossierId(null);
          onOpenEmployeeAttendance?.({ id: emp.id, fullName: emp.fullName });
        }}
      />
    </div>
  );
}

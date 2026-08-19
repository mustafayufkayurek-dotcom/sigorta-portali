'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidePanel } from '@/components/SlidePanel';
import { ClaimNewForm } from '@/components/claim-files/ClaimNewForm';
import { ExpertFileNoteModal } from '@/components/eksper-portal/ExpertFileModals';
import { useApiQuery } from '@/hooks/useApi';
import { SearchInput } from '@/components/ui/SearchInput';
import { TrDateInput } from '@/components/ui/TrDateInput';
import {
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableTh,
  SortablePanelTableTh,
  TableColumnsProvider,
  usePanelTableColumns,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';
import { claimListFileNo, claimListInsuranceCompanyName } from '@/utils/claim-list-column-fields';
import { resolveClaimSupplierDisplayName } from '@/utils/claim-supplier-display';
import { InsuredNameInlineEdit } from '@/components/claim-files/InsuredNameInlineEdit';
import { OperationRowActions } from '@/components/operasyon/OperationRowActions';
import { OperationSendEmailModal, type OperationSendEmailTarget } from '@/components/operasyon/OperationSendEmailModal';
import { OpsStripKpi } from '@/components/operasyon/OpsStripKpi';
import {
  CalendarPlus,
  ClipboardCheck,
  FileEdit,
  FolderOpen,
  Hourglass,
} from 'lucide-react';
import { fmtDate } from '@/utils/date-helpers';
import { formatTryAmount } from '@/utils/format-try-amount';
import { resolveClaimDosyaKonusu } from '@/utils/text-helpers';
import { portalStatusLabel } from '@/utils/portal-file-flow-labels';
import { resolveOperationStatusLabel } from '@sigorta/shared';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import {
  appendClaimListStatusParams,
  claimListStatusFilterFromUrl,
} from '@/utils/claim-list-url-status';
import {
  fieldStaffAddress,
  fieldStaffInspectionBadgeClass,
  fieldStaffInspectionStatus,
  fieldStaffInsuredName,
  fieldStaffPhone,
} from '@/utils/field-staff-claim-view';
import { FieldInsuredContactActions } from '@/components/field-survey/FieldInsuredContactActions';


const fmtAmount = (n: number | undefined | null) => formatTryAmount(n, { fractionDigits: 0 });

type InsuranceCompany = { id: string; name: string };
type ClaimStatus = { id: string; code: string; name: string };

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Düşük',
  normal: 'Normal',
  medium: 'Orta',
  high: 'Yüksek',
  critical: 'Kritik',
};
const PRIORITY_CLASSES: Record<string, string> = {
  low: 'badge badge-gray',
  normal: 'badge badge-blue',
  medium: 'badge badge-blue',
  high: 'badge badge-orange',
  critical: 'badge badge-red',
};

function formatPriorityLabel(priority?: string | null): string {
  if (!priority) return '';
  const key = String(priority).trim().toLowerCase();
  return PRIORITY_LABELS[key] ?? priority;
}

function priorityBadgeClass(priority?: string | null): string {
  if (!priority) return 'badge badge-gray';
  const key = String(priority).trim().toLowerCase();
  return PRIORITY_CLASSES[key] ?? 'badge badge-gray';
}

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'cancelled' | 'overdue' | 'none';

function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.data)) return record.data as T[];
    if (record.data && typeof record.data === 'object') {
      const data = record.data as Record<string, unknown>;
      if (Array.isArray(data.items)) return data.items as T[];
    }
  }
  return [];
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak', sent: 'Gönderildi', paid: 'Ödendi',
  partial: 'Kısmi Ödendi', cancelled: 'İptal', overdue: 'Gecikmiş', none: 'Fatura Yok',
};
const INVOICE_STATUS_CLASSES: Record<string, string> = {
  draft: 'badge badge-gray', sent: 'badge badge-blue', paid: 'badge badge-green',
  partial: 'badge badge-amber', cancelled: 'badge badge-red', overdue: 'badge badge-red', none: 'badge badge-gray',
};

const STATUS_CODE_BADGE: Record<string, string> = {
  SUPPLIER_ASSIGNED:       'bg-purple-100 text-purple-700',
  APPOINTMENT_SCHEDULED:   'bg-blue-100 text-blue-700',
  INSPECTION_DONE:         'bg-amber-100 text-amber-700',
  COST_REPORT_SUBMITTED:   'bg-green-100 text-green-700',
};

function ClaimStatusBadge({ status, reportStatus, approval72hExceeded, operationStatusLabel }: {
  status?: { code?: string; name?: string; color?: string } | null;
  reportStatus?: string | null;
  approval72hExceeded?: boolean;
  operationStatusLabel?: string | null;
}) {
  if (!status) return <span className="badge badge-gray">N/A</span>;
  const code = status.code ?? '';
  const label = operationStatusLabel
    || resolveOperationStatusLabel({
      claimStatusCode: code,
      reportStatus,
      approval72hExceeded,
    })
    || portalStatusLabel(code, status.name);
  const cls = STATUS_CODE_BADGE[code];
  if (cls) {
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
  }
  const style = status.color ? { backgroundColor: `${status.color}22`, color: status.color } : undefined;
  return (
    <span className={style ? 'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium' : 'badge badge-blue'} style={style}>
      {label || 'N/A'}
    </span>
  );
}

function deriveInvoiceStatus(invoices: { status: string; invoiceType: string }[]): InvoiceStatus {
  if (!invoices || invoices.length === 0) return 'none';
  const salesInvoices = invoices.filter((inv) => inv.invoiceType === 'sales');
  if (salesInvoices.length === 0) return 'none';
  if (salesInvoices.some((i) => i.status === 'overdue')) return 'overdue';
  if (salesInvoices.some((i) => i.status === 'paid')) return 'paid';
  if (salesInvoices.some((i) => i.status === 'partial')) return 'partial';
  if (salesInvoices.some((i) => i.status === 'sent')) return 'sent';
  return 'draft';
}

function getUserScope() {
  if (typeof window === 'undefined') return { officeStaffUserId: null, isFieldStaff: false };
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
    const rc = (u?.role?.code ?? u?.roleCode ?? '').toLowerCase();
    return {
      officeStaffUserId: rc === 'office_staff' ? u?.id ?? null : null,
      isFieldStaff: rc === 'field_staff',
    };
  } catch { return { officeStaffUserId: null, isFieldStaff: false }; }
}

const TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 120, minWidth: 88 },
  { id: 'customer', label: 'Müşteri', defaultWidth: 160, minWidth: 100 },
  { id: 'insured', label: 'Sigortalı', defaultWidth: 140, minWidth: 100 },
  { id: 'date', label: 'Tarih', defaultWidth: 100, minWidth: 88 },
  { id: 'subject', label: 'Dosya Konusu', defaultWidth: 140, minWidth: 100 },
  { id: 'status', label: 'Dosya Durumu', defaultWidth: 130, minWidth: 100 },
  { id: 'supplier', label: 'Tedarikçi', defaultWidth: 120, minWidth: 96 },
  { id: 'invoice', label: 'Fatura', defaultWidth: 110, minWidth: 88 },
  { id: 'amount', label: 'Tutar', defaultWidth: 100, minWidth: 88 },
  { id: 'reportSales', label: 'Beklenen Ciro', defaultWidth: 110, minWidth: 88 },
  { id: 'reportCost', label: 'Tedarikçi Maliyet Toplamı', defaultWidth: 140, minWidth: 110 },
  { id: 'reportProfit', label: 'Beklenen Kar', defaultWidth: 110, minWidth: 88 },
  { id: 'priority', label: 'Öncelik', defaultWidth: 100, minWidth: 80 },
  { id: 'revision', label: 'Revizyon', defaultWidth: 120, minWidth: 96 },
  { id: 'actions', label: 'İşlemler', defaultWidth: 188, minWidth: 160, pin: 'end', resizable: false },
];

export default function ClaimFilesPage() {
  return (
    <Suspense fallback={(
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )}
    >
      <ClaimFilesPageContent />
    </Suspense>
  );
}

function ClaimFilesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStatusCode = searchParams.get('status');
  const urlSearch = searchParams.get('search') ?? '';
  const urlInvoiceStatus = searchParams.get('invoiceStatus') ?? '';
  const urlPriority = searchParams.get('priority') ?? '';
  const urlRepairReportStatus = searchParams.get('repairReportStatus') ?? '';

  // Filters state
  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState(urlInvoiceStatus);
  const [priorityFilter, setPriorityFilter] = useState(urlPriority);
  const [insuranceFilter, setInsuranceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pendingRevisionFilter, setPendingRevisionFilter] = useState(false);
  const [pendingReportFilter, setPendingReportFilter] = useState(
    urlRepairReportStatus === 'pending_approval',
  );
  const [repairReportStatusFilter, setRepairReportStatusFilter] = useState(urlRepairReportStatus);
  const [showNewPanel, setShowNewPanel] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const [noteFileId, setNoteFileId] = useState<string | null>(null);
  const [noteFileNo, setNoteFileNo] = useState<string | undefined>(undefined);
  const [noteInsuredName, setNoteInsuredName] = useState<string | undefined>(undefined);
  const [emailTarget, setEmailTarget] = useState<OperationSendEmailTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const limit = 20;
  /** v5: Hasar listesi sütun tercihleri — Operasyon/Acil ile paylaşılmaz */
  const tableColumns = usePanelTableColumns('table-cols:hasar-dosyalari-v5', TABLE_COLUMNS);

  const { officeStaffUserId, isFieldStaff } = useMemo(() => getUserScope(), []);

  // --- TanStack Query: Insurance Companies ---
  const { data: insuranceCompaniesResponse } = useApiQuery<unknown>(
    ['insurance-companies'],
    '/insurance-companies?limit=200',
  );
  const insuranceCompanies = useMemo(() => asList<InsuranceCompany>(insuranceCompaniesResponse), [insuranceCompaniesResponse]);

  // --- TanStack Query: Claim Statuses ---
  const { data: claimStatusesResponse } = useApiQuery<unknown>(
    ['claim-statuses'],
    '/claim-files/statuses',
  );
  const claimStatuses = useMemo(() => asList<ClaimStatus>(claimStatusesResponse), [claimStatusesResponse]);

  const { data: dosyaKonusuResponse } = useApiQuery<unknown>(
    ['dosya-konusu-catalog'],
    '/system-settings/ihbar-konulari',
  );
  const dosyaKonusuCatalog = useMemo(() => {
    const payload = (dosyaKonusuResponse as { data?: { hasar?: string[]; acil?: string[] } } | null)?.data
      ?? (dosyaKonusuResponse as { hasar?: string[]; acil?: string[] } | null);
    return [...(payload?.hasar ?? []), ...(payload?.acil ?? [])]
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
  }, [dosyaKonusuResponse]);

  // URL status code → liste filtresi (open/closed tek duruma fuzzy bağlanmaz)
  useEffect(() => {
    if (!urlStatusCode || statusFilter) return;
    const next = claimListStatusFilterFromUrl(urlStatusCode, claimStatuses);
    if (next) setStatusFilter(next);
  }, [urlStatusCode, claimStatuses, statusFilter]);

  useEffect(() => {
    if (searchParams.get('yeni') !== '1') return;
    setFormSession((s) => s + 1);
    setShowNewPanel(true);
    router.replace('/panel/hasar-dosyalari', { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // --- TanStack Query: Claim Files (main list) ---
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ limit: String(limit), page: String(page) });
    if (search.trim()) params.set('search', search.trim());
    appendClaimListStatusParams(params, statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (insuranceFilter) params.set('insuranceCompanyId', insuranceFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (invoiceStatusFilter) params.set('invoiceStatus', invoiceStatusFilter);
    if (officeStaffUserId) params.set('assignedOfficeUserId', officeStaffUserId);
    if (repairReportStatusFilter) params.set('repairReportStatus', repairReportStatusFilter);
    else if (pendingReportFilter) params.set('repairReportStatus', 'pending_approval');
    return params.toString();
  }, [search, statusFilter, priorityFilter, insuranceFilter, dateFrom, dateTo, page, invoiceStatusFilter, officeStaffUserId, pendingReportFilter, repairReportStatusFilter]);

  const {
    data: claimsResponse,
    isLoading: loading,
    isError,
    refetch,
  } = useApiQuery<{ data?: unknown; meta?: { total?: number } }>(
    ['claim-files', queryParams],
    `/claim-files?${queryParams}`,
  );

  const claims = useMemo(() => asList<any>(claimsResponse), [claimsResponse]);
  const total = useMemo(() => {
    const meta = (claimsResponse as { meta?: { total?: number } } | undefined)?.meta;
    return meta?.total ?? claims.length;
  }, [claimsResponse, claims.length]);

  const pendingReportCount = useMemo(
    () => claims.filter((c) => c.latestRepairReport?.status === 'pending_approval').length,
    [claims],
  );

  const { data: opsStats } = useApiQuery<{
    openClaims?: number;
    openedTodayClaims?: number;
    approvalPending?: number;
    reportWriting?: number;
    reportApproval?: number;
  }>(
    ['claim-files-operation-stats'],
    '/claim-files/operation-stats',
    { enabled: !isFieldStaff },
  );

  // --- TanStack Query: Pending Revisions ---
  const { data: revisionsResponse } = useApiQuery<unknown>(
    ['revision-requests-pending'],
    '/revision-requests?status=REQUESTED&limit=200',
  );
  const revisionsData = useMemo(() => asList<{ claimFileId?: string }>(revisionsResponse), [revisionsResponse]);
  const pendingRevisionMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const rev of revisionsData) {
      if (rev.claimFileId) map[rev.claimFileId] = (map[rev.claimFileId] ?? 0) + 1;
    }
    return map;
  }, [revisionsData]);

  // Derived
  const hasFilters = !!(search || statusFilter || priorityFilter || insuranceFilter || dateFrom || dateTo || invoiceStatusFilter || pendingRevisionFilter || pendingReportFilter || repairReportStatusFilter);
  const filteredClaims = useMemo(() => {
    let rows = pendingRevisionFilter
      ? claims.filter((c: any) => (pendingRevisionMap[c.id] ?? 0) > 0)
      : claims;
    if (isFieldStaff) {
      rows = rows.filter((c: any) => !fieldStaffInspectionStatus(c).done);
    }
    return rows;
  }, [claims, pendingRevisionFilter, pendingRevisionMap, isFieldStaff]);
  const visibleClaims = useMemo(
    () =>
      sortRowsByClientSort(filteredClaims, clientSort, (claim: any, key) => {
        switch (key) {
          case 'fileNo':
            return claimListFileNo(claim) === '—' ? '' : claimListFileNo(claim);
          case 'customer':
            return claim.insuranceCompany?.name ?? '';
          case 'insured':
            return resolveHasarInsuredName(claim);
          case 'date':
            return claim.createdAt ?? '';
          case 'subject':
            return resolveClaimDosyaKonusu(claim, dosyaKonusuCatalog);
          case 'status':
            return claim.currentStatus?.name ?? claim.currentStatus?.code ?? '';
          case 'supplier':
            return resolveClaimSupplierDisplayName(claim) ?? '';
          case 'invoice':
            return deriveInvoiceStatus(claim.invoices ?? []);
          case 'amount':
            return claim.invoicedAmount ?? claim.actualCostAmount ?? -1;
          case 'reportSales':
            return claim.latestRepairReport?.totalSalesAmount ?? -1;
          case 'reportCost':
            return claim.latestRepairReport?.totalSupplierCost ?? -1;
          case 'reportProfit':
            return claim.latestRepairReport?.grossProfit ?? -1;
          case 'priority':
            return claim.priority ?? '';
          case 'revision':
            return pendingRevisionMap[claim.id] ?? 0;
          default:
            return '';
        }
      }),
    [filteredClaims, clientSort, dosyaKonusuCatalog, pendingRevisionMap],
  );

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setPriorityFilter('');
    setInsuranceFilter(''); setDateFrom(''); setDateTo('');
    setInvoiceStatusFilter(''); setPage(1);
    setPendingRevisionFilter(false);
    setPendingReportFilter(false);
    setRepairReportStatusFilter('');
    // URL ?status=open yeniden filtreyi basmasın
    if (urlStatusCode) {
      router.replace('/panel/hasar-dosyalari', { scroll: false });
    }
  };

  function openNewPanel() {
    setFormSession((s) => s + 1);
    setShowNewPanel(true);
  }

  function handleCreateSuccess(claimId: string) {
    setShowNewPanel(false);
    router.push(`/panel/hasar-dosyalari/${claimId}?grup=operasyon`);
  }

  return (
    <TableColumnsProvider value={tableColumns}>
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <a href="/panel" className="hover:text-brand-600 transition-colors">
          {isFieldStaff ? 'Saha Merkezi' : 'Dashboard'}
        </a>
        <span>/</span>
        <span className="text-slate-600 font-medium">{isFieldStaff ? 'Atanan Dosyalar' : 'Hasar Dosyaları'}</span>
      </nav>

      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/panel')}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="page-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="page-title">{isFieldStaff ? 'Atanan Dosyalar' : 'Hasar Dosyaları'}</h2>
            {!loading && (
              <p className="page-subtitle">
                {isFieldStaff
                  ? `${visibleClaims.length} atanan iş. Tespiti bitenler Tamamlanan Tespitler sayfasına gider.`
                  : `${total} dosya bulundu`}
                {!isFieldStaff && urlStatusCode === 'open' && <span className="ml-2 text-orange-500 font-semibold">· Açık Dosyalar</span>}
                {!isFieldStaff && urlStatusCode === 'closed' && <span className="ml-2 text-status-success font-semibold">· Kapalı Dosyalar</span>}
                {urlStatusCode === 'sla_exceeded' && <span className="ml-2 text-status-danger font-semibold">· SLA Aşanlar</span>}
                {search && <span className="ml-2 text-blue-500 font-semibold">· Arama: {search}</span>}
                {invoiceStatusFilter === 'overdue' && <span className="ml-2 text-status-danger font-semibold">· Gecikmiş fatura</span>}
                {invoiceStatusFilter === 'pending' && <span className="ml-2 text-status-warning font-semibold">· Bekleyen tahsilat</span>}
              </p>
            )}
          </div>
        </div>
        <div className="page-header-actions">
          {!isFieldStaff && Object.keys(pendingRevisionMap).length > 0 && (
            <button
              type="button"
              onClick={() => setPendingRevisionFilter((v) => !v)}
              className={`flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors ${pendingRevisionFilter ? 'bg-amber-50 border-amber-300 text-amber-700 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
              Revizyon Bekleyenler
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                {Object.keys(pendingRevisionMap).length}
              </span>
            </button>
          )}
          {!isFieldStaff && (
            <button
              type="button"
              onClick={() => { setPendingReportFilter((v) => !v); setPage(1); }}
              className={`flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors ${pendingReportFilter ? 'bg-orange-50 border-orange-300 text-orange-800 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
              Rapor Onay Bekleyen
              {pendingReportFilter && pendingReportCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold">
                  {pendingReportCount}
                </span>
              )}
            </button>
          )}
          {!isFieldStaff && (
            <button type="button" onClick={openNewPanel} className="btn-primary justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Yeni Dosya
            </button>
          )}
        </div>
      </div>

      {!isFieldStaff && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" data-testid="hasar-kpi-band">
          <OpsStripKpi
            label="Açık Dosya"
            value={opsStats?.openClaims ?? '—'}
            color="bg-brand-600"
            icon={FolderOpen}
          />
          <OpsStripKpi
            label="Onay Bekleyen"
            value={opsStats?.approvalPending ?? '—'}
            color="bg-status-warning"
            icon={Hourglass}
          />
          <OpsStripKpi
            label="Rapor Yazılıyor"
            value={opsStats?.reportWriting ?? '—'}
            color="bg-orange-500"
            icon={FileEdit}
          />
          <OpsStripKpi
            label="Rapor Onayı"
            value={opsStats?.reportApproval ?? '—'}
            color="bg-amber-600"
            icon={ClipboardCheck}
          />
          <OpsStripKpi
            label="Bugün Açılan"
            value={opsStats?.openedTodayClaims ?? '—'}
            color="bg-emerald-600"
            icon={CalendarPlus}
          />
        </div>
      )}

      <SlidePanel
        open={showNewPanel}
        onClose={() => setShowNewPanel(false)}
        title="Yeni Hasar Dosyası"
        width={600}
        scrollContent={false}
      >
        <ClaimNewForm
          key={formSession}
          variant="panel"
          onCancel={() => setShowNewPanel(false)}
          onSuccess={handleCreateSuccess}
        />
      </SlidePanel>

      {/* Filter Bar — saha: yalnız arama + açık/kapalı */}
      <div className="filter-bar">
        <div className="panel-filter-bar">
          <div className={isFieldStaff ? 'relative w-full min-w-0 basis-full' : 'panel-filter-search-wrap'}>
            <SearchInput
              placeholder={isFieldStaff ? 'Dosya No, Sigortalı Ara...' : 'Dosya No, Sigortalı...'}
              value={search}
              onChange={(val) => { setSearch(val); setPage(1); }}
              onClear={() => { setSearch(''); setPage(1); }}
            />
          </div>
          {!isFieldStaff && (
            <select className="panel-filter-control" value={insuranceFilter} onChange={(e) => { setInsuranceFilter(e.target.value); setPage(1); }}>
              <option value="">Tüm Sigorta Şirketleri</option>
              {insuranceCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select className="panel-filter-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Tüm Durumlar</option>
            <option value="__open__">Açık Dosyalar</option>
            <option value="__closed__">Kapalı Dosyalar</option>
            {!isFieldStaff && <option value="__sla_exceeded__">SLA Aşanlar</option>}
            {!isFieldStaff && claimStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {!isFieldStaff && (
            <>
              <select className="panel-filter-control" value={invoiceStatusFilter} onChange={(e) => { setInvoiceStatusFilter(e.target.value); setPage(1); }}>
                <option value="">Tüm Faturalar</option>
                <option value="none">Fatura Yok</option>
                <option value="draft">Taslak</option>
                <option value="sent">Gönderildi</option>
                <option value="paid">Ödendi</option>
                <option value="partial">Kısmi Ödendi</option>
                <option value="overdue">Gecikmiş</option>
                <option value="cancelled">İptal</option>
              </select>
              <select className="panel-filter-control" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
                <option value="">Tüm Öncelikler</option>
                <option value="low">Düşük</option>
                <option value="normal">Normal</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="critical">Kritik</option>
              </select>
              <div className="relative flex-[1_1_calc(50%-0.25rem)] sm:flex-[0_0_8.75rem] min-w-[7.25rem]">
                <TrDateInput className="input-base-sm w-full" value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} placeholder="Başlangıç" />
              </div>
              <div className="relative flex-[1_1_calc(50%-0.25rem)] sm:flex-[0_0_8.75rem] min-w-[7.25rem]">
                <TrDateInput className="input-base-sm w-full" value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} placeholder="Bitiş" />
              </div>
            </>
          )}
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="text-xs text-slate-500 hover:text-red-600 border border-slate-200 px-3 py-2 rounded-xl hover:border-red-200 transition-colors whitespace-nowrap">
              Temizle ×
            </button>
          )}
          {!isFieldStaff && (
            <div className="w-full flex-shrink-0 sm:ml-auto sm:w-auto">
              <div className="hidden lg:block">
                <PanelTableColumnPicker tableColumns={tableColumns} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-status-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-700">Dosyalar yüklenirken hata oluştu.</span>
          </div>
          <button onClick={() => refetch()} className="text-sm text-red-600 font-medium hover:underline">
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
              <thead className="table-head-row">
                <tr>
                  <PanelTableTh colId="fileNo" className="table-th-center">Dosya No</PanelTableTh>
                  <PanelTableTh colId="customer" className="table-th-center">Müşteri</PanelTableTh>
                  <PanelTableTh colId="insured" className="table-th-center">Sigortalı</PanelTableTh>
                  <PanelTableTh colId="date" className="table-th-center">Tarih</PanelTableTh>
                  <PanelTableTh colId="subject" className="table-th-center">Dosya Konusu</PanelTableTh>
                  <PanelTableTh colId="status" className="table-th-center">Dosya Durumu</PanelTableTh>
                  <PanelTableTh colId="supplier" className="table-th-center">Tedarikçi</PanelTableTh>
                  <PanelTableTh colId="invoice" className="table-th-center">Fatura</PanelTableTh>
                  <PanelTableTh colId="amount" className="table-th-center">Tutar</PanelTableTh>
                  <PanelTableTh colId="reportSales" className="table-th-center">Beklenen Ciro</PanelTableTh>
                  <PanelTableTh colId="reportCost" className="table-th-center">Tedarikçi Maliyet Toplamı</PanelTableTh>
                  <PanelTableTh colId="reportProfit" className="table-th-center">Beklenen Kar</PanelTableTh>
                  <PanelTableTh colId="priority" className="table-th-center">Öncelik</PanelTableTh>
                  <PanelTableTh colId="revision" className="table-th-center">Revizyon</PanelTableTh>
                  <PanelTableTh colId="actions" className="table-th-center">İşlemler</PanelTableTh>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {TABLE_COLUMNS.map((col) => (
                      <PanelTableTd key={col.id} colId={col.id} className="px-4 py-3">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                      </PanelTableTd>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : visibleClaims.length === 0 ? (
        <div className="table-container">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {hasFilters
                ? 'Filtrelere Uyan Dosya Bulunamadı'
                : isFieldStaff
                  ? 'Atanan İş Yok'
                  : 'Henüz Hasar Dosyası Yok'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {hasFilters
                ? 'Farklı filtreler deneyin veya filtreleri temizleyin.'
                : isFieldStaff
                  ? 'Tespiti biten işler Tamamlanan Tespitler sayfasındadır.'
                  : 'İlk dosyanızı oluşturun!'}
            </p>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="btn-secondary mt-4">Filtreleri Temizle</button>
            ) : !isFieldStaff ? (
              <button type="button" onClick={openNewPanel} className="btn-primary mt-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Yeni Dosya Oluştur
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="table-container">
          <div className={`grid gap-3 p-3 ${isFieldStaff ? '' : 'lg:hidden'}`}>
            {visibleClaims.map((claim: any) => {
              if (isFieldStaff) {
                const insuredName = fieldStaffInsuredName(claim);
                const phone = fieldStaffPhone(claim);
                const address = fieldStaffAddress(claim);
                const inspection = fieldStaffInspectionStatus(claim);
                return (
                  <div
                    key={claim.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/panel/hasar-dosyalari/${claim.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/panel/hasar-dosyalari/${claim.id}`);
                      }
                    }}
                    className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50/30"
                    data-testid="saha-dosya-karti"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-semibold text-slate-900">{insuredName}</p>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${fieldStaffInspectionBadgeClass(inspection.done)}`}
                        data-testid="saha-tespit-rozet"
                      >
                        {inspection.label}
                      </span>
                    </div>
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      <FieldInsuredContactActions
                        claim={{
                          id: claim.id,
                          fileNo: claim.fileNo,
                          insuredName: claim.insuredName ?? insuredName,
                          propertyAddress: claim.propertyAddress,
                        }}
                        phone={phone}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{address}</p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Tespit Tarih Saati:{' '}
                      <span className="font-medium text-slate-700">{inspection.doneAtLabel}</span>
                    </p>
                  </div>
                );
              }
              const customerName = claimListInsuranceCompanyName(claim);
              const insuredName = resolveHasarInsuredName(claim);
              const revCount = pendingRevisionMap[claim.id] ?? 0;
              const invStatus = deriveInvoiceStatus(claim.invoices ?? []);
              const totalAmount = claim.invoicedAmount ?? claim.actualCostAmount ?? null;
              const rapor = claim.latestRepairReport;
              const subject = resolveClaimDosyaKonusu(claim, dosyaKonusuCatalog);
              const supplierName = resolveClaimSupplierDisplayName(claim);
              const priority = claim.priority ?? 'normal';
              return (
                <button
                  key={claim.id}
                  type="button"
                  onClick={() => router.push(`/panel/hasar-dosyalari/${claim.id}?mode=edit`)}
                  className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/40 ${
                    claim.approval72hExceeded
                      ? 'ops-row-approval-72h border-red-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-all font-mono text-sm font-bold text-slate-900">{claimListFileNo(claim)}</div>
                      <div className="mt-1 truncate text-xs font-medium text-slate-600">{customerName}</div>
                      {subject ? (
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">{subject}</div>
                      ) : null}
                    </div>
                    <ClaimStatusBadge
                      status={claim.currentStatus}
                      reportStatus={claim.newestRepairReportStatus ?? claim.latestRepairReport?.status}
                      approval72hExceeded={Boolean(claim.approval72hExceeded)}
                      operationStatusLabel={claim.operationStatusLabel}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-400">Sigortalı</p>
                      <p className="mt-0.5 truncate font-medium text-slate-700">{insuredName}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Tarih</p>
                      <p className="mt-0.5 font-medium text-slate-700">{fmtDate(claim.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Tedarikçi</p>
                      <p className="mt-0.5 truncate font-medium text-slate-700">{supplierName ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Öncelik</p>
                      <span className={`mt-0.5 inline-flex ${priorityBadgeClass(priority)}`}>
                        {formatPriorityLabel(priority)}
                      </span>
                    </div>
                    <div>
                      <p className="text-slate-400">Fatura</p>
                      <span className={INVOICE_STATUS_CLASSES[invStatus] ?? 'badge badge-gray'}>
                        {INVOICE_STATUS_LABELS[invStatus] ?? invStatus}
                      </span>
                    </div>
                    <div>
                      <p className="text-slate-400">Tutar</p>
                      <p className="mt-0.5 font-semibold text-slate-700">{fmtAmount(totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Beklenen Ciro</p>
                      <p className="mt-0.5 font-semibold text-slate-700">{rapor ? fmtAmount(rapor.totalSalesAmount) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Tedarikçi Maliyet</p>
                      <p className="mt-0.5 font-semibold text-slate-700">{rapor ? fmtAmount(rapor.totalSupplierCost) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Beklenen Kar</p>
                      <p className="mt-0.5 font-semibold text-slate-700">{rapor ? fmtAmount(rapor.grossProfit) : '—'}</p>
                    </div>
                  </div>
                  <div className="mt-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <OperationRowActions
                      kind="hasar"
                      id={claim.id}
                      fileNo={claimListFileNo(claim)}
                      reportId={rapor?.id ?? null}
                      defaultEmailTo={claim.insuranceCompany?.contactEmail ?? claim.customer?.email ?? null}
                      onAddNote={() => {
                        setNoteFileId(claim.id);
                        setNoteFileNo(claimListFileNo(claim) === '—' ? undefined : claimListFileNo(claim));
                        setNoteInsuredName(resolveHasarInsuredName(claim) || undefined);
                      }}
                      onEmailRequest={() =>
                        setEmailTarget({
                          claimId: claim.id,
                          fileNo: claim.fileNo ?? claim.claimNo ?? '—',
                          reportId: rapor?.id ?? null,
                          defaultTo: claim.insuranceCompany?.contactEmail ?? claim.customer?.email ?? undefined,
                        })
                      }
                    />
                  </div>
                  {revCount > 0 && (
                    <div className="mt-3">
                      <span className="badge badge-amber">{revCount} revizyon bekliyor</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className={`hidden overflow-x-auto ${isFieldStaff ? '' : 'lg:block'}`}>
            <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
              <thead className="table-head-row">
                <tr>
                  <SortablePanelTableTh colId="fileNo" sortKey="fileNo" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Dosya No</SortablePanelTableTh>
                  <SortablePanelTableTh colId="customer" sortKey="customer" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Müşteri</SortablePanelTableTh>
                  <SortablePanelTableTh colId="insured" sortKey="insured" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Sigortalı</SortablePanelTableTh>
                  <SortablePanelTableTh colId="date" sortKey="date" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Tarih</SortablePanelTableTh>
                  <SortablePanelTableTh colId="subject" sortKey="subject" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Dosya Konusu</SortablePanelTableTh>
                  <SortablePanelTableTh colId="status" sortKey="status" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Dosya Durumu</SortablePanelTableTh>
                  <SortablePanelTableTh colId="supplier" sortKey="supplier" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Tedarikçi</SortablePanelTableTh>
                  <SortablePanelTableTh colId="invoice" sortKey="invoice" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Fatura</SortablePanelTableTh>
                  <SortablePanelTableTh colId="amount" sortKey="amount" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Tutar</SortablePanelTableTh>
                  <SortablePanelTableTh colId="reportSales" sortKey="reportSales" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Beklenen Ciro</SortablePanelTableTh>
                  <SortablePanelTableTh colId="reportCost" sortKey="reportCost" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Tedarikçi Maliyet Toplamı</SortablePanelTableTh>
                  <SortablePanelTableTh colId="reportProfit" sortKey="reportProfit" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Beklenen Kar</SortablePanelTableTh>
                  <SortablePanelTableTh colId="priority" sortKey="priority" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Öncelik</SortablePanelTableTh>
                  <SortablePanelTableTh colId="revision" sortKey="revision" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Revizyon</SortablePanelTableTh>
                  <PanelTableTh colId="actions" className="table-th-center">İşlemler</PanelTableTh>
                </tr>
              </thead>
              <tbody className="table-body">
                {visibleClaims.map((claim: any) => {
                  const customerName = claimListInsuranceCompanyName(claim);
                  const insuredName = resolveHasarInsuredName(claim);
                  const revCount = pendingRevisionMap[claim.id] ?? 0;
                  const invStatus = deriveInvoiceStatus(claim.invoices ?? []);
                  const totalAmount = claim.invoicedAmount ?? claim.actualCostAmount ?? null;
                  const rapor = claim.latestRepairReport;
                  const supplierName = resolveClaimSupplierDisplayName(claim);
                  const rowAccent = claim.approval72hExceeded
                    ? 'ops-row-approval-72h'
                    : revCount > 0
                      ? 'border-l-4 border-amber-300'
                      : rapor?.status === 'pending_approval'
                        ? 'border-l-4 border-orange-400'
                        : '';

                  return (
                    <tr
                      key={claim.id}
                      className={`table-row cursor-pointer ${rowAccent}`}
                      onClick={() => router.push(`/panel/hasar-dosyalari/${claim.id}?mode=edit`)}
                    >
                      <PanelTableTd colId="fileNo" className="table-td font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">{claimListFileNo(claim)}</PanelTableTd>
                      <PanelTableTd colId="customer" className="table-td text-xs font-medium whitespace-nowrap max-w-[160px]" title={customerName}>{customerName}</PanelTableTd>
                      <PanelTableTd colId="insured" className="table-td text-xs whitespace-nowrap max-w-[180px]">
                        <InsuredNameInlineEdit
                          claimId={claim.id}
                          displayName={insuredName}
                          onSaved={() => { void refetch(); }}
                          compact
                        />
                      </PanelTableTd>
                      <PanelTableTd colId="date" className="table-td text-slate-400 text-xs whitespace-nowrap">{fmtDate(claim.createdAt)}</PanelTableTd>
                      <PanelTableTd colId="subject" className="table-td text-xs whitespace-nowrap max-w-[140px]" title={resolveClaimDosyaKonusu(claim, dosyaKonusuCatalog)}>
                        {resolveClaimDosyaKonusu(claim, dosyaKonusuCatalog)}
                      </PanelTableTd>
                      <PanelTableTd colId="status" className="table-td whitespace-nowrap">
                        <ClaimStatusBadge
                      status={claim.currentStatus}
                      reportStatus={claim.newestRepairReportStatus ?? claim.latestRepairReport?.status}
                      approval72hExceeded={Boolean(claim.approval72hExceeded)}
                      operationStatusLabel={claim.operationStatusLabel}
                    />
                      </PanelTableTd>
                      <PanelTableTd colId="supplier" className="table-td text-xs whitespace-nowrap max-w-[120px]" title={supplierName ?? undefined}>
                        {supplierName ?? <span className="text-slate-300">Atanmadı</span>}
                      </PanelTableTd>
                      <PanelTableTd colId="invoice" className="table-td whitespace-nowrap">
                        <span className={INVOICE_STATUS_CLASSES[invStatus] ?? 'badge badge-gray'}>
                          {INVOICE_STATUS_LABELS[invStatus] ?? invStatus}
                        </span>
                      </PanelTableTd>
                      <PanelTableTd colId="amount" className="table-td text-xs whitespace-nowrap font-semibold">
                        {fmtAmount(totalAmount)}
                      </PanelTableTd>
                      <PanelTableTd colId="reportSales" className="table-td text-xs whitespace-nowrap font-semibold text-slate-800">
                        {rapor ? fmtAmount(rapor.totalSalesAmount) : '—'}
                      </PanelTableTd>
                      <PanelTableTd colId="reportCost" className="table-td text-xs whitespace-nowrap font-semibold text-slate-800">
                        {rapor ? fmtAmount(rapor.totalSupplierCost) : '—'}
                      </PanelTableTd>
                      <PanelTableTd
                        colId="reportProfit"
                        className={`table-td text-xs whitespace-nowrap font-semibold ${
                          rapor && Number(rapor.grossProfit) < 0 ? 'text-status-danger' : 'text-slate-800'
                        }`}
                      >
                        {rapor ? fmtAmount(rapor.grossProfit) : '—'}
                      </PanelTableTd>
                      <PanelTableTd colId="priority" className="table-td whitespace-nowrap">
                        {claim.priority && (
                          <span className={priorityBadgeClass(claim.priority)}>
                            {formatPriorityLabel(claim.priority)}
                          </span>
                        )}
                      </PanelTableTd>
                      <PanelTableTd colId="revision" className="table-td whitespace-nowrap">
                        {revCount > 0 ? (
                          <span className="badge badge-amber">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                            {revCount} Bekliyor
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </PanelTableTd>
                      <PanelTableTd colId="actions" className="table-td-center whitespace-nowrap">
                        <div
                          className="inline-flex"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <OperationRowActions
                            kind="hasar"
                            id={claim.id}
                            fileNo={claimListFileNo(claim)}
                            reportId={rapor?.id ?? null}
                            defaultEmailTo={claim.insuranceCompany?.contactEmail ?? claim.customer?.email ?? null}
                            onAddNote={() => {
                              setNoteFileId(claim.id);
                              setNoteFileNo(claimListFileNo(claim) === '—' ? undefined : claimListFileNo(claim));
                              setNoteInsuredName(resolveHasarInsuredName(claim) || undefined);
                            }}
                            onEmailRequest={() =>
                              setEmailTarget({
                                claimId: claim.id,
                                fileNo: claim.fileNo ?? claim.claimNo ?? '—',
                                reportId: rapor?.id ?? null,
                                defaultTo: claim.insuranceCompany?.contactEmail ?? claim.customer?.email ?? undefined,
                              })
                            }
                          />
                        </div>
                      </PanelTableTd>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total > limit && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/60">
              <span className="text-xs text-slate-400">{(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total} kayıt</span>
              <div className="flex gap-2">
                <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">← Önceki</button>
                <button disabled={page * limit >= total} onClick={() => setPage((p) => p + 1)} className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Sonraki →</button>
              </div>
            </div>
          )}
        </div>
      )}
      <ExpertFileNoteModal
        open={Boolean(noteFileId)}
        claimFileId={noteFileId}
        fileNo={noteFileNo}
        insuredName={noteInsuredName}
        onClose={() => {
          setNoteFileId(null);
          setNoteFileNo(undefined);
          setNoteInsuredName(undefined);
        }}
        onSaved={() => {
          setToast('Dosya Notu Kaydedildi.');
          setNoteFileId(null);
          setNoteFileNo(undefined);
          setNoteInsuredName(undefined);
        }}
      />
      <OperationSendEmailModal
        target={emailTarget}
        onClose={() => setEmailTarget(null)}
      />
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
    </TableColumnsProvider>
  );
}

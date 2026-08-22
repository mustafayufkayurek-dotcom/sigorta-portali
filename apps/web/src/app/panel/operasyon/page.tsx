'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CalendarPlus,
  ClipboardCheck,
  FileEdit,
  FileText,
  FolderInput,
  FolderOpen,
  Hourglass,
} from 'lucide-react';
import { getCases, EmergencyCase } from '@/utils/emergencyApi';
import { apiClient } from '@/lib/api-client';
import {
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableTh,
  PanelTableColGroup,
  SortablePanelTableTh,
  TableColumnsProvider,
  usePanelTableColumns,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { fmtDate } from '@/utils/date-helpers';
import { resolveClaimDosyaKonusu, toTitleCaseTR } from '@/utils/text-helpers';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';
import {
  OPERATION_CUSTOMER_UNDEFINED,
  resolveHasarOperationCustomer,
  resolveOperationCustomer,
} from '@/utils/operation-customer-display';
import { InsuredNameInlineEdit } from '@/components/claim-files/InsuredNameInlineEdit';
import { OperationRowActions } from '@/components/operasyon/OperationRowActions';
import { OperationSendEmailModal, type OperationSendEmailTarget } from '@/components/operasyon/OperationSendEmailModal';
import { OpsStripKpi } from '@/components/operasyon/OpsStripKpi';
import { DoubleDeleteConfirm } from '@/components/operasyon/DoubleDeleteConfirm';
import { ExpertFileNoteModal } from '@/components/eksper-portal/ExpertFileModals';
import { formatTryAmount } from '@/utils/format-try-amount';
import { acilVendorPayLabel, acilVendorPayMatchesFilter, acilVendorPayMatchesQuery, acilVendorPayTone, type AcilVendorPayFilter } from '@/utils/acil-vendor-pay';
import { readAcilLocalFlow } from '@/app/panel/acil-yardim/[id]/acil-workflow';
import { API, authHeader } from '@/utils/api';
import axios from 'axios';
import { SlidePanel } from '@/components/SlidePanel';
import { EmergencyCaseNewForm } from '@/components/emergency/EmergencyCaseNewForm';
import { SearchInput } from '@/components/ui/SearchInput';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import {
  BADGE_TONE_CLASS,
  OPERATION_PRESET_LABELS,
  deriveOperationStage,
  resolveEmergencyOperationLabel,
  type OperationPreset,
  type OperationStageMeta,
} from '@sigorta/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  paid: 'Ödendi',
  partial: 'Kısmi',
  cancelled: 'İptal',
  overdue: 'Gecikmiş',
  none: '—',
};
const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft:     'badge badge-gray',
  sent:      'badge badge-blue',
  paid:      'badge badge-green',
  partial:   'badge badge-amber',
  cancelled: 'badge badge-red',
  overdue:   'badge badge-red',
  none:      'badge badge-gray',
};

function deriveInvoiceStatus(invoices: { status: string; invoiceType: string }[]): string {
  if (!invoices || invoices.length === 0) return 'none';
  const sales = invoices.filter((i) => i.invoiceType === 'sales');
  if (sales.length === 0) return 'none';
  if (sales.some((i) => i.status === 'overdue')) return 'overdue';
  if (sales.some((i) => i.status === 'paid')) return 'paid';
  if (sales.some((i) => i.status === 'partial')) return 'partial';
  if (sales.some((i) => i.status === 'sent')) return 'sent';
  return 'draft';
}

const EMERGENCY_STATUS_LABELS: Record<string, string> = {
  GELEN: 'Yeni İhbar',
  ATANDI: 'Tespit Aşamasında',
  SAHADA: 'Onarım Aşamasında',
  COZULDU: 'Dosya Kapatıldı',
  FATURALANDILDI: 'Finansa Aktarıldı',
};

/** Acil operasyon akışına göre Dosya Durumu sinyali (renk + nokta). */
const EMERGENCY_STATUS_CLASSES: Record<string, string> = {
  GELEN: 'badge badge-gray ring-1 ring-slate-300',
  ATANDI: 'badge badge-blue ring-1 ring-blue-300',
  SAHADA: 'badge badge-orange ring-1 ring-orange-300',
  COZULDU: 'badge badge-green ring-1 ring-emerald-300',
  FATURALANDILDI: 'badge badge-purple ring-1 ring-violet-300',
};

function AcilDosyaDurumuBadge({ code, label }: { code: string; label?: string | null }) {
  const display = label || EMERGENCY_STATUS_LABELS[code] || code;
  const rejected = display === 'Reddedildi';
  const tone = rejected
    ? 'badge badge-red ring-1 ring-red-300'
    : (EMERGENCY_STATUS_CLASSES[code] ?? 'badge badge-gray');
  const showPulse = !rejected && (code === 'GELEN' || code === 'SAHADA');
  const dotClass = rejected
    ? 'bg-red-500'
    : code === 'GELEN'
      ? 'bg-slate-500'
      : code === 'ATANDI'
        ? 'bg-blue-500'
        : code === 'SAHADA'
          ? 'bg-orange-500'
          : code === 'COZULDU'
            ? 'bg-emerald-500'
            : code === 'FATURALANDILDI'
              ? 'bg-violet-500'
              : 'bg-slate-400';
  return (
    <span
      className={`${tone} inline-flex items-center gap-1.5`}
      title={`Acil Dosya Durumu · ${display}`}
      data-testid="acil-dosya-durumu"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass} ${showPulse ? 'animate-pulse' : ''}`} />
      {display}
    </span>
  );
}

const PRESET_CHIPS: OperationPreset[] = [
  'approval_pending',
  'approval_72h',
  'report_writing',
  'report_approval',
  'finance_transfer',
  'delay_risk',
  'opened_today',
  'assigned_to_me',
];

type UnifiedRow =
  | {
      kind: 'hasar';
      id: string;
      fileNo: string;
      customerName: string;
      customerTypeLabel: string | null;
      customerTitle: string;
      customerSearch: string;
      insuredName: string;
      date: string;
      subject: string;
      statusLabel: string;
      statusTone: string;
      invoiceStatus: string;
      amount: string | null;
      expectedSales: string | null;
      supplierCostTotal: string | null;
      expectedProfit: string | null;
      expectedProfitNegative?: boolean;
      delayHours: number | null;
      assigneeName: string;
      approval72hExceeded: boolean;
      delayRisk: boolean;
      updatedAt?: string | null;
      priority?: string | null;
      reportId: string | null;
      defaultEmailTo: string | null;
    }
  | {
      kind: 'acil';
      id: string;
      fileNo: string;
      customerName: string;
      customerTypeLabel: string | null;
      customerTitle: string;
      customerSearch: string;
      insuredName: string;
      date: string;
      subject: string;
      statusCode: string;
      statusLabel?: string | null;
      invoiceStatus: string;
      amount: string | null;
      expectedSales: string | null;
      supplierCostTotal: string | null;
      expectedProfit: string | null;
      expectedProfitNegative?: boolean;
      delayHours: number | null;
      assigneeName: string;
      approval72hExceeded: boolean;
      delayRisk: boolean;
      reportId: string | null;
      defaultEmailTo: string | null;
      vendorPaid: boolean | null;
    };

function resolveAcilListVendorPaid(c: EmergencyCase): boolean | null {
  if (c.vendorPaid === true || c.vendorPaid === false) return c.vendorPaid;
  return readAcilLocalFlow(c.id).vendorPaid;
}

function resolveClaimDisplayDate(claim: {
  notificationDate?: string | null;
  lossDate?: string | null;
  incidentDate?: string | null;
  createdAt?: string | null;
}): string {
  return claim.notificationDate ?? claim.lossDate ?? claim.incidentDate ?? claim.createdAt ?? '';
}

const TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'kind', label: 'Tür', defaultWidth: 80, minWidth: 68 },
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 110, minWidth: 88 },
  { id: 'customer', label: 'Müşteri', defaultWidth: 168, minWidth: 140 },
  { id: 'insured', label: 'Sigortalı Adı Soyadı', defaultWidth: 150, minWidth: 120 },
  { id: 'assignee', label: 'Kimde', defaultWidth: 120, minWidth: 88 },
  { id: 'date', label: 'Tarih', defaultWidth: 96, minWidth: 80, defaultVisible: false },
  { id: 'subject', label: 'Dosya Konusu', defaultWidth: 200, minWidth: 120, flex: true },
  { id: 'status', label: 'Dosya Durumu', defaultWidth: 150, minWidth: 120 },
  { id: 'invoice', label: 'Fatura', defaultWidth: 100, minWidth: 80, defaultVisible: false },
  { id: 'amount', label: 'Tutar', defaultWidth: 96, minWidth: 80, defaultVisible: false },
  { id: 'reportSales', label: 'Beklenen Ciro', defaultWidth: 110, minWidth: 88 },
  { id: 'reportCost', label: 'Tedarikçi Maliyet Toplamı', defaultWidth: 140, minWidth: 110 },
  { id: 'reportProfit', label: 'Beklenen Kar', defaultWidth: 110, minWidth: 88 },
  { id: 'actions', label: 'İşlemler', defaultWidth: 188, minWidth: 160, pin: 'end', resizable: false },
];

const VENDOR_PAY_COL: TableColumnDef = {
  id: 'vendorPay',
  label: 'Ödeme Durumu',
  defaultWidth: 132,
  minWidth: 112,
  alwaysVisible: true,
};

const ACIL_TABLE_COLUMNS: TableColumnDef[] = (() => {
  const hideExtra = new Set(['kind', 'invoice', 'amount', 'reportSales', 'reportCost', 'reportProfit']);
  const cols = TABLE_COLUMNS.map((c) => (hideExtra.has(c.id) ? { ...c, defaultVisible: false } : c));
  const statusAt = cols.findIndex((c) => c.id === 'status');
  return [
    ...cols.slice(0, statusAt + 1),
    VENDOR_PAY_COL,
    ...cols.slice(statusAt + 1),
  ];
})();

const PAGE_SIZE = 50;

/**
 * Sütun genişlikleri sayfa/filtre bazında ayrılır — Hasar ve Acil birbirini etkilemez.
 * v16: iş kuyruğu varsayılan sütun; Ödeme Durumu gizlenemez.
 */
const OPS_COLS_KEY_BY_FILTER: Record<'all' | 'hasar' | 'acil', string> = {
  all: 'table-cols:operasyon-all-v11',
  hasar: 'table-cols:operasyon-hasar-v11',
  acil: 'table-cols:operasyon-acil-v16',
};

function resolveOpsColumnsStorageKey(filterType: 'all' | 'hasar' | 'acil' = 'all'): string {
  const base = OPS_COLS_KEY_BY_FILTER[filterType] ?? OPS_COLS_KEY_BY_FILTER.all;
  if (typeof window === 'undefined') return base;
  try {
    const raw = localStorage.getItem('user') ?? '{}';
    const user = JSON.parse(raw) as { id?: string };
    const uid = typeof user?.id === 'string' && user.id.trim() ? user.id.trim() : '';
    return uid ? `${base}:${uid}` : base;
  } catch {
    return base;
  }
}

/** Sunucu sort alanı — claim-files parseSort ile hizalı */
const COL_SERVER_SORT: Record<string, string> = {
  fileNo: 'fileNo',
  date: 'notificationDate',
};

/** Tablo border-collapse altında border-r güvensiz; inset çizgi belirgin ve kalıcı */
const COL_DIVIDER =
  "relative after:pointer-events-none after:absolute after:inset-y-1 after:right-0 after:w-px after:bg-slate-300 after:content-[''] last:after:content-none";

type OpsStats = {
  open: number;
  openClaims?: number;
  openedTodayClaims?: number;
  openEmergency?: number;
  openedTodayEmergency?: number;
  urgent: number;
  openedToday: number;
  approvalPending: number;
  reportWriting: number;
  reportApproval: number;
  financeTransfer: number;
  delayRisk: number;
  approval72h: number;
};

export default function OperasyonPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    >
      <OperasyonPageContent />
    </Suspense>
  );
}

function OperasyonPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [colsStorageKey, setColsStorageKey] = useState(OPS_COLS_KEY_BY_FILTER.all);

  const [dosyaKonusuCatalog, setDosyaKonusuCatalog] = useState<string[]>([]);

  const [claims, setClaims] = useState<any[]>([]);
  const [claimsTotal, setClaimsTotal] = useState(0);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claimsError, setClaimsError] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('createdAt:desc');
  const [clientSort, setClientSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');

  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);

  const [opsStats, setOpsStats] = useState<OpsStats | null>(null);
  const [emailTarget, setEmailTarget] = useState<OperationSendEmailTarget | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'hasar' | 'acil'>('all');
  const [filterInvoice, setFilterInvoice] = useState('');
  const [filterVendorPay, setFilterVendorPay] = useState<AcilVendorPayFilter>('');
  const [opsPreset, setOpsPreset] = useState<OperationPreset | ''>('');
  const tableColumnDefs = filterType === 'acil' ? ACIL_TABLE_COLUMNS : TABLE_COLUMNS;
  const tableColumns = usePanelTableColumns(colsStorageKey, tableColumnDefs);

  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'hasar' | 'acil'; id: string; fileNo: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [noteFileId, setNoteFileId] = useState<string | null>(null);

  const [showNewAcilPanel, setShowNewAcilPanel] = useState(false);
  const [acilFormSession, setAcilFormSession] = useState(0);
  const [acilCreatedNotice, setAcilCreatedNotice] = useState('');

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'acil' || filter === 'hasar' || filter === 'all') {
      setFilterType(filter);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('yeni') !== '1') return;
    setAcilFormSession((s) => s + 1);
    setShowNewAcilPanel(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('yeni');
    router.replace(`/panel/operasyon?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const applyFilterType = useCallback((t: 'all' | 'hasar' | 'acil') => {
    setFilterType(t);
    const params = new URLSearchParams(searchParams.toString());
    if (t === 'all') params.delete('filter');
    else params.set('filter', t);
    router.replace(`/panel/operasyon?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    setColsStorageKey(resolveOpsColumnsStorageKey(filterType));
  }, [filterType]);

  useEffect(() => {
    const previous = document.title;
    document.title = filterType === 'acil' ? 'Acil Yardım Dosyaları' : 'Dosya Özeti';
    return () => {
      document.title = previous;
    };
  }, [filterType]);

  const patchClaimInsuredName = useCallback((claimId: string, insuredName: string) => {
    setClaims((prev) => prev.map((claim) => (
      claim.id === claimId ? { ...claim, insuredName } : claim
    )));
  }, []);

  const loadClaims = useCallback(async () => {
    // Acil listesi / "Acil Dosya" KPI = acil yardım stoku; hasar API hatası kırmızı şerit basmasın
    if (opsPreset === 'urgent' || filterType === 'acil') {
      setClaims([]);
      setClaimsTotal(0);
      setClaimsLoading(false);
      setClaimsError('');
      return;
    }
    setClaimsLoading(true);
    setClaimsError('');
    try {
      const params: Record<string, string | number | boolean> = {
        page,
        limit: PAGE_SIZE,
        sort,
      };
      if (opsPreset) params.opsPreset = opsPreset;
      if (filterInvoice) params.invoiceStatus = filterInvoice;
      const response = await apiClient.getWithMeta<any[], { total?: number }>('/claim-files', params);
      setClaims(response.data ?? []);
      setClaimsTotal(response.meta?.total ?? response.data?.length ?? 0);
    } catch {
      setClaimsError('Veriler yüklenemedi');
    } finally {
      setClaimsLoading(false);
    }
  }, [page, sort, opsPreset, filterInvoice, filterType]);

  const loadStats = useCallback(async () => {
    try {
      const stats = await apiClient.get<OpsStats>('/claim-files/operation-stats');
      setOpsStats(stats);
    } catch { /* ignore */ }
  }, []);

  const loadCases = useCallback(async () => {
    // Hasar-only KPI filtrelerinde acil listesi gerekmez
    const needsAcil =
      !opsPreset ||
      opsPreset === 'open' ||
      opsPreset === 'urgent' ||
      opsPreset === 'opened_today';
    if (!needsAcil) {
      setCases([]);
      setCasesLoading(false);
      return;
    }
    setCasesLoading(true);
    try {
      const res = await getCases();
      setCases(res.data.slice(0, PAGE_SIZE * 3));
    } catch { /* ignore */ }
    finally { setCasesLoading(false); }
  }, [opsPreset]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  useEffect(() => {
    loadCases();
    loadStats();
    axios
      .get(`${API}/system-settings/ihbar-konulari`, { headers: authHeader() })
      .then((res) => {
        const payload = res.data?.data ?? res.data;
        const names = [...(payload?.hasar ?? []), ...(payload?.acil ?? [])]
          .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0);
        setDosyaKonusuCatalog(names);
      })
      .catch(() => {});
  }, [loadCases, loadStats]);

  useEffect(() => {
    setPage(1);
  }, [opsPreset, filterInvoice, filterType]);

  const hasarRows: UnifiedRow[] = claims.map((claim) => {
    const invStatus = deriveInvoiceStatus(claim.invoices ?? []);
    const customer = resolveHasarOperationCustomer(claim.customer, claim.insuranceCompany);
    const subject = resolveClaimDosyaKonusu(claim, dosyaKonusuCatalog);
    const stage: OperationStageMeta = claim.operationStage
      ?? deriveOperationStage({
        claimStatusCode: claim.currentStatus?.code,
        reportStatus: claim.newestRepairReportStatus ?? claim.latestRepairReport?.status,
      });
    return {
      kind: 'hasar' as const,
      id: claim.id,
      fileNo: claim.fileNo ?? claim.claimNo ?? '—',
      customerName: customer.name,
      customerTypeLabel: customer.typeLabel,
      customerTitle: customer.title,
      customerSearch: customer.searchText,
      insuredName: resolveHasarInsuredName(claim),
      date: resolveClaimDisplayDate(claim),
      subject,
      statusLabel: claim.operationStatusLabel ?? stage.label,
      statusTone: (claim.operationStatusLabel ?? stage.label) === 'Reddedildi'
        ? BADGE_TONE_CLASS.red
        : (BADGE_TONE_CLASS[stage.tone as OperationStageMeta['tone']] ?? 'badge badge-blue'),
      invoiceStatus: invStatus,
      amount: claim.invoicedAmount != null ? formatTryAmount(Number(claim.invoicedAmount), { fractionDigits: 0 }) : null,
      expectedSales:
        claim.latestRepairReport?.totalSalesAmount != null
          ? formatTryAmount(Number(claim.latestRepairReport.totalSalesAmount), { fractionDigits: 0 })
          : null,
      supplierCostTotal:
        claim.latestRepairReport?.totalSupplierCost != null
          ? formatTryAmount(Number(claim.latestRepairReport.totalSupplierCost), { fractionDigits: 0 })
          : null,
      expectedProfit:
        claim.latestRepairReport?.grossProfit != null
          ? formatTryAmount(Number(claim.latestRepairReport.grossProfit), { fractionDigits: 0 })
          : null,
      expectedProfitNegative:
        claim.latestRepairReport?.grossProfit != null
          ? Number(claim.latestRepairReport.grossProfit) < 0
          : false,
      delayHours: typeof claim.approvalWaitingHours === 'number' ? claim.approvalWaitingHours : null,
      assigneeName: claim.assigneeName ?? '—',
      approval72hExceeded: Boolean(claim.approval72hExceeded),
      delayRisk: Boolean(claim.delayRisk),
      updatedAt: claim.updatedAt ?? null,
      priority: claim.priority ?? null,
      reportId: claim.latestRepairReport?.id ?? null,
      defaultEmailTo: claim.insuranceCompany?.contactEmail ?? claim.customer?.email ?? null,
    };
  });

  const acilRows: UnifiedRow[] = cases
    .filter((c) => {
      const closed = c.status === 'COZULDU' || c.status === 'FATURALANDILDI';
      if (opsPreset === 'urgent' || opsPreset === 'open') return !closed;
      if (opsPreset === 'opened_today') {
        if (!c.createdAt) return false;
        const created = new Date(c.createdAt);
        const now = new Date();
        const trDay = (d: Date) =>
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Istanbul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(d);
        return trDay(created) === trDay(now);
      }
      return true;
    })
    .map((c) => {
    const customer = resolveOperationCustomer(c.customer);
    return {
      kind: 'acil' as const,
      id: c.id,
      fileNo: c.caseNo,
      customerName: customer.name,
      customerTypeLabel: customer.typeLabel,
      customerTitle: customer.title,
      customerSearch: customer.searchText,
      insuredName: c.customerName ? toTitleCaseTR(c.customerName) : '—',
      date: c.createdAt,
      subject: resolveClaimDosyaKonusu({ lossType: c.issueType }, dosyaKonusuCatalog),
      statusCode: c.status,
      statusLabel: c.operationStatusLabel
        ?? resolveEmergencyOperationLabel({ status: c.status, notes: c.notes }),
      invoiceStatus: c.status === 'FATURALANDILDI' ? 'paid' : 'none',
      amount: null,
      expectedSales:
        c.totalGelir != null ? formatTryAmount(Number(c.totalGelir), { fractionDigits: 0 }) : null,
      supplierCostTotal:
        c.totalGider != null ? formatTryAmount(Number(c.totalGider), { fractionDigits: 0 }) : null,
      expectedProfit:
        c.netKar != null ? formatTryAmount(Number(c.netKar), { fractionDigits: 0 }) : null,
      expectedProfitNegative: c.netKar != null ? Number(c.netKar) < 0 : false,
      delayHours: null,
      assigneeName: c.assignedUser
        ? `${c.assignedUser.firstName ?? ''} ${c.assignedUser.lastName ?? ''}`.trim() || '—'
        : '—',
      approval72hExceeded: false,
      delayRisk: false,
      reportId: null,
      defaultEmailTo: null,
      vendorPaid: resolveAcilListVendorPaid(c),
    };
  });

  function sortValue(row: UnifiedRow, key: string): string {
    switch (key) {
      case 'kind': return row.kind;
      case 'fileNo': return row.fileNo;
      case 'customer': return `${row.customerName} ${row.customerTypeLabel ?? ''}`;
      case 'insured': return row.insuredName;
      case 'assignee': return row.assigneeName;
      case 'date': return row.date;
      case 'subject': return row.subject;
      case 'status': return row.kind === 'hasar' ? row.statusLabel : row.statusCode;
      case 'invoice': return row.invoiceStatus;
      case 'amount': return row.amount ?? '';
      case 'reportSales': return row.expectedSales ?? '';
      case 'reportCost': return row.supplierCostTotal ?? '';
      case 'reportProfit': return row.expectedProfit ?? '';
      case 'vendorPay':
        return row.kind === 'acil' ? acilVendorPayLabel(row.vendorPaid) : '';
      default: return '';
    }
  }

  const filteredRows: UnifiedRow[] = (() => {
    // KPI preset acil/açık/bugün: hasar+acil birleşik; diğer hasar KPI'ları yalnız hasar
    const effectiveType: typeof filterType =
      opsPreset === 'urgent'
        ? 'acil'
        : opsPreset === 'open' || opsPreset === 'opened_today'
          ? 'all'
          : filterType;
    const merged = effectiveType === 'hasar'
      ? hasarRows
      : effectiveType === 'acil'
        ? acilRows
        : [...hasarRows, ...acilRows];
    const q = customerQuery.trim().toLocaleLowerCase('tr');
    let rows = q
      ? merged.filter((row) => {
          if (row.customerSearch.includes(q) || row.customerName.toLocaleLowerCase('tr').includes(q)) return true;
          if ((row.customerTypeLabel ?? '').toLocaleLowerCase('tr').includes(q)) return true;
          // Acil listesi: Hasar filtre dili — dosya no / sigortalı / konu
          if (filterType === 'acil') {
            if (row.fileNo.toLocaleLowerCase('tr').includes(q)) return true;
            if (row.insuredName.toLocaleLowerCase('tr').includes(q)) return true;
            if ((row.subject ?? '').toLocaleLowerCase('tr').includes(q)) return true;
            if (acilVendorPayMatchesQuery(row.kind === 'acil' ? row.vendorPaid : null, q)) return true;
          }
          return false;
        })
      : [...merged];
    if (filterType === 'acil' && filterVendorPay) {
      rows = rows.filter(
        (row) => row.kind === 'acil' && acilVendorPayMatchesFilter(row.vendorPaid, filterVendorPay),
      );
    }
    if (clientSort) {
      const { key, dir } = clientSort;
      const mul = dir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = String(sortValue(a, key) ?? '');
        const bv = String(sortValue(b, key) ?? '');
        return av.localeCompare(bv, 'tr', { sensitivity: 'base', numeric: true }) * mul;
      });
    } else {
      // Sunucu sort alanı (fileNo / tarih) seçildiyse birleşik listede de aynı sırayı uygula.
      // Aksi halde default (createdAt) görünümü tarih azalan kalır.
      const [field, dir] = sort.split(':');
      const serverColId = Object.entries(COL_SERVER_SORT).find(([, v]) => v === field)?.[0];
      if (serverColId && (dir === 'asc' || dir === 'desc')) {
        const mul = dir === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
          const av = String(sortValue(a, serverColId) ?? '');
          const bv = String(sortValue(b, serverColId) ?? '');
          return av.localeCompare(bv, 'tr', { sensitivity: 'base', numeric: true }) * mul;
        });
      } else {
        rows = [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
    }
    return rows;
  })();

  const activeSortKey =
    clientSort?.key
    ?? Object.entries(COL_SERVER_SORT).find(([, v]) => sort.startsWith(`${v}:`))?.[0]
    ?? null;
  const sortDir: 'asc' | 'desc' = clientSort
    ? clientSort.dir
    : (sort.endsWith(':asc') ? 'asc' : 'desc');

  /** ASC → DESC → Default (üç durumlu gerçek sıralama; birleşik hasar+acil listede client) */
  const handleColumnSort = (colId: string) => {
    if (colId === 'actions') return;
    const serverField = COL_SERVER_SORT[colId];
    setClientSort((prev) => {
      if (!prev || prev.key !== colId) return { key: colId, dir: 'asc' };
      if (prev.dir === 'asc') return { key: colId, dir: 'desc' };
      return null;
    });
    // Sayfalı hasar API ile hizala (görüntü sırası clientSort ile belirlenir)
    if (serverField) {
      setSort((prev) => {
        const [f, d] = prev.split(':');
        if (f === serverField && d === 'asc') return `${serverField}:desc`;
        if (f === serverField && d === 'desc') return 'createdAt:desc';
        return `${serverField}:asc`;
      });
    } else {
      setSort('createdAt:desc');
    }
  };

  const missingInsuredHasar = hasarRows.filter((row) => row.insuredName === '—');
  /** Sidebar → Acil Yardım Dosyaları: Hasar listesi kabuğuna hizalı sade üst alan */
  const isAcilListMode = filterType === 'acil';
  const isLoading =
    (opsPreset !== 'urgent' && claimsLoading) ||
    (
      (
        opsPreset === 'urgent' ||
        opsPreset === 'open' ||
        opsPreset === 'opened_today' ||
        (!opsPreset && filterType !== 'hasar')
      ) && casesLoading
    );
  const totalPages = Math.max(1, Math.ceil(claimsTotal / PAGE_SIZE));

  const togglePreset = (preset: OperationPreset) => {
    setOpsPreset((prev) => (prev === preset ? '' : preset));
    if (preset === 'urgent') setFilterType('acil');
    else if (preset === 'open' || preset === 'opened_today') setFilterType('all');
    else setFilterType('hasar');
  };

  const columnFitSamples = useMemo(() => {
    const samples: Record<string, string[]> = {};
    for (const col of tableColumnDefs) samples[col.id] = [col.label];
    for (const row of filteredRows) {
      samples.kind?.push(row.kind === 'hasar' ? 'Hasar' : 'Acil');
      samples.fileNo?.push(row.fileNo);
      samples.customer?.push(row.customerName);
      if (row.customerTypeLabel) samples.customer?.push(row.customerTypeLabel);
      samples.insured?.push(row.insuredName);
      samples.assignee?.push(row.assigneeName);
      samples.date?.push(fmtDate(row.date));
      samples.subject?.push(row.subject);
      samples.status?.push(row.kind === 'hasar' ? row.statusLabel : (row.statusLabel || EMERGENCY_STATUS_LABELS[row.statusCode] || row.statusCode));
      samples.invoice?.push(INVOICE_STATUS_LABELS[row.invoiceStatus] ?? row.invoiceStatus);
      if (row.amount) samples.amount?.push(row.amount);
      if (row.expectedSales) samples.reportSales?.push(row.expectedSales);
      if (row.supplierCostTotal) samples.reportCost?.push(row.supplierCostTotal);
      if (row.expectedProfit) samples.reportProfit?.push(row.expectedProfit);
      if (row.kind === 'acil') samples.vendorPay?.push(acilVendorPayLabel(row.vendorPaid));
      samples.actions?.push('İşlemler');
    }
    return samples;
  }, [filteredRows, tableColumnDefs]);

  const visibleOpsColumns = useMemo(() => {
    const cols = tableColumns.prefs.orderedVisibleColumns;
    if (filterType !== 'acil') return cols;
    const withoutKind = cols.filter((c) => c.id !== 'kind');
    if (withoutKind.some((c) => c.id === 'vendorPay')) return withoutKind;
    const statusAt = withoutKind.findIndex((c) => c.id === 'status');
    const insertAt = statusAt >= 0 ? statusAt + 1 : withoutKind.length;
    return [...withoutKind.slice(0, insertAt), VENDOR_PAY_COL, ...withoutKind.slice(insertAt)];
  }, [filterType, tableColumns.prefs.orderedVisibleColumns]);

  const opsTableStyle = useMemo(() => {
    if (filterType !== 'acil') return panelTableLayoutStyle(tableColumns);
    const total = visibleOpsColumns.reduce(
      (sum, col) => sum + tableColumns.widths.getWidth(col.id),
      0,
    );
    return { tableLayout: 'fixed' as const, width: '100%', minWidth: `${Math.max(total, 720)}px` };
  }, [filterType, tableColumns, visibleOpsColumns]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      if (deleteTarget.kind === 'hasar') {
        // Kalıcı silme kapalı — iptal durumuna geç
        const statuses = await apiClient.get<Array<{ id: string; code: string }>>('/claim-files/statuses');
        const cancelled = statuses.find((s) => s.code === 'cancelled');
        if (!cancelled) throw new Error('İptal durumu bulunamadı');
        await axios.post(
          `${API}/claim-files/${deleteTarget.id}/change-status`,
          { toStatusId: cancelled.id, note: 'Operasyon listesinden çift onaylı iptal' },
          { headers: authHeader() },
        );
      } else {
        await axios.delete(`${API}/emergency/cases/${deleteTarget.id}`, { headers: authHeader() });
      }
      setDeleteTarget(null);
      await Promise.all([loadClaims(), loadCases(), loadStats()]);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message ?? e.message
        : e instanceof Error ? e.message : 'İşlem başarısız';
      setDeleteError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <TableColumnsProvider value={tableColumns}>
    <div className={isAcilListMode ? 'space-y-3' : 'space-y-6'}>
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <a href="/panel" className="hover:text-brand-600 transition-colors">Dashboard</a>
        <span>/</span>
        {isAcilListMode ? (
          <span className="text-slate-600 font-medium">Acil Yardım Dosyaları</span>
        ) : (
          <span className="text-slate-600 font-medium">Dosya Özeti</span>
        )}
      </nav>

      <div className="page-header">
        <div className="flex items-center gap-3">
          {isAcilListMode ? (
            <button
              type="button"
              onClick={() => router.push('/panel')}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Dashboard"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          ) : null}
          <div className="page-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            {isAcilListMode ? (
              <>
                <h2 className="page-title">Acil Yardım Dosyaları</h2>
                {!isLoading && (
                  <p className="page-subtitle">
                    {filteredRows.length} dosya bulundu
                    {customerQuery.trim() ? (
                      <span className="ml-2 text-brand-600 font-semibold">· Arama: {customerQuery.trim()}</span>
                    ) : null}
                  </p>
                )}
                <div className="mt-1.5">
                  <OpsFirstRunNotice
                    compact
                    noticeId={OPS_NOTICE.acilListeSonDegisiklik.id}
                    title={OPS_NOTICE.acilListeSonDegisiklik.title}
                    body={OPS_NOTICE.acilListeSonDegisiklik.body}
                    testId="acil-liste-ilk-kullanim-seridi"
                  />
                </div>
              </>
            ) : (
              <>
                <h2 className="page-title">Dosya Özeti</h2>
                <p className="page-subtitle">Dosyaya girmeden: durum, kimde, risk ve gecikme süresi</p>
              </>
            )}
          </div>
        </div>
        <div className="page-header-actions">
          {!isAcilListMode && (
            <Link href="/panel/operasyon/gelen-kutusu" className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Gelen Kutusu
            </Link>
          )}
          {!isAcilListMode && (
            <Link href="/panel/hasar-dosyalari?yeni=1" className="btn-primary shadow-sm shadow-blue-200/60 justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Yeni Hasar Dosyası
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setAcilFormSession((s) => s + 1);
              setShowNewAcilPanel(true);
            }}
            className={
              isAcilListMode
                ? 'btn-primary justify-center'
                : 'inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all'
            }
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {isAcilListMode ? 'Yeni Dosya' : 'Yeni Acil Dosyası'}
          </button>
          {acilCreatedNotice ? (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
              {acilCreatedNotice}
            </span>
          ) : null}
        </div>
      </div>

      {/* Dosya Özeti KPI — Acil listesinde yalnız acil sayıları */}
      {isAcilListMode ? (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="ops-kpi-band-acil">
        <OpsStripKpi
          dense
          label="Açık Dosya"
          value={opsStats?.openEmergency ?? opsStats?.urgent ?? '—'}
          color="bg-brand-600"
          icon={FolderOpen}
        />
        <OpsStripKpi
          dense
          label="Bugün Açılan"
          value={opsStats?.openedTodayEmergency ?? '—'}
          color="bg-emerald-600"
          icon={CalendarPlus}
        />
        <OpsStripKpi
          dense
          label="Toplam Satır"
          value={filteredRows.length}
          color="bg-slate-600"
          icon={FileText}
        />
      </div>
      ) : (
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8"
        data-testid="ops-kpi-band"
      >
        <OpsStripKpi
          dense
          label="Açık Dosya"
          value={opsStats?.open ?? '—'}
          color="bg-brand-600"
          icon={FolderOpen}
          active={opsPreset === 'open'}
          onClick={() => togglePreset('open')}
        />
        <OpsStripKpi
          dense
          label="Onay Bekleyen"
          value={opsStats?.approvalPending ?? '—'}
          color="bg-status-warning"
          icon={Hourglass}
          active={opsPreset === 'approval_pending'}
          onClick={() => togglePreset('approval_pending')}
        />
        <OpsStripKpi
          dense
          label="Rapor Yazılıyor"
          value={opsStats?.reportWriting ?? '—'}
          color="bg-orange-500"
          icon={FileEdit}
          active={opsPreset === 'report_writing'}
          onClick={() => togglePreset('report_writing')}
        />
        <OpsStripKpi
          dense
          label="Rapor Onayı"
          value={opsStats?.reportApproval ?? '—'}
          color="bg-amber-600"
          icon={ClipboardCheck}
          active={opsPreset === 'report_approval'}
          onClick={() => togglePreset('report_approval')}
        />
        <OpsStripKpi
          dense
          label="Finansa Aktarılacak"
          value={opsStats?.financeTransfer ?? '—'}
          color="bg-violet-600"
          icon={FolderInput}
          active={opsPreset === 'finance_transfer'}
          onClick={() => togglePreset('finance_transfer')}
        />
        <OpsStripKpi
          dense
          label="72 Saat + Risk"
          value={opsStats?.delayRisk ?? opsStats?.approval72h ?? '—'}
          color="bg-red-600"
          icon={AlertTriangle}
          active={opsPreset === 'delay_risk' || opsPreset === 'approval_72h'}
          onClick={() => togglePreset('delay_risk')}
        />
        <OpsStripKpi
          dense
          label="Bugün Açılan"
          value={opsStats?.openedToday ?? '—'}
          color="bg-emerald-600"
          icon={CalendarPlus}
          active={opsPreset === 'opened_today'}
          onClick={() => togglePreset('opened_today')}
        />
        <OpsStripKpi
          dense
          label="Acil Dosya"
          value={opsStats?.urgent ?? '—'}
          color="bg-orange-600"
          icon={FileText}
          active={opsPreset === 'urgent'}
          onClick={() => togglePreset('urgent')}
        />
      </div>
      )}

      {!isAcilListMode && opsStats && opsStats.approval72h > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex flex-wrap items-center justify-between gap-2">
          <p>
            <span className="font-semibold">{opsStats.approval72h} dosyada</span> onay 72 saati aştı — satırlar uyarı ile işaretlendi.
          </p>
          <button
            type="button"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
            onClick={() => togglePreset('approval_72h')}
          >
            72s Geçenleri Göster
          </button>
        </div>
      )}

      {claimsError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{claimsError}</div>}
      {deleteError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{deleteError}</div>}
      {!isAcilListMode && missingInsuredHasar.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">
            {missingInsuredHasar.length} hasar dosyasında sigortalı adı soyadı kayıtlı değil.
          </p>
          <p className="text-xs mt-1 text-amber-800">
            Sigortalı Adı Soyadı sütunundan doğrudan adı girip kaydedin; liste anında güncellenir.
          </p>
        </div>
      )}

      {isAcilListMode && (
        <div className="filter-bar !mb-3 !py-2.5">
          <div className="panel-filter-bar">
            <div className="panel-filter-search-wrap">
              <SearchInput
                placeholder="Dosya No, Sigortalı..."
                value={customerQuery}
                onChange={(val) => setCustomerQuery(val)}
                onClear={() => setCustomerQuery('')}
              />
            </div>
            <select
              className="panel-filter-control"
              value={filterInvoice}
              onChange={(e) => setFilterInvoice(e.target.value)}
            >
              <option value="">Tüm Faturalar</option>
              <option value="none">Fatura Yok</option>
              <option value="draft">Taslak</option>
              <option value="sent">Gönderildi</option>
              <option value="partial">Kısmi</option>
              <option value="paid">Ödendi</option>
              <option value="overdue">Gecikmiş</option>
              <option value="cancelled">İptal</option>
            </select>
            <select
              className="panel-filter-control"
              value={filterVendorPay}
              onChange={(e) => setFilterVendorPay(e.target.value as AcilVendorPayFilter)}
              data-testid="acil-odeme-filtre"
              title="Tedarikçi ödemesi"
            >
              <option value="">Tüm ödemeler</option>
              <option value="paid">Ödendi</option>
              <option value="unpaid">Ödenmedi</option>
              <option value="none">Kayıt yok</option>
            </select>
            <select
              className="panel-filter-control"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              title="Sıralama"
            >
              <option value="createdAt:desc">Yeni → Eski</option>
              <option value="createdAt:asc">Eski → Yeni</option>
              <option value="updatedAt:desc">Son Güncelleme</option>
              <option value="fileNo:asc">Dosya No A-Z</option>
            </select>
            {customerQuery.trim() || filterInvoice || filterVendorPay ? (
              <button
                type="button"
                onClick={() => {
                  setCustomerQuery('');
                  setFilterInvoice('');
                  setFilterVendorPay('');
                }}
                className="text-xs text-slate-500 hover:text-red-600 border border-slate-200 px-3 py-2 rounded-xl hover:border-red-200 transition-colors whitespace-nowrap"
              >
                Temizle ×
              </button>
            ) : null}
            <div className="w-full flex-shrink-0 sm:ml-auto sm:w-auto">
              <div className="hidden lg:block">
                <PanelTableColumnPicker tableColumns={tableColumns} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`table-container${isAcilListMode ? ' ops-queue-table' : ''}`}>
        {!isAcilListMode && (
        <div className="flex flex-col gap-2 px-4 py-2.5 border-b border-slate-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="section-heading mb-0 shrink-0">
              <span className="section-heading-bar" />
              <span className="section-heading-text">Tüm Dosyalar</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Müşteri Ara…"
                data-testid="ops-customer-search"
                className="w-full sm:w-40 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
                title="Müşteri adı veya tipine göre ara"
              />
              <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
                {(['all', 'hasar', 'acil'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => applyFilterType(t)}
                    className={`px-3 py-1.5 transition-colors ${
                      filterType === t ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'all' ? 'Hepsi' : t === 'hasar' ? 'Hasar' : 'Acil'}
                  </button>
                ))}
              </div>
              <select
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
                value={filterInvoice}
                onChange={(e) => setFilterInvoice(e.target.value)}
              >
                <option value="">Fatura: Hepsi</option>
                <option value="none">Fatura Yok</option>
                <option value="draft">Taslak</option>
                <option value="sent">Gönderildi</option>
                <option value="paid">Ödendi</option>
                <option value="overdue">Gecikmiş</option>
              </select>
              <select
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600 bg-white"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                title="Sıralama"
              >
                <option value="createdAt:desc">Yeni → Eski</option>
                <option value="createdAt:asc">Eski → Yeni</option>
                <option value="updatedAt:desc">Son Güncelleme</option>
                <option value="fileNo:asc">Dosya No A-Z</option>
                <option value="priority:desc">Öncelik</option>
              </select>
              <div className="hidden lg:block">
                <PanelTableColumnPicker tableColumns={tableColumns} />
              </div>
            </div>
          </div>

          {/* Hazır filtreler — server-side opsPreset */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_CHIPS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => togglePreset(preset)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                  opsPreset === preset
                    ? preset === 'approval_72h' || preset === 'delay_risk'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {OPERATION_PRESET_LABELS[preset]}
                {preset === 'approval_72h' && opsStats?.approval72h != null ? ` (${opsStats.approval72h})` : ''}
              </button>
            ))}
            {opsPreset && (
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-800"
                onClick={() => setOpsPreset('')}
              >
                Filtreyi Temizle
              </button>
            )}
          </div>
        </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-sm text-slate-400">
            <div className="space-y-3 animate-pulse">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-slate-200" />)}</div>
          </div>
        ) : filteredRows.length === 0 ? (
          isAcilListMode ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-600">
                {customerQuery.trim() || filterInvoice
                  ? 'Filtrelere Uyan Dosya Bulunamadı'
                  : 'Henüz Acil Yardım Dosyası Yok'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {customerQuery.trim() || filterInvoice
                  ? 'Farklı filtreler deneyin veya filtreleri temizleyin.'
                  : 'İlk dosyanızı oluşturun!'}
              </p>
              {customerQuery.trim() || filterInvoice ? (
                <button
                  type="button"
                  onClick={() => {
                    setCustomerQuery('');
                    setFilterInvoice('');
                  }}
                  className="btn-secondary mt-4"
                >
                  Filtreleri Temizle
                </button>
              ) : (
                <Link href="/panel/operasyon?filter=acil&yeni=1" className="btn-primary mt-4 inline-flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Yeni Dosya Oluştur
                </Link>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-slate-400">Henüz kayıt bulunamadı.</div>
          )
        ) : (
          <>
          {/* Mobil / tablet kart — masaüstü tablo lg+ */}
          <div className="grid gap-3 p-3 lg:hidden">
            {filteredRows.map((row) => (
              <button
                key={`${row.kind}-${row.id}`}
                type="button"
                onClick={() =>
                  router.push(
                    row.kind === 'hasar'
                      ? `/panel/hasar-dosyalari/${row.id}?grup=operasyon`
                      : `/panel/acil-yardim/${row.id}`,
                  )
                }
                className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/40 ${
                  row.approval72hExceeded
                    ? 'ops-row-approval-72h border-red-200'
                    : row.delayRisk
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.kind === 'hasar' ? (
                        <span className="badge badge-blue">Hasar</span>
                      ) : (
                        <span className="badge badge-orange">Acil</span>
                      )}
                      {row.approval72hExceeded ? (
                        <span className="ops-72s-chip">72s</span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 font-mono text-sm font-bold text-slate-900">{row.fileNo}</div>
                    <div className="mt-0.5 truncate text-xs font-medium text-slate-600">{row.customerName}</div>
                  </div>
                  {row.kind === 'hasar' ? (
                    <span className={row.statusTone}>{row.statusLabel}</span>
                  ) : (
                    <AcilDosyaDurumuBadge code={row.statusCode} label={row.statusLabel} />
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400">Sigortalı</p>
                    <p className="mt-0.5 truncate font-medium text-slate-700">{row.insuredName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Tarih</p>
                    <p className="mt-0.5 font-medium text-slate-700">{fmtDate(row.date)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Sorumlu</p>
                    <p className="mt-0.5 truncate font-medium text-slate-700">{row.assigneeName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Konu</p>
                    <p className="mt-0.5 truncate font-medium text-slate-700">{row.subject || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Beklenen Ciro</p>
                    <p className="mt-0.5 font-semibold text-slate-700">{row.expectedSales ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Tedarikçi Maliyet</p>
                    <p className="mt-0.5 font-semibold text-slate-700">{row.supplierCostTotal ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Beklenen Kar</p>
                    <p className={`mt-0.5 font-semibold ${row.expectedProfitNegative ? 'text-status-danger' : 'text-slate-700'}`}>
                      {row.expectedProfit ?? '—'}
                    </p>
                  </div>
                  {row.kind === 'acil' ? (
                    <div>
                      <p className="text-slate-400">Ödeme Durumu</p>
                      <p className="mt-0.5">
                        <span className={acilVendorPayTone(row.vendorPaid)} data-testid="acil-liste-odeme">
                          {acilVendorPayLabel(row.vendorPaid)}
                        </span>
                      </p>
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-xs" style={opsTableStyle}>
              {filterType === 'acil' ? (
                <colgroup>
                  {visibleOpsColumns.map((col) => (
                    <col
                      key={col.id}
                      style={col.flex ? undefined : { width: tableColumns.widths.getWidth(col.id) }}
                    />
                  ))}
                </colgroup>
              ) : (
                <PanelTableColGroup />
              )}
              <thead className="table-head-row">
                <tr>
                  {visibleOpsColumns.map((col) =>
                    col.id === 'actions' ? (
                      <PanelTableTh
                        key={col.id}
                        colId={col.id}
                        className={`table-th !py-2 text-xs ${COL_DIVIDER}`}
                        fitSamples={columnFitSamples[col.id]}
                      >
                        {col.label}
                      </PanelTableTh>
                    ) : (
                      <SortablePanelTableTh
                        key={col.id}
                        colId={col.id}
                        className={`table-th !py-2 text-xs ${COL_DIVIDER}`}
                        fitSamples={columnFitSamples[col.id]}
                        sortKey={col.id}
                        activeSortKey={activeSortKey}
                        sortDir={sortDir}
                        onSort={handleColumnSort}
                      >
                        {col.id === 'vendorPay' ? (
                          <span data-testid="acil-odeme-durumu-sutun">{col.label}</span>
                        ) : (
                          col.label
                        )}
                      </SortablePanelTableTh>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="table-body">
                {filteredRows.map((row) => (
                  <tr
                    key={`${row.kind}-${row.id}`}
                    title={row.approval72hExceeded ? 'Onay süresi 72 saati aştı' : undefined}
                    className={`table-row cursor-pointer ${
                      row.approval72hExceeded
                        ? 'ops-row-approval-72h'
                        : row.delayRisk
                          ? 'bg-red-50/40'
                          : ''
                    }`}
                    onClick={() =>
                      router.push(
                        row.kind === 'hasar'
                          ? `/panel/hasar-dosyalari/${row.id}?grup=operasyon`
                          : `/panel/acil-yardim/${row.id}`,
                      )
                    }
                  >
                    {visibleOpsColumns.map((col) => {
                      switch (col.id) {
                        case 'kind':
                          return (
                            <PanelTableTd key={col.id} colId="kind" className={`table-td !py-2 text-xs ${COL_DIVIDER}`}>
                              {row.kind === 'hasar' ? (
                                <span className="badge badge-blue">Hasar</span>
                              ) : (
                                <span className="badge badge-orange">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                  Acil
                                </span>
                              )}
                            </PanelTableTd>
                          );
                        case 'fileNo':
                          return (
                            <PanelTableTd key={col.id} colId="fileNo" className={`table-td !py-2 font-mono text-xs font-normal text-slate-800 ${COL_DIVIDER}`}>
                              <span className={`inline-flex flex-wrap items-center gap-1 ${clientSort?.key === 'fileNo' ? 'font-semibold text-slate-950' : ''}`}>
                                {row.fileNo}
                                {row.approval72hExceeded && (
                                  <span className="ops-72s-chip" title="72 saat onay aşıldı">72s</span>
                                )}
                              </span>
                            </PanelTableTd>
                          );
                        case 'customer':
                          return (
                            <PanelTableTd
                              key={col.id}
                              colId="customer"
                              className={`table-td !py-2 text-xs ${COL_DIVIDER}`}
                              title={row.customerTitle}
                            >
                              <div className="min-w-0 text-left" data-testid="ops-customer-cell" data-kind={row.kind}>
                                <div
                                  className={`[overflow-wrap:anywhere] ${
                                    row.customerName === OPERATION_CUSTOMER_UNDEFINED
                                      ? 'text-slate-500'
                                      : 'font-medium text-slate-800'
                                  }`}
                                  title={row.customerName}
                                >
                                  {row.customerName}
                                </div>
                                {row.customerTypeLabel ? (
                                  <div
                                    className={`mt-0.5 [overflow-wrap:anywhere] text-[10px] font-medium ${
                                      row.kind === 'hasar' ? 'text-slate-500' : 'text-slate-400'
                                    }`}
                                    title={row.customerTypeLabel}
                                  >
                                    {row.customerTypeLabel}
                                  </div>
                                ) : null}
                              </div>
                            </PanelTableTd>
                          );
                        case 'insured':
                          return (
                            <PanelTableTd key={col.id} colId="insured" className={`table-td !py-2 text-xs font-medium text-slate-700 ${COL_DIVIDER}`} title={row.insuredName}>
                              {row.kind === 'hasar' ? (
                                <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                  <InsuredNameInlineEdit
                                    claimId={row.id}
                                    displayName={row.insuredName}
                                    onSaved={(insuredName) => patchClaimInsuredName(row.id, insuredName)}
                                    expectedUpdatedAt={row.updatedAt}
                                    compact
                                  />
                                </div>
                              ) : (
                                row.insuredName
                              )}
                            </PanelTableTd>
                          );
                        case 'assignee':
                          return (
                            <PanelTableTd key={col.id} colId="assignee" className={`table-td !py-2 text-xs text-slate-600 ${COL_DIVIDER}`} title={row.assigneeName}>
                              {row.assigneeName || '—'}
                            </PanelTableTd>
                          );
                        case 'date':
                          return (
                            <PanelTableTd key={col.id} colId="date" className={`table-td !py-2 text-xs text-slate-400 ${COL_DIVIDER}`}>
                              {fmtDate(row.date)}
                            </PanelTableTd>
                          );
                        case 'subject':
                          return (
                            <PanelTableTd key={col.id} colId="subject" className={`table-td !py-2 text-xs text-slate-500 ${COL_DIVIDER}`} title={row.subject}>
                              {row.subject}
                            </PanelTableTd>
                          );
                        case 'status':
                          return (
                            <PanelTableTd key={col.id} colId="status" className={`table-td !py-2 text-xs ${COL_DIVIDER}`}>
                              {row.kind === 'hasar' ? (
                                <span className={row.statusTone}>{row.statusLabel}</span>
                              ) : (
                                <AcilDosyaDurumuBadge code={row.statusCode} label={row.statusLabel} />
                              )}
                            </PanelTableTd>
                          );
                        case 'vendorPay':
                          return (
                            <PanelTableTd key={col.id} colId="vendorPay" className={`table-td !py-2 text-xs ${COL_DIVIDER}`}>
                              {row.kind === 'acil' ? (
                                <span className={acilVendorPayTone(row.vendorPaid)} data-testid="acil-liste-odeme">
                                  {acilVendorPayLabel(row.vendorPaid)}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </PanelTableTd>
                          );
                        case 'invoice':
                          return (
                            <PanelTableTd key={col.id} colId="invoice" className={`table-td !py-2 text-xs ${COL_DIVIDER}`}>
                              <span className={INVOICE_STATUS_COLORS[row.invoiceStatus]}>
                                {INVOICE_STATUS_LABELS[row.invoiceStatus]}
                              </span>
                            </PanelTableTd>
                          );
                        case 'amount':
                          return (
                            <PanelTableTd key={col.id} colId="amount" className={`table-td !py-2 text-xs font-semibold tabular-nums ${COL_DIVIDER}`}>
                              {row.amount ?? <span className="text-slate-300">—</span>}
                            </PanelTableTd>
                          );
                        case 'reportSales':
                          return (
                            <PanelTableTd key={col.id} colId="reportSales" className={`table-td !py-2 text-xs font-semibold tabular-nums text-slate-800 ${COL_DIVIDER}`}>
                              {row.expectedSales ?? <span className="text-slate-300">—</span>}
                            </PanelTableTd>
                          );
                        case 'reportCost':
                          return (
                            <PanelTableTd key={col.id} colId="reportCost" className={`table-td !py-2 text-xs font-semibold tabular-nums text-slate-800 ${COL_DIVIDER}`}>
                              {row.supplierCostTotal ?? <span className="text-slate-300">—</span>}
                            </PanelTableTd>
                          );
                        case 'reportProfit':
                          return (
                            <PanelTableTd
                              key={col.id}
                              colId="reportProfit"
                              className={`table-td !py-2 text-xs font-semibold tabular-nums ${COL_DIVIDER} ${
                                row.expectedProfitNegative ? 'text-status-danger' : 'text-slate-800'
                              }`}
                            >
                              {row.expectedProfit ?? <span className="text-slate-300">—</span>}
                            </PanelTableTd>
                          );
                        case 'actions':
                          return (
                            <PanelTableTd key={col.id} colId="actions" wrap={false} className={`table-td !py-2 text-xs ${COL_DIVIDER}`}>
                              <OperationRowActions
                                kind={row.kind}
                                id={row.id}
                                fileNo={row.fileNo}
                                reportId={row.reportId}
                                defaultEmailTo={row.defaultEmailTo}
                                onAddNote={
                                  row.kind === 'hasar' ? () => setNoteFileId(row.id) : undefined
                                }
                                onEmailRequest={() =>
                                  setEmailTarget({
                                    claimId: row.id,
                                    fileNo: row.fileNo,
                                    reportId: row.reportId,
                                    defaultTo: row.defaultEmailTo ?? undefined,
                                  })
                                }
                                onDeleteRequest={() => {
                                  setDeleteError('');
                                  setDeleteTarget({ kind: row.kind, id: row.id, fileNo: row.fileNo });
                                }}
                              />
                            </PanelTableTd>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            {isAcilListMode
              ? `${filteredRows.length} dosya`
              : (
                <>
                  {filteredRows.length} satır &bull; Hasar toplam {claimsTotal}
                  {!opsPreset && filterType !== 'hasar' ? ` · Acil ${cases.length}` : ''}
                  {opsPreset ? ` · Filtre: ${OPERATION_PRESET_LABELS[opsPreset]}` : ''}
                </>
              )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
            >
              Önceki
            </button>
            <span className="tabular-nums">Sayfa {page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>

      <DoubleDeleteConfirm
        open={Boolean(deleteTarget)}
        fileNo={deleteTarget?.fileNo ?? ''}
        loading={deleteLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
      <OperationSendEmailModal
        target={emailTarget}
        onClose={() => setEmailTarget(null)}
      />
      <ExpertFileNoteModal
        open={Boolean(noteFileId)}
        claimFileId={noteFileId}
        fileNo={filteredRows.find((r) => r.id === noteFileId)?.fileNo}
        onClose={() => setNoteFileId(null)}
        onSaved={() => setNoteFileId(null)}
      />
      <SlidePanel
        open={showNewAcilPanel}
        onClose={() => setShowNewAcilPanel(false)}
        title="Yeni Acil Yardım Dosyası"
        width={600}
        scrollContent={false}
      >
        <EmergencyCaseNewForm
          key={acilFormSession}
          variant="panel"
          onCancel={() => setShowNewAcilPanel(false)}
          onSuccess={() => {
            setShowNewAcilPanel(false);
            void loadCases();
            setAcilCreatedNotice('Dosya oluşturuldu');
            setTimeout(() => setAcilCreatedNotice(''), 3000);
          }}
        />
      </SlidePanel>
    </div>
    </TableColumnsProvider>
  );
}

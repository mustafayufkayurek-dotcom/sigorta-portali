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
  type LucideIcon,
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
import { DoubleDeleteConfirm } from '@/components/operasyon/DoubleDeleteConfirm';
import { API, authHeader } from '@/utils/api';
import axios from 'axios';
import { SlidePanel } from '@/components/SlidePanel';
import { EmergencyCaseNewForm } from '@/components/emergency/EmergencyCaseNewForm';
import {
  BADGE_TONE_CLASS,
  OPERATION_PRESET_LABELS,
  deriveOperationStage,
  formatApprovalDelayLabel,
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
const EMERGENCY_STATUS_CLASSES: Record<string, string> = {
  GELEN:          'badge badge-gray',
  ATANDI:         'badge badge-blue',
  SAHADA:         'badge badge-orange',
  COZULDU:        'badge badge-green',
  FATURALANDILDI: 'badge badge-purple',
};

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
      invoiceStatus: string;
      amount: string | null;
      delayHours: number | null;
      assigneeName: string;
      approval72hExceeded: boolean;
      delayRisk: boolean;
      reportId: string | null;
      defaultEmailTo: string | null;
    };

function OpsStripKpi({
  label,
  value,
  color,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
}) {
  /** Operasyon KPI — yatay kart; ikon solda, rakam ve başlık sağda; eşit yükseklik */
  const body = (
    <div
      className={`group flex h-[102px] w-full min-w-0 flex-row items-center gap-3 overflow-hidden rounded-xl border bg-white px-2.5 py-2.5 shadow-md transition ${
        active
          ? 'border-blue-400 ring-2 ring-blue-200 shadow-blue-100'
          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 hover:shadow-lg'
      }`}
      data-testid="ops-kpi-card"
      data-kpi-label={label}
    >
      <span className={`inline-flex w-fit shrink-0 rounded-lg p-2 shadow-sm ${color}`}>
        <Icon className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-xl font-bold leading-none tabular-nums text-slate-950">{value}</span>
        <span className="mt-1.5 block text-[10px] font-semibold leading-snug text-slate-600 [overflow-wrap:anywhere]">
          {label}
        </span>
      </span>
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full min-w-0 text-left" data-testid={`ops-kpi-${label}`}>
        {body}
      </button>
    );
  }
  return body;
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
  { id: 'subject', label: 'Dosya Konusu', defaultWidth: 220, minWidth: 120, flex: true },
  { id: 'status', label: 'Durum', defaultWidth: 130, minWidth: 100 },
  { id: 'delayDuration', label: 'Gecikme Süresi', defaultWidth: 120, minWidth: 96 },
  { id: 'invoice', label: 'Fatura', defaultWidth: 100, minWidth: 80, defaultVisible: false },
  { id: 'amount', label: 'Tutar', defaultWidth: 96, minWidth: 80, defaultVisible: false },
  { id: 'actions', label: 'İşlemler', defaultWidth: 188, minWidth: 160 },
];

const PAGE_SIZE = 50;

const OPS_COLS_LEGACY_KEY = 'table-cols:operasyon-v7';
const OPS_COLS_BASE_KEY = 'table-cols:operasyon-v8';

function resolveOpsColumnsStorageKey(): string {
  if (typeof window === 'undefined') return OPS_COLS_BASE_KEY;
  try {
    const raw = localStorage.getItem('user') ?? '{}';
    const user = JSON.parse(raw) as { id?: string };
    const uid = typeof user?.id === 'string' && user.id.trim() ? user.id.trim() : '';
    return uid ? `${OPS_COLS_BASE_KEY}:${uid}` : OPS_COLS_BASE_KEY;
  } catch {
    return OPS_COLS_BASE_KEY;
  }
}

function migrateOpsColumnPrefs(targetKey: string) {
  if (typeof window === 'undefined') return;
  const suffixes = ['', ':order', ':widths'] as const;
  for (const suffix of suffixes) {
    const dest = `${targetKey}${suffix}`;
    if (localStorage.getItem(dest)) continue;
    const fromV7 = localStorage.getItem(`${OPS_COLS_LEGACY_KEY}${suffix}`);
    if (fromV7) {
      localStorage.setItem(dest, fromV7);
      continue;
    }
    const fromBase = localStorage.getItem(`${OPS_COLS_BASE_KEY}${suffix}`);
    if (fromBase && dest !== `${OPS_COLS_BASE_KEY}${suffix}`) {
      localStorage.setItem(dest, fromBase);
    }
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
  const [colsStorageKey, setColsStorageKey] = useState(OPS_COLS_BASE_KEY);
  const tableColumns = usePanelTableColumns(colsStorageKey, TABLE_COLUMNS);

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
  const [opsPreset, setOpsPreset] = useState<OperationPreset | ''>('');

  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'hasar' | 'acil'; id: string; fileNo: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
    const key = resolveOpsColumnsStorageKey();
    migrateOpsColumnPrefs(key);
    setColsStorageKey(key);
  }, []);

  const patchClaimInsuredName = useCallback((claimId: string, insuredName: string) => {
    setClaims((prev) => prev.map((claim) => (
      claim.id === claimId ? { ...claim, insuredName } : claim
    )));
  }, []);

  const loadClaims = useCallback(async () => {
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
  }, [page, sort, opsPreset, filterInvoice]);

  const loadStats = useCallback(async () => {
    try {
      const stats = await apiClient.get<OpsStats>('/claim-files/operation-stats');
      setOpsStats(stats);
    } catch { /* ignore */ }
  }, []);

  const loadCases = useCallback(async () => {
    if (opsPreset) {
      setCases([]);
      setCasesLoading(false);
      return;
    }
    setCasesLoading(true);
    try {
      const res = await getCases();
      setCases(res.data.slice(0, PAGE_SIZE));
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
        reportStatus: claim.latestRepairReport?.status,
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
      statusLabel: Boolean(claim.approval72hExceeded)
        ? 'Onay Talep Et'
        : (claim.operationStatusLabel ?? stage.label),
      statusTone: Boolean(claim.approval72hExceeded)
        ? 'badge badge-red'
        : (BADGE_TONE_CLASS[stage.tone as OperationStageMeta['tone']] ?? 'badge badge-blue'),
      invoiceStatus: invStatus,
      amount: claim.invoicedAmount != null ? `${Number(claim.invoicedAmount).toLocaleString('tr-TR')} ₺` : null,
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

  const acilRows: UnifiedRow[] = cases.map((c) => {
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
      invoiceStatus: c.status === 'FATURALANDILDI' ? 'paid' : 'none',
      amount: null,
      delayHours: null,
      assigneeName: '—',
      approval72hExceeded: false,
      delayRisk: false,
      reportId: null,
      defaultEmailTo: null,
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
      case 'delayDuration': return row.delayHours == null ? '' : String(row.delayHours).padStart(5, '0');
      case 'invoice': return row.invoiceStatus;
      case 'amount': return row.amount ?? '';
      default: return '';
    }
  }

  const filteredRows: UnifiedRow[] = (() => {
    const merged = filterType === 'hasar'
      ? hasarRows
      : filterType === 'acil'
        ? acilRows
        : [...hasarRows, ...acilRows];
    const q = customerQuery.trim().toLocaleLowerCase('tr');
    let rows = q
      ? merged.filter((row) => row.customerSearch.includes(q) || row.customerName.toLocaleLowerCase('tr').includes(q) || (row.customerTypeLabel ?? '').toLocaleLowerCase('tr').includes(q))
      : [...merged];
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
  const isLoading = claimsLoading || (filterType !== 'hasar' && !opsPreset && casesLoading);
  const totalPages = Math.max(1, Math.ceil(claimsTotal / PAGE_SIZE));

  const togglePreset = (preset: OperationPreset) => {
    setOpsPreset((prev) => (prev === preset ? '' : preset));
    setFilterType('hasar');
  };

  const columnFitSamples = useMemo(() => {
    const samples: Record<string, string[]> = {};
    for (const col of TABLE_COLUMNS) samples[col.id] = [col.label];
    for (const row of filteredRows) {
      samples.kind?.push(row.kind === 'hasar' ? 'Hasar' : 'Acil');
      samples.fileNo?.push(row.fileNo);
      samples.customer?.push(row.customerName);
      if (row.customerTypeLabel) samples.customer?.push(row.customerTypeLabel);
      samples.insured?.push(row.insuredName);
      samples.assignee?.push(row.assigneeName);
      samples.date?.push(fmtDate(row.date));
      samples.subject?.push(row.subject);
      samples.status?.push(row.kind === 'hasar' ? row.statusLabel : (EMERGENCY_STATUS_LABELS[row.statusCode] ?? row.statusCode));
      samples.delayDuration?.push(formatApprovalDelayLabel(row.delayHours).text);
      samples.invoice?.push(INVOICE_STATUS_LABELS[row.invoiceStatus] ?? row.invoiceStatus);
      if (row.amount) samples.amount?.push(row.amount);
      samples.actions?.push('İşlemler');
    }
    return samples;
  }, [filteredRows]);

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
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <a href="/panel" className="hover:text-brand-600 transition-colors">Dashboard</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Operasyon</span>
      </nav>

      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="page-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h1 className="page-title">Operasyon</h1>
            <p className="page-subtitle">Dosyaya girmeden: durum, kimde, risk ve gecikme süresi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/panel/operasyon/gelen-kutusu" className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Gelen Kutusu
          </Link>
          <Link href="/panel/hasar-dosyalari?yeni=1" className="btn-primary shadow-sm shadow-blue-200/60">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Yeni Hasar Dosyası
          </Link>
          <Link href="/panel/operasyon?filter=acil&yeni=1" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Yeni Acil Dosyası
          </Link>
          {acilCreatedNotice ? (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
              {acilCreatedNotice}
            </span>
          ) : null}
        </div>
      </div>

      {/* Operasyon KPI — dikey kartlar; 1440’te tek satır taşma/kesilme yok */}
      <div
        className="grid grid-cols-4 gap-3 xl:grid-cols-8"
        data-testid="ops-kpi-band"
      >
        <OpsStripKpi
          label="Açık Dosya"
          value={opsStats?.open ?? '—'}
          color="bg-brand-600"
          icon={FolderOpen}
          active={opsPreset === 'open'}
          onClick={() => togglePreset('open')}
        />
        <OpsStripKpi
          label="Onay Bekleyen"
          value={opsStats?.approvalPending ?? '—'}
          color="bg-status-warning"
          icon={Hourglass}
          active={opsPreset === 'approval_pending'}
          onClick={() => togglePreset('approval_pending')}
        />
        <OpsStripKpi
          label="Rapor Yazılıyor"
          value={opsStats?.reportWriting ?? '—'}
          color="bg-orange-500"
          icon={FileEdit}
          active={opsPreset === 'report_writing'}
          onClick={() => togglePreset('report_writing')}
        />
        <OpsStripKpi
          label="Rapor Onayı"
          value={opsStats?.reportApproval ?? '—'}
          color="bg-amber-600"
          icon={ClipboardCheck}
          active={opsPreset === 'report_approval'}
          onClick={() => togglePreset('report_approval')}
        />
        <OpsStripKpi
          label="Finansa Aktarılacak"
          value={opsStats?.financeTransfer ?? '—'}
          color="bg-violet-600"
          icon={FolderInput}
          active={opsPreset === 'finance_transfer'}
          onClick={() => togglePreset('finance_transfer')}
        />
        <OpsStripKpi
          label="72 Saat + Risk"
          value={opsStats?.delayRisk ?? opsStats?.approval72h ?? '—'}
          color="bg-red-600"
          icon={AlertTriangle}
          active={opsPreset === 'delay_risk' || opsPreset === 'approval_72h'}
          onClick={() => togglePreset('delay_risk')}
        />
        <OpsStripKpi
          label="Bugün Açılan"
          value={opsStats?.openedToday ?? '—'}
          color="bg-emerald-600"
          icon={CalendarPlus}
          active={opsPreset === 'opened_today'}
          onClick={() => togglePreset('opened_today')}
        />
        <OpsStripKpi
          label="Acil Dosya"
          value={opsStats?.urgent ?? '—'}
          color="bg-orange-600"
          icon={FileText}
          active={opsPreset === 'urgent'}
          onClick={() => togglePreset('urgent')}
        />
      </div>

      {opsStats && opsStats.approval72h > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex flex-wrap items-center justify-between gap-2">
          <p>
            <span className="font-semibold">{opsStats.approval72h} dosyada</span> onay 72 saati aştı — <span className="font-semibold">Onay Talep Et</span> aksiyonu gerekli.
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
      {missingInsuredHasar.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">
            {missingInsuredHasar.length} hasar dosyasında sigortalı adı soyadı kayıtlı değil.
          </p>
          <p className="text-xs mt-1 text-amber-800">
            Sigortalı Adı Soyadı sütunundan doğrudan adı girip kaydedin; liste anında güncellenir.
          </p>
        </div>
      )}

      <div className="table-container">
        <div className="flex flex-col gap-2 px-4 py-2.5 border-b border-slate-100">
          <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto">
            <div className="section-heading mb-0 shrink-0">
              <span className="section-heading-bar" />
              <span className="section-heading-text">Tüm Dosyalar</span>
            </div>
            <div className="flex flex-nowrap items-center gap-2 shrink-0">
              <input
                type="search"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Müşteri Ara…"
                data-testid="ops-customer-search"
                className="w-40 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
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
              <PanelTableColumnPicker tableColumns={tableColumns} />
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

        {isLoading ? (
          <div className="py-16 text-center text-sm text-slate-400">
            <div className="space-y-3 animate-pulse">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-slate-200" />)}</div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">Henüz kayıt bulunamadı.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={panelTableLayoutStyle(tableColumns)}>
              <PanelTableColGroup />
              <thead className="table-head-row">
                <tr>
                  {tableColumns.prefs.orderedVisibleColumns.map((col) =>
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
                        {col.label}
                      </SortablePanelTableTh>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="table-body">
                {filteredRows.map((row) => (
                  <tr
                    key={`${row.kind}-${row.id}`}
                    className={`table-row cursor-pointer ${row.approval72hExceeded || row.delayRisk ? 'bg-red-50/40' : ''}`}
                    onClick={() =>
                      router.push(
                        row.kind === 'hasar'
                          ? `/panel/hasar-dosyalari/${row.id}?grup=operasyon`
                          : `/panel/acil-yardim/${row.id}`,
                      )
                    }
                  >
                    {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                      switch (col.id) {
                        case 'kind':
                          return (
                            <PanelTableTd key={col.id} colId="kind" className={`table-td !py-2 text-xs whitespace-nowrap ${COL_DIVIDER}`}>
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
                            <PanelTableTd key={col.id} colId="fileNo" className={`table-td !py-2 font-mono text-xs font-normal text-slate-800 whitespace-nowrap ${COL_DIVIDER}`}>
                              <span className={`inline-flex items-center gap-1 ${clientSort?.key === 'fileNo' ? 'font-semibold text-slate-950' : ''}`}>
                                {row.fileNo}
                                {row.approval72hExceeded && (
                                  <span className="badge badge-red" title="72 saat onay aşıldı">72s</span>
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
                                  className={`truncate ${
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
                                    className={`mt-0.5 truncate text-[10px] font-medium ${
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
                            <PanelTableTd key={col.id} colId="insured" className={`table-td !py-2 text-xs whitespace-nowrap font-medium text-slate-700 ${COL_DIVIDER}`} title={row.insuredName}>
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
                            <PanelTableTd key={col.id} colId="assignee" className={`table-td !py-2 text-xs whitespace-nowrap text-slate-600 ${COL_DIVIDER}`} title={row.assigneeName}>
                              {row.assigneeName || '—'}
                            </PanelTableTd>
                          );
                        case 'date':
                          return (
                            <PanelTableTd key={col.id} colId="date" className={`table-td !py-2 text-xs text-slate-400 whitespace-nowrap ${COL_DIVIDER}`}>
                              {fmtDate(row.date)}
                            </PanelTableTd>
                          );
                        case 'subject':
                          return (
                            <PanelTableTd key={col.id} colId="subject" className={`table-td !py-2 text-xs text-slate-500 whitespace-nowrap ${COL_DIVIDER}`} title={row.subject}>
                              {row.subject}
                            </PanelTableTd>
                          );
                        case 'status':
                          return (
                            <PanelTableTd key={col.id} colId="status" className={`table-td !py-2 text-xs whitespace-nowrap ${COL_DIVIDER}`}>
                              {row.kind === 'hasar' ? (
                                <span className={row.statusTone}>{row.statusLabel}</span>
                              ) : (
                                <span className={EMERGENCY_STATUS_CLASSES[row.statusCode] ?? 'badge badge-gray'}>
                                  {EMERGENCY_STATUS_LABELS[row.statusCode] ?? row.statusCode}
                                </span>
                              )}
                            </PanelTableTd>
                          );
                        case 'delayDuration': {
                          const delay = formatApprovalDelayLabel(
                            row.approval72hExceeded && (row.delayHours == null || row.delayHours < 72)
                              ? 72
                              : row.delayHours,
                          );
                          return (
                            <PanelTableTd key={col.id} colId="delayDuration" className={`table-td !py-2 text-xs whitespace-nowrap ${COL_DIVIDER}`}>
                              <span
                                className={
                                  delay.level === 'over96'
                                    ? 'font-semibold text-red-800'
                                    : delay.level === 'over72'
                                      ? 'font-semibold text-red-700'
                                      : delay.level === 'normal'
                                        ? 'text-slate-700'
                                        : 'text-slate-400'
                                }
                                data-testid="ops-delay-duration"
                              >
                                {delay.text}
                                {delay.suffix ? ` ${delay.suffix}` : ''}
                              </span>
                            </PanelTableTd>
                          );
                        }
                        case 'invoice':
                          return (
                            <PanelTableTd key={col.id} colId="invoice" className={`table-td !py-2 text-xs whitespace-nowrap ${COL_DIVIDER}`}>
                              <span className={INVOICE_STATUS_COLORS[row.invoiceStatus]}>
                                {INVOICE_STATUS_LABELS[row.invoiceStatus]}
                              </span>
                            </PanelTableTd>
                          );
                        case 'amount':
                          return (
                            <PanelTableTd key={col.id} colId="amount" className={`table-td !py-2 text-xs whitespace-nowrap font-semibold tabular-nums ${COL_DIVIDER}`}>
                              {row.amount ?? <span className="text-slate-300">—</span>}
                            </PanelTableTd>
                          );
                        case 'actions':
                          return (
                            <PanelTableTd key={col.id} colId="actions" className={`table-td !py-2 text-xs whitespace-nowrap ${COL_DIVIDER}`}>
                              <OperationRowActions
                                kind={row.kind}
                                id={row.id}
                                fileNo={row.fileNo}
                                reportId={row.reportId}
                                defaultEmailTo={row.defaultEmailTo}
                                approval72hExceeded={row.approval72hExceeded}
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
        )}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            {filteredRows.length} satır &bull; Hasar toplam {claimsTotal}
            {!opsPreset && filterType !== 'hasar' ? ` · Acil ${cases.length}` : ''}
            {opsPreset ? ` · Filtre: ${OPERATION_PRESET_LABELS[opsPreset]}` : ''}
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

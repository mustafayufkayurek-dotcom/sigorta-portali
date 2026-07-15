'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCases, EmergencyCase } from '@/utils/emergencyApi';
import { apiClient } from '@/lib/api-client';
import {
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableTh,
  PanelTableColGroup,
  TableColumnsProvider,
  usePanelTableColumns,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { fmtDate } from '@/utils/date-helpers';
import { resolveClaimDosyaKonusu, toTitleCaseTR } from '@/utils/text-helpers';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';
import { InsuredNameInlineEdit } from '@/components/claim-files/InsuredNameInlineEdit';
import { OperationRowActions } from '@/components/operasyon/OperationRowActions';
import { DoubleDeleteConfirm } from '@/components/operasyon/DoubleDeleteConfirm';
import { API, authHeader } from '@/utils/api';
import axios from 'axios';
import {
  BADGE_TONE_CLASS,
  OPERATION_PRESET_LABELS,
  deriveOperationStage,
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
  GELEN: 'Gelen',
  ATANDI: 'Atandı',
  SAHADA: 'Sahada',
  COZULDU: 'Çözüldü',
  FATURALANDILDI: 'Faturalandı',
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
      insuredName: string;
      date: string;
      subject: string;
      statusLabel: string;
      statusTone: string;
      invoiceStatus: string;
      amount: string | null;
      nextAction: string;
      assigneeName: string;
      approval72hExceeded: boolean;
      delayRisk: boolean;
      updatedAt?: string | null;
      priority?: string | null;
    }
  | {
      kind: 'acil';
      id: string;
      fileNo: string;
      customerName: string;
      insuredName: string;
      date: string;
      subject: string;
      statusCode: string;
      invoiceStatus: string;
      amount: string | null;
      nextAction: string;
      assigneeName: string;
      approval72hExceeded: boolean;
      delayRisk: boolean;
    };

function StatCard({
  label,
  value,
  accentClass,
  iconBg,
  icon,
  href,
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  accentClass?: string;
  iconBg?: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
    <div
      className={`flex flex-col items-center justify-center text-center gap-1 bg-white rounded-xl border shadow-card px-3 py-2 ${accentClass ?? 'card-accent-blue'} ${
        active ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200/70'
      }`}
    >
      {icon && (
        <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${iconBg ?? 'bg-blue-50'}`}>
          {icon}
        </div>
      )}
      <div className="flex flex-col items-center min-w-0 w-full">
        <p className="text-[10px] font-medium text-slate-400 tracking-wide leading-tight">{label}</p>
        <span className="text-base font-bold text-slate-900 leading-none tabular-nums mt-0.5">{value}</span>
      </div>
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {content}
      </button>
    );
  }
  if (href) return <Link href={href} className="block">{content}</Link>;
  return content;
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
  { id: 'customer', label: 'Sigorta Şirketi', defaultWidth: 130, minWidth: 100 },
  { id: 'insured', label: 'Sigortalı Adı Soyadı', defaultWidth: 150, minWidth: 120 },
  { id: 'assignee', label: 'Kimde', defaultWidth: 120, minWidth: 88 },
  { id: 'date', label: 'Tarih', defaultWidth: 96, minWidth: 80, defaultVisible: false },
  { id: 'subject', label: 'Dosya Konusu', defaultWidth: 220, minWidth: 120, flex: true },
  { id: 'status', label: 'Durum', defaultWidth: 130, minWidth: 100 },
  { id: 'nextAction', label: 'Sonraki Aksiyon', defaultWidth: 140, minWidth: 100 },
  { id: 'invoice', label: 'Fatura', defaultWidth: 100, minWidth: 80, defaultVisible: false },
  { id: 'amount', label: 'Tutar', defaultWidth: 96, minWidth: 80, defaultVisible: false },
  { id: 'actions', label: 'İşlemler', defaultWidth: 220, minWidth: 180 },
];

const PAGE_SIZE = 50;

type OpsStats = {
  open: number;
  urgent: number;
  openedToday: number;
  approvalPending: number;
  reportWriting: number;
  financeTransfer: number;
  delayRisk: number;
  approval72h: number;
};

export default function OperasyonPage() {
  const router = useRouter();
  const tableColumns = usePanelTableColumns('table-cols:operasyon-v5', TABLE_COLUMNS);

  const [dosyaKonusuCatalog, setDosyaKonusuCatalog] = useState<string[]>([]);

  const [claims, setClaims] = useState<any[]>([]);
  const [claimsTotal, setClaimsTotal] = useState(0);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claimsError, setClaimsError] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('createdAt:desc');

  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);

  const [inboxPendingCount, setInboxPendingCount] = useState<number | null>(null);
  const [opsStats, setOpsStats] = useState<OpsStats | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'hasar' | 'acil'>('all');
  const [filterInvoice, setFilterInvoice] = useState('');
  const [opsPreset, setOpsPreset] = useState<OperationPreset | ''>('');

  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'hasar' | 'acil'; id: string; fileNo: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      const [statsRes, inboxRes] = await Promise.allSettled([
        apiClient.get<OpsStats>('/claim-files/operation-stats'),
        apiClient.get<{ pending?: number; unownedCount?: number }>('/operation-inbox/stats'),
      ]);
      if (statsRes.status === 'fulfilled') setOpsStats(statsRes.value);
      if (inboxRes.status === 'fulfilled') {
        const inbox = inboxRes.value;
        setInboxPendingCount(inbox.unownedCount ?? inbox.pending ?? 0);
      }
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

  const emergencyOpenCount = cases.filter((c) => c.status !== 'FATURALANDILDI').length;

  const hasarRows: UnifiedRow[] = claims.map((claim) => {
    const invStatus = deriveInvoiceStatus(claim.invoices ?? []);
    const customerName = claim.insuranceCompany?.name ?? claim.customer?.fullName ?? claim.customer?.companyName ?? '—';
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
      customerName,
      insuredName: resolveHasarInsuredName(claim),
      date: resolveClaimDisplayDate(claim),
      subject,
      statusLabel: claim.operationStatusLabel ?? stage.label,
      statusTone: BADGE_TONE_CLASS[stage.tone as OperationStageMeta['tone']] ?? 'badge badge-blue',
      invoiceStatus: invStatus,
      amount: claim.invoicedAmount != null ? `${Number(claim.invoicedAmount).toLocaleString('tr-TR')} ₺` : null,
      nextAction: claim.nextAction ?? stage.nextAction,
      assigneeName: claim.assigneeName ?? '—',
      approval72hExceeded: Boolean(claim.approval72hExceeded),
      delayRisk: Boolean(claim.delayRisk),
      updatedAt: claim.updatedAt ?? null,
      priority: claim.priority ?? null,
    };
  });

  const acilRows: UnifiedRow[] = cases.map((c) => ({
    kind: 'acil' as const,
    id: c.id,
    fileNo: c.caseNo,
    customerName: '—',
    insuredName: c.customerName ? toTitleCaseTR(c.customerName) : '—',
    date: c.createdAt,
    subject: resolveClaimDosyaKonusu({ lossType: c.issueType }, dosyaKonusuCatalog),
    statusCode: c.status,
    invoiceStatus: c.status === 'FATURALANDILDI' ? 'paid' : 'none',
    amount: null,
    nextAction: c.status === 'GELEN' ? 'Ata / değerlendir' : c.status === 'ATANDI' ? 'Sahaya git' : 'Takip et',
    assigneeName: '—',
    approval72hExceeded: false,
    delayRisk: false,
  }));

  const filteredRows: UnifiedRow[] = (() => {
    const merged = filterType === 'hasar'
      ? hasarRows
      : filterType === 'acil'
        ? acilRows
        : [...hasarRows, ...acilRows];
    return [...merged].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  })();

  const columnFitSamples = useMemo(() => {
    const samples: Record<string, string[]> = {};
    for (const col of TABLE_COLUMNS) samples[col.id] = [col.label];
    for (const row of filteredRows) {
      samples.kind?.push(row.kind === 'hasar' ? 'Hasar' : 'Acil');
      samples.fileNo?.push(row.fileNo);
      samples.customer?.push(row.customerName);
      samples.insured?.push(row.insuredName);
      samples.assignee?.push(row.assigneeName);
      samples.date?.push(fmtDate(row.date));
      samples.subject?.push(row.subject);
      samples.status?.push(row.kind === 'hasar' ? row.statusLabel : (EMERGENCY_STATUS_LABELS[row.statusCode] ?? row.statusCode));
      samples.nextAction?.push(row.nextAction);
      samples.invoice?.push(INVOICE_STATUS_LABELS[row.invoiceStatus] ?? row.invoiceStatus);
      if (row.amount) samples.amount?.push(row.amount);
      samples.actions?.push('İşlemler');
    }
    return samples;
  }, [filteredRows]);

  const missingInsuredHasar = hasarRows.filter((row) => row.insuredName === '—');
  const isLoading = claimsLoading || (filterType !== 'hasar' && !opsPreset && casesLoading);
  const totalPages = Math.max(1, Math.ceil(claimsTotal / PAGE_SIZE));

  const togglePreset = (preset: OperationPreset) => {
    setOpsPreset((prev) => (prev === preset ? '' : preset));
    setFilterType('hasar');
  };

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
      await loadClaims();
      await loadStats();
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
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
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
            <p className="page-subtitle">Dosyaya girmeden: durum, kimde, risk ve sonraki aksiyon</p>
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
          <Link href="/panel/acil-yardim?yeni=1" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Yeni Acil Dosyası
          </Link>
        </div>
      </div>

      {/* Operasyon KPI — ciro/kâr yok */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <StatCard
          label="Gelen Kutu"
          value={inboxPendingCount ?? '—'}
          accentClass="card-accent-purple"
          iconBg="bg-violet-50"
          icon={<svg className="w-3.5 h-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
          href="/panel/operasyon/gelen-kutusu"
        />
        <StatCard
          label="Açık"
          value={opsStats?.open ?? '—'}
          accentClass="card-accent-blue"
          iconBg="bg-blue-50"
          icon={<svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          active={opsPreset === 'open'}
          onClick={() => togglePreset('open')}
        />
        <StatCard
          label="Acil"
          value={opsStats?.urgent ?? emergencyOpenCount}
          accentClass="card-accent-amber"
          iconBg="bg-amber-50"
          icon={<svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
          active={opsPreset === 'urgent'}
          onClick={() => togglePreset('urgent')}
        />
        <StatCard
          label="Bugün"
          value={opsStats?.openedToday ?? '—'}
          accentClass="card-accent-green"
          iconBg="bg-emerald-50"
          icon={<svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          active={opsPreset === 'opened_today'}
          onClick={() => togglePreset('opened_today')}
        />
        <StatCard
          label="Onay Bekleyen"
          value={opsStats?.approvalPending ?? '—'}
          accentClass="card-accent-amber"
          iconBg="bg-amber-50"
          icon={<svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          active={opsPreset === 'approval_pending'}
          onClick={() => togglePreset('approval_pending')}
        />
        <StatCard
          label="Rapor Bekleyen"
          value={opsStats?.reportWriting ?? '—'}
          accentClass="card-accent-amber"
          iconBg="bg-orange-50"
          icon={<svg className="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          active={opsPreset === 'report_writing'}
          onClick={() => togglePreset('report_writing')}
        />
        <StatCard
          label="Finansa Aktarılacak"
          value={opsStats?.financeTransfer ?? '—'}
          accentClass="card-accent-purple"
          iconBg="bg-violet-50"
          icon={<svg className="w-3.5 h-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          active={opsPreset === 'finance_transfer'}
          onClick={() => togglePreset('finance_transfer')}
        />
        <StatCard
          label="Gecikme Riski"
          value={opsStats?.delayRisk ?? opsStats?.approval72h ?? '—'}
          accentClass="card-accent-red"
          iconBg="bg-red-50"
          icon={<svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
          active={opsPreset === 'delay_risk' || opsPreset === 'approval_72h'}
          onClick={() => togglePreset('delay_risk')}
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
              <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
                {(['all', 'hasar', 'acil'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 transition-colors ${
                      filterType === t ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
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
                      : 'bg-blue-600 text-white border-blue-600'
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
                  {tableColumns.prefs.orderedVisibleColumns.map((col) => (
                    <PanelTableTh
                      key={col.id}
                      colId={col.id}
                      className="table-th !py-2.5 text-xs"
                      fitSamples={columnFitSamples[col.id]}
                    >
                      {col.label}
                    </PanelTableTh>
                  ))}
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
                          ? `/panel/hasar-dosyalari/${row.id}`
                          : `/panel/acil-yardim/${row.id}`,
                      )
                    }
                  >
                    {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                      switch (col.id) {
                        case 'kind':
                          return (
                            <PanelTableTd key={col.id} colId="kind" className="table-td !py-2 text-xs whitespace-nowrap">
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
                            <PanelTableTd key={col.id} colId="fileNo" className="table-td !py-2 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                {row.fileNo}
                                {row.approval72hExceeded && (
                                  <span className="badge badge-red" title="72 saat onay aşıldı">72s</span>
                                )}
                              </span>
                            </PanelTableTd>
                          );
                        case 'customer':
                          return (
                            <PanelTableTd key={col.id} colId="customer" className="table-td !py-2 text-xs whitespace-nowrap" title={row.customerName}>
                              {row.customerName}
                            </PanelTableTd>
                          );
                        case 'insured':
                          return (
                            <PanelTableTd key={col.id} colId="insured" className="table-td !py-2 text-xs whitespace-nowrap font-medium text-slate-700" title={row.insuredName}>
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
                            <PanelTableTd key={col.id} colId="assignee" className="table-td !py-2 text-xs whitespace-nowrap text-slate-600" title={row.assigneeName}>
                              {row.assigneeName || '—'}
                            </PanelTableTd>
                          );
                        case 'date':
                          return (
                            <PanelTableTd key={col.id} colId="date" className="table-td !py-2 text-xs text-slate-400 whitespace-nowrap">
                              {fmtDate(row.date)}
                            </PanelTableTd>
                          );
                        case 'subject':
                          return (
                            <PanelTableTd key={col.id} colId="subject" className="table-td !py-2 text-xs text-slate-500 whitespace-nowrap" title={row.subject}>
                              {row.subject}
                            </PanelTableTd>
                          );
                        case 'status':
                          return (
                            <PanelTableTd key={col.id} colId="status" className="table-td !py-2 text-xs whitespace-nowrap">
                              {row.kind === 'hasar' ? (
                                <span className={row.statusTone}>{row.statusLabel}</span>
                              ) : (
                                <span className={EMERGENCY_STATUS_CLASSES[row.statusCode] ?? 'badge badge-gray'}>
                                  {EMERGENCY_STATUS_LABELS[row.statusCode] ?? row.statusCode}
                                </span>
                              )}
                            </PanelTableTd>
                          );
                        case 'nextAction':
                          return (
                            <PanelTableTd key={col.id} colId="nextAction" className="table-td !py-2 text-xs whitespace-nowrap">
                              <span className={row.approval72hExceeded ? 'font-semibold text-red-700' : 'text-slate-600'}>
                                {row.nextAction}
                              </span>
                            </PanelTableTd>
                          );
                        case 'invoice':
                          return (
                            <PanelTableTd key={col.id} colId="invoice" className="table-td !py-2 text-xs whitespace-nowrap">
                              <span className={INVOICE_STATUS_COLORS[row.invoiceStatus]}>
                                {INVOICE_STATUS_LABELS[row.invoiceStatus]}
                              </span>
                            </PanelTableTd>
                          );
                        case 'amount':
                          return (
                            <PanelTableTd key={col.id} colId="amount" className="table-td !py-2 text-xs whitespace-nowrap font-semibold tabular-nums">
                              {row.amount ?? <span className="text-slate-300">—</span>}
                            </PanelTableTd>
                          );
                        case 'actions':
                          return (
                            <PanelTableTd key={col.id} colId="actions" className="table-td !py-2 text-xs whitespace-nowrap">
                              <OperationRowActions
                                kind={row.kind}
                                id={row.id}
                                fileNo={row.fileNo}
                                approval72hExceeded={row.approval72hExceeded}
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
    </div>
    </TableColumnsProvider>
  );
}

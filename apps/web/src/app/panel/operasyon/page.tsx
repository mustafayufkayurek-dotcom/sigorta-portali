'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCases, EmergencyCase } from '@/utils/emergencyApi';
import { apiClient } from '@/lib/api-client';
import {
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableTh,
  TableColumnsProvider,
  usePanelTableColumns,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { fmtDate } from '@/utils/date-helpers';
import { formatDisplayLabel, resolveClaimIhbarKonusu, toTitleCaseTR } from '@/utils/text-helpers';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';
import { InsuredNameInlineEdit } from '@/components/claim-files/InsuredNameInlineEdit';

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

// ─── Unified row type ──────────────────────────────────────────────────────────

type UnifiedRow =
  | { kind: 'hasar'; id: string; fileNo: string; customerName: string; insuredName: string; date: string; subject: string; statusLabel: string; invoiceStatus: string; amount: string | null }
  | { kind: 'acil'; id: string; fileNo: string; customerName: string; insuredName: string; date: string; subject: string; statusCode: string; invoiceStatus: string; amount: string | null };

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  badge,
  accentClass,
  iconBg,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  badge?: string;
  accentClass?: string;
  iconBg?: string;
  icon?: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className={`flex items-center gap-2.5 bg-white rounded-2xl border border-slate-200/70 shadow-card px-4 py-3 ${accentClass ?? 'card-accent-blue'}`}>
      {icon && (
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${iconBg ?? 'bg-blue-50'}`}>
          {icon}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <p className="text-[11px] font-medium text-slate-400 tracking-wide leading-none truncate">{label}</p>
        <span className="text-lg font-bold text-slate-900 leading-tight tabular-nums">{value}</span>
        {badge && (
          <span className="badge badge-blue self-start mt-0.5">{badge}</span>
        )}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block">{content}</Link>;
  return content;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'kind', label: 'Tür', defaultWidth: 88, minWidth: 72 },
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 120, minWidth: 88 },
  { id: 'customer', label: 'Sigorta Şirketi', defaultWidth: 140, minWidth: 100 },
  { id: 'insured', label: 'Sigortalı Adı Soyadı', defaultWidth: 160, minWidth: 120 },
  { id: 'date', label: 'Tarih', defaultWidth: 100, minWidth: 88 },
  { id: 'subject', label: 'İhbar Konusu', defaultWidth: 160, minWidth: 100 },
  { id: 'status', label: 'Durum', defaultWidth: 120, minWidth: 96 },
  { id: 'invoice', label: 'Fatura', defaultWidth: 110, minWidth: 88 },
  { id: 'amount', label: 'Tutar', defaultWidth: 100, minWidth: 88 },
];

export default function OperasyonPage() {
  const router = useRouter();
  const tableColumns = usePanelTableColumns('table-cols:operasyon-v2', TABLE_COLUMNS);

  const [claims, setClaims] = useState<any[]>([]);
  const [claimsTotal, setClaimsTotal] = useState(0);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claimsError, setClaimsError] = useState('');

  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);

  const [openCount, setOpenCount] = useState<number | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [overdueCount, setOverdueCount] = useState<number | null>(null);
  const [invoicePendingCount, setInvoicePendingCount] = useState<number | null>(null);
  const [inboxPendingCount, setInboxPendingCount] = useState<number | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'hasar' | 'acil'>('all');
  const [filterInvoice, setFilterInvoice] = useState('');

  const patchClaimInsuredName = useCallback((claimId: string, insuredName: string) => {
    setClaims((prev) => prev.map((claim) => (
      claim.id === claimId ? { ...claim, insuredName } : claim
    )));
  }, []);

  const loadClaims = useCallback(async () => {
    setClaimsLoading(true);
    setClaimsError('');
    try {
      const response = await apiClient.getWithMeta<any[], { total?: number }>('/claim-files', { limit: 50, sort: 'createdAt:desc' });
      setClaims(response.data ?? []);
      setClaimsTotal(response.meta?.total ?? response.data?.length ?? 0);
    } catch { setClaimsError('Veriler yüklenemedi'); }
    finally { setClaimsLoading(false); }
  }, []);

  const loadStats = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const [openRes, todayRes, overdueRes, invoiceRes, inboxRes] = await Promise.allSettled([
        apiClient.getWithMeta<any[], { total?: number }>('/claim-files', { limit: 1, statusCode: 'open' }),
        apiClient.getWithMeta<any[], { total?: number }>('/claim-files', { limit: 1, dateFrom: today, dateTo: today }),
        apiClient.getWithMeta<any[], { total?: number }>('/claim-files', { limit: 1, slaExceeded: true }),
        apiClient.getWithMeta<any[], { total?: number }>('/claim-files', { limit: 1, invoiceStatus: 'none' }),
        apiClient.get<{ pending?: number; unownedCount?: number }>('/operation-inbox/stats'),
      ]);
      if (openRes.status === 'fulfilled') setOpenCount(openRes.value.meta?.total ?? openRes.value.data?.length ?? 0);
      if (todayRes.status === 'fulfilled') setTodayCount(todayRes.value.meta?.total ?? todayRes.value.data?.length ?? 0);
      if (overdueRes.status === 'fulfilled') setOverdueCount(overdueRes.value.meta?.total ?? overdueRes.value.data?.length ?? 0);
      if (invoiceRes.status === 'fulfilled') setInvoicePendingCount(invoiceRes.value.meta?.total ?? invoiceRes.value.data?.length ?? 0);
      if (inboxRes.status === 'fulfilled') {
        const inbox = inboxRes.value;
        setInboxPendingCount(inbox.unownedCount ?? inbox.pending ?? 0);
      }
    } catch { /* ignore */ }
  }, []);

  const loadCases = useCallback(async () => {
    setCasesLoading(true);
    try {
      const res = await getCases();
      setCases(res.data.slice(0, 50));
    } catch { /* ignore */ }
    finally { setCasesLoading(false); }
  }, []);

  useEffect(() => {
    loadClaims();
    loadCases();
    loadStats();
  }, [loadClaims, loadCases, loadStats]);

  const emergencyOpenCount = cases.filter((c) => c.status !== 'FATURALANDILDI').length;

  const hasarRows: UnifiedRow[] = claims.map((claim) => {
    const invStatus = deriveInvoiceStatus(claim.invoices ?? []);
    const customerName = claim.insuranceCompany?.name ?? claim.customer?.fullName ?? claim.customer?.companyName ?? '—';
    const subject = resolveClaimIhbarKonusu(claim);
    return {
      kind: 'hasar', id: claim.id,
      fileNo: claim.fileNo ?? claim.claimNo ?? '—',
      customerName, insuredName: resolveHasarInsuredName(claim),
      date: claim.createdAt, subject,
      statusLabel: claim.currentStatus?.name ?? 'N/A',
      invoiceStatus: invStatus,
      amount: claim.totalAmount != null ? `${Number(claim.totalAmount).toLocaleString('tr-TR')} ₺` : null,
    };
  });

  const acilRows: UnifiedRow[] = cases.map((c) => ({
    kind: 'acil', id: c.id, fileNo: c.caseNo,
    customerName: '—',
    insuredName: c.customerName ? toTitleCaseTR(c.customerName) : '—',
    date: c.createdAt, subject: formatDisplayLabel(c.issueType ?? c.notes),
    statusCode: c.status,
    invoiceStatus: c.status === 'FATURALANDILDI' ? 'paid' : 'none',
    amount: null,
  }));

  const allRows: UnifiedRow[] = [...hasarRows, ...acilRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const filteredRows = allRows.filter((row) => {
    if (filterType !== 'all' && row.kind !== filterType) return false;
    if (filterInvoice && row.invoiceStatus !== filterInvoice) return false;
    return true;
  });

  const missingInsuredHasar = hasarRows.filter((row) => row.insuredName === '—');

  const isLoading = claimsLoading || casesLoading;

  return (
    <TableColumnsProvider value={tableColumns}>
    <div className="space-y-6">
      {/* Header */}
            {/* Breadcrumb */}
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
            <p className="page-subtitle">Tüm operasyonun kuş bakışı özeti</p>
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

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Gelen Kutu (Bekleyen)"
          value={inboxPendingCount ?? '—'}
          accentClass="card-accent-purple"
          iconBg="bg-violet-50"
          icon={<svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
          href="/panel/operasyon/gelen-kutusu"
        />
        <StatCard
          label="Açık Hasar Dosyası"
          value={openCount ?? claimsTotal}
          accentClass="card-accent-blue"
          iconBg="bg-blue-50"
          icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          href="/panel/hasar-dosyalari?status=open"
        />
        <StatCard
          label="Acil Yardım (Aktif)"
          value={emergencyOpenCount}
          accentClass="card-accent-amber"
          iconBg="bg-amber-50"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
          href="/panel/acil-yardim"
        />
        <StatCard
          label="Bugün Açılan"
          value={todayCount ?? '—'}
          accentClass="card-accent-green"
          iconBg="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          href="/panel/hasar-dosyalari"
        />
        <StatCard
          label="Fatura Bekleyen"
          value={invoicePendingCount ?? '—'}
          accentClass="card-accent-amber"
          iconBg="bg-amber-50"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2 2 4-4M7 7h10a2 2 0 012 2v9a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z" /></svg>}
          href="/panel/hasar-dosyalari?invoiceStatus=none"
        />
        <StatCard
          label="Gecikmiş Dosya"
          value={overdueCount ?? '—'}
          accentClass="card-accent-red"
          iconBg="bg-red-50"
          icon={<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          href="/panel/hasar-dosyalari?status=sla_exceeded"
        />
      </div>

      {/* Birleşik Tablo */}
      {claimsError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{claimsError}</div>}
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
        {/* Tablo başlık + filtreler */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="section-heading mb-0">
            <span className="section-heading-bar" />
            <span className="section-heading-text">Tüm Dosyalar</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Tür filtresi */}
            <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden text-xs font-medium">
              {(['all', 'hasar', 'acil'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 transition-colors ${
                    filterType === t
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t === 'all' ? 'Hepsi' : t === 'hasar' ? 'Hasar' : 'Acil'}
                </button>
              ))}
            </div>

            {/* Fatura durumu filtresi */}
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
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-slate-400">
            <div className="space-y-3 animate-pulse">{Array.from({length:6}).map((_,i)=><div key={i} className="h-12 rounded-lg bg-slate-200"/>)}</div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">Henüz kayıt bulunamadı.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={panelTableLayoutStyle(tableColumns)}>
              <thead className="table-head-row">
                <tr>
                  {tableColumns.prefs.orderedVisibleColumns.map((col) => (
                    <PanelTableTh key={col.id} colId={col.id} className="table-th">
                      {col.label}
                    </PanelTableTh>
                  ))}
                </tr>
              </thead>
              <tbody className="table-body">
                {filteredRows.map((row) => (
                  <tr
                    key={`${row.kind}-${row.id}`}
                    className="table-row cursor-pointer"
                    onClick={() =>
                      router.push(
                        row.kind === 'hasar'
                          ? `/panel/hasar-dosyalari/${row.id}`
                          : `/panel/acil-yardim/${row.id}`
                      )
                    }
                  >
                    {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                      switch (col.id) {
                        case 'kind':
                          return (
                            <PanelTableTd key={col.id} colId="kind" className="table-td whitespace-nowrap">
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
                            <PanelTableTd key={col.id} colId="fileNo" className="table-td font-mono font-semibold text-slate-800 whitespace-nowrap">
                              {row.fileNo}
                            </PanelTableTd>
                          );
                        case 'customer':
                          return (
                            <PanelTableTd key={col.id} colId="customer" className="table-td whitespace-nowrap" title={row.customerName}>
                              {row.customerName}
                            </PanelTableTd>
                          );
                        case 'insured':
                          return (
                            <PanelTableTd key={col.id} colId="insured" className="table-td whitespace-nowrap font-medium text-slate-700" title={row.insuredName}>
                              {row.kind === 'hasar' ? (
                                <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                  <InsuredNameInlineEdit
                                    claimId={row.id}
                                    displayName={row.insuredName}
                                    onSaved={(insuredName) => patchClaimInsuredName(row.id, insuredName)}
                                    compact
                                  />
                                </div>
                              ) : (
                                row.insuredName
                              )}
                            </PanelTableTd>
                          );
                        case 'date':
                          return (
                            <PanelTableTd key={col.id} colId="date" className="table-td text-slate-400 whitespace-nowrap">
                              {fmtDate(row.date)}
                            </PanelTableTd>
                          );
                        case 'subject':
                          return (
                            <PanelTableTd key={col.id} colId="subject" className="table-td text-slate-500 whitespace-nowrap" title={row.subject}>
                              {row.subject}
                            </PanelTableTd>
                          );
                        case 'status':
                          return (
                            <PanelTableTd key={col.id} colId="status" className="table-td whitespace-nowrap">
                              {row.kind === 'hasar' ? (
                                <span className="badge badge-blue">{row.statusLabel}</span>
                              ) : (
                                <span className={EMERGENCY_STATUS_CLASSES[row.statusCode] ?? 'badge badge-gray'}>
                                  {EMERGENCY_STATUS_LABELS[row.statusCode] ?? row.statusCode}
                                </span>
                              )}
                            </PanelTableTd>
                          );
                        case 'invoice':
                          return (
                            <PanelTableTd key={col.id} colId="invoice" className="table-td whitespace-nowrap">
                              <span className={INVOICE_STATUS_COLORS[row.invoiceStatus]}>
                                {INVOICE_STATUS_LABELS[row.invoiceStatus]}
                              </span>
                            </PanelTableTd>
                          );
                        case 'amount':
                          return (
                            <PanelTableTd key={col.id} colId="amount" className="table-td whitespace-nowrap font-semibold">
                              {row.amount ?? <span className="text-slate-300">—</span>}
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
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-500">
          {filteredRows.length} dosya gösteriliyor &bull; Toplam {claimsTotal + cases.length} kayıt
        </div>
      </div>

      {/* Hızlı Butonlar */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
        <div className="section-heading">
          <span className="section-heading-bar" />
          <span className="section-heading-text">Hızlı İşlemler</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/panel/hasar-dosyalari" className="btn-secondary">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Tüm Hasar Dosyaları
          </Link>
          <Link href="/panel/acil-yardim" className="btn-secondary">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Tüm Acil Dosyaları
          </Link>
          <Link href="/panel/finans/faturalar" className="btn-secondary">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2 2 4-4M7 7h10a2 2 0 012 2v9a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z" /></svg>
            Faturalar
          </Link>
        </div>
      </div>
    </div>
    </TableColumnsProvider>
  );
}

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApiQuery } from '@/hooks/useApi';
import { SearchInput } from '@/components/ui/SearchInput';


const fmtDate = (d: string) => new Date(d).toLocaleDateString('tr-TR');
const fmtAmount = (n: number | undefined | null) => {
  if (!n) return '—';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺';
};

type InsuranceCompany = { id: string; name: string };
type ClaimStatus = { id: string; code: string; name: string };

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Düşük', normal: 'Normal', high: 'Yüksek', critical: 'Kritik',
};
const PRIORITY_CLASSES: Record<string, string> = {
  low:      'badge badge-gray',
  normal:   'badge badge-blue',
  high:     'badge badge-orange',
  critical: 'badge badge-red',
};

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'cancelled' | 'overdue' | 'none';

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

function ClaimStatusBadge({ status }: { status?: { code?: string; name?: string; color?: string } | null }) {
  if (!status) return <span className="badge badge-gray">N/A</span>;
  const code = status.code ?? '';
  const cls = STATUS_CODE_BADGE[code];
  if (cls) {
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status.name}</span>;
  }
  const style = status.color ? { backgroundColor: `${status.color}22`, color: status.color } : undefined;
  return (
    <span className={style ? 'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium' : 'badge badge-blue'} style={style}>
      {status.name ?? 'N/A'}
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

export default function ClaimFilesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStatusCode = searchParams.get('status');
  const urlSearch = searchParams.get('search') ?? '';
  const urlInvoiceStatus = searchParams.get('invoiceStatus') ?? '';
  const urlPriority = searchParams.get('priority') ?? '';

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
  const limit = 20;

  const { officeStaffUserId, isFieldStaff } = useMemo(() => getUserScope(), []);

  // --- TanStack Query: Insurance Companies ---
  const { data: insuranceCompanies = [] } = useApiQuery<InsuranceCompany[]>(
    ['insurance-companies'],
    '/insurance-companies?limit=200',
  );

  // --- TanStack Query: Claim Statuses ---
  const { data: claimStatuses = [] } = useApiQuery<ClaimStatus[]>(
    ['claim-statuses'],
    '/claim-files/statuses',
  );

  // URL status code → status filter (auto-select on first load)
  useEffect(() => {
    if (urlStatusCode && claimStatuses.length > 0 && !statusFilter) {
      if (urlStatusCode === 'sla_exceeded') {
        setStatusFilter('__sla_exceeded__');
      } else {
        const match = claimStatuses.find((s) =>
          urlStatusCode === 'open'
            ? ['open', 'in_progress', 'active', 'açık', 'devam'].some((k) => s.code?.toLowerCase().includes(k) || s.name?.toLowerCase().includes(k))
            : urlStatusCode === 'closed'
            ? ['closed', 'done', 'completed', 'kapali', 'kapalı', 'tamamlandı', 'finalized'].some((k) => s.code?.toLowerCase().includes(k) || s.name?.toLowerCase().includes(k))
            : false,
        );
        if (match) setStatusFilter(match.id);
      }
    }
  }, [urlStatusCode, claimStatuses, statusFilter]);

  // --- TanStack Query: Claim Files (main list) ---
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ limit: String(limit), page: String(page) });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter === '__sla_exceeded__') params.set('slaExceeded', 'true');
    else if (statusFilter) params.set('statusId', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (insuranceFilter) params.set('insuranceCompanyId', insuranceFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (invoiceStatusFilter) params.set('invoiceStatus', invoiceStatusFilter);
    if (officeStaffUserId) params.set('assignedOfficeUserId', officeStaffUserId);
    return params.toString();
  }, [search, statusFilter, priorityFilter, insuranceFilter, dateFrom, dateTo, page, invoiceStatusFilter, officeStaffUserId]);

  const {
    data: claimsResponse,
    isLoading: loading,
    isError,
    refetch,
  } = useApiQuery<any[]>(
    ['claim-files', queryParams],
    `/claim-files?${queryParams}`,
  );

  const claims = claimsResponse ?? [];
  const total = claims.length;

  // --- TanStack Query: Pending Revisions ---
  const { data: revisionsData = [] } = useApiQuery<{ claimFileId?: string }[]>(
    ['revision-requests-pending'],
    '/revision-requests?status=PENDING&limit=200',
  );
  const pendingRevisionMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const rev of revisionsData) {
      if (rev.claimFileId) map[rev.claimFileId] = (map[rev.claimFileId] ?? 0) + 1;
    }
    return map;
  }, [revisionsData]);

  // Derived
  const hasFilters = !!(search || statusFilter || priorityFilter || insuranceFilter || dateFrom || dateTo || invoiceStatusFilter || pendingRevisionFilter);
  const visibleClaims = pendingRevisionFilter
    ? claims.filter((c: any) => (pendingRevisionMap[c.id] ?? 0) > 0)
    : claims;

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setPriorityFilter('');
    setInsuranceFilter(''); setDateFrom(''); setDateTo('');
    setInvoiceStatusFilter(''); setPage(1);
    setPendingRevisionFilter(false);
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Hasar Dosyaları</span>
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
            <h2 className="page-title">Hasar Dosyaları</h2>
            {!loading && (
              <p className="page-subtitle">
                {total} dosya bulundu
                {urlStatusCode === 'open' && <span className="ml-2 text-orange-500 font-semibold">· Açık Dosyalar</span>}
                {urlStatusCode === 'closed' && <span className="ml-2 text-emerald-500 font-semibold">· Kapalı Dosyalar</span>}
                {urlStatusCode === 'sla_exceeded' && <span className="ml-2 text-red-500 font-semibold">· SLA Aşanlar</span>}
                {search && <span className="ml-2 text-blue-500 font-semibold">· Arama: {search}</span>}
                {invoiceStatusFilter === 'overdue' && <span className="ml-2 text-red-500 font-semibold">· Gecikmiş fatura</span>}
                {invoiceStatusFilter === 'pending' && <span className="ml-2 text-amber-500 font-semibold">· Bekleyen tahsilat</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(pendingRevisionMap).length > 0 && (
            <button
              type="button"
              onClick={() => setPendingRevisionFilter((v) => !v)}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors ${pendingRevisionFilter ? 'bg-amber-50 border-amber-300 text-amber-700 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
              Revizyon Bekleyenler
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                {Object.keys(pendingRevisionMap).length}
              </span>
            </button>
          )}
          {!isFieldStaff && (
            <button type="button"
              onClick={() => router.push('/panel/hasar-dosyalari/yeni')}
              className="btn-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Yeni Dosya
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <div className="relative md:col-span-2 xl:col-span-1">
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Arama</label>
            <SearchInput
              placeholder="Dosya No, Sigortalı..."
              value={search}
              onChange={(val) => { setSearch(val); setPage(1); }}
              onClear={() => { setSearch(''); setPage(1); }}
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">Müşteri</span>
            <select className="input-base-sm w-full" value={insuranceFilter} onChange={(e) => { setInsuranceFilter(e.target.value); setPage(1); }}>
              <option value="">Tüm Müşteriler</option>
              {insuranceCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">Durum</span>
            <select className="input-base-sm w-full" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">Tüm Durumlar</option>
              <option value="__sla_exceeded__">SLA Aşanlar</option>
              {claimStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">Fatura</span>
            <select className="input-base-sm w-full" value={invoiceStatusFilter} onChange={(e) => { setInvoiceStatusFilter(e.target.value); setPage(1); }}>
              <option value="">Tüm Faturalar</option>
              <option value="none">Fatura Yok</option>
              <option value="draft">Taslak</option>
              <option value="sent">Gönderildi</option>
              <option value="paid">Ödendi</option>
              <option value="partial">Kısmi Ödendi</option>
              <option value="overdue">Gecikmiş</option>
              <option value="cancelled">İptal</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">Öncelik</span>
            <select className="input-base-sm w-full" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
              <option value="">Tüm Öncelikler</option>
              <option value="low">Düşük</option>
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="critical">Kritik</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">Başlangıç</span>
            <input type="date" className="input-base-sm w-full" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">Bitiş</span>
            <input type="date" className="input-base-sm w-full" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </label>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="self-end text-xs text-slate-500 hover:text-red-600 border border-slate-200 px-3 py-2 rounded-xl hover:border-red-200 transition-colors whitespace-nowrap">
              Temizle ×
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <table className="w-full text-sm">
              <thead className="table-head-row">
                <tr>
                  <th className="table-th">Dosya No</th>
                  <th className="table-th">Müşteri</th>
                  <th className="table-th">Sigortalı</th>
                  <th className="table-th">Tarih</th>
                  <th className="table-th">İhbar Konusu</th>
                  <th className="table-th">Durum</th>
                  <th className="table-th">Tedarikçi</th>
                  <th className="table-th">Fatura</th>
                  <th className="table-th">Tutar</th>
                  <th className="table-th">Öncelik</th>
                  <th className="table-th">Revizyon</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                      </td>
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
              {hasFilters ? 'Filtrelere Uyan Dosya Bulunamadı' : 'Henüz Hasar Dosyası Yok'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {hasFilters ? 'Farklı filtreler deneyin veya filtreleri temizleyin.' : 'İlk dosyanızı oluşturun!'}
            </p>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="btn-secondary mt-4">Filtreleri Temizle</button>
            ) : !isFieldStaff ? (
              <button type="button" onClick={() => router.push('/panel/hasar-dosyalari/yeni')} className="btn-primary mt-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Yeni Dosya Oluştur
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head-row">
                <tr>
                  <th className="table-th">Dosya No</th>
                  <th className="table-th">Müşteri</th>
                  <th className="table-th">Sigortalı</th>
                  <th className="table-th">Tarih</th>
                  <th className="table-th">İhbar Konusu</th>
                  <th className="table-th">Durum</th>
                  <th className="table-th">Tedarikçi</th>
                  <th className="table-th">Fatura</th>
                  <th className="table-th">Tutar</th>
                  <th className="table-th">Öncelik</th>
                  <th className="table-th">Revizyon</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {visibleClaims.map((claim: any) => {
                  const customerName = claim.insuranceCompany?.name ?? '—';
                  const insuredName = claim.customer?.fullName ?? claim.customer?.companyName
                    ?? ((claim.customer?.firstName || claim.customer?.lastName)
                      ? `${claim.customer.firstName ?? ''} ${claim.customer.lastName ?? ''}`.trim()
                      : '—');
                  const revCount = pendingRevisionMap[claim.id] ?? 0;
                  const invStatus = deriveInvoiceStatus(claim.invoices ?? []);
                  const totalAmount = claim.invoicedAmount ?? claim.actualCostAmount ?? null;
                  const supplierName = claim.assignedAdjuster?.adjuster?.company
                    ?? (claim.assignedAdjuster ? `${claim.assignedAdjuster.firstName ?? ''} ${claim.assignedAdjuster.lastName ?? ''}`.trim() : null);

                  return (
                    <tr
                      key={claim.id}
                      className={`table-row cursor-pointer ${revCount > 0 ? 'border-l-4 border-amber-300' : ''}`}
                      onClick={() => router.push(`/panel/hasar-dosyalari/${claim.id}?mode=edit`)}
                    >
                      <td className="table-td font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">{claim.fileNo ?? claim.claimNo ?? '—'}</td>
                      <td className="table-td text-xs font-medium whitespace-nowrap max-w-[160px] truncate">{customerName}</td>
                      <td className="table-td text-xs whitespace-nowrap max-w-[140px] truncate">{insuredName}</td>
                      <td className="table-td text-slate-400 text-xs whitespace-nowrap">{fmtDate(claim.createdAt)}</td>
                      <td className="table-td text-xs whitespace-nowrap max-w-[140px] truncate">
                        {claim.lossType ?? claim.productBranch ?? '—'}
                      </td>
                      <td className="table-td whitespace-nowrap">
                        <ClaimStatusBadge status={claim.currentStatus} />
                      </td>
                      <td className="table-td text-xs whitespace-nowrap max-w-[120px] truncate">
                        {supplierName ?? <span className="text-slate-300">Atanmadı</span>}
                      </td>
                      <td className="table-td whitespace-nowrap">
                        <span className={INVOICE_STATUS_CLASSES[invStatus] ?? 'badge badge-gray'}>
                          {INVOICE_STATUS_LABELS[invStatus] ?? invStatus}
                        </span>
                      </td>
                      <td className="table-td text-xs whitespace-nowrap font-semibold">
                        {fmtAmount(totalAmount)}
                      </td>
                      <td className="table-td whitespace-nowrap">
                        {claim.priority && (
                          <span className={PRIORITY_CLASSES[claim.priority] ?? 'badge badge-gray'}>
                            {PRIORITY_LABELS[claim.priority] ?? claim.priority}
                          </span>
                        )}
                      </td>
                      <td className="table-td whitespace-nowrap">
                        {revCount > 0 ? (
                          <span className="badge badge-amber">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                            {revCount} Bekliyor
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
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
    </div>
  );
}

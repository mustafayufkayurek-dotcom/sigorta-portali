'use client';

import { useEffect, useState, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getFinanceList, getMonthlySummary, createInvoiceDraft, getAcilVendorEntitlements,
  FinanceRow, MonthlySummary, AcilVendorEntitlementRow,
} from '@/utils/emergencyApi';
import { formatTryAmount } from '@/utils/format-try-amount';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';

const EMERGENCY_FINANCE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'date', label: 'Tarih', defaultWidth: 104, minWidth: 88 },
  { id: 'customer', label: 'Müşteri', defaultWidth: 160, minWidth: 120 },
  { id: 'issueType', label: 'Konu', defaultWidth: 120, minWidth: 96 },
  { id: 'gelir', label: 'Gelir', defaultWidth: 108, minWidth: 88 },
  { id: 'gider', label: 'Gider', defaultWidth: 108, minWidth: 88 },
  { id: 'kar', label: 'Kâr', defaultWidth: 108, minWidth: 88 },
  { id: 'invoice', label: 'Fatura', defaultWidth: 108, minWidth: 88 },
];

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const OVERDUE_BADGE: Record<string, string> = {
  none: '',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
};
const OVERDUE_LABEL: Record<string, string> = {
  warning: '7+ gün',
  critical: '15+ gün',
};

function FinansPageInner() {
  const searchParams = useSearchParams();
  const initInvoiceStatus = searchParams.get('invoiceStatus') ?? '';
  const focusCaseId = searchParams.get('caseId');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState(initInvoiceStatus);
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [entitlements, setEntitlements] = useState<AcilVendorEntitlementRow[]>([]);
  const [listSummary, setListSummary] = useState({ totalCases: 0, totalGelir: 0, totalGider: 0, netKar: 0 });
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCustomerName, setBulkCustomerName] = useState('');
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const tableColumns = usePanelTableColumns('table-cols:acil-yardim-finans', EMERGENCY_FINANCE_TABLE_COLUMNS);

  const sortedRows = useMemo(
    () =>
      sortRowsByClientSort(rows, clientSort, (row, key) => {
        switch (key) {
          case 'date':
            return row.fileDate ?? row.createdAt ?? '';
          case 'customer':
            return row.customerName ?? '';
          case 'issueType':
            return row.issueType ?? '';
          case 'gelir':
            return row.totalGelir ?? 0;
          case 'gider':
            return row.totalGider ?? 0;
          case 'kar':
            return row.netKar ?? 0;
          case 'invoice':
            return row.isFaturalandildi ? 1 : 0;
          default:
            return '';
        }
      }),
    [rows, clientSort],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, monthRes, entitlementRes] = await Promise.all([
        getFinanceList({ month, year, search: filterSearch || undefined, invoiceStatus: invoiceStatus || undefined }),
        getMonthlySummary(year, month),
        getAcilVendorEntitlements().catch(() => ({ data: [] as AcilVendorEntitlementRow[] })),
      ]);
      setRows(listRes.data);
      setListSummary(listRes.summary);
      setMonthly(monthRes.data);
      setEntitlements(entitlementRes.data);
      if (focusCaseId) {
        const focused = listRes.data.find((row) => row.id === focusCaseId);
        if (focused && !focused.isFaturalandildi) {
          setSelected(new Set([focused.id]));
          setBulkCustomerName(focused.customerName);
          setShowBulkModal(true);
        }
      }
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, [year, month, filterSearch, invoiceStatus, focusCaseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setFilterSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    const unfatured = rows.filter((r) => !r.isFaturalandildi).map((r) => r.id);
    if (selected.size === unfatured.length) setSelected(new Set());
    else setSelected(new Set(unfatured));
  }

  async function handleBulkInvoice() {
    if (!bulkCustomerName.trim()) { setBulkError('Müşteri adı zorunlu'); return; }
    setBulkLoading(true);
    setBulkError(null);
    try {
      const caseIds = Array.from(selected);
      // Grup: seçilen vakaları tek fatura taslağına dönüştür
      await createInvoiceDraft({ caseIds, customerName: bulkCustomerName.trim() });
      setSelected(new Set());
      setShowBulkModal(false);
      setBulkCustomerName('');
      await load();
    } catch (err: any) {
      setBulkError(err.message);
    } finally {
      setBulkLoading(false);
    }
  }

  const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const unfaturedCount = rows.filter((r) => !r.isFaturalandildi).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Acil Yardım — Finansal Takip</h1>
          <p className="text-sm text-slate-500">Gelir, gider ve faturalaştırma yönetimi</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/panel/acil-yardim/finans/faturalar" className="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Fatura Taslakları
          </Link>
          <Link href="/panel/operasyon?filter=acil" className="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Kanban
          </Link>
        </div>
      </div>

      {/* Ay Özet Kartları */}
      {monthly && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-1">Toplam Müdahale</p>
            <p className="text-2xl font-bold text-slate-900">{monthly.totalCases}</p>
          </div>
          <div className="bg-green-50 rounded-2xl border border-green-200 shadow-sm p-4">
            <p className="text-xs text-green-600 mb-1">Toplam Gelir</p>
            <p className="text-xl font-bold text-green-700">{fmt(monthly.totalGelir)} ₺</p>
          </div>
          <div className="bg-red-50 rounded-2xl border border-red-200 shadow-sm p-4">
            <p className="text-xs text-red-600 mb-1">Toplam Gider</p>
            <p className="text-xl font-bold text-red-700">{fmt(monthly.totalGider)} ₺</p>
          </div>
          <div className={`rounded-2xl border shadow-sm p-4 ${monthly.netKar >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className={`text-xs mb-1 ${monthly.netKar >= 0 ? 'text-brand-600' : 'text-orange-600'}`}>Net Kâr</p>
            <p className={`text-xl font-bold ${monthly.netKar >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(monthly.netKar)} ₺</p>
          </div>
        </div>
      )}

      <section id="tedarikci-hakedis" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Tedarikçi Hakedişleri</h2>
          <p className="text-xs text-slate-500">
            İş bitiminde dosya tedarikçisine verilir. Verilme tarih ve saati kayıttadır. Vade uygulanmaz.
          </p>
        </div>
        {entitlements.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz hakediş yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3">Dosya</th>
                  <th className="pb-2 pr-3">Tedarikçi</th>
                  <th className="pb-2 pr-3">Tutar</th>
                  <th className="pb-2 pr-3">Verilme</th>
                  <th className="pb-2">Vade</th>
                </tr>
              </thead>
              <tbody>
                {entitlements.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3">
                      <Link href={`/panel/acil-yardim/${row.caseId}`} className="font-semibold text-brand-700 hover:underline">
                        {row.caseNo}
                      </Link>
                      <p className="text-[11px] text-slate-500">{row.customerName}</p>
                    </td>
                    <td className="py-2 pr-3">{row.vendorName}</td>
                    <td className="py-2 pr-3 font-semibold">{formatTryAmount(row.amount, { fractionDigits: 0 })}</td>
                    <td className="py-2 pr-3">
                      {new Date(row.grantedAt).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 text-slate-500">Yok</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-2">
        {/* Ay / Yıl */}
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {/* Fatura durumu */}
        <select
          value={invoiceStatus}
          onChange={(e) => setInvoiceStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tümü</option>
          <option value="pending">Bekliyor</option>
          <option value="overdue">Gecikmiş</option>
          <option value="invoiced">Faturalandı</option>
        </select>
        {/* Arama */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara..."
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Toplu Fatura Butonu */}
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => { setBulkCustomerName(''); setBulkError(null); setShowBulkModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {selected.size} Seçileni Faturaya Dönüştür
          </button>
        )}
      </div>

      {/* Tablo */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">Bu döneme ait kayıt bulunamadı.</div>
      ) : (
        <TableColumnsProvider value={tableColumns}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <div className="px-4 py-2 border-b border-slate-100 flex justify-end">
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
          <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="px-4 py-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === unfaturedCount && unfaturedCount > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <SortablePanelTableTh colId="date" sortKey="date" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center font-semibold">Tarih</SortablePanelTableTh>
                <SortablePanelTableTh colId="customer" sortKey="customer" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center font-semibold">Müşteri</SortablePanelTableTh>
                <SortablePanelTableTh colId="issueType" sortKey="issueType" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center font-semibold">Konu</SortablePanelTableTh>
                <SortablePanelTableTh colId="gelir" sortKey="gelir" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center font-semibold">Gelir</SortablePanelTableTh>
                <SortablePanelTableTh colId="gider" sortKey="gider" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center font-semibold">Gider</SortablePanelTableTh>
                <SortablePanelTableTh colId="kar" sortKey="kar" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center font-semibold">Kâr</SortablePanelTableTh>
                <SortablePanelTableTh colId="invoice" sortKey="invoice" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="px-4 py-3 text-center font-semibold">Fatura</SortablePanelTableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedRows.map((row) => (
                <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${
                  row.overdueLevel === 'critical' ? 'bg-red-50/30' :
                  row.overdueLevel === 'warning' ? 'bg-yellow-50/30' : ''
                }`}>
                  <td className="px-4 py-3">
                    {!row.isFaturalandildi && (
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        className="rounded"
                      />
                    )}
                  </td>
                  <PanelTableTd colId="date" className="px-4 py-3 text-slate-500">{fmtDate(row.fileDate ?? row.createdAt)}</PanelTableTd>
                  <PanelTableTd colId="customer" className="px-4 py-3">
                    <Link href={`/panel/acil-yardim/${row.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                      {row.customerName}
                    </Link>
                    <p className="text-xs text-slate-400">{row.caseNo}</p>
                  </PanelTableTd>
                  <PanelTableTd colId="issueType" className="px-4 py-3 text-blue-700 font-medium">{row.issueType}</PanelTableTd>
                  <PanelTableTd colId="gelir" className="px-4 py-3 text-right text-green-700 font-semibold">{fmt(row.totalGelir)} ₺</PanelTableTd>
                  <PanelTableTd colId="gider" className="px-4 py-3 text-right text-red-600 font-semibold">{fmt(row.totalGider)} ₺</PanelTableTd>
                  <PanelTableTd colId="kar" className={`px-4 py-3 text-right font-bold ${row.netKar >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                    {fmt(row.netKar)} ₺
                  </PanelTableTd>
                  <PanelTableTd colId="invoice" className="px-4 py-3">
                    {row.isFaturalandildi ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        Faturalandı
                      </span>
                    ) : row.overdueLevel !== 'none' ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${OVERDUE_BADGE[row.overdueLevel]}`}>
                        {OVERDUE_LABEL[row.overdueLevel]}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Bekliyor
                      </span>
                    )}
                  </PanelTableTd>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-100 bg-slate-50">
              <tr className="text-xs font-bold text-slate-700">
                <td colSpan={4} className="px-4 py-3">{listSummary.totalCases} kayıt</td>
                <PanelTableTd colId="gelir" className="px-4 py-3 text-right text-green-700">{fmt(listSummary.totalGelir)} ₺</PanelTableTd>
                <PanelTableTd colId="gider" className="px-4 py-3 text-right text-red-600">{fmt(listSummary.totalGider)} ₺</PanelTableTd>
                <PanelTableTd colId="kar" className={`px-4 py-3 text-right ${listSummary.netKar >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(listSummary.netKar)} ₺</PanelTableTd>
                <PanelTableTd colId="invoice" className="px-4 py-3">{null}</PanelTableTd>
              </tr>
            </tfoot>
          </table>
        </div>
        </TableColumnsProvider>
      )}

      {/* Toplu Fatura Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Fatura Taslağı Oluştur</h2>
              <button type="button" onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-500">{selected.size} dosya tek faturada birleştirilecek.</p>
            {bulkError && <p className="text-xs text-red-600">{bulkError}</p>}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Müşteri Adı <span className="text-status-danger">*</span></label>
              <input
                autoFocus
                type="text"
                value={bulkCustomerName}
                onChange={(e) => setBulkCustomerName(e.target.value)}
                placeholder="Ad Soyad veya Şirket"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleBulkInvoice}
                disabled={bulkLoading}
                className="flex-1 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50"
              >
                {bulkLoading ? 'Oluşturuluyor...' : 'Taslak Oluştur'}
              </button>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FinansPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <FinansPageInner />
    </Suspense>
  );
}

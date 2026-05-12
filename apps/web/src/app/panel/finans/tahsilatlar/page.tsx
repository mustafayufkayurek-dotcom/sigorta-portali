'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';

function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }
function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

const METHOD_LABEL: Record<string, string> = {
  eft: 'EFT', havale: 'Havale', credit_card: 'Kredi Kartı', cash: 'Nakit', offset: 'Mahsuplaşma', check: 'Çek',
};

type SortKey = 'paymentDate' | 'amount' | 'paymentType';
type SortDir = 'asc' | 'desc';
type QuickFilter = 'tumu' | 'incoming' | 'outgoing';

export default function TahsilatlarPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('tumu');
  const [filters, setFilters] = useState<any>({ paymentType: '', status: '', method: '', page: 1, limit: 20 });
  const [sortKey, setSortKey] = useState<SortKey>('paymentDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [totals, setTotals] = useState({ incoming: 0, outgoing: 0, pendingIncoming: 0 });

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params: any = { page: filters.page, limit: filters.limit };
    const effectiveType = quickFilter !== 'tumu' ? quickFilter : filters.paymentType;
    if (effectiveType) params.paymentType = effectiveType;
    if (filters.status) params.status = filters.status;
    if (filters.method) params.method = filters.method;
    if (search.trim()) params.search = search.trim();
    axios.get(`${API}/payments`, { headers: authHeader(), params })
      .then((r) => {
        const data = r.data.data ?? [];
        setPayments(data);
        setTotal(r.data.meta?.total ?? 0);
        const summary = r.data.summary;
        if (summary) {
          setTotals({ incoming: summary.totalIncoming ?? 0, outgoing: summary.totalOutgoing ?? 0, pendingIncoming: summary.pendingIncoming ?? 0 });
        } else {
          const inc  = data.filter((p: any) => p.paymentType === 'incoming' && p.status === 'completed').reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
          const out  = data.filter((p: any) => p.paymentType === 'outgoing' && p.status === 'completed').reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
          const pend = data.filter((p: any) => p.paymentType === 'incoming' && p.status === 'pending').reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
          setTotals({ incoming: inc, outgoing: out, pendingIncoming: pend });
        }
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setError('Veriler yüklenemedi.');
        setPayments([]);
        setTotal(0);
        setTotals({ incoming: 0, outgoing: 0, pendingIncoming: 0 });
      })
      .finally(() => setLoading(false));
  }, [filters, search, quickFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...payments].sort((a, b) => {
    let av: any, bv: any;
    if (sortKey === 'paymentDate') { av = a.paymentDate ?? ''; bv = b.paymentDate ?? ''; }
    else if (sortKey === 'amount') { av = a.amount ?? 0; bv = b.amount ?? 0; }
    else { av = a.paymentType ?? ''; bv = b.paymentType ?? ''; }
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv), 'tr') : String(bv).localeCompare(String(av), 'tr');
  });

  const net = totals.incoming - totals.outgoing;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 space-y-5 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/finans" className="hover:text-blue-600 transition-colors">Finans</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Tahsilatlar</span>
      </nav>


      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tahsilatlar ve Ödemeler</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500">Tamamlanan ve bekleyen tüm para hareketlerini görüntüleyin.</p>
      </div>

      {/* Net Bakiye Hero */}
      <div className={`rounded-2xl border shadow-sm p-6 ${net >= 0 ? 'border-blue-100 dark:border-blue-900/50 bg-gradient-to-r from-blue-50 to-blue-50/30 dark:from-blue-900/20 dark:to-slate-800' : 'border-red-100 dark:border-red-900/50 bg-gradient-to-r from-red-50 to-red-50/30 dark:from-red-900/20 dark:to-slate-800'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Net Bakiye</p>
            <p className={`text-4xl font-bold ${net >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>
              {net >= 0 ? '+' : ''}{fmtCurrency(net)}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Toplam Tahsilat − Toplam Ödeme</p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tahsilat</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{fmtCurrency(totals.incoming)}</p>
            </div>
            <div className="w-px bg-slate-200 dark:bg-slate-600" />
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ödeme</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{fmtCurrency(totals.outgoing)}</p>
            </div>
            <div className="w-px bg-slate-200 dark:bg-slate-600" />
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Bekleyen</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{fmtCurrency(totals.pendingIncoming)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-green-100 dark:border-green-900/50 bg-green-50/40 dark:bg-green-900/20 shadow-sm p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Toplam Tahsilat</p>
          <p className="text-xl font-bold text-green-700 dark:text-green-400">{fmtCurrency(totals.incoming)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Tamamlanan ödemeler</p>
        </div>
        <div className="rounded-xl border border-orange-100 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-900/20 shadow-sm p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Toplam Ödeme</p>
          <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{fmtCurrency(totals.outgoing)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Giden ödemeler</p>
        </div>
        <div className="rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-900/20 shadow-sm p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Bekleyen Tahsilat</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{fmtCurrency(totals.pendingIncoming)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Onay bekliyor</p>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 ${net >= 0 ? 'border-blue-100 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-900/20' : 'border-red-100 dark:border-red-900/50 bg-red-50/40 dark:bg-red-900/20'}`}>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Net Bakiye</p>
          <p className={`text-xl font-bold ${net >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>{net >= 0 ? '+' : ''}{fmtCurrency(net)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Gelir − Gider</p>
        </div>
      </div>

      {/* Quick Filter: Tümü / Tahsilat / Ödeme */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Hızlı Filtre:</span>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-lg">
          {([
            { key: 'tumu',     label: 'Tümü'              },
            { key: 'incoming', label: '↓ Tahsilat'        },
            { key: 'outgoing', label: '↑ Ödeme'           },
          ] as { key: QuickFilter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setQuickFilter(key); setFilters((f: any) => ({ ...f, page: 1 })); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                quickFilter === key
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm px-4 py-3 flex gap-3 flex-wrap items-center">
        <input
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
          placeholder="Dosya no, not ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
        />
        <select
          value={filters.paymentType}
          onChange={(e) => setFilters({ ...filters, paymentType: e.target.value, page: 1 })}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 focus:outline-none"
        >
          <option value="">Tüm Yönler</option>
          <option value="incoming">Gelen (Tahsilat)</option>
          <option value="outgoing">Giden (Ödeme)</option>
        </select>
        <select
          value={filters.method}
          onChange={(e) => setFilters({ ...filters, method: e.target.value, page: 1 })}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 focus:outline-none"
        >
          <option value="">Tüm Yöntemler</option>
          <option value="eft">EFT</option>
          <option value="havale">Havale</option>
          <option value="credit_card">Kredi Kartı</option>
          <option value="cash">Nakit</option>
          <option value="offset">Mahsuplaşma</option>
          <option value="check">Çek</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 focus:outline-none"
        >
          <option value="">Tüm Durumlar</option>
          <option value="completed">Tamamlandı</option>
          <option value="pending">Bekliyor</option>
          <option value="cancelled">İptal</option>
        </select>
        {(filters.paymentType || filters.status || filters.method || search) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setFilters({ paymentType: '', status: '', method: '', page: 1, limit: 20 }); }}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
          >
            Temizle
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
      ) : payments.length === 0 ? (
        <EmptyState msg="Henüz veri bulunmamaktadır." />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <SortableTh label="Tarih"  col="paymentDate" sortKey={sortKey} dir={sortDir} onToggle={toggleSort} />
                  <th className="text-left px-4 py-3">Dosya</th>
                  <SortableTh label="Yön"    col="paymentType" sortKey={sortKey} dir={sortDir} onToggle={toggleSort} />
                  <th className="text-left px-4 py-3">Yöntem</th>
                  <th className="text-left px-4 py-3">Bağlı Fatura</th>
                  <SortableTh label="Tutar"  col="amount"      sortKey={sortKey} dir={sortDir} onToggle={toggleSort} right />
                  <th className="text-left px-4 py-3">Durum</th>
                  <th className="text-left px-4 py-3">Not</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {sorted.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-blue-50/30 dark:hover:bg-slate-700/40 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/30 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800'}`}
                  >
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtDate(p.paymentDate)}</td>
                    <td className="px-4 py-3">
                      {p.claimFileId
                        ? <a href={`/panel/hasar-dosyalari/${p.claimFileId}`} className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-mono">{p.claimFile?.fileNo ?? '—'}</a>
                        : <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${p.paymentType === 'incoming' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800' : 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800'}`}>
                        {p.paymentType === 'incoming' ? '↓ Gelen' : '↑ Giden'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{METHOD_LABEL[p.method] ?? p.method ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">{p.invoice?.invoiceNo ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{fmtCurrency(p.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        p.status === 'completed'
                          ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800'
                          : p.status === 'pending'
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800'
                          : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800'
                      }`}>
                        {p.status === 'completed' ? 'Tamamlandı' : p.status === 'pending' ? 'Bekliyor' : 'İptal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[140px] truncate" title={p.note ?? ''}>
                      {p.note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <span className="text-xs text-slate-400 dark:text-slate-500">{total} kayıt · sayfa {filters.page}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() => setFilters((p: any) => ({ ...p, page: p.page - 1 }))}
                className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                ← Önceki
              </button>
              <button
                type="button"
                disabled={payments.length < filters.limit}
                onClick={() => setFilters((p: any) => ({ ...p, page: p.page + 1 }))}
                className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Sonraki →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableTh({ label, col, sortKey, dir, onToggle, right }: {
  label: string; col: string; sortKey: string; dir: SortDir; onToggle: (k: any) => void; right?: boolean;
}) {
  const active = sortKey === col;
  return (
    <th
      className={`px-4 py-3 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-xs uppercase text-slate-500 dark:text-slate-400 font-medium ${right ? 'text-right' : 'text-left'}`}
      onClick={() => onToggle(col)}
    >
      <span className={`inline-flex items-center gap-1 ${right ? 'justify-end w-full' : ''}`}>
        {label}
        <span className={`transition-opacity ${active ? 'opacity-100 text-blue-600 dark:text-blue-400' : 'opacity-30'}`}>
          {active && dir === 'desc' ? '↓' : '↑'}
        </span>
      </span>
    </th>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden animate-pulse">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-700 h-10" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`px-4 py-4 border-b border-slate-50 dark:border-slate-700 h-12 ${i % 2 !== 0 ? 'bg-slate-50/30 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800'}`} />
      ))}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 py-16 flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        <svg className="w-6 h-6 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500">{msg}</p>
    </div>
  );
}

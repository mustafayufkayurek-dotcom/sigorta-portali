'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR');
}

type TxStatus = 'tamamlandi' | 'bekliyor' | 'iptal';
type TxCategory = string;

interface Transaction {
  id: string;
  tarih: string;
  aciklama: string;
  kategori: TxCategory;
  tutar: number;
  tip: 'gelir' | 'gider';
  durum: TxStatus;
}

const DURUM_LABEL: Record<TxStatus, string> = {
  tamamlandi: 'Tamamlandı',
  bekliyor: 'Bekliyor',
  iptal: 'İptal',
};

const DURUM_COLOR: Record<TxStatus, string> = {
  tamamlandi: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  bekliyor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  iptal: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
};

export default function FinansDashboard() {
  const router = useRouter();
  const [filter, setFilter] = useState<'tumu' | 'gelir' | 'gider'>('tumu');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ gelir: 0, gider: 0, bekleyen: 0, bekleyenCount: 0 });

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    axios.get(`${API}/finance/transactions`, { headers: authHeader() })
      .then((r) => {
        const data: Transaction[] = r.data?.data ?? r.data ?? [];
        setTransactions(data);
        const gelir   = data.filter(t => t.tip === 'gelir' && t.durum === 'tamamlandi').reduce((s, t) => s + t.tutar, 0);
        const gider   = data.filter(t => t.tip === 'gider' && t.durum === 'tamamlandi').reduce((s, t) => s + t.tutar, 0);
        const bekl    = data.filter(t => t.durum === 'bekliyor').reduce((s, t) => s + t.tutar, 0);
        const beklCnt = data.filter(t => t.durum === 'bekliyor').length;
        setStats({ gelir, gider, bekleyen: bekl, bekleyenCount: beklCnt });
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setError('');
        setTransactions([]);
        setStats({ gelir: 0, gider: 0, bekleyen: 0, bekleyenCount: 0 });
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const net_kar = stats.gelir - stats.gider;

  const filtered = transactions.filter(t => {
    if (filter === 'gelir') return t.tip === 'gelir';
    if (filter === 'gider') return t.tip === 'gider';
    return true;
  });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finans Yönetimi</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gelir, gider ve tahsilat özetinizi buradan takip edin.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          label="Toplam Gelir"
          value={fmtCurrency(stats.gelir)}
          sub="Tamamlanan tahsilatlar"
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          }
        />
        <SummaryCard
          label="Toplam Gider"
          value={fmtCurrency(stats.gider)}
          sub="Tamamlanan ödemeler"
          color="orange"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
          }
        />
        <SummaryCard
          label="Net Kar"
          value={fmtCurrency(net_kar)}
          sub={`Kar marjı %${stats.gelir > 0 ? Math.round((net_kar / stats.gelir) * 100) : 0}`}
          color={net_kar >= 0 ? 'blue' : 'red'}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          }
        />
        <SummaryCard
          label="Bekleyen Faturalar"
          value={fmtCurrency(stats.bekleyen)}
          sub={`${stats.bekleyenCount} işlem bekliyor`}
          color="yellow"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          }
        />
      </div>

      {/* Net Bar */}
      {stats.gelir > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kar Marjı</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              %{Math.round((net_kar / stats.gelir) * 100)}
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${net_kar >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(Math.abs(Math.round((net_kar / stats.gelir) * 100)), 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Son İşlemler</h3>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
            {(['tumu', 'gelir', 'gider'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === f
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {f === 'tumu' ? 'Tümü' : f === 'gelir' ? 'Gelirler' : 'Giderler'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded" />)}
          </div>
        ) : error ? (
          <div className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-slate-400 dark:text-slate-500">Henüz veri bulunmamaktadır.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    {['Tarih', 'Açıklama', 'Kategori', 'Tutar', 'Durum'].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${h === 'Tutar' ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filtered.map((tx, idx) => (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/40 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800'}`}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {fmtDate(tx.tarih)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {tx.aciklama}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                          {tx.kategori}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${tx.tip === 'gelir' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {tx.tip === 'gelir' ? '+' : '-'}{fmtCurrency(tx.tutar)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DURUM_COLOR[tx.durum]}`}>
                          {DURUM_LABEL[tx.durum] ?? tx.durum}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-slate-500">{filtered.length} işlem gösteriliyor</span>
              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  +{fmtCurrency(filtered.filter(t => t.tip === 'gelir').reduce((s, t) => s + t.tutar, 0))}
                </span>
                <span className="text-red-500 dark:text-red-400 font-semibold">
                  -{fmtCurrency(filtered.filter(t => t.tip === 'gider').reduce((s, t) => s + t.tutar, 0))}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  sub: string;
  color: 'green' | 'orange' | 'blue' | 'red' | 'yellow';
  icon: React.ReactNode;
}

function SummaryCard({ label, value, sub, color, icon }: SummaryCardProps) {
  const palette: Record<string, { card: string; icon: string; value: string }> = {
    green:  { card: 'border-green-100 dark:border-green-900/50 bg-green-50/60 dark:bg-green-900/20',   icon: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',  value: 'text-green-700 dark:text-green-400' },
    orange: { card: 'border-orange-100 dark:border-orange-900/50 bg-orange-50/60 dark:bg-orange-900/20', icon: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400', value: 'text-orange-700 dark:text-orange-400' },
    blue:   { card: 'border-blue-100 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-900/20',     icon: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',    value: 'text-blue-700 dark:text-blue-400' },
    red:    { card: 'border-red-100 dark:border-red-900/50 bg-red-50/60 dark:bg-red-900/20',         icon: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',        value: 'text-red-700 dark:text-red-400' },
    yellow: { card: 'border-yellow-100 dark:border-yellow-900/50 bg-yellow-50/60 dark:bg-yellow-900/20', icon: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400', value: 'text-yellow-700 dark:text-yellow-400' },
  };
  const p = palette[color];
  return (
    <div className={`rounded-xl border shadow-sm p-5 ${p.card}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.icon}`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-bold ${p.value}`}>{value}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

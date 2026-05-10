'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';

type Period = 'Aylık' | 'Çeyreklik' | 'Yıllık';

interface PortfolioRow {
  id: string;
  sigortaSirketi: string;
  donem: string;
  dosyaSayisi: number;
  gelir: number;
  gider: number;
  netKZ: number;
  marjPct: number;
}

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

const PERIOD_PARAM: Record<Period, string> = {
  Aylık: 'monthly',
  Çeyreklik: 'quarterly',
  Yıllık: 'yearly',
};

export default function PortfolyoPLPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('Aylık');
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    axios
      .get(`${API}/finance/portfolio-pl`, {
        params: { period: PERIOD_PARAM[period] },
        headers: authHeader(),
      })
      .then((r) => {
        setRows(r.data?.data ?? r.data ?? []);
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setError('Veriler yüklenemedi.');
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [period, router]);

  useEffect(() => { load(); }, [load]);

  const totalPortfolyoDegeri = rows.reduce((s, r) => s + r.gelir, 0);
  const totalKar   = rows.filter((r) => r.netKZ > 0).reduce((s, r) => s + r.netKZ, 0);
  const totalZarar = rows.filter((r) => r.netKZ < 0).reduce((s, r) => s + Math.abs(r.netKZ), 0);
  const netKZ      = rows.reduce((s, r) => s + r.netKZ, 0);

  const summaryCards = [
    {
      label: 'Toplam Portföy Değeri',
      value: fmtCurrency(totalPortfolyoDegeri),
      color: 'text-slate-800 dark:text-slate-100',
      bg: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      label: 'Toplam Kar',
      value: fmtCurrency(totalKar),
      color: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      icon: (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      label: 'Toplam Zarar',
      value: fmtCurrency(totalZarar),
      color: 'text-red-700 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      icon: (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17H5m0 0V9m0 8l8-8 4 4 6-6" />
        </svg>
      ),
    },
    {
      label: 'Net KZ',
      value: fmtCurrency(netKZ),
      color: netKZ >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
      bg: netKZ >= 0
        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      icon: (
        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Portföy Kar/Zarar</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Tüm aktif dosyaların portföy bazında kar/zarar özeti. Sigorta şirketi bazlı, dönemsel karşılaştırma.
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
          {(['Aylık', 'Çeyreklik', 'Yıllık'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                period === p
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
              {card.icon}
            </div>
            <p className={`text-xl font-bold ${card.color}`}>{rows.length === 0 ? '—' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Sigorta Şirketi Bazlı KZ — <span className="text-blue-600 dark:text-blue-400">{period}</span>
          </p>
          {!loading && <span className="text-xs text-slate-400 dark:text-slate-500">{rows.length} şirket</span>}
        </div>

        {loading ? (
          <div className="animate-pulse p-6 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded" />)}
          </div>
        ) : error ? (
          <div className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : rows.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-sm text-slate-400 dark:text-slate-500">Henüz veri bulunmamaktadır.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-700/50">
                  {['Sigorta Şirketi', 'Dönem', 'Dosya Sayısı', 'Gelir', 'Gider', 'Net KZ', 'Marj %'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${i <= 1 ? 'text-left' : 'text-right'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/60">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500 flex-shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-100">{row.sigortaSirketi}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{row.donem}</td>
                    <td className="px-5 py-3.5 text-right text-slate-700 dark:text-slate-300">{row.dosyaSayisi}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300">{fmtCurrency(row.gelir)}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300">{fmtCurrency(row.gider)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`font-bold ${row.netKZ >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {row.netKZ >= 0 ? '+' : ''}{fmtCurrency(row.netKZ)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`inline-flex items-center justify-center text-xs font-bold px-2.5 py-1 rounded-full ${
                        row.marjPct >= 20
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                          : row.marjPct >= 0
                          ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                      }`}>
                        {row.marjPct >= 0 ? '+' : ''}{row.marjPct.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60">
                  <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-100" colSpan={2}>Toplam</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                    {rows.reduce((s, r) => s + r.dosyaSayisi, 0)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                    {fmtCurrency(rows.reduce((s, r) => s + r.gelir, 0))}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                    {fmtCurrency(rows.reduce((s, r) => s + r.gider, 0))}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-bold ${netKZ >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {netKZ >= 0 ? '+' : ''}{fmtCurrency(netKZ)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-bold text-sm ${netKZ >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {totalPortfolyoDegeri > 0
                        ? `${netKZ >= 0 ? '+' : ''}${((netKZ / totalPortfolyoDegeri) * 100).toFixed(2)}%`
                        : '—'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

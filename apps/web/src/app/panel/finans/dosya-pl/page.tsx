'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { formatTryAmount } from '@/utils/format-try-amount';

function fmtCurrency(n: number | null | undefined) {
  return formatTryAmount(n, { fractionDigits: 0 });
}

export default function DosyaPLPage() {
  const [portfolioPL, setPortfolioPL] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(0); // 0 = tüm yıl

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = { year };
      if (month > 0) params.month = month;

      const [plRes, rankRes] = await Promise.all([
        axios.get(`${API}/finance/analytics/portfolio-pl`, { headers: authHeader(), params }),
        axios.get(`${API}/finance/analytics/profitability-ranking`, { headers: authHeader(), params: { limit: 30 } }),
      ]);
      setPortfolioPL(plRes.data);
      setRanking(rankRes.data);
    } catch { setError('Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const months = [
    { v: 0, l: 'Tüm Yıl' }, { v: 1, l: 'Ocak' }, { v: 2, l: 'Şubat' }, { v: 3, l: 'Mart' },
    { v: 4, l: 'Nisan' }, { v: 5, l: 'Mayıs' }, { v: 6, l: 'Haziran' }, { v: 7, l: 'Temmuz' },
    { v: 8, l: 'Ağustos' }, { v: 9, l: 'Eylül' }, { v: 10, l: 'Ekim' }, { v: 11, l: 'Kasım' }, { v: 12, l: 'Aralık' },
  ];

  const isProfit = !portfolioPL || portfolioPL.netProfit >= 0;

  return (
    <div className="space-y-6 min-h-screen bg-white dark:bg-slate-900 p-6">
      <FinansSubpageBreadcrumb current="Dosya P&L" />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Portföy Kârlılık Analizi</h2>
        <div className="flex gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
          >
            {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
          >
            {months.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Yükleniyor...' : 'Güncelle'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
      {portfolioPL && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Dosya Sayısı</p>
            <p className="text-2xl font-bold text-slate-900">{portfolioPL.fileCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Toplam Gelir</p>
            <p className="text-xl font-bold text-blue-700">{fmtCurrency(portfolioPL.totalRevenue)}</p>
            <div className="mt-1 text-xs text-slate-400 space-y-0.5">
              <div>Dosya: {fmtCurrency(portfolioPL.fileFeeRevenue)}</div>
              <div>Ekstra: {fmtCurrency(portfolioPL.extraWorkRevenue)}</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Toplam Gider</p>
            <p className="text-xl font-bold text-red-600">{fmtCurrency(portfolioPL.totalCost)}</p>
            <div className="mt-1 text-xs text-slate-400 space-y-0.5">
              <div>Değişken: {fmtCurrency(portfolioPL.totalVariableCost)}</div>
              <div>Sabit Pay: {fmtCurrency(portfolioPL.overheadShare)}</div>
            </div>
          </div>
          <div className={`rounded-xl border p-4 ${isProfit ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-slate-500 mb-1">Net Kâr / Zarar</p>
            <p className={`text-xl font-bold ${isProfit ? 'text-green-800' : 'text-red-700'}`}>{fmtCurrency(portfolioPL.netProfit)}</p>
            <p className={`text-sm mt-1 ${isProfit ? 'text-green-600' : 'text-status-danger'}`}>
              %{(portfolioPL.netMarginPct ?? 0).toFixed(1)} kâr marjı
            </p>
          </div>
        </div>
      )}

      {/* Tahsilat özeti */}
      {portfolioPL && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Tahsilat Kırılımı</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500 mb-1">Sigorta Şirketinden Tahsilat</p>
              <p className="font-bold text-green-700">{fmtCurrency(portfolioPL.totalCollected - (portfolioPL.collectedFromInsured ?? 0))}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Sigortalıdan Tahsil</p>
              <p className="font-bold text-green-700">{fmtCurrency(portfolioPL.collectedFromInsured ?? 0)}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Bekleyen Bakiye</p>
              <p className="font-bold text-orange-600">{fmtCurrency(portfolioPL.outstandingBalance ?? 0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Kârlılık sıralaması */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Dosya Kârlılık Sıralaması</p>
        </div>
        {ranking.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Henüz kayıt bulunamadı.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {ranking.map((item: any, i: number) => {
              const isPos = item.netProfit >= 0;
              return (
                <div key={item.claimFileId} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>
                    <div>
                      <Link
                        href={`/panel/hasar-dosyalari/${item.claimFileId}`}
                        className="text-sm font-medium text-blue-700 hover:underline"
                      >
                        {item.claimFile?.fileNo ?? item.claimFileId}
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <span className="text-slate-500">{fmtCurrency(item.totalRevenue)}</span>
                    <span className="text-status-danger">{fmtCurrency(item.totalCost)}</span>
                    <span className={`font-bold ${isPos ? 'text-green-700' : 'text-red-600'}`}>
                      {fmtCurrency(item.netProfit)}
                      <span className="text-xs font-normal ml-1">
                        (%{(item.netMarginPct ?? item.grossMarginPct ?? 0).toFixed(1)})
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

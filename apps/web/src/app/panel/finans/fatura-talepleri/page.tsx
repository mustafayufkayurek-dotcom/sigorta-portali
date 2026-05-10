'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR');
}

type FaturaDurum = 'bekliyor' | 'onaylandi' | 'reddedildi' | 'faturalandı';

interface FaturaTalebi {
  id: string;
  tarih: string;
  dosyaNo: string;
  tedarikci: string;
  tutar: number;
  aciklama: string;
  durum: FaturaDurum;
}

const DURUM_LABEL: Record<FaturaDurum, string> = {
  bekliyor:    'Bekliyor',
  onaylandi:   'Onaylandı',
  reddedildi:  'Reddedildi',
  faturalandı: 'Faturalandı',
};

const DURUM_COLOR: Record<FaturaDurum, string> = {
  bekliyor:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  onaylandi:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  reddedildi:  'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  faturalandı: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
};

const DURUM_DOT: Record<FaturaDurum, string> = {
  bekliyor:    'bg-yellow-400',
  onaylandi:   'bg-blue-500',
  reddedildi:  'bg-red-500',
  faturalandı: 'bg-green-500',
};

type FilterKey = 'tumu' | FaturaDurum;

export default function FaturaTalepleriPage() {
  const router = useRouter();
  const [talepler, setTalepler] = useState<FaturaTalebi[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('tumu');

  const load = useCallback(() => {
    setLoading(true);
    axios
      .get(`${API}/finance/invoice-requests`, { headers: authHeader() })
      .then((r) => {
        setTalepler(r.data?.data ?? r.data ?? []);
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        setTalepler([]);
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleDurumChange = (id: string, yeniDurum: FaturaDurum) => {
    axios
      .patch(`${API}/finance/invoice-requests/${id}`, { durum: yeniDurum }, { headers: authHeader() })
      .then(() => {
        setTalepler(prev => prev.map(t => t.id === id ? { ...t, durum: yeniDurum } : t));
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/giris'); return; }
        // Optimistically update in UI even if API fails
        setTalepler(prev => prev.map(t => t.id === id ? { ...t, durum: yeniDurum } : t));
      });
  };

  const filtered = filter === 'tumu' ? talepler : talepler.filter(t => t.durum === filter);

  const counts: Record<FilterKey, number> = {
    tumu:        talepler.length,
    bekliyor:    talepler.filter(t => t.durum === 'bekliyor').length,
    onaylandi:   talepler.filter(t => t.durum === 'onaylandi').length,
    reddedildi:  talepler.filter(t => t.durum === 'reddedildi').length,
    faturalandı: talepler.filter(t => t.durum === 'faturalandı').length,
  };

  const totalAmount  = talepler.reduce((s, t) => s + t.tutar, 0);
  const pendAmount   = talepler.filter(t => t.durum === 'bekliyor').reduce((s, t) => s + t.tutar, 0);
  const approvedAmt  = talepler.filter(t => t.durum === 'onaylandi').reduce((s, t) => s + t.tutar, 0);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fatura Talepleri</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tedarikçi fatura taleplerini yönetin ve onaylayın.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Toplam Talep Tutarı', value: fmtCurrency(totalAmount), color: 'text-slate-800 dark:text-slate-100' },
          { label: 'Bekleyen',            value: fmtCurrency(pendAmount),  color: 'text-yellow-700 dark:text-yellow-400' },
          { label: 'Onaylanan',           value: fmtCurrency(approvedAmt), color: 'text-blue-700 dark:text-blue-400' },
        ].map((c) => (
          <div key={c.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{talepler.length === 0 ? '—' : c.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(['tumu', 'bekliyor', 'onaylandi', 'reddedildi', 'faturalandı'] as FilterKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filter === k
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {k === 'tumu' ? 'Tümü' : DURUM_LABEL[k as FaturaDurum]}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === k ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
              {counts[k]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="animate-pulse p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded" />)}
          </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  {['Tarih', 'Dosya No', 'Tedarikçi', 'Açıklama', 'Tutar', 'Durum', 'İşlem'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${i === 4 ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {filtered.map((t, idx) => (
                  <tr key={t.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(t.tarih)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{t.dosyaNo}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">{t.tedarikci}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[200px] truncate">{t.aciklama}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{fmtCurrency(t.tutar)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${DURUM_COLOR[t.durum]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${DURUM_DOT[t.durum]}`} />
                        {DURUM_LABEL[t.durum]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={t.durum}
                        onChange={(e) => handleDurumChange(t.id, e.target.value as FaturaDurum)}
                        className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        {(Object.keys(DURUM_LABEL) as FaturaDurum[]).map((d) => (
                          <option key={d} value={d}>{DURUM_LABEL[d]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <span className="text-xs text-slate-400 dark:text-slate-500">{filtered.length} kayıt</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {fmtCurrency(filtered.reduce((s, t) => s + t.tutar, 0))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

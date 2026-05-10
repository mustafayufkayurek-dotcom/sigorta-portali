'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getInvoiceDrafts, approveInvoiceDraft, EmergencyInvoiceDraft } from '@/utils/emergencyApi';

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  approved: 'bg-green-100 text-green-700',
  sent: 'bg-blue-100 text-blue-700',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  approved: 'Onaylandı',
  sent: 'Gönderildi',
};

export default function FaturalarPage() {
  const [drafts, setDrafts] = useState<EmergencyInvoiceDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInvoiceDrafts(filterStatus || undefined);
      setDrafts(res.data);
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id: string) {
    setApproving(id);
    try {
      const res = await approveInvoiceDraft(id);
      setDrafts((prev) => prev.map((d) => (d.id === id ? res.data : d)));
    } catch {
      // sessiz
    } finally {
      setApproving(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fatura Taslakları</h1>
          <p className="text-sm text-slate-500">Acil yardım faturalandırma</p>
        </div>
        <Link href="/panel/acil-yardim/finans" className="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
          Gelir-Gider Listesi
        </Link>
      </div>

      {/* Filtre */}
      <div className="flex items-center gap-2">
        {['', 'draft', 'approved', 'sent'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
              filterStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s === '' ? 'Tümü' : STATUS_LABEL[s] ?? s}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">Fatura taslağı bulunamadı.</div>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <div key={draft.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400">{draft.draftNo}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[draft.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABEL[draft.status] ?? draft.status}
                      </span>
                    </div>
                    <p className="text-base font-bold text-slate-900">{draft.customerName}</p>
                    <p className="text-xs text-slate-400">{fmtDate(draft.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-green-700">{fmt(draft.totalAmount)} ₺</p>
                    <p className="text-xs text-slate-400">{draft.items.length} kalem</p>
                  </div>
                </div>

                {draft.notes && (
                  <p className="mt-2 text-xs text-slate-500 italic">{draft.notes}</p>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => (e === draft.id ? null : draft.id))}
                    className="text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    {expanded === draft.id ? 'Kalemleri Gizle' : 'Kalemleri Göster'}
                  </button>
                  {draft.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => handleApprove(draft.id)}
                      disabled={approving === draft.id}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {approving === draft.id ? 'Onaylanıyor...' : 'Faturayı Onayla'}
                    </button>
                  )}
                  {draft.status === 'approved' && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Logo Wings ERP sync — Faz 4
                    </span>
                  )}
                </div>
              </div>

              {/* Kalemler */}
              {expanded === draft.id && draft.items.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50 p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 font-semibold">
                        <th className="text-left pb-2">Vaka No</th>
                        <th className="text-left pb-2">Açıklama</th>
                        <th className="text-right pb-2">Tutar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {draft.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-1.5 font-mono text-slate-500">
                            {item.case?.caseNo ?? '—'}
                          </td>
                          <td className="py-1.5 text-slate-700">{item.description ?? '—'}</td>
                          <td className="py-1.5 text-right font-bold text-green-700">{fmt(item.amount)} ₺</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }
function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}
function fmtDate(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('tr-TR') : '—'; }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Taslak', color: 'bg-slate-100 text-slate-600' },
  SENT: { label: 'Gönderildi', color: 'bg-blue-100 text-blue-700' },
  PARTIALLY_APPROVED: { label: 'Kısmi Onay', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: 'Onaylandı', color: 'bg-green-100 text-green-700' },
  DISPUTED: { label: 'İtirazlı', color: 'bg-red-100 text-red-700' },
  CLOSED: { label: 'Kapatıldı', color: 'bg-slate-200 text-slate-500' },
};

const ITEM_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Bekliyor', color: 'bg-slate-100 text-slate-600' },
  APPROVED: { label: 'Onaylı', color: 'bg-green-100 text-green-700' },
  DISPUTED: { label: 'İtirazlı', color: 'bg-red-100 text-red-700' },
};

export default function VendorStatementDetailPage() {
  const { id: vendorId, stmtId } = useParams<{ id: string; stmtId: string }>();
  const router = useRouter();
  const [statement, setStatement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!stmtId) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/vendor-statements/${stmtId}`, { headers: authHeader() });
      setStatement(r.data?.data ?? r.data);
    } catch {
      setStatement(null);
    } finally {
      setLoading(false);
    }
  }, [stmtId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!stmtId || !confirm('Ekstre tedarikçiye SMS ile gönderilecek. Onaylıyor musunuz?')) return;
    setSending(true);
    try {
      await axios.post(`${API}/vendor-statements/${stmtId}/send`, {}, { headers: authHeader() });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Gönderim hatası');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="text-center py-16 text-slate-400">Yükleniyor...</div>;
  }

  if (!statement) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-4">Ekstre bulunamadı.</p>
        <Link href={`/panel/tedarikciler/${vendorId}`} className="text-sm text-indigo-600 hover:underline">
          Tedarikçiye dön
        </Link>
      </div>
    );
  }

  const status = STATUS_LABELS[statement.status] ?? { label: statement.status, color: 'bg-slate-100 text-slate-600' };
  const items: any[] = statement.items ?? [];
  const receipts: any[] = statement.receipts ?? [];

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push(`/panel/tedarikciler/${vendorId}`)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Tedarikçi — Ödemeler / Ekstre
      </button>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-indigo-500 font-medium tracking-wide mb-1">Ödeme Ekstresi</p>
            <h1 className="text-xl font-bold text-slate-900">{statement.statementNo}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {statement.vendor?.name ?? '—'} · {fmtDate(statement.periodStart)} – {fmtDate(statement.periodEnd)}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.color}`}>{status.label}</span>
            <p className="text-lg font-bold text-slate-800">{fmtCurrency(statement.totalAmount)}</p>
            {statement.status === 'DRAFT' && (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {sending ? 'Gönderiliyor...' : 'Tedarikçiye Gönder'}
              </button>
            )}
          </div>
        </div>
        {statement.notes && (
          <p className="text-sm text-slate-500 mt-4 pt-4 border-t border-slate-50">{statement.notes}</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Kalemler ({items.length})</h2>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Kalem yok</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left px-5 py-2.5 font-semibold">Açıklama</th>
                  <th className="text-left px-5 py-2.5 font-semibold">Dosya</th>
                  <th className="text-right px-5 py-2.5 font-semibold">Tutar</th>
                  <th className="text-center px-5 py-2.5 font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => {
                  const is = ITEM_STATUS[item.approvalStatus] ?? { label: item.approvalStatus, color: 'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{item.lineDescription}</p>
                        {item.workGroup?.name && (
                          <p className="text-xs text-slate-400 mt-0.5">{item.workGroup.name}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {item.claimFile?.id ? (
                          <Link href={`/panel/hasar-dosyalari/${item.claimFile.id}`} className="text-xs text-indigo-600 hover:underline">
                            {item.claimFile.fileNo ?? 'Dosya'}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmtCurrency(item.totalAmount)}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${is.color}`}>{is.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {receipts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Ödeme Dekontları</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {receipts.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.fileName}</p>
                  {r.bankRef && <p className="text-xs text-slate-400">Ref: {r.bankRef} · {fmtDate(r.bankDate)}</p>}
                </div>
                <span className="text-sm font-bold text-green-700 flex-shrink-0">{fmtCurrency(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

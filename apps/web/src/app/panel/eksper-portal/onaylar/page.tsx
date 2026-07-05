'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toTitleCaseTR } from '@/utils/text-helpers';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';

const EKSPER_PORTAL_HOME = '/panel/eksper-portal';
const EKSPER_PORTAL_LABEL = 'Eksper Paneli';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface Approval {
  id: string;
  reportId: string;
  status: string;
  channel: string;
  comments?: string;
  expiresAt: string;
  createdAt: string;
  report?: {
    reportNumber?: string;
    totalAmount?: number;
    status?: string;
    claimFile?: { fileNumber?: string; insuranceCompany?: { name?: string } };
  };
}

export default function EksperOnaylarPage() {
  const router = useRouter();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [action, setAction] = useState<'approved' | 'rejected' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadApprovals = (expertUserId: string) => {
    setError(null);
    fetch(`${API}/external-approvals/pending?approverType=expert&approverId=${expertUserId}`, {
      headers: getHeaders(),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Sunucu hatası: ${r.status}`);
        return r.json();
      })
      .then((res) => setApprovals(res?.data ?? []))
      .catch((err: Error) => setError(err.message ?? 'Onaylar yüklenemedi.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/giris'); return; }
    const u = JSON.parse(raw);
    if (u?.role?.code !== 'expert') { router.push('/panel'); return; }
    if (u?.id) loadApprovals(u.id);
    else setLoading(false);
  }, [router]);

  const handleRespond = async () => {
    if (!selected || !action) return;
    const normalizedComment = toTitleCaseTR(comment.trim());
    if (action === 'rejected' && !normalizedComment) { alert('Red için yorum zorunludur.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/external-approvals/${selected.id}/respond-auth`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action, comments: normalizedComment }),
      });
      if (!res.ok) throw new Error('İstek başarısız');
      setToast(action === 'approved' ? 'Onay verildi.' : 'Red bildirildi.');
      setApprovals((prev) => prev.filter((a) => a.id !== selected.id));
      setSelected(null);
      setAction(null);
      setComment('');
    } catch {
      alert('İşlem sırasında hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (s: string) => ({ pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi', expired: 'Süresi Doldu' }[s] ?? s);
  const statusColor = (s: string) => ({ pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', expired: 'bg-slate-100 text-slate-600' }[s] ?? 'bg-slate-100 text-slate-600');
  const fmt = (d: string) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtMoney = (v?: number) => v != null ? v.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }) : '—';

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <PortalBreadcrumb
        portalHomeHref={EKSPER_PORTAL_HOME}
        portalHomeLabel={EKSPER_PORTAL_LABEL}
        currentLabel="Bekleyen Onaylar"
      />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Bekleyen Onaylar</h2>
        <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full">{approvals.length} onay bekliyor</span>
      </div>

      {toast && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 flex justify-between items-center">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-green-700 hover:text-green-900 ml-4 font-bold">&times;</button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-700 hover:text-red-900 ml-4 font-bold">&times;</button>
        </div>
      )}

      {!error && approvals.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-500 font-medium">Bekleyen onay isteği bulunmuyor.</p>
          <p className="text-slate-400 text-sm mt-1">Tüm onaylar işlenmiş.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{a.report?.claimFile?.fileNumber ?? '—'}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-sm text-slate-600">{a.report?.reportNumber ?? a.reportId.slice(0, 8)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(a.status)}`}>{statusLabel(a.status)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>Sigorta: {a.report?.claimFile?.insuranceCompany?.name ?? '—'}</span>
                    <span>Tutar: {fmtMoney(a.report?.totalAmount)}</span>
                    <span>Gönderildi: {fmt(a.createdAt)}</span>
                    <span>Son Tarih: <span className={new Date(a.expiresAt) < new Date() ? 'text-red-600 font-medium' : ''}>{fmt(a.expiresAt)}</span></span>
                  </div>
                </div>
                {a.status === 'pending' && (
                  <div className="flex-shrink-0 flex gap-2">
                    <button type="button"
                      onClick={() => { setSelected(a); setAction('approved'); setComment(''); }}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Onayla
                    </button>
                    <button type="button"
                      onClick={() => { setSelected(a); setAction('rejected'); setComment(''); }}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Reddet
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {selected && action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {action === 'approved' ? 'Onay Ver' : 'Reddet'}
            </h3>
            <div className="text-sm text-slate-600 space-y-1">
              <p><span className="font-medium">Dosya No:</span> {selected.report?.claimFile?.fileNumber ?? '—'}</p>
              <p><span className="font-medium">Rapor:</span> {selected.report?.reportNumber ?? selected.reportId.slice(0, 8)}</p>
              <p><span className="font-medium">Tutar:</span> {fmtMoney(selected.report?.totalAmount)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Yorum {action === 'rejected' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onBlur={(e) => {
                  const v = toTitleCaseTR(e.target.value.trim());
                  if (v) setComment(v);
                }}
                rows={3}
                placeholder={action === 'rejected' ? 'Red Gerekçesi (Zorunlu)...' : 'İsteğe Bağlı Yorum...'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setSelected(null); setAction(null); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">İptal</button>
              <button type="button"
                onClick={handleRespond}
                disabled={submitting}
                className={`px-4 py-2 text-sm text-white rounded-lg ${action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
              >
                {submitting ? 'Kaydediliyor...' : action === 'approved' ? 'Onayla' : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

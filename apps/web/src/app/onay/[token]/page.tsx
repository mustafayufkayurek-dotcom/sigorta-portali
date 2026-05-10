'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { ToastProvider } from '@/contexts/ToastContext';
import { useToast } from '@/contexts/ToastContext';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

interface PageProps {
  params: { token: string };
}

function ApprovalPageInner({ token }: { token: string }) {
  const { showToast } = useToast();

  const [state, setState] = useState<'loading' | 'ready' | 'already_responded' | 'expired' | 'error'>('loading');
  const [data, setData] = useState<any>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'approved' | 'rejected' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    axios
      .get(`${API}/external-approvals/token/${token}`)
      .then((res) => {
        setData(res.data.data);
        setState(res.data.alreadyResponded ? 'already_responded' : 'ready');
      })
      .catch((e) => {
        const msg: string = e.response?.data?.message ?? 'Bilinmeyen hata';
        if (msg.includes('süre') || msg.includes('expir')) {
          setState('expired');
        } else {
          setErrorMsg(msg);
          setState('error');
        }
      });
  }, [token]);

  const handleRespond = useCallback(async (action: 'approved' | 'rejected') => {
    if (action === 'rejected' && !comments.trim()) {
      showToast('warning', 'Lütfen Ret Nedenini Belirtiniz');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/external-approvals/${token}/respond`, { action, comments });
      setSubmitted(action);
    } catch (e: any) {
      showToast('error', e.response?.data?.message ?? 'İşlem Başarısız');
    } finally {
      setSubmitting(false);
    }
  }, [token, comments, showToast]);

  // ── Yükleniyor ────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-gray-500 text-sm">Yükleniyor...</p>
      </div>
    );
  }

  // ── Hata ─────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Geçersiz Bağlantı</h2>
          <p className="text-gray-500 text-sm">{errorMsg || 'Bu Onay Bağlantısı Geçersiz veya Bulunamadı.'}</p>
        </div>
      </div>
    );
  }

  // ── Süre dolmuş ───────────────────────────────────────────────────────────
  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Bağlantı Süresi Doldu</h2>
          <p className="text-gray-500 text-sm">Bu Onay Bağlantısının Geçerlilik Süresi Dolmuş. Lütfen İlgili Kişiyle İletişime Geçin.</p>
        </div>
      </div>
    );
  }

  // ── Yanıt verilmiş ────────────────────────────────────────────────────────
  if (state === 'already_responded' || submitted) {
    const action = submitted ?? data?.status;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${action === 'approved' ? 'bg-green-100' : 'bg-red-100'}`}>
            {action === 'approved' ? (
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {action === 'approved' ? 'Onay Verildi' : 'Rapor Reddedildi'}
          </h2>
          <p className="text-gray-500 text-sm">
            {action === 'approved'
              ? 'Teşekkürler! Onayınız Başarıyla Kaydedildi.'
              : 'Ret Bilginiz Kaydedildi. İlgili Ekip En Kısa Sürede İletişime Geçecektir.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Rapor inceleme + yanıt formu ─────────────────────────────────────────
  const report = data?.report;
  const claimFile = report?.claimFile;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Başlık */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400">Hasar Onarım Raporu Onay Talebi</p>
              <h1 className="text-xl font-bold text-gray-900">{report?.reportNo}</h1>
              {data?.versionNo > 1 && (
                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block">
                  v{report?.versionNo}
                </span>
              )}
            </div>
            <span className="bg-indigo-100 text-indigo-700 text-xs px-3 py-1 rounded-full font-medium flex-shrink-0">
              {data?.approverType === 'expert' ? 'Eksper Onayı' : 'Sigorta Şirketi Onayı'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div>
              <p className="text-xs text-gray-400">Hasar Dosya No</p>
              <p className="font-medium text-gray-800">{claimFile?.fileNo ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Sigorta Şirketi</p>
              <p className="font-medium text-gray-800">{claimFile?.insuranceCompany?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Müşteri</p>
              <p className="font-medium text-gray-800">
                {claimFile?.customer ? `${claimFile.customer.firstName ?? ''} ${claimFile.customer.lastName ?? ''}`.trim() || claimFile.customer.companyName : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Rapor Tarihi</p>
              <p className="font-medium text-gray-800">
                {report?.reportDate ? new Date(report.reportDate).toLocaleDateString('tr-TR') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Toplam Tutar</p>
              <p className="font-medium text-gray-800">
                {report?.totalSalesAmount != null
                  ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(report.totalSalesAmount)
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Onay Son Tarihi</p>
              <p className="font-medium text-gray-800">
                {data?.expiresAt ? new Date(data.expiresAt).toLocaleString('tr-TR') : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Rapor Kalemleri */}
        {report?.items?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Onarım Kalemleri</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500">
                    <th className="text-left px-4 py-2 font-medium">İş Grubu</th>
                    <th className="text-left px-4 py-2 font-medium">Tanım</th>
                    <th className="text-right px-4 py-2 font-medium">Miktar</th>
                    <th className="text-right px-4 py-2 font-medium">Birim Fiyat</th>
                    <th className="text-right px-4 py-2 font-medium">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((item: any, i: number) => (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2 text-gray-600">{item.workGroup?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-800">{item.description || item.jobDescription}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.salesUnitPrice)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.salesTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-blue-50">
                    <td colSpan={4} className="px-4 py-2 font-semibold text-gray-700 text-right">Genel Toplam</td>
                    <td className="px-4 py-2 text-right font-bold text-gray-900">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(report.totalSalesAmount ?? 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Tespitler */}
        {report?.findingsText && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Tespit ve Değerlendirme</h2>
            <p className="text-sm text-gray-600 whitespace-pre-line">{report.findingsText}</p>
          </div>
        )}

        {/* Yanıt Formu */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Onay Kararınız</h2>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Yorum / Açıklama (Red Durumunda Zorunlu)</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Varsa Açıklama veya Ret Nedeninizi Buraya Yazınız..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleRespond('rejected')}
              disabled={submitting}
              className="flex-1 border border-red-200 text-red-600 rounded-xl py-3 text-sm font-medium hover:bg-red-50 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'İşleniyor...' : 'Reddet'}
            </button>
            <button
              onClick={() => handleRespond('approved')}
              disabled={submitting}
              className="flex-1 bg-green-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'İşleniyor...' : 'Onayla'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Bu Sayfa Güvenli Token ile Korunmaktadır. Onay Bilgileriniz Şifreli Olarak Saklanır.
        </p>
      </div>
    </div>
  );
}

export default function ExternalApprovalPage({ params }: PageProps) {
  const { token } = params;
  return (
    <ToastProvider>
      <ApprovalPageInner token={token} />
    </ToastProvider>
  );
}

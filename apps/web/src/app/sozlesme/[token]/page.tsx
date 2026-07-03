'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { prepareTrustedDocumentHtml } from '@/utils/sanitize-html';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

type ContractData = {
  id: string;
  contractNo: string;
  contractDate: string;
  startDate: string | null;
  deliveryDate: string | null;
  signDeadlineAt: string | null;
  vendorName: string;
  fileNo: string;
  insuranceCompanyName: string | null;
  renderedContent: string;
  status: string;
  signedAt: string | null;
};

export default function SozlesmePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/public/vendor-contracts/${token}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.message ?? 'Sözleşme yüklenemedi');
        setContract(json.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async () => {
    if (!fullName.trim()) { setSignError('Ad Soyad zorunludur'); return; }
    if (!agreed) { setSignError('Sözleşmeyi okuduğunuzu onaylamanız gerekmektedir'); return; }
    setSigning(true);
    setSignError('');
    try {
      const r = await fetch(`${API}/public/vendor-contracts/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim() }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.message ?? 'İmzalama başarısız');
      setConfirmed(true);
      setContract((prev) => prev ? { ...prev, status: 'vendor_signed', signedAt: new Date().toISOString() } : prev);
    } catch (e: any) {
      setSignError(e.message);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Sözleşme yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-2">Sözleşme Bulunamadı</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const isAlreadySigned = contract.status === 'vendor_signed';
  const isCancelled = contract.status === 'cancelled';
  const isDeadlinePassed = contract.signDeadlineAt
    ? new Date(contract.signDeadlineAt) < new Date()
    : false;

  return (
    <div
      className="min-h-screen bg-slate-50"
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`
        @media print { body { display: none !important; } }
        * { -webkit-user-select: none; user-select: none; }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Meridyen Assistance</p>
            <p className="text-sm font-bold text-slate-800">Tedarikçi Onarım Sözleşmesi</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Sözleşme No</p>
            <p className="text-sm font-semibold text-indigo-700">{contract.contractNo}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Status banners */}
        {isAlreadySigned && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">Bu sözleşme imzalanmıştır</p>
              <p className="text-xs text-green-600">
                {contract.signedAt && `İmzalanma Tarihi: ${new Date(contract.signedAt).toLocaleString('tr-TR')}`}
              </p>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <p className="text-sm font-bold text-red-800">Bu sözleşme iptal edilmiştir</p>
            <p className="text-xs text-red-600 mt-0.5">Bu sözleşme Meridyen Assistance tarafından iptal edilmiştir.</p>
          </div>
        )}

        {!isAlreadySigned && !isCancelled && isDeadlinePassed && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <p className="text-sm font-bold text-amber-800">İmza süresi dolmuştur</p>
            <p className="text-xs text-amber-600 mt-0.5">
              İmza son tarihi {contract.signDeadlineAt ? new Date(contract.signDeadlineAt).toLocaleDateString('tr-TR') : '—'} geçmiştir.
              Lütfen Meridyen Assistance ile iletişime geçin.
            </p>
          </div>
        )}

        {!isAlreadySigned && !isCancelled && !isDeadlinePassed && contract.signDeadlineAt && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
            <p className="text-xs font-medium text-amber-700">
              Sözleşmeyi imzalamanız için son tarih:{' '}
              <strong>{new Date(contract.signDeadlineAt).toLocaleDateString('tr-TR')}</strong>
              {' '}— Bu tarihe kadar imzalanmazsa iş emri iptal edilebilir.
            </p>
          </div>
        )}

        {/* Contract info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Dosya No', value: contract.fileNo },
            { label: 'Sigorta Şirketi', value: contract.insuranceCompanyName ?? '—' },
            { label: 'Tarih', value: new Date(contract.contractDate).toLocaleDateString('tr-TR') },
            { label: 'Tedarikçi', value: contract.vendorName },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Contract content */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sözleşme İçeriği</p>
          </div>
          <div
            className="p-6 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: prepareTrustedDocumentHtml(contract.renderedContent),
            }}
          />
        </div>

        {/* Sign section */}
        {!isAlreadySigned && !isCancelled && !isDeadlinePassed && !confirmed && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Sözleşmeyi Onaylayın</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Ad Soyad <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Adınızı ve soyadınızı tam yazın"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={agreed}
                  onClick={() => setAgreed(!agreed)}
                  className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-all ${
                    agreed ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 hover:border-indigo-400'
                  }`}
                >
                  {agreed && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className="text-sm text-slate-600 leading-relaxed">
                  Yukarıdaki sözleşmeyi tamamını okudum, anladım ve tüm maddelerini kabul ediyorum.
                  Bu onayın <strong>dijital imza</strong> hükmünde olduğunu kabul ediyorum.
                </span>
              </label>

              {signError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{signError}</p>
              )}

              <button
                type="button"
                onClick={handleSign}
                disabled={signing || !fullName.trim() || !agreed}
                className="w-full py-3.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #1a4080 0%, #1e5aa8 100%)' }}
              >
                {signing ? 'İmzalanıyor…' : 'Sözleşmeyi İmzala ve Onayla'}
              </button>

              <p className="text-xs text-slate-400 text-center">
                Bu onay, ıslak imza yerine geçer ve yasal delil niteliği taşır.
              </p>
            </div>
          </div>
        )}

        {/* Success */}
        {confirmed && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-base font-bold text-green-800 mb-1">Sözleşme İmzalandı!</h3>
            <p className="text-sm text-green-700">
              Sözleşme <strong>{fullName}</strong> adına başarıyla imzalandı.
            </p>
            <p className="text-xs text-green-600 mt-1">
              {new Date().toLocaleString('tr-TR')} tarihinde onaylandı.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-slate-400">
            Bu belge Meridyen Assistance tarafından oluşturulmuştur. Yetkisiz kopyalanması yasaktır.
          </p>
        </div>
      </div>
    </div>
  );
}

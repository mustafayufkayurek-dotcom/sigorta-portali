'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Script from 'next/script';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
}

type Summary = {
  amount: number;
  currency: string;
  status: string;
  description?: string;
  payerName?: string;
  fileNo: string;
  insuredName?: string;
  insuranceCompany?: string;
  tokenExpiresAt: string;
  payable: boolean;
  providerConfigured: boolean;
};

export default function OnlineOdemePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params?.token as string;
  const sonuc = searchParams.get('sonuc');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/public/collection-links/token/${token}`);
      setSummary(res.data.data);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : 'Ödeme bilgisi yüklenemedi.';
      setError(typeof msg === 'string' ? msg : 'Ödeme bilgisi yüklenemedi.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const startCheckout = async () => {
    setCheckoutLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API}/public/collection-links/token/${token}/checkout`);
      setIframeUrl(res.data.data?.iframeUrl ?? null);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : 'Ödeme başlatılamadı.';
      setError(typeof msg === 'string' ? msg : 'Ödeme başlatılamadı.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Yükleniyor…</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const paid = summary.status === 'paid' || sonuc === 'basarili';
  const failed = summary.status === 'failed' || sonuc === 'basarisiz';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Meridyen Assistance</p>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Online Ödeme</h1>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <p className="text-xs text-slate-500">Dosya No</p>
            <p className="font-mono font-semibold text-slate-800">{summary.fileNo}</p>
            {summary.insuranceCompany && (
              <p className="text-xs text-slate-500 mt-2">{summary.insuranceCompany}</p>
            )}
            {summary.description && (
              <p className="text-sm text-slate-600 mt-3">{summary.description}</p>
            )}
          </div>

          <div className="px-6 py-5">
            <p className="text-xs text-slate-500 mb-1">Ödenecek tutar</p>
            <p className="text-3xl font-bold text-emerald-700">{fmtCurrency(summary.amount)}</p>
            {summary.payerName && (
              <p className="text-xs text-slate-500 mt-2">Ödeyen: {summary.payerName}</p>
            )}
          </div>

          {paid && (
            <div className="mx-6 mb-6 p-4 rounded-xl bg-green-50 border border-green-100 text-center">
              <p className="text-green-800 font-medium text-sm">Ödemeniz alındı</p>
              <p className="text-xs text-green-600 mt-1">Teşekkür ederiz. Kaydınız kısa sürede güncellenecektir.</p>
            </div>
          )}

          {failed && !paid && (
            <div className="mx-6 mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-center">
              <p className="text-red-800 font-medium text-sm">Ödeme tamamlanamadı</p>
              <p className="text-xs text-red-600 mt-1">Tekrar deneyebilir veya bizimle iletişime geçebilirsiniz.</p>
            </div>
          )}

          {!paid && summary.payable && !iframeUrl && (
            <div className="px-6 pb-6">
              {!summary.providerConfigured ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                  Online ödeme geçici olarak kullanılamıyor. Lütfen firma ile iletişime geçin.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={checkoutLoading}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {checkoutLoading ? 'Hazırlanıyor…' : 'Kredi Kartı ile Öde'}
                </button>
              )}
              {error && <p className="text-xs text-red-600 mt-2 text-center">{error}</p>}
            </div>
          )}

          {summary.status === 'expired' && !paid && (
            <div className="mx-6 mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-sm text-slate-600">
              Bu ödeme linkinin süresi dolmuş. Yeni link için dosya sorumlunuzla iletişime geçin.
            </div>
          )}
        </div>

        {iframeUrl && !paid && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-2">
            <Script src="https://www.paytr.com/js/iframeResizer.min.js" strategy="afterInteractive" />
            <iframe
              src={iframeUrl}
              id="paytriframe"
              title="PayTR Ödeme"
              frameBorder={0}
              scrolling="no"
              style={{ width: '100%', minHeight: 400 }}
            />
            <Script id="paytr-resize" strategy="afterInteractive">
              {`if (typeof iFrameResize === 'function') { iFrameResize({}, '#paytriframe'); }`}
            </Script>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400">
          Güvenli ödeme altyapısı PayTR · 256-bit SSL
        </p>
      </div>
    </div>
  );
}

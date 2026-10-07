'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  MALI_MESULIYET_LOKASYON_ETIKET,
  PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE,
  type MaliMesuliyetLokasyon,
} from '@sigorta/shared';
import { API } from '@/utils/api';
import { formatTryAmount } from '@/utils/format-try-amount';

type Stage = 'loading' | 'view' | 'done' | 'error';

export default function MaliMesuliyetMuvafakatPublicPage() {
  const params = useParams();
  const token = params?.token as string;
  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/public/mali-mesuliyet/${token}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = json?.message ?? json?.data?.message ?? 'Evrak yüklenemedi';
          throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
        }
        setPayload(json?.data ?? json);
        setStage('view');
      })
      .catch((e: Error) => {
        setError(e.message || 'Evrak yüklenemedi');
        setStage('error');
      });
  }, [token]);

  const act = async (path: 'approve' | 'reject') => {
    if (path === 'approve' && !fullName.trim()) {
      setError('Ad Soyad yazın.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/public/mali-mesuliyet/${token}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          path === 'approve' ? { fullName } : { reason: rejectReason },
        ),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = json?.message ?? 'İşlem yapılamadı';
        throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
      }
      setStage('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem yapılamadı');
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'loading') {
    return <p className="p-8 text-center text-sm text-slate-500">Yükleniyor…</p>;
  }
  if (stage === 'error') {
    const closed = error === PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-slate-950">
            {closed ? PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE : error}
          </p>
        </div>
      </div>
    );
  }
  if (stage === 'done') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-slate-950">Bu belge zaten işleme alınmıştır ve erişime kapatılmıştır</p>
        </div>
      </div>
    );
  }

  const tespipler = payload?.tespipler ?? [];
  const totals = payload?.genelToplam ?? { mainSales: 0, neighborSales: 0, genelToplam: 0 };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs text-slate-500">Meridyen Assistance</p>
          <h1 className="text-sm font-semibold text-slate-950">Mali Mesuliyet Muvafakat</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('approve')}
            className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white"
          >
            Onayla
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('reject')}
            className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700"
          >
            Reddet
          </button>
        </div>
      </div>
      <article className="mx-auto my-6 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs text-slate-500">Dosya No</p>
        <p className="text-sm font-semibold">{payload?.fileNo || '—'}</p>
        <label className="mt-4 block text-xs font-medium text-slate-500">Ad Soyad</label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <label className="mt-3 block text-xs font-medium text-slate-500">Red Gerekçesi</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          rows={2}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
        <ul className="mt-4 space-y-3">
          {tespipler.map((area: any) => (
            <li key={area.id} className="rounded-xl border border-slate-100 p-3">
              <p className="text-sm font-semibold">
                {MALI_MESULIYET_LOKASYON_ETIKET[area.lokasyon as MaliMesuliyetLokasyon] ?? area.lokasyon}
                {area.daireNo ? ` · Daire ${area.daireNo}` : ''}
              </p>
              {(area.items ?? []).map((item: any) => (
                <p key={item.id} className="mt-1 flex justify-between text-sm text-slate-600">
                  <span>{item.jobDescription}</span>
                  <span>{formatTryAmount(item.salesTotal)}</span>
                </p>
              ))}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm font-semibold">Genel Toplam {formatTryAmount(totals.genelToplam)}</p>
      </article>
    </div>
  );
}

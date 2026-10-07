'use client';

import { useState } from 'react';
import axios from 'axios';
import {
  MALI_MESULIYET_LOKASYON_ETIKET,
  type MaliMesuliyetLokasyon,
} from '@sigorta/shared';
import { formatTryAmount } from '@/utils/format-try-amount';
import { openWhatsAppChat } from '@/utils/date-helpers';
import { getApiErrorMessage } from '@/utils/api-error';
import { API, authHeader } from './claim-detail-utils';

type Kalem = { id: string; jobDescription: string; salesTotal: number };
type Tespit = {
  id: string;
  lokasyon: string;
  daireNo: string;
  items: Kalem[];
  alanSatis: number;
};

export function MaliMesuliyetMuvafakatTaslagi({
  claimId,
  fileNo,
  insuredName,
  tespipler,
  totals,
  suggestedPhone,
  onClose,
  onSaved,
}: {
  claimId: string;
  fileNo?: string | null;
  insuredName?: string | null;
  tespipler: Tespit[];
  totals: { mainSales: number; neighborSales: number; genelToplam: number };
  suggestedPhone?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [stage, setStage] = useState<'view' | 'approved' | 'rejected'>('view');
  const [rejectReason, setRejectReason] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState(suggestedPhone?.trim() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      await axios.post(
        `${API}/claim-files/${claimId}/mali-mesuliyet/muvafakat/onay`,
        { fullName: fullName.trim() },
        { headers: authHeader() },
      );
      setStage('approved');
      onSaved?.();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Onay kaydedilemedi.'));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    setError('');
    try {
      await axios.post(
        `${API}/claim-files/${claimId}/mali-mesuliyet/muvafakat/red`,
        { reason: rejectReason },
        { headers: authHeader() },
      );
      setStage('rejected');
      onSaved?.();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Red kaydedilemedi.'));
    } finally {
      setBusy(false);
    }
  };

  const sendWhatsapp = async () => {
    if (!phone.trim()) {
      setError('Telefon numarası yok.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await axios.post(
        `${API}/claim-files/${claimId}/mali-mesuliyet/muvafakat/whatsapp`,
        { phone: phone.trim() },
        { headers: authHeader() },
      );
      const data = r.data?.data ?? r.data;
      openWhatsAppChat(data.phone || phone.trim(), data.message ?? '');
    } catch (err) {
      setError(getApiErrorMessage(err, 'WhatsApp açılamadı.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-100"
      data-testid="mali-mesuliyet-muvafakat-taslagi"
      role="dialog"
      aria-labelledby="mali-mesuliyet-muvafakat-baslik"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs text-slate-500">Meridyen Assistance</p>
          <h2 id="mali-mesuliyet-muvafakat-baslik" className="text-sm font-semibold text-slate-950">
            Mali Mesuliyet Muvafakat
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stage === 'view' ? (
            <>
              <button
                type="button"
                data-testid="mali-mesuliyet-muvafakat-onayla"
                disabled={busy}
                onClick={() => void approve()}
                className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Onayla
              </button>
              <button
                type="button"
                data-testid="mali-mesuliyet-muvafakat-reddet"
                disabled={busy}
                onClick={() => void reject()}
                className="min-h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Reddet
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Kapat
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        {stage === 'approved' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-950">Muvafakat Verildi</p>
            <p className="mt-2 text-sm text-slate-500">Kayıt düştü. Dış link kapanır.</p>
          </div>
        ) : null}
        {stage === 'rejected' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-950">Bu tespit reddedilmiştir</p>
            <p className="mt-2 text-sm text-slate-500">Kayıt düştü. Dış link kapanır.</p>
          </div>
        ) : null}

        {stage === 'view' ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">Dosya No</p>
            <p className="text-sm font-semibold text-slate-950">{fileNo?.trim() || '—'}</p>
            {insuredName?.trim() ? (
              <>
                <p className="mt-3 text-xs text-slate-500">Sigortalı</p>
                <p className="text-sm font-semibold text-slate-950">{insuredName}</p>
              </>
            ) : null}
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Komşu daire tespitleri aşağıdadır. Onay veya red, ilgili taraf veya sigorta şirketi içindir.
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-500">Ad Soyad</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Onaylayan adı"
            />
            <label className="mt-3 block text-xs font-medium text-slate-500">Telefon</label>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="532 133 4144"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendWhatsapp()}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                WhatsApp ile Gönder
              </button>
            </div>
            <label className="mt-3 block text-xs font-medium text-slate-500">Red Gerekçesi</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Örn. alt kat kalemi eksik"
            />
            <ul className="mt-4 space-y-3">
              {tespipler.length === 0 ? (
                <li className="text-sm text-slate-500">Dosyada mali mesuliyet alanı yok.</li>
              ) : (
                tespipler.map((area) => (
                  <li key={area.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {MALI_MESULIYET_LOKASYON_ETIKET[area.lokasyon as MaliMesuliyetLokasyon] ??
                          area.lokasyon}
                        {area.daireNo ? ` · Daire ${area.daireNo}` : ''}
                      </p>
                      <p className="text-sm font-semibold">{formatTryAmount(area.alanSatis)}</p>
                    </div>
                    {area.items.map((item) => (
                      <p key={item.id} className="mt-1 flex justify-between gap-2 text-sm text-slate-600">
                        <span>{item.jobDescription}</span>
                        <span>{formatTryAmount(item.salesTotal)}</span>
                      </p>
                    ))}
                  </li>
                ))
              )}
            </ul>
            <dl className="mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-brand-50 px-3 py-2">
                <dt className="text-xs text-slate-500">Ana Dosya Toplamı</dt>
                <dd className="text-sm font-semibold text-slate-950">{formatTryAmount(totals.mainSales)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-500">Mali Mesuliyet Toplamı</dt>
                <dd className="text-sm font-semibold text-slate-950">
                  {formatTryAmount(totals.neighborSales)}
                </dd>
              </div>
              <div className="rounded-lg bg-brand-800 px-3 py-2 text-white">
                <dt className="text-xs text-slate-100">Genel Toplam</dt>
                <dd className="text-sm font-semibold">{formatTryAmount(totals.genelToplam)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              Dış link 7 gündür. Onay veya red sonrası kapanır.
            </p>
          </article>
        ) : null}
      </div>
    </div>
  );
}

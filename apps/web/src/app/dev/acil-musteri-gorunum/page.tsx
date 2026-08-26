'use client';

/**
 * Acil — müşterinin telefonunda gördüğü servis onay formu ve anket.
 * Personel dosya ekranına konmaz. Yalnız development.
 */

import { useState, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import {
  SURVEY_Q6_LABEL,
  SURVEY_Q7_LABEL,
  SURVEY_ACIL_STAR_QUESTIONS,
  SURVEY_STAR_SCALE_LINE,
} from '@/utils/survey-form';

type View = 'servis' | 'anket';

export default function AcilMusteriGorunumPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MusteriGorunumInner />;
}

function MusteriGorunumInner() {
  const [view, setView] = useState<View>('servis');
  const [approveOpen, setApproveOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [formApproved, setFormApproved] = useState(false);
  const [ratings, setRatings] = useState({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [surveyDone, setSurveyDone] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6" data-testid="acil-musteri-gorunum">
      <div className="mx-auto max-w-md space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Müşteri telefonu — örnek
        </p>
        <h1 className="text-lg font-semibold text-slate-900">
          Sigortalı bunları WhatsApp linkinden görür
        </h1>
        <p className="text-sm text-slate-600">
          Personel ekranında durmaz. Link WhatsApp ile gider; müşteri telefondan açar.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('servis')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
              view === 'servis' ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Servis Onay Formu
          </button>
          <button
            type="button"
            onClick={() => setView('anket')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
              view === 'anket' ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Anket
          </button>
        </div>
      </div>

      {view === 'servis' ? (
        <div className="mx-auto mt-4 max-w-md space-y-3">
          <WhatsAppBubble>
            Meridyen Assistance tarafından düzenlenen Servis Onay Formu belgesini aşağıdaki
            linkten inceleyebilir ve onaylayabilirsiniz:
            {'\n\n'}
            https://uygulama.meridyen/evrak/ornek-link
            {'\n\n'}
            Meridyen Assistance
          </WhatsAppBubble>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {formApproved ? (
              <div className="px-6 py-16 text-center">
                <p className="text-base font-semibold text-slate-900">Onaylandı</p>
                <p className="mt-1 text-sm text-slate-500">{fullName} tarafından onaylandı.</p>
                <p className="mt-4 text-xs text-slate-400">Bu sayfayı kapatabilirsiniz.</p>
              </div>
            ) : (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-xs text-gray-500">Meridyen Assistance</p>
                    <h2 className="text-sm font-semibold text-gray-900">Servis Onay Formu</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setApproveOpen(true)}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    Onayla
                  </button>
                </div>
                <iframe
                  title="Servis Onay Formu örneği"
                  src="/dev/acil-preview/servis-onay-formu-ornek.pdf"
                  className="h-[70vh] w-full bg-white"
                />
              </>
            )}
          </div>

          {approveOpen && !formApproved ? (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-base font-semibold text-gray-900">Belgeyi Onayla</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Adınızı yazarak yukarıdaki belgeyi elektronik ortamda onaylamış sayılırsınız.
                </p>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ad Soyad"
                  className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setApproveOpen(false)}
                    className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={!fullName.trim()}
                    onClick={() => {
                      setFormApproved(true);
                      setApproveOpen(false);
                    }}
                    className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Onayla
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mx-auto mt-4 max-w-md space-y-3">
          <WhatsAppBubble>
            Değerli Sigortalımız,
            {'\n\n'}
            Acil Yardım dosyanız tamamlanmıştır. Hizmetimizden yararlandığınız için teşekkür ederiz.
            {'\n\n'}
            Deneyiminizi değerlendirmeniz için kısa bir anket hazırladık (yaklaşık 30 saniye):
            {'\n\n'}
            https://uygulama.meridyen/anket/ornek-link
          </WhatsAppBubble>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
            {surveyDone ? (
              <div className="bg-white px-8 py-16 text-center">
                <p className="text-xl font-bold text-slate-800">Teşekkürler!</p>
                <p className="mt-2 text-sm text-slate-500">
                  Değerli geri bildiriminiz için teşekkür ederiz.
                </p>
                <p className="mt-6 text-xs text-slate-400">Meridyen Assistance</p>
              </div>
            ) : (
              <>
                <div className="border-b border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">Meridyen Assistance</p>
                  <p className="text-sm font-bold text-slate-800">Kalite Kontrol Anket Formu</p>
                </div>
                <div className="space-y-4 px-4 py-6">
                  <div className="space-y-2 rounded-xl border border-brand-100 bg-brand-50 px-5 py-4">
                    <p className="text-sm text-brand-900">Değerli Sigortalımız,</p>
                    <p className="text-sm leading-relaxed text-brand-800">
                      Acil yardım dosyanız kapsamında hizmet tamamlanmıştır. Bu form memnuniyetinizi
                      değerlendirmek amacıyla hazırlanmıştır.
                    </p>
                  </div>
                  <div className="overflow-hidden divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {SURVEY_ACIL_STAR_QUESTIONS.map((q, idx) => (
                      <div key={q.key} className="px-5 py-5">
                        <p className="mb-1 text-sm font-medium text-slate-700">
                          <span className="font-semibold text-brand-500">{idx + 1}.</span> {q.label}
                        </p>
                        <p className="mb-3 text-[11px] text-slate-500">{SURVEY_STAR_SCALE_LINE}</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRatings((prev) => ({ ...prev, [q.key]: star }))}
                              className={`text-2xl ${star <= ratings[q.key] ? 'text-amber-400' : 'text-slate-200'}`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                    <p className="mb-4 text-sm font-medium text-slate-700">
                      <span className="font-semibold text-brand-500">6.</span> {SURVEY_Q6_LABEL}
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setRecommend(true)}
                        className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold ${
                          recommend === true
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        Memnunum
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecommend(false)}
                        className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold ${
                          recommend === false
                            ? 'border-red-400 bg-red-50 text-red-700'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        Memnun Değilim
                      </button>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                    <p className="mb-3 text-sm font-medium text-slate-700">{SURVEY_Q7_LABEL}</p>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSurveyDone(true)}
                    className="w-full rounded-xl py-4 text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #1a4080 0%, #1e5aa8 100%)' }}
                  >
                    Anketi Tamamla ve Gönder
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WhatsAppBubble({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#dcf8c6] px-3 py-2 text-sm whitespace-pre-wrap text-slate-800 shadow-sm">
      {children}
    </div>
  );
}

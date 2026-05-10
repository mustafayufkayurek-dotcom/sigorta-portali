'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

type SurveyMeta = {
  id: string;
  insuredName: string | null;
  status: string;
  tokenExpiresAt: string | null;
};

type Ratings = {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
};

const QUESTIONS = [
  {
    key: 'q1' as keyof Ratings,
    label: 'Genel hizmet memnuniyetinizi nasıl değerlendirirsiniz?',
  },
  {
    key: 'q2' as keyof Ratings,
    label: 'Meridyen Assistance ekibinin müdahale hızından memnun musunuz?',
  },
  {
    key: 'q3' as keyof Ratings,
    label: 'Meridyen Assistance\'ın süreç boyunca bilgilendirmesini nasıl değerlendirirsiniz?',
  },
  {
    key: 'q4' as keyof Ratings,
    label: 'Yapılan işin kalitesini nasıl değerlendirirsiniz?',
  },
  {
    key: 'q5' as keyof Ratings,
    label: 'Ekibimizin profesyonelliğini nasıl değerlendirirsiniz?',
  },
];

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => !disabled && setHovered(star)}
            onMouseLeave={() => !disabled && setHovered(0)}
            className="focus:outline-none disabled:cursor-default"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className={`w-9 h-9 transition-colors ${
                filled ? 'text-amber-400' : 'text-slate-200'
              }`}
              fill="currentColor"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

export default function AnketPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [meta, setMeta] = useState<SurveyMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ratings, setRatings] = useState<Ratings>({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/public/surveys/${token}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.message ?? 'Anket yüklenemedi');
        setMeta(json.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    // Validasyon
    const unanswered = Object.values(ratings).filter((v) => v === 0);
    if (unanswered.length > 0) {
      setSubmitError('Lütfen tüm yıldız sorularını yanıtlayın');
      return;
    }
    if (recommend === null) {
      setSubmitError('Lütfen tavsiye sorusunu yanıtlayın');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const r = await fetch(`${API}/public/surveys/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q1Rating: ratings.q1,
          q2Rating: ratings.q2,
          q3Rating: ratings.q3,
          q4Rating: ratings.q4,
          q5Rating: ratings.q5,
          q6Recommend: recommend,
          q7Comment: comment.trim() || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.message ?? 'Gönderim başarısız');
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Anket yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-2">Anket Bulunamadı</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!meta) return null;

  // Teşekkür ekranı
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Teşekkürler!</h2>
          {meta.insuredName && (
            <p className="text-sm font-medium text-slate-600 mb-3">
              Sayın {meta.insuredName},
            </p>
          )}
          <p className="text-sm text-slate-500 leading-relaxed">
            Değerli geri bildiriminiz için teşekkür ederiz. Hizmet kalitemizi
            geliştirmek için yanıtlarınızı dikkate alıyoruz.
          </p>
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400">Meridyen Assistance</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Meridyen Assistance</p>
            <p className="text-sm font-bold text-slate-800">Müşteri Memnuniyet Anketi</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Yaklaşık 30 saniye</p>
            <p className="text-xs text-indigo-600 font-medium">7 soru</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
        {/* Karşılama */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4">
          {meta.insuredName ? (
            <p className="text-sm text-indigo-800">
              Sayın <strong>{meta.insuredName}</strong>, size sunduğumuz hizmetlerle
              ilgili deneyiminizi değerlendirmeniz bizim için değerlidir.
            </p>
          ) : (
            <p className="text-sm text-indigo-800">
              Size sunduğumuz hizmetlerle ilgili deneyiminizi değerlendirmeniz bizim
              için değerlidir.
            </p>
          )}
        </div>

        {/* Yıldız soruları */}
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
          {QUESTIONS.map((q, idx) => (
            <div key={q.key} className="px-5 py-5">
              <p className="text-sm font-medium text-slate-700 mb-3">
                <span className="text-indigo-500 font-semibold">{idx + 1}.</span>{' '}
                {q.label}
              </p>
              <StarRating
                value={ratings[q.key]}
                onChange={(v) => setRatings((prev) => ({ ...prev, [q.key]: v }))}
                disabled={submitting}
              />
            </div>
          ))}
        </div>

        {/* Soru 6: Tavsiye */}
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-5 shadow-sm">
          <p className="text-sm font-medium text-slate-700 mb-4">
            <span className="text-indigo-500 font-semibold">6.</span>{' '}
            Meridyen Assistance&apos;ı tavsiye eder misiniz?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setRecommend(true)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                recommend === true
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-slate-200 text-slate-600 hover:border-green-300'
              }`}
            >
              Evet
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setRecommend(false)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                recommend === false
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-slate-200 text-slate-600 hover:border-red-300'
              }`}
            >
              Hayır
            </button>
          </div>
        </div>

        {/* Soru 7: Yorum (opsiyonel) */}
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-5 shadow-sm">
          <p className="text-sm font-medium text-slate-700 mb-3">
            <span className="text-indigo-500 font-semibold">7.</span>{' '}
            Eklemek istediğiniz görüş veya öneriniz var mı?{' '}
            <span className="text-slate-400 font-normal">(Opsiyonel)</span>
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
            placeholder="Görüş veya önerinizi buraya yazabilirsiniz…"
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
          />
        </div>

        {/* Hata */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        {/* Gönder */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          style={{ background: 'linear-gradient(135deg, #1a4080 0%, #1e5aa8 100%)' }}
        >
          {submitting ? 'Gönderiliyor…' : 'Anketi Tamamla ve Gönder'}
        </button>

        <p className="text-center text-xs text-slate-400 pb-4">
          Yanıtlarınız gizli tutulmakta ve yalnızca hizmet kalitemizi artırmak için
          kullanılmaktadır.
        </p>
      </div>
    </div>
  );
}

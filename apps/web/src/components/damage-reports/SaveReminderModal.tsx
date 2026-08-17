'use client';

import { useEffect, useState, useRef } from 'react';

export type SaveReminderDetail = 'both' | 'fields' | 'items' | 'none';

export type SaveReminderIntent = 'leave' | 'logout';

const DEFAULT_COUNTDOWN = 20;

function detailSuffix(detail: SaveReminderDetail): string {
  if (detail === 'both') return ' (metin alanları ve tablo satırları)';
  if (detail === 'fields') return ' (metin alanları)';
  if (detail === 'items') return ' (tablo satırları)';
  return '';
}

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, seconds / total));
  const offset = circumference * (1 - progress);

  return (
    <div className="relative w-[4.5rem] h-[4.5rem] shrink-0" aria-hidden>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#34d399"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white tabular-nums">
        {seconds}
      </span>
    </div>
  );
}

export default function SaveReminderModal({
  open,
  intent = 'leave',
  detail = 'none',
  saving = false,
  countdownSeconds = DEFAULT_COUNTDOWN,
  onSave,
  onDiscard,
  onContinue,
}: {
  open: boolean;
  intent?: SaveReminderIntent;
  detail?: SaveReminderDetail;
  saving?: boolean;
  countdownSeconds?: number;
  onSave: () => void;
  onDiscard: () => void;
  onContinue: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(countdownSeconds);
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          onContinueRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [open, countdownSeconds]);

  if (!open) return null;

  const isLogout = intent === 'logout';
  const discardLabel = isLogout ? 'Kaydetmeden Çıkış Yap' : 'Kaydetmeden Çık';
  const bodyExtra = isLogout
    ? ' Oturumu kapatmadan önce kaydetmenizi öneririz.'
    : ' Yazımı tamamladıysanız kaydetmenizi öneririz.';

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center z-[90] p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80"
        role="dialog"
        aria-labelledby="save-reminder-title"
        aria-describedby="save-reminder-desc"
      >
        <div className="bg-slate-900 px-5 py-4 flex items-center gap-4">
          <CountdownRing seconds={secondsLeft} total={countdownSeconds} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-wide text-emerald-300/90 mb-1">
              Kayıt Hatırlatması
            </p>
            <h3 id="save-reminder-title" className="text-base font-semibold text-white leading-snug">
              {isLogout ? 'Çıkmadan Önce Kaydedin' : 'Kaydetmeyi Unutmayın'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 tabular-nums">
              Otomatik kapanma: {secondsLeft} sn
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <p id="save-reminder-desc" className="text-sm text-slate-600 leading-relaxed">
            Raporda kaydedilmemiş değişiklikler var{detailSuffix(detail)}.{bodyExtra}
          </p>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full rounded-xl bg-emerald-600 text-white py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {discardLabel}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-xl py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Yazmaya Devam Et
          </button>
        </div>
      </div>
    </div>
  );
}

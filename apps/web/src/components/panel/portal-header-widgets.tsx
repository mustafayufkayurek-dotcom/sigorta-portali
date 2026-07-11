'use client';

import { useEffect, useState } from 'react';

const _apiV1Base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API_V1 = _apiV1Base.endsWith('/api/v1') ? _apiV1Base : `${_apiV1Base}/api/v1`;

export function PortalExchangeRates({ tone = 'light' }: { tone?: 'dark' | 'light' }) {
  const [usd, setUsd] = useState<number | null>(null);
  const [eur, setEur] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`${API_V1}/widgets/exchange-rates`)
      .then((r) => r.json())
      .then((body) => {
        if (!active) return;
        const data = body?.data;
        if (data?.usd) {
          setUsd((data.usd.buyingRate + data.usd.sellingRate) / 2);
        }
        if (data?.eur) {
          setEur((data.eur.buyingRate + data.eur.sellingRate) / 2);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div
        className={`h-3.5 w-3.5 rounded-full border-2 animate-spin ${
          tone === 'light' ? 'border-slate-200 border-t-slate-500' : 'border-white/30 border-t-white'
        }`}
        aria-hidden="true"
      />
    );
  }

  const labelClass = tone === 'light' ? 'text-slate-500 font-medium' : 'text-blue-200 font-medium';
  const valueClass = tone === 'light' ? 'text-slate-800 font-semibold' : 'text-white font-semibold';
  const sepClass = tone === 'light' ? 'text-slate-300' : 'text-blue-300/40';

  return (
    <div className="flex items-center gap-2.5">
      <div className="text-[11px] tabular-nums">
        <span className={labelClass}>USD </span>
        <span className={valueClass}>{usd ? `₺${usd.toFixed(2)}` : '—'}</span>
      </div>
      <span className={`${sepClass} select-none`}>|</span>
      <div className="text-[11px] tabular-nums">
        <span className={labelClass}>EUR </span>
        <span className={valueClass}>{eur ? `₺${eur.toFixed(2)}` : '—'}</span>
      </div>
    </div>
  );
}

export function PortalLiveClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const dateStr = now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (compact) {
    return (
      <div className="text-right text-[11px] tabular-nums text-slate-500">
        <p className="font-semibold text-slate-800">{timeStr}</p>
        <p className="text-[10px] leading-tight">{dateStr}</p>
      </div>
    );
  }

  return (
    <div className="text-right">
      <p className="text-blue-200 text-[10px] leading-tight">{dateStr}</p>
      <p className="text-white text-lg font-bold tabular-nums tracking-wide">{timeStr}</p>
    </div>
  );
}

export const EXPERT_WHATSAPP_SUPPORT_URL = 'https://wa.me/905336330713';
export const EXPERT_WHATSAPP_SUPPORT_PHONE = '0533 633 07 13';

export function ExpertPortalContactStrip() {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/90 px-3 py-2 sm:px-5">
      <a
        href={EXPERT_WHATSAPP_SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-100"
      >
        WhatsApp Destek · {EXPERT_WHATSAPP_SUPPORT_PHONE}
      </a>
      <a
        href="tel:+908508852555"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
      >
        0 850 885 25 55
      </a>
      <a
        href="mailto:info@meridyenassistance.com"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
      >
        info@meridyenassistance.com
      </a>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { PortalExchangeRates, PortalLiveClock } from '@/components/panel/portal-header-widgets';

export type PortalCompactHeaderProps = {
  title: string;
  /** Hoş geldiniz rozeti — ad veya kısa metin */
  welcomeLabel?: string;
  /** Başlık altı: rozetler, şirket adı vb. */
  meta?: ReactNode;
  /** Kur/döviz + saat şeridi */
  showRatesAndClock?: boolean;
  /** Üst satır sağ / alt satır (mobil) butonları */
  actions?: ReactNode;
  /** Başlık altında ek satır (view mode, filtre vb.) */
  belowActions?: ReactNode;
  /** İletişim şeridi (alt) */
  contactStrip?: ReactNode;
  className?: string;
};

/**
 * Portal ana sayfaları — ince mavi şerit + beyaz kart + kompakt karşılama.
 * Admin DashboardHeader ile aynı görsel dil.
 */
export function PortalCompactHeader({
  title,
  welcomeLabel,
  meta,
  showRatesAndClock = false,
  actions,
  belowActions,
  contactStrip,
  className = '',
}: PortalCompactHeaderProps) {
  const trailing = showRatesAndClock ? (
    <>
      <PortalExchangeRates tone="light" />
      <PortalLiveClock compact />
    </>
  ) : null;

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
      <div className="px-3 py-3 sm:px-5 sm:py-3.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">{title}</h1>
              {welcomeLabel ? (
                <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  Hoş Geldiniz, {welcomeLabel}
                </span>
              ) : null}
            </div>
            {meta ? <div className="mt-2">{meta}</div> : null}
          </div>

          {(trailing || actions) ? (
            <>
              <div className="hidden shrink-0 flex-wrap items-center justify-end gap-2 lg:flex lg:max-w-[55%]">
                {trailing}
                {actions}
              </div>
              {trailing ? (
                <div className="flex flex-wrap items-center justify-end gap-3 lg:hidden">
                  {trailing}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {actions ? (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 lg:hidden">
            {actions}
          </div>
        ) : null}

        {belowActions ? (
          <div className="mt-3 border-t border-slate-100 pt-3">
            {belowActions}
          </div>
        ) : null}
      </div>

      {contactStrip}
    </div>
  );
}

export type PortalSubpageHeaderProps = {
  breadcrumb: ReactNode;
  title: string;
  actions?: ReactNode;
  className?: string;
};

/** Portal alt sayfaları — kompakt kart + breadcrumb + başlık */
export function PortalSubpageHeader({
  breadcrumb,
  title,
  actions,
  className = '',
}: PortalSubpageHeaderProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
      <div className="space-y-2 px-3 py-3 sm:px-5 sm:py-3.5">
        {breadcrumb}
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">{title}</h1>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

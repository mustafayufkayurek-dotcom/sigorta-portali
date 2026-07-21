'use client';

import type { ReactNode } from 'react';

/** Ortak tedarikçi kartı — Kayıtlı ve Alternatif sekmelerinde aynı yapı. */

function toTelHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

function FieldRow({
  label,
  children,
  testId,
  emphasize,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
  emphasize?: boolean;
}) {
  return (
    <p
      className={`mt-0.5 min-w-0 ${emphasize ? 'text-sm text-slate-900' : 'text-[11px] text-slate-600'}`}
      data-testid={testId}
    >
      <span className={`font-medium ${emphasize ? 'text-slate-700' : 'text-slate-700'}`}>{label}: </span>
      {children}
    </p>
  );
}

export type VendorCandidateCardProps = {
  name: string;
  phone?: string | null;
  /** Telefon yokken gösterilecek metin (varsayılan —) */
  phoneEmptyLabel?: string;
  address?: string | null;
  /** Alternatif: Puan (yoksa —) */
  rating?: number | null;
  /** Alternatif: Değerlendirme Sayısı (yoksa —) */
  reviewCount?: number | null;
  /** Kayıtlı: ek puan satırı (ör. Hizmet Kalitesi) — rating yokken */
  ratingLine?: string | null;
  /** Karar destek metrikleri (kalite, maliyet, dosya sayısı vb.) */
  metrics?: Array<{ label: string; value: string }>;
  /** Üst / en iyi aday — Sistem Önerisi rozeti */
  systemSuggestion?: boolean;
  /** Opsiyonel kaynak rozeti (sağlayıcı adı yok) */
  sourceBadge?: { label: string; testId?: string } | null;
  directionsUrl?: string | null;
  /** true: Yol Tarifi satırı (link yoksa —) */
  showDirections?: boolean;
  /** true: Web Sitesi satırı her zaman (URL yoksa —) */
  showWebsite?: boolean;
  /** Boşsa satır gizlenir (showWebsite false iken) */
  websiteUrl?: string | null;
  selected?: boolean;
  selectedLabel?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    testId?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    testId?: string;
  };
  testId?: string;
};

function formatPuan(rating: number | null | undefined): string {
  if (rating == null || !Number.isFinite(rating) || rating <= 0) return '—';
  const full = Math.min(5, Math.round(rating));
  return `${'★'.repeat(full)}${'☆'.repeat(5 - full)} ${rating.toFixed(1)}`;
}

export function VendorCandidateCard({
  name,
  phone,
  phoneEmptyLabel = '—',
  address,
  rating,
  reviewCount,
  ratingLine,
  metrics,
  systemSuggestion = false,
  sourceBadge = null,
  directionsUrl,
  showDirections = false,
  showWebsite = false,
  websiteUrl,
  selected,
  selectedLabel = 'Atandı',
  primaryAction,
  secondaryAction,
  testId = 'tedarikci-aday-kart',
}: VendorCandidateCardProps) {
  const phoneTrim = phone?.trim() || '';
  const telHref = phoneTrim ? toTelHref(phoneTrim) : '';
  const addressTrim = address?.trim() || '';
  const websiteTrim = websiteUrl?.trim() || '';
  const directionsTrim = directionsUrl?.trim() || '';
  const showPuanFields = rating !== undefined || reviewCount !== undefined;
  const showLinkRow = showDirections || showWebsite || Boolean(websiteTrim);

  return (
    <li
      className={`rounded-xl border bg-white px-3 py-2.5 ${
        selected ? 'border-blue-200 ring-1 ring-blue-100 bg-blue-50/40' : 'border-slate-200'
      }`}
      data-testid={testId}
    >
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <FieldRow label="Firma Adı" testId="tedarikci-kart-firma-adi" emphasize>
              <span className="font-semibold truncate inline-block max-w-full align-bottom">{name}</span>
            </FieldRow>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {sourceBadge ? (
                <span
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                  data-testid={sourceBadge.testId ?? 'tedarikci-kaynak-rozet'}
                >
                  {sourceBadge.label}
                </span>
              ) : null}
              {systemSuggestion ? (
                <span
                  className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"
                  data-testid="tedarikci-sistem-onerisi"
                >
                  Sistem Önerisi
                </span>
              ) : null}
            </div>
          </div>
          {selected ? (
            <span className="shrink-0 text-[11px] font-medium text-blue-700 mt-0.5">{selectedLabel}</span>
          ) : null}
        </div>

        <FieldRow label="Telefon" testId="tedarikci-kart-telefon">
          {phoneTrim && telHref ? (
            <a href={telHref} className="tabular-nums hover:text-blue-700 hover:underline">
              {phoneTrim}
            </a>
          ) : phoneTrim ? (
            <span className="tabular-nums">{phoneTrim}</span>
          ) : (
            <span className="text-slate-400">{phoneEmptyLabel}</span>
          )}
        </FieldRow>

        <FieldRow label="Adres" testId="tedarikci-kart-adres">
          {addressTrim ? (
            <span className="truncate inline-block max-w-full align-bottom" title={addressTrim}>
              {addressTrim}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </FieldRow>

        {showPuanFields ? (
          <>
            <FieldRow label="Puan" testId="tedarikci-kart-puan">
              <span className={rating != null && rating > 0 ? 'text-amber-700' : 'text-slate-400'}>
                {formatPuan(rating)}
              </span>
            </FieldRow>
            <FieldRow label="Değerlendirme Sayısı" testId="tedarikci-kart-degerlendirme">
              {reviewCount != null && Number.isFinite(reviewCount) && reviewCount > 0 ? (
                <span>{reviewCount}</span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </FieldRow>
          </>
        ) : ratingLine ? (
          <p className="text-[11px] text-amber-700 mt-0.5">{ratingLine}</p>
        ) : null}

        {metrics && metrics.length > 0 ? (
          <dl className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1" data-testid="tedarikci-kart-metrikler">
            {metrics.map((m) => (
              <div key={m.label} className="min-w-0">
                <dt className="text-[10px] text-slate-400 leading-tight">{m.label}</dt>
                <dd
                  className={`text-[11px] font-medium truncate ${
                    m.value === '—' ? 'text-slate-400' : 'text-slate-800'
                  }`}
                >
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {showLinkRow ? (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 items-center">
            {showWebsite || websiteTrim ? (
              websiteTrim ? (
                <a
                  href={websiteTrim}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  data-testid="tedarikci-kart-web-sitesi"
                >
                  Web Sitesi
                </a>
              ) : (
                <span className="text-[11px] text-slate-400" data-testid="tedarikci-kart-web-sitesi">
                  Web Sitesi: —
                </span>
              )
            ) : null}
            {showDirections ? (
              directionsTrim ? (
                <a
                  href={directionsTrim}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  data-testid="tedarikci-kart-yol-tarifi"
                >
                  Yol Tarifi
                </a>
              ) : (
                <span className="text-[11px] text-slate-400" data-testid="tedarikci-kart-yol-tarifi">
                  Yol Tarifi: —
                </span>
              )
            ) : null}
          </div>
        ) : null}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {primaryAction ? (
            <button
              type="button"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              data-testid={primaryAction.testId ?? 'tedarikci-kart-birincil'}
            >
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button
              type="button"
              disabled={secondaryAction.disabled}
              onClick={secondaryAction.onClick}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid={secondaryAction.testId ?? 'tedarikci-kart-ikincil'}
              title={secondaryAction.disabled ? 'Bu tedarikçi zaten havuzda' : undefined}
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      )}
    </li>
  );
}

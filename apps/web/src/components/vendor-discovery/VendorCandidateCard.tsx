'use client';

import type { ReactNode } from 'react';
import { Check, MapPin, Phone } from 'lucide-react';
import { VendorServiceDomainIcons } from './VendorServiceDomainIcons';

/** Ortak tedarikçi kartı — Kayıtlı ve Alternatif sekmelerinde aynı yapı. */

function toTelHref(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`;
  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    cleaned = `+90${cleaned.slice(1)}`;
  }
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
    <div
      className={`mt-0.5 min-w-0 ${emphasize ? 'text-sm text-slate-900' : 'text-[11px] text-slate-600'}`}
      data-testid={testId}
    >
      <span className={`font-medium ${emphasize ? 'text-slate-700' : 'text-slate-700'}`}>{label}: </span>
      {children}
    </div>
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
  /**
   * Bölgeye Uzaklık — il/ilçe eşleşmesi; kartta belirgin şerit (dosya sorumlusu kaçırmasın).
   */
  regionProximity?: { label: string; tone: 'same-district' | 'same-city' | 'other' | 'unknown' } | null;
  /** Üst / en iyi aday — Sistem Önerisi rozeti */
  systemSuggestion?: boolean;
  /** Memnuniyet + maliyet skoru (yüzde metni, ör. %92) */
  systemSuggestionPercent?: string | null;
  /** Opsiyonel kaynak rozeti (sağlayıcı adı yok) */
  sourceBadge?: { label: string; testId?: string } | null;
  /** Memnuniyet / maliyet uyarısı (operasyon metni) */
  warningText?: string | null;
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
  /** Hizmet kolları (acil branş / iş grubu) */
  serviceBranches?: string[] | null;
  /** Dosya konusu — ikon yedeği */
  serviceTypeHint?: string | null;
  /** Hizmet verdiği il / ilçe */
  serviceAreaLabels?: string[] | null;
  testId?: string;
};

function formatPuan(rating: number | null | undefined): string {
  if (rating == null || !Number.isFinite(rating) || rating <= 0) return '—';
  const full = Math.min(5, Math.round(rating));
  return `${'★'.repeat(full)}${'☆'.repeat(5 - full)} ${rating.toFixed(1)}`;
}

function proximityRailClass(tone: 'same-district' | 'same-city' | 'other' | 'unknown'): string {
  switch (tone) {
    case 'same-district':
      return 'border-l-[3px] border-l-slate-800';
    case 'same-city':
      return 'border-l-[3px] border-l-slate-400';
    case 'other':
      return 'border-l-[3px] border-l-amber-600';
    default:
      return 'border-l-[3px] border-l-slate-200';
  }
}

function proximityChipClass(tone: 'same-district' | 'same-city' | 'other' | 'unknown'): string {
  switch (tone) {
    case 'same-district':
      return 'border-emerald-600 bg-emerald-600 text-white';
    case 'same-city':
      return 'border-slate-200 bg-slate-100 text-slate-800';
    case 'other':
      return 'border-amber-200 bg-white text-amber-800';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
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
  regionProximity = null,
  systemSuggestion = false,
  systemSuggestionPercent = null,
  sourceBadge = null,
  warningText = null,
  directionsUrl,
  showDirections = false,
  showWebsite = false,
  websiteUrl,
  selected,
  selectedLabel = 'Atandı',
  primaryAction,
  secondaryAction,
  serviceBranches,
  serviceTypeHint = null,
  serviceAreaLabels,
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
      className={`relative overflow-hidden rounded-xl border bg-white px-3 py-2.5 ${
        selected ? 'border-blue-200 ring-1 ring-blue-100 bg-blue-50/40' : 'border-slate-200'
      } ${regionProximity ? proximityRailClass(regionProximity.tone) : ''}`}
      data-testid={testId}
    >
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2 pr-20">
          <div className="min-w-0 flex-1">
            <p
              className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-slate-900"
              data-testid="tedarikci-kart-firma-adi"
            >
              {sourceBadge ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                  data-testid={sourceBadge.testId ?? 'tedarikci-kaynak-rozet'}
                >
                  {sourceBadge.label}
                </span>
              ) : null}
              {systemSuggestion ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-blue-800"
                  data-testid="tedarikci-sistem-onerisi"
                >
                  <span className="text-[10px] font-semibold leading-none">Sistem Önerisi</span>
                  {systemSuggestionPercent ? (
                    <span className="text-sm font-bold tabular-nums leading-none tracking-tight text-blue-900">
                      {systemSuggestionPercent}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {regionProximity ? (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold tracking-tight ${proximityChipClass(regionProximity.tone)}`}
                  data-testid="tedarikci-bolgeye-uzaklik"
                  title="Bölgeye Uzaklık"
                >
                  <MapPin className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                  <span className="sr-only">Bölgeye Uzaklık: </span>
                  {regionProximity.label}
                </span>
              ) : null}
              <span className="min-w-0">
                <span className="font-medium text-slate-700">Firma Adı: </span>
                <span className="font-semibold">{name}</span>
              </span>
            </p>
          </div>
          {selected ? (
            <span className="shrink-0 text-[11px] font-medium text-blue-700 mt-0.5">{selectedLabel}</span>
          ) : null}
        </div>

        <FieldRow label="Telefon" testId="tedarikci-kart-telefon">
          {phoneTrim && telHref ? (
            <a
              href={telHref}
              className="inline-flex items-center gap-1 font-semibold tabular-nums text-brand-700 hover:underline"
              aria-label={`${phoneTrim} numarasını ara`}
            >
              <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
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

        {serviceAreaLabels && serviceAreaLabels.length > 0 ? (
          <FieldRow label="Hizmet Bölgeleri" testId="tedarikci-kart-hizmet-bolgeleri">
            <span className="leading-snug">{serviceAreaLabels.join(', ')}</span>
          </FieldRow>
        ) : null}

          <p className="mt-1.5 min-w-0 text-[13px] leading-snug text-slate-900" data-testid="tedarikci-kart-hizmet-kollari">
            <span className="font-medium text-slate-700">Hizmet Kolları: </span>
            <span className="font-semibold">
              {serviceBranches && serviceBranches.length > 0 ? serviceBranches.join(' · ') : '—'}
            </span>
          </p>

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
          <dl
            className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2"
            data-testid="tedarikci-kart-metrikler"
          >
            {metrics.map((m) => (
              <div key={m.label} className="min-w-0 text-center">
                <dt className="text-[11px] font-semibold text-slate-600 leading-tight">{m.label}</dt>
                <dd
                  className={`mt-0.5 text-sm font-semibold tabular-nums truncate ${
                    m.value === '—' ? 'text-slate-400' : 'text-slate-900'
                  }`}
                >
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {warningText ? (
          <p
            className="mt-1.5 text-[11px] font-medium text-status-warning leading-snug"
            data-testid="tedarikci-kalite-uyari"
          >
            {warningText}
          </p>
        ) : null}

        {showLinkRow ? (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 items-center">
            {showWebsite || websiteTrim ? (
              websiteTrim ? (
                <a
                  href={websiteTrim}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-brand-600 hover:text-blue-700 hover:underline"
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
                  className="text-[11px] font-medium text-brand-600 hover:text-blue-700 hover:underline"
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
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
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
          {primaryAction ? (
            <button
              type="button"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
              data-testid={primaryAction.testId ?? 'tedarikci-kart-birincil'}
            >
              <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
              {primaryAction.label}
            </button>
          ) : null}
        </div>
      )}
      <VendorServiceDomainIcons branches={serviceBranches} name={name} hint={serviceTypeHint} />
    </li>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';
import type { VendorRecommendation } from '@/utils/emergencyApi';
import { resolveRegionProximity } from '@/utils/vendor-region-proximity';
import { AlternativeVendorServicePanel } from './AlternativeVendorServicePanel';
import { VendorCandidateCard } from './VendorCandidateCard';

export type VendorTabId = 'kayitli' | 'alternatif';

/** Bölge havuzu üst sınırı (API ile aynı) */
const TOP_N = 20;
/** Memnuniyet + maliyet skoruna göre açık önerilen adet */
const TOP_FEATURED = 3;
const QUALITY_WARN_TEXT =
  'Memnuniyet veya maliyet değerlendirmesi olumsuz. Alternatif tedarikçi arayın.';

function formatScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return '—';
  return (Math.round(score * 10) / 10).toFixed(1);
}

function formatCost(cost: number | null | undefined): string {
  if (cost == null || !Number.isFinite(cost)) return '—';
  return `${Number(cost).toLocaleString('tr-TR')} TL`;
}

function formatLastWorkedAgo(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const then = new Date(d);
  then.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (days < 0) return '—';
  if (days === 0) return 'Bugün';
  return `${days} Gün Önce`;
}

function formatCompletedCount(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count)) return '—';
  return String(count);
}

/** Mevcut ranking alanlarından karar gerekçesi — eksik alan = — */
function rationaleMetrics(v: VendorRecommendation): Array<{ label: string; value: string }> {
  return [
    { label: 'Hizmet Kalitesi', value: formatScore(v.avgServiceScore) },
    { label: 'Ortalama Maliyet', value: formatCost(v.avgCost) },
    { label: 'Tamamlanan Dosya Sayısı', value: formatCompletedCount(v.completedFileCount) },
    { label: 'Son Çalışma', value: formatLastWorkedAgo(v.lastWorkedAt) },
  ];
}

function locationLine(v: VendorRecommendation): string {
  return [v.district, v.city].filter(Boolean).join(' · ');
}

type Props = {
  title?: string;
  helpText?: string;
  assignedBadge?: boolean;
  loading: boolean;
  vendors: VendorRecommendation[];
  assignedVendorId?: string | null;
  assignLoading?: boolean;
  onAssign: (vendorId: string) => void | Promise<void>;
  /** Red / zorunlu alternatif — Alternatif sekmesini aç */
  preferAlternatif?: boolean;
  city?: string;
  district?: string;
  serviceType?: string;
  category?: string;
  onAlternativeAssigned?: (vendor: {
    id: string;
    name: string;
    phone?: string | null;
  }) => void | Promise<void>;
  onSavedToPool?: (vendor: {
    id: string;
    name: string;
    phone?: string | null;
  }) => void | Promise<void>;
  /** false: çekmecede kart boyu küçülmesin (faaliyet ikonları görünsün) */
  fillHeight?: boolean;
};

function formatSuggestionPercent(v: VendorRecommendation): string {
  const raw = v.compositeScore;
  if (raw == null || !Number.isFinite(raw)) return '—';
  const pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
  return `%${Math.max(0, Math.min(100, pct))}`;
}

function VendorCardRow({
  v,
  fileCity,
  fileDistrict,
  fileServiceType,
  featured,
  assignedVendorId,
  assignLoading,
  onAssign,
}: {
  v: VendorRecommendation;
  fileCity?: string;
  fileDistrict?: string;
  fileServiceType?: string;
  featured: boolean;
  assignedVendorId?: string | null;
  assignLoading: boolean;
  onAssign: (vendorId: string) => void | Promise<void>;
}) {
  const selected = assignedVendorId === v.id;
  const regionProximity = resolveRegionProximity({
    fileCity,
    fileDistrict,
    vendorCity: v.city,
    vendorDistrict: v.district,
  });

  return (
    <VendorCandidateCard
      name={v.name}
      phone={v.phone}
      address={locationLine(v) || null}
      serviceBranches={v.serviceBranches}
      serviceTypeHint={fileServiceType}
      serviceAreaLabels={v.serviceAreaLabels?.length ? v.serviceAreaLabels : undefined}
      metrics={rationaleMetrics(v)}
      regionProximity={regionProximity}
      systemSuggestion={featured}
      systemSuggestionPercent={featured ? formatSuggestionPercent(v) : null}
      selected={selected}
      warningText={v.qualityWarning ? QUALITY_WARN_TEXT : null}
      testId="tedarikci-oneri"
      primaryAction={
        selected
          ? undefined
          : {
              label: 'Dosyaya Ata',
              onClick: () => void onAssign(v.id),
              disabled: assignLoading || Boolean(assignedVendorId),
              testId: 'tedarikci-ata',
            }
      }
    />
  );
}

/**
 * Önerilen Tedarikçiler — karar destek sekmeleri.
 * Sekme 1: Kayıtlı Tedarikçiler (varsayılan) — üstte skorlu ilk 3; diğerleri kapalı/açılır
 * Sekme 2: Alternatif Öneriler — yalnızca sekmeden
 */
export function RecommendedVendorsTabs({
  title = 'Önerilen Tedarikçiler',
  helpText = 'Dosya için tedarikçi seçin veya alternatif önerin',
  assignedBadge = false,
  loading,
  vendors,
  assignedVendorId,
  assignLoading = false,
  onAssign,
  preferAlternatif = false,
  city,
  district,
  serviceType,
  category = 'acil',
  onAlternativeAssigned,
  onSavedToPool,
  fillHeight = true,
}: Props) {
  const ranked = useMemo(() => {
    const list = [...vendors];
    list.sort((a, b) => {
      if (a.rank != null && b.rank != null) return a.rank - b.rank;
      const ca = a.compositeScore ?? a.avgServiceScore ?? 0;
      const cb = b.compositeScore ?? b.avgServiceScore ?? 0;
      return cb - ca;
    });
    return list.slice(0, TOP_N);
  }, [vendors]);

  const featured = useMemo(() => ranked.slice(0, TOP_FEATURED), [ranked]);
  const rest = useMemo(() => ranked.slice(TOP_FEATURED), [ranked]);

  const hasQualityWarning = ranked.some((v) => v.qualityWarning);

  const [tab, setTab] = useState<VendorTabId>('kayitli');
  const [restOpen, setRestOpen] = useState(false);

  useEffect(() => {
    if (preferAlternatif) {
      setTab('alternatif');
    }
  }, [preferAlternatif]);

  useEffect(() => {
    setRestOpen(false);
  }, [vendors]);

  return (
    <div
      className={`bg-white rounded-xl border border-slate-100 shadow-sm p-2.5 flex flex-col gap-1.5 min-w-0 ${
        fillHeight ? 'h-full min-h-0' : ''
      }`}
      data-testid="tedarikci-onerileri"
    >
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Building2 className="w-3.5 h-3.5 shrink-0 text-brand-600" strokeWidth={1.75} aria-hidden />
          <h3 className="text-sm font-semibold text-slate-800 truncate">{title}</h3>
        </div>
        {assignedBadge && (
          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            Atandı
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-500 leading-snug shrink-0" data-testid="tedarikci-onerileri-yardim">
        {helpText}
      </p>

      <div
        className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50/80 shrink-0"
        role="tablist"
        aria-label="Tedarikçi öneri sekmeleri"
        data-testid="tedarikci-sekmeler"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'kayitli'}
          onClick={() => setTab('kayitli')}
          className={`flex-1 text-center text-[11px] sm:text-xs font-semibold py-1.5 px-2 rounded-md transition-colors ${
            tab === 'kayitli'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          data-testid="sekme-kayitli-tedarikciler"
        >
          Kayıtlı Tedarikçiler
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'alternatif'}
          onClick={() => setTab('alternatif')}
          className={`flex-1 text-center text-[11px] sm:text-xs font-semibold py-1.5 px-2 rounded-md transition-colors ${
            tab === 'alternatif'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          data-testid="sekme-alternatif-oneriler"
        >
          Alternatif Öneriler
        </button>
      </div>

      {tab === 'kayitli' ? (
        <div
          className={fillHeight ? 'flex-1 flex flex-col min-h-0' : 'flex flex-col'}
          data-testid="sekme-kayitli-icerik"
          role="tabpanel"
        >
          {loading ? (
            <p className="text-xs text-slate-400 py-1 text-center">Öneriler yükleniyor...</p>
          ) : ranked.length > 0 ? (
            <>
              {hasQualityWarning ? (
                <p
                  className="mb-2 text-[11px] font-medium text-status-warning leading-snug"
                  data-testid="tedarikci-olumsuz-uyari"
                  role="status"
                >
                  Kayıtlı tedarikçilerde olumsuz değerlendirme var. Alternatif tedarikçi aramanız gerekir.
                </p>
              ) : null}
              <p className="mb-1.5 text-[11px] font-semibold text-slate-600" data-testid="tedarikci-oneri-baslik">
                Önerilen ({featured.length})
              </p>
              <ul className="space-y-2" data-testid="tedarikci-oneri-acik-liste">
                {featured.map((v) => (
                  <VendorCardRow
                    key={v.id}
                    v={v}
                    fileCity={city}
                    fileDistrict={district}
                    fileServiceType={serviceType}
                    featured
                    assignedVendorId={assignedVendorId}
                    assignLoading={assignLoading}
                    onAssign={onAssign}
                  />
                ))}
              </ul>
              {rest.length > 0 ? (
                <div className="mt-2 border-t border-slate-100 pt-2" data-testid="tedarikci-diger-kutu">
                  <button
                    type="button"
                    onClick={() => setRestOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    aria-expanded={restOpen}
                    data-testid="tedarikci-diger-ac-kapa"
                  >
                    <span>Diğer Kayıtlı Tedarikçiler ({rest.length})</span>
                    {restOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    )}
                  </button>
                  {restOpen ? (
                    <ul className="mt-2 space-y-2" data-testid="tedarikci-diger-liste">
                      {rest.map((v) => (
                        <VendorCardRow
                          key={v.id}
                          v={v}
                          fileCity={city}
                          fileDistrict={district}
                          fileServiceType={serviceType}
                          featured={false}
                          assignedVendorId={assignedVendorId}
                          assignLoading={assignLoading}
                          onAssign={onAssign}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div
              className="flex flex-col gap-2 min-h-0"
              data-testid="tedarikci-bolge-bos"
              role="status"
            >
              <p className="text-xs font-semibold text-slate-700 text-center leading-snug">
                Bu İl Ve İlçede Kayıtlı Tedarikçi Yok
              </p>
              <p className="text-[11px] text-slate-500 text-center leading-snug">
                Alternatif önerilere bakın. Yeni kayıt sonraki dosyalarda önerilir.
              </p>
              <button
                type="button"
                onClick={() => setTab('alternatif')}
                className="mx-auto rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                data-testid="tedarikci-alternatife-gec"
              >
                Alternatif Önerilere Bak
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className={fillHeight ? 'flex-1 flex flex-col min-h-0' : 'flex flex-col'}
          data-testid="sekme-alternatif-icerik"
          role="tabpanel"
        >
          <AlternativeVendorServicePanel
            city={city}
            district={district}
            serviceType={serviceType}
            category={category}
            embedded
            active={tab === 'alternatif'}
            autoExpandWhenEmpty
            onAssigned={onAlternativeAssigned}
            onSavedToPool={onSavedToPool}
          />
        </div>
      )}
    </div>
  );
}

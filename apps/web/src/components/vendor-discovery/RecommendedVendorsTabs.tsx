'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import type { VendorRecommendation } from '@/utils/emergencyApi';
import { AlternativeVendorServicePanel } from './AlternativeVendorServicePanel';
import { VendorCandidateCard } from './VendorCandidateCard';

export type VendorTabId = 'kayitli' | 'alternatif';

const TOP_N = 5;

function formatScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return '—';
  return (Math.round(score * 10) / 10).toFixed(1);
}

function formatCost(cost: number | null | undefined): string {
  if (cost == null || !Number.isFinite(cost)) return '—';
  return `${Number(cost).toLocaleString('tr-TR')} TL`;
}

function formatDistance(v: VendorRecommendation): string {
  const label = v.distanceLabel?.trim();
  if (label) return label;
  if (v.distanceKm != null && Number.isFinite(v.distanceKm)) {
    return `${(Math.round(v.distanceKm * 10) / 10).toLocaleString('tr-TR')} km`;
  }
  return '—';
}

function formatLastWorkedAt(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR');
}

function formatCompletedCount(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count)) return '—';
  return String(count);
}

/** Mevcut ranking alanlarından karar gerekçesi — eksik alan = — */
function rationaleMetrics(v: VendorRecommendation): Array<{ label: string; value: string }> {
  return [
    { label: 'Hizmet Kalitesi', value: formatScore(v.avgServiceScore) },
    { label: 'Bölgeye Uzaklık', value: formatDistance(v) },
    { label: 'Ortalama Maliyet', value: formatCost(v.avgCost) },
    { label: 'Tamamlanan Dosya Sayısı', value: formatCompletedCount(v.completedFileCount) },
    { label: 'Son Çalışma Tarihi', value: formatLastWorkedAt(v.lastWorkedAt) },
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
};

/**
 * Önerilen Tedarikçiler — karar destek sekmeleri.
 * Sekme 1: Kayıtlı Tedarikçiler (varsayılan)
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

  const [tab, setTab] = useState<VendorTabId>('kayitli');

  useEffect(() => {
    if (preferAlternatif) {
      setTab('alternatif');
    }
  }, [preferAlternatif]);

  return (
    <div
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-2.5 flex flex-col gap-1.5 min-w-0 h-full min-h-0"
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
          className="flex-1 flex flex-col min-h-0"
          data-testid="sekme-kayitli-icerik"
          role="tabpanel"
        >
          {loading ? (
            <p className="text-xs text-slate-400 py-1 text-center">Öneriler yükleniyor...</p>
          ) : ranked.length > 0 ? (
            <ul className="space-y-2">
              {ranked.map((v, index) => {
                const selected = assignedVendorId === v.id;
                return (
                  <VendorCandidateCard
                    key={v.id}
                    name={v.name}
                    phone={v.phone}
                    address={locationLine(v) || null}
                    metrics={rationaleMetrics(v)}
                    systemSuggestion={index === 0}
                    selected={selected}
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
              })}
            </ul>
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
          className="flex-1 flex flex-col min-h-0"
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

'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  formatCostMemoryLine,
  type VendorCostMemorySummary,
} from '@/utils/vendor-intelligence-profile';
import { API, authHeader } from './claim-detail-utils';
import { AlternativeVendorServicePanel } from '@/components/vendor-discovery/AlternativeVendorServicePanel';

type CostMemorySummary = VendorCostMemorySummary;

function formatMetricValue(value: string | null | undefined, empty = '—'): string {
  const t = value?.trim();
  return t ? t : empty;
}

function formatResponseHours(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} Dk`;
  return `${Math.round(hours * 10) / 10} Saat`;
}

export function VendorSuggestPanel({
  claimFileId,
  city,
  category,
  workGroupId,
  selectedVendorId,
  onSelect,
  onManual,
}: {
  claimFileId?: string;
  city?: string;
  category: string;
  workGroupId?: string;
  selectedVendorId: string;
  onSelect: (vendorId: string) => void;
  onManual: () => void;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const mapRecommendations = (recs: any[]) =>
      recs.map((rec) => ({
        id: rec.id,
        name: rec.name,
        operationGroup: rec.operationGroup ?? rec.costMemory?.operationGroup ?? null,
        canonicalLabel: rec.canonicalLabel ?? rec.costMemory?.canonicalLabel ?? null,
        originalServiceType:
          rec.originalServiceType ?? rec.costMemory?.originalServiceType ?? null,
        stats: {
          completedJobs: rec.completedFileCount ?? rec.stats?.completedJobs ?? 0,
          avgAmount: rec.avgCost ?? rec.stats?.avgAmount ?? null,
          costMemory: rec.costMemory ?? rec.stats?.costMemory ?? null,
          recommendationScore: rec.compositeScore ?? rec.stats?.recommendationScore ?? null,
          expertiseMatchScore: rec.expertiseMatchScore ?? rec.stats?.expertiseMatchScore ?? null,
          avgServiceScore: rec.avgServiceScore ?? rec.stats?.avgServiceScore ?? null,
          avgResponseTime: rec.avgResponseTime ?? rec.stats?.avgResponseTime ?? null,
        },
      }));

    if (claimFileId) {
      const params = new URLSearchParams({ limit: '3' });
      if (workGroupId) params.set('workGroupId', workGroupId);
      axios
        .get(`${API}/claim-files/${claimFileId}/vendors/recommended?${params}`, { headers: authHeader() })
        .then((r) => setSuggestions(mapRecommendations(r.data.data || [])))
        .catch(() => {
          const params = new URLSearchParams({ category });
          if (city) params.set('city', city);
          if (workGroupId) params.set('workGroupId', workGroupId);
          return axios.get(`${API}/vendors/suggest?${params}`, { headers: authHeader() })
            .then((res) => setSuggestions(res.data.data || []));
        })
        .catch(console.error)
        .finally(() => setLoading(false));
      return;
    }

    const params = new URLSearchParams({ category });
    if (city) params.set('city', city);
    if (workGroupId) params.set('workGroupId', workGroupId);
    axios.get(`${API}/vendors/suggest?${params}`, { headers: authHeader() })
      .then((r) => setSuggestions(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimFileId, city, category, workGroupId]);

  return (
    <div className="border border-indigo-100 rounded-xl bg-indigo-50/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-indigo-700">
          Önerilen Tedarikçiler{city ? ` (${city})` : ''}
        </p>
        <button type="button" onClick={onManual} className="text-xs text-slate-500 hover:text-slate-700 underline">Manuel Seç</button>
      </div>
      {loading ? (
        <p className="text-xs text-slate-400 py-2 text-center">Yükleniyor...</p>
      ) : suggestions.length === 0 ? (
        <p className="text-xs text-slate-400 py-2 text-center">Bu Kriterlerde Tedarikçi Bulunamadı.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {suggestions.slice(0, 3).map((v) => {
            const memory = v.stats?.costMemory as CostMemorySummary | null | undefined;
            const memoryLine = formatCostMemoryLine(memory ?? null);
            const operationGroup =
              (v.operationGroup as string | null | undefined)?.trim()
              || memory?.operationGroup?.trim()
              || memory?.canonicalLabel?.trim()
              || null;
            const canonical =
              (v.canonicalLabel as string | null | undefined)?.trim()
              || memory?.canonicalLabel?.trim()
              || null;
            const original =
              (v.originalServiceType as string | null | undefined)?.trim()
              || memory?.originalServiceType?.trim()
              || null;
            const terminologyParts = [canonical, original].filter((part, idx, arr) => {
              if (!part) return false;
              if (operationGroup && part.localeCompare(operationGroup, 'tr', { sensitivity: 'base' }) === 0) {
                return false;
              }
              return arr.findIndex((p) => p && p.localeCompare(part, 'tr', { sensitivity: 'base' }) === 0) === idx;
            });
            const qualityScore = v.stats?.avgServiceScore;
            const qualityText =
              qualityScore != null && Number.isFinite(qualityScore)
                ? `${Math.round(qualityScore * 10) / 10}/5`
                : v.stats?.recommendationScore != null
                  ? `Skor ${v.stats.recommendationScore}`
                  : null;
            const costMemoryText = memoryLine || (v.stats?.avgAmount != null
              ? `Ort. ${v.stats.avgAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}`
              : null);
            const responseText = formatResponseHours(v.stats?.avgResponseTime);
            const selected = selectedVendorId === v.id;
            const muted = selected ? 'text-indigo-100' : 'text-slate-500';
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{v.name}</span>
                  <span className={`text-xs shrink-0 ${selected ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {v.stats?.completedJobs ?? 0} iş
                    {v.stats?.recommendationScore != null && ` · Skor ${v.stats.recommendationScore}`}
                  </span>
                </div>
                {operationGroup && (
                  <p className={`text-[11px] mt-0.5 leading-snug ${muted}`}>
                    Hizmet: {operationGroup}
                    {terminologyParts.length > 0 ? ` · ${terminologyParts.join(' · ')}` : ''}
                  </p>
                )}
                <p className={`text-[11px] mt-0.5 leading-snug ${muted}`}>
                  Hizmet Kalitesi: {formatMetricValue(qualityText)}
                </p>
                <p className={`text-[11px] mt-0.5 leading-snug ${muted}`}>
                  Ortalama Maliyet: {formatMetricValue(costMemoryText, 'Veri yok')}
                </p>
                <p className={`text-[11px] mt-0.5 leading-snug ${muted}`}>
                  Müdahale Süresi: {responseText}
                </p>
              </button>
            );
          })}
        </div>
      )}
      {!loading && (
        <AlternativeVendorServicePanel
          city={city}
          serviceType={category}
          category={category}
          compact
          autoExpandWhenEmpty={suggestions.length === 0}
          onAssigned={async (vendor) => {
            onSelect(vendor.id);
          }}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from './claim-detail-utils';
import { RecommendedVendorsTabs } from '@/components/vendor-discovery/RecommendedVendorsTabs';
import type { VendorRecommendation } from '@/utils/emergencyApi';

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
  const [suggestions, setSuggestions] = useState<VendorRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const mapRecommendations = (recs: any[]): VendorRecommendation[] =>
      recs.map((rec) => ({
        id: rec.id,
        name: rec.name,
        phone: rec.phone ?? null,
        city: rec.city ?? city ?? null,
        district: rec.district ?? null,
        avgServiceScore: rec.avgServiceScore ?? rec.stats?.avgServiceScore ?? null,
        avgCost: rec.avgCost ?? rec.stats?.avgAmount ?? null,
        avgResponseTime: rec.avgResponseTime ?? rec.stats?.avgResponseTime ?? null,
        completedFileCount: rec.completedFileCount ?? rec.stats?.completedJobs ?? 0,
        compositeScore: rec.compositeScore ?? rec.stats?.recommendationScore ?? undefined,
        rank: rec.rank,
        distanceKm: rec.distanceKm ?? rec.stats?.distanceKm ?? null,
        distanceLabel: rec.distanceLabel ?? rec.stats?.distanceLabel ?? null,
        lastWorkedAt: rec.lastWorkedAt ?? rec.stats?.lastWorkedAt ?? null,
      }));

    if (claimFileId) {
      const params = new URLSearchParams({ limit: '5' });
      if (workGroupId) params.set('workGroupId', workGroupId);
      axios
        .get(`${API}/claim-files/${claimFileId}/vendors/recommended?${params}`, { headers: authHeader() })
        .then((r) => setSuggestions(mapRecommendations(r.data.data || [])))
        .catch(() => {
          const params = new URLSearchParams({ category });
          if (city) params.set('city', city);
          if (workGroupId) params.set('workGroupId', workGroupId);
          return axios.get(`${API}/vendors/suggest?${params}`, { headers: authHeader() })
            .then((res) => setSuggestions(mapRecommendations(res.data.data || [])));
        })
        .catch(console.error)
        .finally(() => setLoading(false));
      return;
    }

    const params = new URLSearchParams({ category });
    if (city) params.set('city', city);
    if (workGroupId) params.set('workGroupId', workGroupId);
    axios.get(`${API}/vendors/suggest?${params}`, { headers: authHeader() })
      .then((r) => setSuggestions(mapRecommendations(r.data.data || [])))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimFileId, city, category, workGroupId]);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onManual}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          Manuel Seç
        </button>
      </div>
      <RecommendedVendorsTabs
        loading={loading}
        vendors={suggestions}
        assignedVendorId={selectedVendorId || null}
        onAssign={(vendorId) => onSelect(vendorId)}
        city={city}
        serviceType={category}
        category={category}
        onAlternativeAssigned={async (vendor) => {
          onSelect(vendor.id);
        }}
      />
    </div>
  );
}

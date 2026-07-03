'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from './claim-detail-utils';

export function VendorSuggestPanel({
  city,
  category,
  selectedVendorId,
  onSelect,
  onManual,
}: {
  city?: string;
  category: string;
  selectedVendorId: string;
  onSelect: (vendorId: string) => void;
  onManual: () => void;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ category });
    if (city) params.set('city', city);
    setLoading(true);
    axios.get(`${API}/vendors/suggest?${params}`, { headers: authHeader() })
      .then((r) => setSuggestions(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [city, category]);

  return (
    <div className="border border-indigo-100 rounded-xl bg-indigo-50/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-indigo-700">Önerilen Tedarikçiler {city ? `(${city})` : ''}</p>
        <button type="button" onClick={onManual} className="text-xs text-slate-500 hover:text-slate-700 underline">Manuel Seç</button>
      </div>
      {loading ? (
        <p className="text-xs text-slate-400 py-2 text-center">Yükleniyor...</p>
      ) : suggestions.length === 0 ? (
        <p className="text-xs text-slate-400 py-2 text-center">Bu Kriterlerde Tedarikçi Bulunamadı.</p>
      ) : (
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {suggestions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${selectedVendorId === v.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{v.name}</span>
                <span className={`text-xs ${selectedVendorId === v.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {v.stats?.completedJobs ?? 0} iş
                  {v.stats?.availableCapacity != null && ` · K:${v.stats.availableCapacity}`}
                </span>
              </div>
              {v.stats?.avgAmount != null && (
                <p className={`text-xs mt-0.5 ${selectedVendorId === v.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                  Ort. {v.stats.avgAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

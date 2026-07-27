'use client';

import { API, authHeader } from '@/utils/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { SlidePanel } from '@/components/SlidePanel';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { DistrictCheckboxGrid } from '@/components/ui/DistrictCheckboxGrid';
import { useToast } from '@/contexts/ToastContext';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { fetchProvinceDistricts } from '@/utils/fetch-province-districts';

type Province = { id: string; name: string; plateCode?: number };

export type ExternalVendorSource =
  | 'google_places'
  | 'google_mock'
  | 'instagram_mock'
  | 'facebook_mock';

export interface ExternalVendorCandidate {
  externalId: string;
  name: string;
  address: string;
  city: string;
  district?: string;
  phone?: string;
  rating: number;
  reviewCount: number;
  source: ExternalVendorSource;
  mapsUrl: string;
  serviceTypes: string[];
  latitude?: number;
  longitude?: number;
}

export interface VendorDiscoverySearchContext {
  city: string;
  districts?: string[];
  serviceType: string;
  minRating: string;
  sessionId?: string;
}

interface VendorDiscoveryPanelProps {
  open: boolean;
  onClose: () => void;
  provinces: Province[];
  onAddAsVendor?: (candidate: ExternalVendorCandidate, context: VendorDiscoverySearchContext) => void;
}

const MIN_RATING_OPTIONS = [
  { value: '3.5', label: '3.5+' },
  { value: '4.0', label: '4.0+' },
  { value: '4.5', label: '4.5+' },
];

const SOURCE_LABELS: Record<ExternalVendorSource, string> = {
  google_places: 'Dış Kaynak',
  google_mock: 'Örnek Sonuç',
  instagram_mock: 'Örnek Sonuç',
  facebook_mock: 'Örnek Sonuç',
};

const MAX_DISTRICTS_PER_SEARCH = 5;

export function VendorDiscoveryPanel({ open, onClose, provinces, onAddAsVendor }: VendorDiscoveryPanelProps) {
  const { showToast } = useToast();
  const [provinceId, setProvinceId] = useState('');
  const [allDistrictsMode, setAllDistrictsMode] = useState(true);
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([]);
  const [serviceType, setServiceType] = useState('');
  const [minRating, setMinRating] = useState('4.0');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ExternalVendorCandidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [searchSource, setSearchSource] = useState<'google_places' | 'mock' | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);

  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ value: p.id, label: p.name })),
    [provinces],
  );

  const selectedProvince = provinces.find((p) => p.id === provinceId);

  useEffect(() => {
    if (!open) return;
    setProvinceId('');
    setAllDistrictsMode(true);
    setSelectedDistrictIds([]);
    setServiceType('');
    setMinRating('4.0');
    setResults([]);
    setSearched(false);
    setDistricts([]);
    setSearchSource(null);
    setSessionId(undefined);
    setQuota(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    axios
      .get(`${API}/vendor-discovery/quota`, { headers: authHeader() })
      .then((r) => setQuota(r.data.data ?? null))
      .catch(() => setQuota(null));
  }, [open]);

  useEffect(() => {
    if (!provinceId) {
      setDistricts([]);
      setSelectedDistrictIds([]);
      setAllDistrictsMode(true);
      return;
    }
    setSelectedDistrictIds([]);
    setAllDistrictsMode(true);
    setLoadingDistricts(true);
    const controller = new AbortController();
    void fetchProvinceDistricts(provinceId, { signal: controller.signal, toastOnError: true })
      .then((rows) => {
        if (!controller.signal.aborted) setDistricts(rows);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDistricts(false);
      });
    return () => { controller.abort(); };
  }, [provinceId]);

  const selectedDistrictNames = useMemo(
    () => selectedDistrictIds
      .map((id) => districts.find((d) => d.id === id)?.name)
      .filter((name): name is string => Boolean(name)),
    [selectedDistrictIds, districts],
  );

  const toggleDistrict = (districtId: string) => {
    setAllDistrictsMode(false);
    setSelectedDistrictIds((prev) =>
      prev.includes(districtId) ? prev.filter((id) => id !== districtId) : [...prev, districtId],
    );
  };

  const selectAllDistricts = () => {
    setAllDistrictsMode(false);
    setSelectedDistrictIds(districts.map((d) => d.id));
  };

  const handleSearch = useCallback(async () => {
    if (!selectedProvince) {
      showToast('warning', 'Lütfen il seçin.');
      return;
    }
    const trimmedService = serviceType.trim();
    if (!trimmedService) {
      showToast('warning', 'Lütfen hizmet türü girin.');
      return;
    }
    if (!allDistrictsMode && selectedDistrictNames.length === 0) {
      showToast('warning', 'En az bir ilçe seçin veya "Tüm İlçeler"i işaretleyin.');
      return;
    }
    if (!allDistrictsMode && selectedDistrictNames.length > MAX_DISTRICTS_PER_SEARCH) {
      showToast(
        'info',
        `En fazla ${MAX_DISTRICTS_PER_SEARCH} ilçe ile arama yapılır; seçiminizin ilk ${MAX_DISTRICTS_PER_SEARCH} ilçesi kullanılacak.`,
      );
    }

    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        city: selectedProvince.name,
        serviceType: trimmedService,
        minRating,
      });
      if (!allDistrictsMode && selectedDistrictNames.length > 0) {
        params.set('districts', selectedDistrictNames.slice(0, MAX_DISTRICTS_PER_SEARCH).join(','));
      }

      const r = await axios.get(`${API}/vendor-discovery/search?${params}`, { headers: authHeader() });
      setResults(r.data.data || []);
      setSearchSource(r.data.meta?.source ?? 'mock');
      setSessionId(r.data.meta?.sessionId);
      axios
        .get(`${API}/vendor-discovery/quota`, { headers: authHeader() })
        .then((qr) => setQuota(qr.data.data ?? null))
        .catch(() => {});
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        showToast('warning', err.response.data?.message ?? 'Günlük arama limitine ulaştınız.');
      } else if (axios.isAxiosError(err) && err.response?.data?.message) {
        showToast('error', String(err.response.data.message));
      } else {
        showToast('error', 'Dış kaynak araması başarısız. Bağlantınızı kontrol edip tekrar deneyin.');
      }
      setResults([]);
      setSearchSource(null);
      setSessionId(undefined);
    } finally {
      setLoading(false);
    }
  }, [selectedProvince, serviceType, minRating, allDistrictsMode, selectedDistrictNames, showToast]);

  const handleAddAsVendor = (candidate: ExternalVendorCandidate) => {
    if (!selectedProvince) return;

    const context: VendorDiscoverySearchContext = {
      city: selectedProvince.name,
      districts: allDistrictsMode ? undefined : selectedDistrictNames,
      serviceType: serviceType.trim(),
      minRating,
      sessionId,
    };

    if (onAddAsVendor) {
      onAddAsVendor(candidate, context);
      return;
    }

    showToast('info', `"${candidate.name}" — tedarikçi formuna aktarım yapılandırılmamış.`);
  };

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="Dış Kaynakta Ara"
      subtitle="Dış kaynaklardan tedarikçi adayı bulun"
      width={520}
    >
      <div className="p-5 space-y-5">
        {searched && searchSource === 'google_places' && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Canlı Sonuç
            </span>
            <span>Dış kaynak sonuçları getirildi.</span>
          </div>
        )}
        {searched && searchSource === 'mock' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            Alternatif tedarikçi şu anda önerilemiyor. Lütfen daha sonra tekrar deneyin.
          </div>
        )}

        <form autoComplete="off" onSubmit={(e) => e.preventDefault()} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">İl</label>
            <SearchableSelect
              value={provinceId}
              onChange={setProvinceId}
              options={provinceOptions}
              placeholder="İl seçin"
              disableBrowserAutocomplete
              inputClassName="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-xs font-medium text-slate-600">İlçe</label>
              {provinceId && districts.length > 0 && !allDistrictsMode && (
                <span className="text-[11px] text-slate-500">
                  {selectedDistrictIds.length}/{districts.length} seçili
                </span>
              )}
            </div>

            {provinceId ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allDistrictsMode}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAllDistrictsMode(checked);
                      if (checked) setSelectedDistrictIds([]);
                    }}
                    className="rounded accent-brand-600"
                  />
                  Tüm İlçeler (İl Geneli)
                </label>

                {!allDistrictsMode && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={selectAllDistricts}
                        className="text-xs font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg"
                      >
                        Tümünü Seç
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDistrictIds([])}
                        className="text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg"
                      >
                        Temizle
                      </button>
                    </div>
                    <DistrictCheckboxGrid
                      districts={districts}
                      loading={loadingDistricts}
                      isChecked={(districtId) => selectedDistrictIds.includes(districtId)}
                      onToggle={toggleDistrict}
                      maxHeightClass="max-h-44"
                      gridClassName="grid grid-cols-2 gap-1.5"
                      accentClass="accent-brand-600"
                    />
                    {selectedDistrictIds.length > MAX_DISTRICTS_PER_SEARCH && (
                      <p className="text-[11px] text-amber-700">
                        En fazla {MAX_DISTRICTS_PER_SEARCH} ilçe birleştirilir; fazlası aramaya dahil edilmez.
                      </p>
                    )}
                  </>
                )}

                {allDistrictsMode && (
                  <p className="text-[11px] text-slate-500">
                    Arama tüm il genelinde yapılır. Şehir merkezi birden fazla ilçeyi kapsıyorsa bu seçenek uygundur.
                  </p>
                )}

                {!allDistrictsMode && districts.length === 0 && !loadingDistricts && (
                  <p className="text-xs text-slate-400">Bu il için ilçe listesi yüklenemedi.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2">Önce il seçin.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hizmet Türü</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              placeholder="Örn. Camcı, Sıvacı, Boyacı"
              value={serviceType}
              autoComplete="off"
              onChange={(e) => setServiceType(e.target.value)}
              onBlur={(e) => {
                const v = toTitleCaseTR(e.target.value.trim());
                if (v) setServiceType(v);
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Min. Puan</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
            >
              {MIN_RATING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || (quota != null && quota.remaining <= 0)}
            className="btn-primary w-full justify-center"
          >
            {loading ? 'Aranıyor…' : 'Ara'}
          </button>
          {quota != null && (
            <p className="text-[11px] text-slate-500 text-center">
              Bugün {quota.used}/{quota.limit} arama kullanıldı — {quota.remaining} kalan
            </p>
          )}
        </form>

        {searched && !loading && results.length === 0 && (
          <div className="text-center py-8 text-sm text-slate-500">
            Filtrelere uyan aday bulunamadı. Farklı il veya hizmet türü deneyin.
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500">
              İlk {results.length} Aday
            </p>
            {results.map((candidate) => (
              <div
                key={candidate.externalId}
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{candidate.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{candidate.address}</p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                    {SOURCE_LABELS[candidate.source]}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="font-medium text-amber-700">
                    ⭐ {candidate.rating.toFixed(1)} ({candidate.reviewCount} yorum)
                  </span>
                  {candidate.phone && <span>{candidate.phone}</span>}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={candidate.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-brand-600 hover:text-blue-800"
                  >
                    Haritada Aç
                  </a>
                  <button
                    type="button"
                    onClick={() => handleAddAsVendor(candidate)}
                    className="text-xs font-medium text-brand-600 hover:text-brand-800"
                  >
                    Tedarikçi Olarak Ekle
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SlidePanel>
  );
}

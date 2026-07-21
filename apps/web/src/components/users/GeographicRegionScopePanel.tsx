'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { DistrictCheckboxGrid } from '@/components/ui/DistrictCheckboxGrid';
import { isDistrictAreaChecked } from '@/utils/service-area-helpers';
import {
  GEOGRAPHIC_REGION_LABELS,
  getProvincesForRegionCode,
  getRegionCodeFromApiCode,
  type ProvinceLike,
} from '@/utils/turkey-geographic-regions';

export interface GeographicRegionOption {
  id: string;
  code: string;
  name: string;
}

export interface DistrictOption {
  id: string;
  name: string;
}

export interface ServiceAreaLike {
  provinceId: string;
  districtId: string | null;
  provinceName?: string;
  districtName?: string | null;
}

interface GeographicRegionScopePanelProps {
  regions: GeographicRegionOption[];
  provinces: ProvinceLike[];
  selectedRegionIds: string[];
  serviceAreas: ServiceAreaLike[];
  countrywide: boolean;
  onCountrywideChange: (countrywide: boolean) => void;
  onToggleRegion: (regionId: string, checked: boolean) => void;
  onToggleDistrict: (
    provinceId: string,
    districtId: string,
    districtsInProvince: DistrictOption[],
  ) => void;
  /** İl geneli (tüm ilçeler) — ilçe ince ayarını temizler / il kaydı ekler */
  onSelectAllDistrictsInProvince?: (
    provinceId: string,
    districtsInProvince: DistrictOption[],
  ) => void;
  loadDistricts: (provinceId: string) => Promise<DistrictOption[]>;
  error?: string;
}

export function GeographicRegionScopePanel({
  regions,
  provinces,
  selectedRegionIds,
  serviceAreas,
  countrywide,
  onCountrywideChange,
  onToggleRegion,
  onToggleDistrict,
  onSelectAllDistrictsInProvince,
  loadDistricts,
  error,
}: GeographicRegionScopePanelProps) {
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [expandedProvinces, setExpandedProvinces] = useState<Set<string>>(new Set());
  const [districtCache, setDistrictCache] = useState<Record<string, DistrictOption[]>>({});
  const [loadingProvinceId, setLoadingProvinceId] = useState<string | null>(null);

  const sortedRegions = useMemo(
    () => [...regions].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [regions],
  );

  const districtRefinements = useMemo(
    () => serviceAreas.filter((area) => Boolean(area.districtId)),
    [serviceAreas],
  );

  const toggleRegionExpand = (regionId: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) next.delete(regionId);
      else next.add(regionId);
      return next;
    });
  };

  const ensureDistrictsLoaded = useCallback(async (provinceId: string) => {
    if (districtCache[provinceId]) return districtCache[provinceId];
    setLoadingProvinceId(provinceId);
    try {
      const list = await loadDistricts(provinceId);
      setDistrictCache((prev) => ({ ...prev, [provinceId]: list }));
      return list;
    } finally {
      setLoadingProvinceId((current) => (current === provinceId ? null : current));
    }
  }, [districtCache, loadDistricts]);

  const toggleProvinceExpand = async (provinceId: string) => {
    const willExpand = !expandedProvinces.has(provinceId);
    setExpandedProvinces((prev) => {
      const next = new Set(prev);
      if (next.has(provinceId)) next.delete(provinceId);
      else next.add(provinceId);
      return next;
    });
    if (willExpand) {
      await ensureDistrictsLoaded(provinceId);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">Bölgeler</p>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={countrywide}
            onChange={(e) => onCountrywideChange(e.target.checked)}
            className="rounded border-slate-300 text-blue-600"
          />
          Tüm Türkiye
        </label>
      </div>

      {countrywide && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-800">
          <p className="font-medium">Tüm Türkiye seçili — bölge listesi gizlendi.</p>
          <p className="mt-1 text-blue-700">
            Marmara, Ege, Akdeniz, İç Anadolu, Karadeniz, Doğu Anadolu veya Güneydoğu Anadolu gibi
            belirli coğrafi bölgeler atamak için yukarıdaki <span className="font-semibold">Tüm Türkiye</span>{' '}
            işaretini kaldırın; ardından iller ve isteğe bağlı ilçeler açılır.
          </p>
        </div>
      )}

      {!countrywide && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
          {sortedRegions.length === 0 ? (
            <p className="text-xs text-amber-700 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              Coğrafi bölge listesi yüklenemedi. Ayarlar → Bölgesel Zamlar ekranından &quot;7 Coğrafi Bölgeyi Yükle&quot;
              ile kayıtları oluşturabilir veya sayfayı yenileyebilirsiniz.
            </p>
          ) : (
            sortedRegions.map((region) => {
              const regionCode = getRegionCodeFromApiCode(region.code);
              const regionProvinces = regionCode ? getProvincesForRegionCode(regionCode, provinces) : [];
              const checked = selectedRegionIds.includes(region.id);
              const expanded = expandedRegions.has(region.id);
              const label = regionCode ? GEOGRAPHIC_REGION_LABELS[regionCode] : region.name;

              return (
                <div key={region.id} className="rounded-lg border border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <label className="flex flex-1 items-center gap-2 text-sm text-slate-700 cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onToggleRegion(region.id, e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 flex-shrink-0"
                      />
                      <span className="font-medium truncate">{label}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {regionProvinces.length} il
                      </span>
                    </label>
                    {checked && regionProvinces.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleRegionExpand(region.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-white hover:text-slate-700"
                        aria-expanded={expanded}
                      >
                        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        İller
                      </button>
                    )}
                  </div>

                  {checked && expanded && regionProvinces.length > 0 && (
                    <div className="border-t border-slate-100 px-3 pb-3 pt-2 space-y-2">
                      <p className="text-[11px] text-slate-500">
                        İl seçildiğinde <span className="font-medium text-slate-600">Tüm İlçeler</span> veya tek tek
                        ilçe seçebilirsiniz. İlçe seçilmezse bölgedeki tüm il kapsanır.
                      </p>
                      {regionProvinces
                        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
                        .map((province) => {
                          const provinceExpanded = expandedProvinces.has(province.id);
                          const districts = districtCache[province.id] ?? [];
                          const hasDistrictRefinement = serviceAreas.some(
                            (area) => area.provinceId === province.id && area.districtId,
                          );
                          const hasWholeProvince = serviceAreas.some(
                            (area) => area.provinceId === province.id && !area.districtId,
                          );
                          const allDistrictsActive =
                            hasWholeProvince
                            || (!hasDistrictRefinement && checked)
                            || (
                              districts.length > 0
                              && districts.every((d) =>
                                isDistrictAreaChecked(serviceAreas, province.id, d.id),
                              )
                            );

                          return (
                            <div key={province.id} className="rounded-lg border border-slate-100 bg-white">
                              <button
                                type="button"
                                onClick={() => toggleProvinceExpand(province.id)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  {provinceExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{province.name}</span>
                                </span>
                                {hasDistrictRefinement ? (
                                  <span className="text-[11px] text-blue-600 flex-shrink-0">İlçe İnce Ayarı</span>
                                ) : allDistrictsActive ? (
                                  <span className="text-[11px] text-emerald-600 flex-shrink-0">Tüm İlçeler</span>
                                ) : null}
                              </button>

                              {provinceExpanded && (
                                <div className="border-t border-slate-100 px-3 pb-3 pt-2 space-y-2">
                                  {loadingProvinceId === province.id && districts.length === 0 ? (
                                    <p className="text-xs text-slate-400 py-2">İlçeler yükleniyor…</p>
                                  ) : (
                                    <>
                                      {onSelectAllDistrictsInProvince && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onSelectAllDistrictsInProvince(province.id, districts)
                                          }
                                          className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                                            allDistrictsActive && !hasDistrictRefinement
                                              ? 'border-blue-300 bg-blue-50 text-blue-800'
                                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                          }`}
                                          data-testid="bolge-tum-ilceler"
                                        >
                                          Tüm İlçeler
                                        </button>
                                      )}
                                      <DistrictCheckboxGrid
                                        districts={districts}
                                        maxHeightClass="max-h-36"
                                        gridClassName="grid gap-2 sm:grid-cols-3"
                                        accentClass="accent-blue-600"
                                        isChecked={(districtId) =>
                                          isDistrictAreaChecked(serviceAreas, province.id, districtId)
                                        }
                                        onToggle={(districtId) =>
                                          onToggleDistrict(province.id, districtId, districts)
                                        }
                                      />
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {(selectedRegionIds.length > 0 || districtRefinements.length > 0) && (
            <div className="pt-1">
              <p className="mb-1.5 text-xs font-medium text-slate-600">Seçili Kapsam</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedRegionIds.map((regionId) => {
                  const region = regions.find((item) => item.id === regionId);
                  if (!region) return null;
                  const regionCode = getRegionCodeFromApiCode(region.code);
                  const label = regionCode ? GEOGRAPHIC_REGION_LABELS[regionCode] : region.name;
                  return (
                    <span
                      key={regionId}
                      className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                    >
                      {label}
                    </span>
                  );
                })}
                {districtRefinements.map((area) => (
                  <span
                    key={`${area.provinceId}:${area.districtId}`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                  >
                    {area.provinceName ?? area.provinceId} / {area.districtName ?? area.districtId}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

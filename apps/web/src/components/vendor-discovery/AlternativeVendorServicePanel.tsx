'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { VendorCandidateCard } from './VendorCandidateCard';

export type AlternativeVendorCandidate = {
  externalId: string;
  name: string;
  address: string;
  city: string;
  district?: string;
  phone?: string;
  rating: number;
  reviewCount: number;
  serviceTypes: string[];
  latitude?: number;
  longitude?: number;
  /** Yol tarifi — API’den gelir; yoksa istemci adresle üretir */
  mapsUrl?: string;
  websiteUrl?: string;
  /** Karar gerekçesi — yalnızca API’de varsa gösterilir */
  distanceKm?: number | null;
  distanceLabel?: string | null;
  avgCost?: number | null;
  completedFileCount?: number | null;
  lastWorkedAt?: string | null;
};

type AlternativeMeta = {
  configured: boolean;
  code: string;
  message: string;
  sessionId?: string;
  count?: number;
};

type ActionMode = 'assign_file' | 'save_pool';

type PendingAction = {
  mode: ActionMode;
  candidate: AlternativeVendorCandidate;
};

/** Kullanıcıya teknik sağlayıcı / API dili sızmasın (Kural 8). */
function toUserFacingSearchMessage(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  if (!t) {
    return 'Alternatif tedarikçi şu anda önerilemiyor. Lütfen daha sonra tekrar deneyin.';
  }
  if (/google|places|api|yapılandır/i.test(t)) {
    return 'Alternatif tedarikçi şu anda önerilemiyor. Lütfen daha sonra tekrar deneyin.';
  }
  return t;
}

/** UI’da sağlayıcı adı yazmadan yol tarifi linki. */
function buildDirectionsUrl(c: AlternativeVendorCandidate): string | null {
  if (c.mapsUrl?.trim()) return c.mapsUrl.trim();
  if (c.latitude != null && c.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`;
  }
  const q = [c.name, c.address, c.district, c.city].filter(Boolean).join(' ');
  if (!q.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function AlternativeVendorServicePanel({
  city,
  district,
  serviceType,
  category = 'acil',
  vendorType = 'hizmet',
  /** Sekme içinde: arama otomatik, CTA gizli */
  embedded = false,
  autoExpandWhenEmpty = true,
  forceExpand = false,
  compact = false,
  active = true,
  onAssigned,
  onSavedToPool,
}: {
  city?: string;
  district?: string;
  serviceType?: string;
  category?: string;
  vendorType?: string;
  embedded?: boolean;
  /** Meridyen önerisi yokken CTA’yı açık göster (standalone) */
  autoExpandWhenEmpty?: boolean;
  /** Red / manuel — paneli açık tut (aynı sayfa) */
  forceExpand?: boolean;
  compact?: boolean;
  /** Sekme aktifken arama tetiklenir */
  active?: boolean;
  onAssigned?: (vendor: { id: string; name: string; phone?: string | null }) => void | Promise<void>;
  onSavedToPool?: (vendor: { id: string; name: string; phone?: string | null }) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(embedded || autoExpandWhenEmpty || forceExpand);

  useEffect(() => {
    if (forceExpand) setExpanded(true);
  }, [forceExpand]);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<AlternativeVendorCandidate[]>([]);
  const [meta, setMeta] = useState<AlternativeMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const canSearch = Boolean(city?.trim() && serviceType?.trim());
  const panelOpen = embedded ? active : expanded;

  const runSearch = useCallback(async () => {
    if (!city?.trim() || !serviceType?.trim()) {
      setError('Arama için il ve hizmet türü gerekli.');
      return;
    }
    setLoading(true);
    setError(null);
    setActionMsg(null);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        city: city.trim(),
        serviceType: serviceType.trim(),
      });
      if (district?.trim()) params.set('district', district.trim());
      const r = await axios.get(`${API}/vendor-discovery/alternative-search?${params}`, {
        headers: authHeader(),
      });
      setResults(r.data.data || []);
      setMeta(r.data.meta ?? null);
      if (r.data.meta?.code === 'ALTERNATIVE_SERVICE_NOT_CONFIGURED') {
        setError(
          'Alternatif tedarikçi şu anda önerilemiyor. Lütfen daha sonra tekrar deneyin.',
        );
      } else if (r.data.meta?.message && !(r.data.data || []).length) {
        setError(toUserFacingSearchMessage(String(r.data.meta.message)));
      } else {
        setError(null);
      }
    } catch (err) {
      setResults([]);
      setMeta(null);
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        setError(
          toUserFacingSearchMessage(
            err.response.data?.message ?? 'Günlük arama limitine ulaşıldı.',
          ),
        );
      } else if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(toUserFacingSearchMessage(String(err.response.data.message)));
      } else {
        setError(
          'Alternatif tedarikçi şu anda önerilemiyor. Lütfen daha sonra tekrar deneyin.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [city, district, serviceType]);

  useEffect(() => {
    if (!panelOpen || !canSearch || searched) return;
    if (embedded || autoExpandWhenEmpty || forceExpand) {
      void runSearch();
    }
  }, [panelOpen, canSearch, searched, embedded, autoExpandWhenEmpty, forceExpand, runSearch]);

  function openAction(mode: ActionMode, candidate: AlternativeVendorCandidate) {
    setPending({ mode, candidate });
    setPhoneDraft(candidate.phone?.trim() || '');
    setActionMsg(null);
  }

  async function confirmAction() {
    if (!pending) return;
    const phone = phoneDraft.trim();
    if (!phone) {
      setActionMsg('Telefon zorunludur.');
      return;
    }
    setBusy(true);
    setActionMsg(null);
    try {
      const body = {
        name: toTitleCaseTR(pending.candidate.name),
        phone,
        address: pending.candidate.address || undefined,
        city: pending.candidate.city || city || undefined,
        district: pending.candidate.district || district || undefined,
        type: vendorType,
        category,
        notes:
          pending.mode === 'assign_file'
            ? 'Yalnızca bu dosyada kullanım.'
            : 'Meridyen Tedarikçi Havuzuna eklendi.',
      };
      const r = await axios.post(`${API}/vendors`, body, { headers: authHeader() });
      const vendor = r.data.data as { id: string; name: string; phone?: string | null };
      if (pending.mode === 'assign_file') {
        await onAssigned?.(vendor);
        setActionMsg(`"${vendor.name}" bu dosyaya atandı.`);
      } else {
        await onSavedToPool?.(vendor);
        setActionMsg(`"${vendor.name}" Meridyen Tedarikçi Havuzuna eklendi.`);
      }
      if (meta?.sessionId && pending.candidate.externalId) {
        axios
          .post(
            `${API}/vendor-discovery/link-import`,
            {
              sessionId: meta.sessionId,
              externalId: pending.candidate.externalId,
              vendorId: vendor.id,
            },
            { headers: authHeader() },
          )
          .catch(() => {});
      }
      setPending(null);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setActionMsg(String(err.response.data.message));
      } else {
        setActionMsg('Kayıt başarısız. Lütfen tekrar deneyin.');
      }
    } finally {
      setBusy(false);
    }
  }

  const resultsList = (
    <div className="space-y-1.5" data-testid="alternatif-tedarikci-panel">
      {!canSearch && (
        <div
          className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
          role="status"
        >
          <p className="text-xs font-semibold text-slate-700 text-center leading-snug">
            Öneri İçin İl Ve Hizmet Türü Gerekli
          </p>
        </div>
      )}
      {canSearch && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={loading}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-700 underline disabled:opacity-50"
          >
            {loading ? 'Aranıyor...' : searched ? 'Yenile' : 'Ara'}
          </button>
        </div>
      )}
      {loading ? (
        <p className="text-xs text-slate-400 py-1 text-center">Öneriler yükleniyor...</p>
      ) : error && results.length === 0 ? (
        <div
          className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5"
          role="status"
          data-testid="alternatif-bos-uyari"
        >
          <p className="text-xs font-medium text-amber-800 text-center leading-snug">{error}</p>
        </div>
      ) : searched && results.length === 0 ? (
        <div
          className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
          role="status"
          data-testid="alternatif-bos-uyari"
        >
          <p className="text-xs font-semibold text-slate-700 text-center leading-snug">
            {meta?.message
              ? toUserFacingSearchMessage(meta.message)
              : 'Uygun Tedarikçi Önerisi Yok'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {results.map((c, index) => {
            const addressLine = [c.address, c.district, c.city].filter(Boolean).join(' · ');
            return (
              <VendorCandidateCard
                key={c.externalId}
                name={toTitleCaseTR(c.name)}
                phone={c.phone}
                phoneEmptyLabel="Telefon Bilgisi Bulunamadı"
                address={addressLine || null}
                rating={c.rating}
                reviewCount={c.reviewCount}
                systemSuggestion={index === 0}
                directionsUrl={buildDirectionsUrl(c)}
                showDirections
                showWebsite
                websiteUrl={c.websiteUrl?.trim() || null}
                testId="alternatif-aday"
                primaryAction={{
                  label: 'Dosyaya Ata',
                  onClick: () => openAction('assign_file', c),
                  testId: 'alternatif-dosyaya-ata',
                }}
                secondaryAction={{
                  label: 'Tedarikçi Havuzuna Kaydet',
                  onClick: () => openAction('save_pool', c),
                  testId: 'alternatif-havuza-kaydet',
                }}
              />
            );
          })}
        </ul>
      )}
      {actionMsg && !pending && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {actionMsg}
        </p>
      )}
    </div>
  );

  return (
    <div
      className={embedded ? undefined : compact ? 'mt-2' : 'mt-3'}
      data-testid="alternatif-tedarikci-servisi"
    >
      {!embedded && (
        <button
          type="button"
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            if (next && !searched && canSearch) {
              void runSearch();
            }
          }}
          className={
            compact
              ? 'w-full flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 bg-brand-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors'
              : 'w-full flex items-center justify-center gap-2 rounded-xl py-3 px-3 bg-brand-600 text-white border-2 border-blue-700 text-sm sm:text-[15px] font-bold shadow-md shadow-blue-200/60 ring-2 ring-blue-100 hover:bg-blue-700 transition-colors'
          }
          data-testid="alternatif-tedarikci-cta"
        >
          Alternatif Öneri Getir
        </button>
      )}

      {panelOpen && (embedded ? resultsList : <div className="mt-2">{resultsList}</div>)}

      {pending && (
        <div
          className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4"
          data-testid="alternatif-aksiyon-modal"
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              {pending.mode === 'assign_file'
                ? 'Yalnızca Bu Dosyada Kullan'
                : 'Meridyen Tedarikçi Havuzuna Ekle'}
            </h3>
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{pending.candidate.name}</span>
              {pending.mode === 'assign_file'
                ? ' yalnızca bu dosyaya atanacak.'
                : ' Meridyen Tedarikçi Havuzuna eklenecek; gelecek önerilerde kullanılabilir.'}
            </p>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Telefon *</label>
              <input
                type="tel"
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                placeholder="05xx xxx xx xx"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {actionMsg && <p className="text-xs text-red-600">{actionMsg}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmAction()}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {busy
                  ? 'Kaydediliyor...'
                  : pending.mode === 'assign_file'
                    ? 'Yalnızca Bu Dosyada Kullan'
                    : 'Meridyen Tedarikçi Havuzuna Ekle'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

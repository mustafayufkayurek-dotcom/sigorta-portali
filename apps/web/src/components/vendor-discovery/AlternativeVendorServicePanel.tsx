'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { toTitleCaseTR } from '@/utils/text-helpers';

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

function formatStars(rating: number | null | undefined): string {
  if (rating == null || !Number.isFinite(rating) || rating <= 0) return '—';
  const full = Math.min(5, Math.round(rating));
  return `${'★'.repeat(full)}${'☆'.repeat(5 - full)} ${rating.toFixed(1)}`;
}

export function AlternativeVendorServicePanel({
  city,
  district,
  serviceType,
  category = 'acil',
  vendorType = 'hizmet',
  autoExpandWhenEmpty = true,
  compact = false,
  onAssigned,
  onSavedToPool,
}: {
  city?: string;
  district?: string;
  serviceType?: string;
  category?: string;
  vendorType?: string;
  /** Meridyen önerisi yokken CTA’yı açık göster */
  autoExpandWhenEmpty?: boolean;
  compact?: boolean;
  onAssigned?: (vendor: { id: string; name: string; phone?: string | null }) => void | Promise<void>;
  onSavedToPool?: (vendor: { id: string; name: string; phone?: string | null }) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(autoExpandWhenEmpty);
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
    if (expanded && autoExpandWhenEmpty && canSearch && !searched) {
      void runSearch();
    }
  }, [expanded, autoExpandWhenEmpty, canSearch, searched, runSearch]);

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

  return (
    <div
      className={compact ? 'mt-2' : 'mt-3'}
      data-testid="alternatif-tedarikci-servisi"
    >
      <button
        type="button"
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          if (next && !searched && canSearch) {
            void runSearch();
          }
        }}
        className={`w-full flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors ${
          compact
            ? 'py-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50'
            : 'py-2.5 border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
        data-testid="alternatif-tedarikci-cta"
      >
        Alternatif Tedarikçi Öner
        <span className="text-[11px] font-normal text-slate-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2" data-testid="alternatif-tedarikci-panel">
          {!canSearch && (
            <p className="text-xs text-slate-500 text-center py-1">
              Öneri için il ve hizmet türü gerekli.
            </p>
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
            <p className="text-xs text-slate-400 py-2 text-center">Öneriler yükleniyor...</p>
          ) : error && results.length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : searched && results.length === 0 ? (
            <p className="text-xs text-slate-500 py-2 text-center">
              {meta?.message
                ? toUserFacingSearchMessage(meta.message)
                : 'Uygun tedarikçi önerisi yok.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((c) => (
                <li
                  key={c.externalId}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  data-testid="alternatif-aday"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        {formatStars(c.rating)}
                        {c.reviewCount > 0 ? ` · ${c.reviewCount} değerlendirme` : ''}
                      </p>
                      {c.address && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{c.address}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openAction('assign_file', c)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      data-testid="alternatif-dosyaya-ata"
                    >
                      Dosyaya Ata
                    </button>
                    <button
                      type="button"
                      onClick={() => openAction('save_pool', c)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                      data-testid="alternatif-havuza-kaydet"
                    >
                      Havuza Kaydet
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {actionMsg && !pending && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {actionMsg}
            </p>
          )}
        </div>
      )}

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
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
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

'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Building2, Plus } from 'lucide-react';
import {
  MALI_MESULIYET_LOKASYON,
  MALI_MESULIYET_LOKASYON_ETIKET,
  maliMesuliyetDaireNoOk,
  type MaliMesuliyetLokasyon,
} from '@sigorta/shared';
import { FieldHelpTip, FieldLabel } from '@/components/ui/FieldHelpTip';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/api-error';
import { formatTryAmount } from '@/utils/format-try-amount';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { formatTrAmountInput, parseTrAmountInput } from '@/utils/tr-amount-input';
import { API, authHeader } from './claim-detail-utils';
import { MaliMesuliyetMuvafakatTaslagi } from './MaliMesuliyetMuvafakatTaslagi';

type Kalem = {
  id: string;
  jobDescription: string;
  quantity: number;
  unit: string;
  salesUnitPrice: number;
  salesTotal: number;
};

type Tespit = {
  id: string;
  lokasyon: string;
  daireNo: string;
  findingsText: string | null;
  items: Kalem[];
  alanSatis: number;
};

type GenelToplam = {
  mainSales: number;
  neighborSales: number;
  genelToplam: number;
};

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400';

function lokasyonEtiket(value: string): string {
  return MALI_MESULIYET_LOKASYON_ETIKET[value as MaliMesuliyetLokasyon] ?? value;
}

export function MaliMesuliyetAlanlariPanel({
  claimId,
  fileNo,
  insuredName,
}: {
  claimId: string;
  fileNo?: string | null;
  insuredName?: string | null;
}) {
  const { showToast } = useToast();
  const [tespipler, setTespipler] = useState<Tespit[]>([]);
  const [totals, setTotals] = useState<GenelToplam>({
    mainSales: 0,
    neighborSales: 0,
    genelToplam: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [lokasyon, setLokasyon] = useState<MaliMesuliyetLokasyon>('alt_kat');
  const [daireNo, setDaireNo] = useState('');
  const [savingArea, setSavingArea] = useState(false);
  const [kalemDraft, setKalemDraft] = useState<Record<string, { desc: string; qty: string; price: string }>>(
    {},
  );
  const [savingKalem, setSavingKalem] = useState<string | null>(null);
  const [taslakOpen, setTaslakOpen] = useState(false);
  const [suggestedPhone, setSuggestedPhone] = useState('');

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await axios.get(`${API}/claim-files/${claimId}/mali-mesuliyet`, {
        headers: authHeader(),
      });
      const data = r.data?.data;
      setTespipler(Array.isArray(data?.tespipler) ? data.tespipler : []);
      setSuggestedPhone(String(data?.muvafakat?.suggestedPhone ?? ''));
      const g = data?.genelToplam;
      setTotals({
        mainSales: Number(g?.mainSales ?? 0),
        neighborSales: Number(g?.neighborSales ?? 0),
        genelToplam: Number(g?.genelToplam ?? 0),
      });
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Alanlar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addArea = async () => {
    if (!maliMesuliyetDaireNoOk(lokasyon, daireNo)) {
      showToast('error', 'Daire No girin.');
      return;
    }
    setSavingArea(true);
    try {
      await axios.post(
        `${API}/claim-files/${claimId}/mali-mesuliyet`,
        { lokasyon, daireNo: daireNo.trim() },
        { headers: authHeader() },
      );
      setDaireNo('');
      setFormOpen(false);
      await load();
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Alan eklenemedi.'));
    } finally {
      setSavingArea(false);
    }
  };

  const addKalem = async (tespitId: string) => {
    const draft = kalemDraft[tespitId] ?? { desc: '', qty: '1', price: '' };
    const desc = draft.desc.trim();
    if (!desc) {
      showToast('error', 'İş kalemi yazın.');
      return;
    }
    const qty = parseTrAmountInput(draft.qty) ?? 1;
    const price = parseTrAmountInput(draft.price) ?? 0;
    setSavingKalem(tespitId);
    try {
      await axios.post(
        `${API}/claim-files/${claimId}/mali-mesuliyet/${tespitId}/kalem`,
        {
          jobDescription: toTitleCaseTR(desc),
          quantity: qty,
          unit: 'adet',
          salesUnitPrice: price,
        },
        { headers: authHeader() },
      );
      setKalemDraft((prev) => ({ ...prev, [tespitId]: { desc: '', qty: '1', price: '' } }));
      await load();
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Kalem eklenemedi.'));
    } finally {
      setSavingKalem(null);
    }
  };

  return (
    <section
      id="mali-mesuliyet-alanlari"
      className="scroll-mt-16 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-5"
      data-testid="mali-mesuliyet-alanlari"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Building2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-950">
              Mali Mesuliyet Alanları
              <FieldHelpTip text="Yan daire, alt kat, üst kat veya ortak alan. Daire numarası ortak alan dışında durur." />
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">Komşu tespitleri bu dosyada ayrı durur</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="mali-mesuliyet-alan-ekle"
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Mali Mesuliyet Alanları
          </button>
          <button
            type="button"
            data-testid="mali-mesuliyet-muvafakat-taslak"
            onClick={() => setTaslakOpen(true)}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Muvafakat Taslağı
          </button>
        </div>
      </div>

      {formOpen ? (
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:grid-cols-3">
          <div>
            <FieldLabel help="Hasarın yayıldığı yer">Lokasyon</FieldLabel>
            <select
              className={inputClass}
              value={lokasyon}
              onChange={(e) => setLokasyon(e.target.value as MaliMesuliyetLokasyon)}
              data-testid="mali-mesuliyet-lokasyon"
            >
              {MALI_MESULIYET_LOKASYON.map((code) => (
                <option key={code} value={code}>
                  {MALI_MESULIYET_LOKASYON_ETIKET[code]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel help="Ortak alanda daire no gerekmez">Daire No</FieldLabel>
            <input
              className={inputClass}
              value={daireNo}
              onChange={(e) => setDaireNo(e.target.value)}
              placeholder="Örn. 5"
              data-testid="mali-mesuliyet-daire-no"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              disabled={savingArea}
              onClick={() => void addArea()}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {savingArea ? 'Kaydediliyor…' : 'Alanı Kaydet'}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Alanlar yükleniyor…</p> : null}
      {loadError ? (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Tekrar Dene
          </button>
        </div>
      ) : null}
      {!loading && !loadError && tespipler.length === 0 ? (
        <p className="text-sm text-slate-500">Dosyada mali mesuliyet alanı yok.</p>
      ) : null}

      <div className="space-y-3">
        {tespipler.map((area) => {
          const draft = kalemDraft[area.id] ?? { desc: '', qty: '1', price: '' };
          return (
            <article
              key={area.id}
              className="rounded-xl border border-slate-200 bg-white p-3"
              data-testid="mali-mesuliyet-alan-kart"
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {lokasyonEtiket(area.lokasyon)}
                  {area.daireNo ? ` · Daire ${area.daireNo}` : ''}
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {formatTryAmount(area.alanSatis)}
                </p>
              </div>
              {area.items.length === 0 ? (
                <p className="mb-3 text-sm text-slate-500">Bu alanda iş kalemi yok.</p>
              ) : (
                <ul className="mb-3 divide-y divide-slate-100">
                  {area.items.map((item) => (
                    <li key={item.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                      <span className="min-w-0 text-slate-700">{item.jobDescription}</span>
                      <span className="shrink-0 text-slate-800">{formatTryAmount(item.salesTotal)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <FieldLabel>İş Kalemi</FieldLabel>
                  <input
                    className={inputClass}
                    value={draft.desc}
                    placeholder="Örn. boya işleri"
                    onChange={(e) =>
                      setKalemDraft((prev) => ({ ...prev, [area.id]: { ...draft, desc: e.target.value } }))
                    }
                    onBlur={(e) =>
                      setKalemDraft((prev) => ({
                        ...prev,
                        [area.id]: { ...draft, desc: toTitleCaseTR(e.target.value) },
                      }))
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Miktar</FieldLabel>
                  <input
                    className={inputClass}
                    value={draft.qty}
                    onChange={(e) =>
                      setKalemDraft((prev) => ({
                        ...prev,
                        [area.id]: { ...draft, qty: formatTrAmountInput(e.target.value) },
                      }))
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Satış</FieldLabel>
                  <input
                    className={inputClass}
                    value={draft.price}
                    onChange={(e) =>
                      setKalemDraft((prev) => ({
                        ...prev,
                        [area.id]: { ...draft, price: formatTrAmountInput(e.target.value) },
                      }))
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={savingKalem === area.id}
                onClick={() => void addKalem(area.id)}
                className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Kalemi Ekle
              </button>
            </article>
          );
        })}
      </div>

      <MaliMesuliyetToplamKutulari totals={totals} />

      {taslakOpen ? (
        <MaliMesuliyetMuvafakatTaslagi
          claimId={claimId}
          fileNo={fileNo}
          insuredName={insuredName}
          tespipler={tespipler}
          totals={totals}
          suggestedPhone={suggestedPhone}
          onClose={() => setTaslakOpen(false)}
          onSaved={() => void load()}
        />
      ) : null}
    </section>
  );
}

export function MaliMesuliyetToplamKutulari({ totals }: { totals: GenelToplam }) {
  const boxes = [
    { id: 'ana', label: 'Ana Dosya Toplamı', value: totals.mainSales, tone: 'brand' as const },
    { id: 'komsu', label: 'Mali Mesuliyet Toplamı', value: totals.neighborSales, tone: 'slate' as const },
    { id: 'genel', label: 'Genel Toplam', value: totals.genelToplam, tone: 'navy' as const },
  ];
  return (
    <div
      className="mt-4 grid gap-2 sm:grid-cols-3"
      data-testid="mali-mesuliyet-toplam-kutulari"
    >
      {boxes.map((box) => (
        <div
          key={box.id}
          className={
            box.tone === 'navy'
              ? 'rounded-xl bg-brand-800 px-3 py-3 text-white'
              : box.tone === 'brand'
                ? 'rounded-xl border border-brand-100 bg-brand-50 px-3 py-3'
                : 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-3'
          }
        >
          <p
            className={
              box.tone === 'navy' ? 'text-xs font-medium text-brand-100' : 'text-xs font-medium text-slate-500'
            }
          >
            {box.label}
          </p>
          <p
            className={
              box.tone === 'navy'
                ? 'mt-1 text-lg font-semibold tracking-tight'
                : 'mt-1 text-lg font-semibold tracking-tight text-slate-950'
            }
          >
            {formatTryAmount(box.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

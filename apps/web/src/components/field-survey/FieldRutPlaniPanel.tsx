'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Route } from 'lucide-react';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { API, authHeader } from '@/utils/api';
import { formatSettingsApiError } from '@/utils/settings-api';
import { formatTryAmount } from '@/utils/format-try-amount';
import { numberToTrAmountInput, parseTrAmountInput } from '@/utils/tr-amount-input';
import { TrAmountInput } from '@/components/ui/TrAmountInput';

type DosyaSatir = {
  id: string;
  fileNo?: string | null;
  insuredName?: string | null;
  propertyAddress?: {
    addressLine?: string | null;
    city?: string | null;
    district?: string | null;
  } | null;
};

type Durak = {
  sira: number;
  claimFileId: string;
  fileNo: string;
  adres: string;
  bacakKm: number;
  bacakDakika: number;
};

type GecisSatir = { id: string; ad: string; ucret: string };
type OtoyolSatir = { ref: string; ad?: string; km: string; kmUcreti: string };

/**
 * Tespitçi Atanan Dosyalar — çıkış yazılır, rut sırası önerilir.
 * Ayarlar’da tespitçi bedel taslağı açıksa köprü / otoyol / yemek de yazılır.
 * Gelire Düşür yönetici / finanstadır.
 */
export function FieldRutPlaniPanel({ dosyalar }: { dosyalar: DosyaSatir[] }) {
  const [acik, setAcik] = useState(false);
  const [cikis, setCikis] = useState('');
  const [secili, setSecili] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [duraklar, setDuraklar] = useState<Durak[]>([]);
  const [toplamKm, setToplamKm] = useState<number | null>(null);
  const [taslakAcik, setTaslakAcik] = useState(false);
  const [gecisler, setGecisler] = useState<GecisSatir[]>([]);
  const [otoyollar, setOtoyollar] = useState<OtoyolSatir[]>([]);
  const [yemek, setYemek] = useState('');
  const [yemekNot, setYemekNot] = useState('');

  const adaylar = useMemo(
    () => dosyalar.filter((d) => d.id && (d.propertyAddress?.addressLine || d.propertyAddress?.city)),
    [dosyalar],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await axios.get(`${API}/hasar-tespit-bedel/tespitci-taslak-tercih`, {
          headers: authHeader(),
        });
        if (!cancelled) setTaslakAcik(Boolean(res.data?.data?.tespitciBedelTaslagi));
      } catch {
        if (!cancelled) setTaslakAcik(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maliyetOnizleme = useMemo(() => {
    const g = gecisler.reduce((s, row) => s + (parseTrAmountInput(row.ucret) ?? 0), 0);
    const o = otoyollar.reduce((s, row) => {
      const km = Number(String(row.km).replace(',', '.')) || 0;
      const ucret = parseTrAmountInput(row.kmUcreti) ?? 0;
      return s + km * ucret;
    }, 0);
    const y = parseTrAmountInput(yemek) ?? 0;
    return Math.round((g + o + y) * 100) / 100;
  }, [gecisler, otoyollar, yemek]);

  const oner = async () => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const ids = secili.length ? secili : adaylar.map((d) => d.id);
      if (!ids.length) {
        setError('Ruta eklenecek dosya yok.');
        return;
      }
      const res = await axios.post(
        `${API}/hasar-tespit-bedel/rut-plani`,
        { cikisAdresi: cikis, claimFileIds: ids, ucretOner: taslakAcik },
        { headers: authHeader() },
      );
      const d = res.data?.data as {
        duraklar: Durak[];
        toplamKm: number;
        gecisOneri?: Array<{ id: string; ad: string; ucret: number | null }>;
        otoyolOneri?: Array<{ ref: string; ad?: string; km: number; kmUcreti: number | null }>;
      };
      setDuraklar(d.duraklar ?? []);
      setToplamKm(d.toplamKm ?? null);
      if (taslakAcik) {
        setGecisler(
          (d.gecisOneri ?? []).map((g) => ({
            id: g.id,
            ad: g.ad,
            ucret: numberToTrAmountInput(g.ucret),
          })),
        );
        setOtoyollar(
          (d.otoyolOneri ?? []).map((o) => ({
            ref: o.ref,
            ad: o.ad,
            km: o.km ? String(o.km).replace('.', ',') : '',
            kmUcreti: numberToTrAmountInput(o.kmUcreti),
          })),
        );
      } else {
        setGecisler([]);
        setOtoyollar([]);
      }
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
      setDuraklar([]);
      setToplamKm(null);
      setGecisler([]);
      setOtoyollar([]);
    } finally {
      setBusy(false);
    }
  };

  const taslakKaydet = async () => {
    if (!duraklar.length) {
      setError('Önce rut planı önerin.');
      return;
    }
    setSaving(true);
    setError('');
    setNote('');
    try {
      const payload = {
        cikisAdresi: cikis,
        toplamKm,
        gecisler: gecisler.map((g) => ({
          id: g.id,
          ad: g.ad,
          adet: 1,
          ucret: parseTrAmountInput(g.ucret),
        })),
        otoyollar: otoyollar.map((o) => ({
          ref: o.ref,
          ad: o.ad,
          km: Number(String(o.km).replace(',', '.')) || 0,
          kmUcreti: parseTrAmountInput(o.kmUcreti),
        })),
        yemekTutar: parseTrAmountInput(yemek),
        yemekNot: yemekNot.trim() || null,
      };
      for (const d of duraklar) {
        await axios.post(`${API}/claim-files/${d.claimFileId}/hasar-tespit-bedel/taslak`, payload, {
          headers: authHeader(),
        });
      }
      setNote(
        `Taslak ${duraklar.length} dosyaya yazıldı. Tespit maliyeti önizleme ${formatTryAmount(maliyetOnizleme)}. Gelire Düşür finanstadır.`,
      );
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (!adaylar.length) return null;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4" data-testid="field-rut-plani">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-brand-600" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-900">Rut Planı</h3>
        </div>
        <button
          type="button"
          onClick={() => setAcik((v) => !v)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {acik ? 'Gizle' : 'Aç'}
        </button>
      </div>
      {acik ? (
        <div className="mt-3 space-y-3">
          <OpsFirstRunNotice
            noticeId={OPS_NOTICE.fieldRutPlani.id}
            title={OPS_NOTICE.fieldRutPlani.title}
            body={OPS_NOTICE.fieldRutPlani.body}
            testId="field-rut-plani-seridi"
            compact
          />
          <div>
            <label htmlFor="field-rut-cikis" className="mb-1 block text-xs font-medium text-slate-700">Çıkış Adresi</label>
            <div className="flex gap-2">
              <input
                id="field-rut-cikis"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={cikis}
                placeholder="Örn. ofis adresi, ilçe, il"
                onChange={(e) => setCikis(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !cikis.trim()}
                onClick={() => void oner()}
                className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? 'Hesaplanıyor' : 'Rut Planı Öner'}
              </button>
            </div>
          </div>
          <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
            {adaylar.map((a) => {
              const on = secili.length === 0 || secili.includes(a.id);
              const adres = [a.propertyAddress?.addressLine, a.propertyAddress?.district, a.propertyAddress?.city]
                .filter(Boolean)
                .join(', ');
              return (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={on}
                      onChange={() => {
                        setSecili((ids) => {
                          if (ids.length === 0) {
                            return adaylar.map((d) => d.id).filter((id) => id !== a.id);
                          }
                          return ids.includes(a.id) ? ids.filter((x) => x !== a.id) : [...ids, a.id];
                        });
                      }}
                    />
                    <span>
                      <span className="font-medium text-slate-900">{a.fileNo}</span>
                      {a.insuredName ? <span className="text-slate-600"> · {a.insuredName}</span> : null}
                      <span className="block text-xs text-slate-500">{adres}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p> : null}
          {note ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{note}</p> : null}
          {duraklar.length ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">
                Önerilen sıra{toplamKm != null ? ` · toplam ${toplamKm.toLocaleString('tr-TR')} km` : ''}
              </p>
              <ol className="mt-1 space-y-1 text-xs text-slate-700">
                {duraklar.map((d) => (
                  <li key={d.claimFileId}>
                    {d.sira}. {d.fileNo} · {d.bacakKm.toLocaleString('tr-TR')} km
                    <span className="block text-slate-500">{d.adres}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {taslakAcik && duraklar.length ? (
            <div className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3" data-testid="field-bedel-taslak">
              <div>
                <p className="text-xs font-semibold text-slate-900">Yol / Köprü / Yemek Taslağı</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Tespit maliyetine yansır. Gelire Düşür yönetici ve finanstadır. Yemek ayrı masraf fişi olarak da yazılabilir.
                </p>
              </div>

              {gecisler.length ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-700">Köprü / Tünel</p>
                  <ul className="space-y-1.5">
                    {gecisler.map((g, i) => (
                      <li key={g.id} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-800">{g.ad}</span>
                        <TrAmountInput
                          className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          value={g.ucret}
                          onChange={(v) => setGecisler((rows) => rows.map((r, j) => (j === i ? { ...r, ucret: v } : r)))}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Bu rutte otomatik köprü önerisi yok; gerekirse finans dosyada ekler.</p>
              )}

              {otoyollar.length ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-700">Otoyol</p>
                  <ul className="space-y-1.5">
                    {otoyollar.map((o, i) => (
                      <li key={o.ref} className="grid grid-cols-[1fr_4.5rem_5.5rem] items-center gap-1.5">
                        <span className="truncate text-xs text-slate-800">{o.ref}{o.ad ? ` · ${o.ad}` : ''}</span>
                        <input
                          aria-label={`${o.ref} km`}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          inputMode="decimal"
                          placeholder="Km"
                          value={o.km}
                          onChange={(e) =>
                            setOtoyollar((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, km: e.target.value.replace(/[^\d,]/g, '') } : r)),
                            )
                          }
                        />
                        <TrAmountInput
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          value={o.kmUcreti}
                          onChange={(v) => setOtoyollar((rows) => rows.map((r, j) => (j === i ? { ...r, kmUcreti: v } : r)))}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="field-yemek" className="mb-1 block text-xs font-medium text-slate-700">Yemek (Taslak)</label>
                  <TrAmountInput
                    id="field-yemek"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={yemek}
                    onChange={setYemek}
                  />
                </div>
                <div>
                  <label htmlFor="field-yemek-not" className="mb-1 block text-xs font-medium text-slate-700">Yemek Notu</label>
                  <input
                    id="field-yemek-not"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={yemekNot}
                    placeholder="Örn. öğle yemeği"
                    onChange={(e) => setYemekNot(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">
                  Maliyet önizleme · {formatTryAmount(maliyetOnizleme)}
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void taslakKaydet()}
                  className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  data-testid="field-bedel-taslak-kaydet"
                >
                  {saving ? 'Kaydediliyor…' : 'Taslağı Dosyalara Yaz'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          {taslakAcik
            ? 'Nereden çıktığınızı yazın; rut, köprü ve yemek taslağı önerilir.'
            : 'Nereden çıktığınızı yazın; yazılım mağaza sırasını önerir.'}
        </p>
      )}
    </div>
  );
}

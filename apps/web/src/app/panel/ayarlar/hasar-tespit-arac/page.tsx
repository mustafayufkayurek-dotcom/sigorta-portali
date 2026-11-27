'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Car, Plus, Route, Trash2 } from 'lucide-react';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { SettingsFieldLabel, inputCls } from '@/components/settings/SettingsUI';
import { TrAmountInput } from '@/components/ui/TrAmountInput';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { API, authHeader } from '@/utils/api';
import { formatSettingsApiError } from '@/utils/settings-api';
import { numberToTrAmountInput, parseTrAmountInput } from '@/utils/tr-amount-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import {
  DEFAULT_HASAR_TESPIT_ARAC,
  YAKIT_TURU_LABEL,
  aracGunlukKira,
  normalizeHasarTespitArac,
  type HasarTespitAracAyarlari,
  type YakitTuru,
} from '@sigorta/shared';

type GecisForm = { id: string; ad: string; ucret: string; ciftYon: boolean; lat?: number | null; lng?: number | null };
type OtoyolForm = { ref: string; ad: string; kmUcreti: string };

interface Form {
  aylikKira: string;
  kmAsimUcreti: string;
  yakitTuru: YakitTuru;
  tuketimL100: string;
  varsayilanCikisAdresi: string;
  gecisler: GecisForm[];
  otoyollar: OtoyolForm[];
  tespitciBedelTaslagi: boolean;
  kurulumSorumluUserIds: string[];
}

function toForm(a: HasarTespitAracAyarlari): Form {
  return {
    aylikKira: numberToTrAmountInput(a.aylikKira),
    kmAsimUcreti: numberToTrAmountInput(a.kmAsimUcreti),
    yakitTuru: a.yakitTuru,
    tuketimL100: a.tuketimL100 == null ? '' : String(a.tuketimL100).replace('.', ','),
    varsayilanCikisAdresi: a.varsayilanCikisAdresi,
    gecisler: a.gecisler.map((g) => ({ id: g.id, ad: g.ad, ucret: numberToTrAmountInput(g.ucret), ciftYon: g.ciftYon, lat: g.lat, lng: g.lng })),
    otoyollar: a.otoyollar.map((o) => ({ ref: o.ref, ad: o.ad ?? '', kmUcreti: o.kmUcreti == null ? '' : String(o.kmUcreti).replace('.', ',') })),
    tespitciBedelTaslagi: a.tespitciBedelTaslagi === true,
    kurulumSorumluUserIds: [...a.kurulumSorumluUserIds],
  };
}

function fromForm(f: Form): HasarTespitAracAyarlari {
  return normalizeHasarTespitArac({
    aylikKira: parseTrAmountInput(f.aylikKira),
    kmAsimUcreti: parseTrAmountInput(f.kmAsimUcreti),
    yakitTuru: f.yakitTuru,
    tuketimL100: parseTrAmountInput(f.tuketimL100),
    varsayilanCikisAdresi: f.varsayilanCikisAdresi,
    gecisler: f.gecisler.map((g) => ({ ...g, ucret: parseTrAmountInput(g.ucret) })),
    otoyollar: f.otoyollar.map((o) => ({ ref: o.ref, ad: o.ad, kmUcreti: parseTrAmountInput(o.kmUcreti) })),
    tespitciBedelTaslagi: f.tespitciBedelTaslagi,
    kurulumSorumluUserIds: f.kurulumSorumluUserIds,
  });
}

function tl(n: number): string {
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}

export default function HasarTespitAracPage() {
  const [form, setForm] = useState<Form>(() => toForm(DEFAULT_HASAR_TESPIT_ARAC));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [newGecis, setNewGecis] = useState('');
  const [newRef, setNewRef] = useState('');
  const [tespitciAdaylar, setTespitciAdaylar] = useState<Array<{ id: string; name: string; email: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, kurulum] = await Promise.all([
        axios.get(`${API}/hasar-tespit-bedel/arac`, { headers: authHeader() }),
        axios.get(`${API}/hasar-tespit-bedel/arac-kurulum`, { headers: authHeader() }).catch(() => null),
      ]);
      setForm(toForm(normalizeHasarTespitArac(res.data?.data)));
      const adaylar = kurulum?.data?.data?.adaylar;
      setTespitciAdaylar(Array.isArray(adaylar) ? adaylar : []);
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const patch = (next: Partial<Form>) => {
    setSavedNote('');
    setForm((f) => ({ ...f, ...next }));
  };

  const kira = useMemo(() => aracGunlukKira(parseTrAmountInput(form.aylikKira), new Date()), [form.aylikKira]);

  const save = async () => {
    setSaving(true);
    setError('');
    setSavedNote('');
    try {
      const res = await axios.put(`${API}/hasar-tespit-bedel/arac`, fromForm(form), { headers: authHeader() });
      setForm(toForm(normalizeHasarTespitArac(res.data?.data)));
      setSavedNote('Kaydedildi. Hasar Tespit dosyasında Hizmet Bedeli Hesapla bu rakamlarla açılır.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('hasar-tespit-arac-kaydedildi'));
      }
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const addGecis = () => {
    const ad = toTitleCaseTR(newGecis.trim());
    if (!ad) return;
    const id = `gecis-${Date.now()}`;
    patch({ gecisler: [...form.gecisler, { id, ad, ucret: '', ciftYon: true, lat: null, lng: null }] });
    setNewGecis('');
  };

  const addOtoyol = () => {
    const ref = newRef.trim().toUpperCase().replace(/^O(\d)/, 'O-$1');
    if (!/^O-\d+[A-Z]?$/.test(ref)) {
      setError('Otoyol numarası O-4 biçiminde yazılır.');
      return;
    }
    if (form.otoyollar.some((o) => o.ref === ref)) return;
    setError('');
    patch({ otoyollar: [...form.otoyollar, { ref, ad: '', kmUcreti: '' }] });
    setNewRef('');
  };

  return (
    <SettingsPageLayout
      title="Hasar Tespit Araç Giderleri"
      description="Araç kirası, km aşımı, yakıt ve köprü / otoyol ücretleri bir kez girilir. Dosyada hizmet bedeli bu rakamlarla hesaplanır."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
    >
      <div className="space-y-4" data-testid="hasar-tespit-arac-ayarlari">
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        {savedNote ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{savedNote}</p> : null}
        {loading ? <p className="text-sm text-slate-500">Yükleniyor</p> : null}

        <section id="arac-kurulum-sorumlular" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4" data-testid="arac-kurulum-sorumlular">
          <h2 className="text-sm font-semibold text-slate-900">Kurulumdan Sorumlu Tespitçi</h2>
          <p className="mt-1 text-xs text-slate-500">
            Yazılıma girince eksik araç bilgisi yalnız bu hesaplarda sırayla sorulur. Her bölge ve her
            tespitçi için zorunlu değildir.
          </p>
          {tespitciAdaylar.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">Aktif tespitçi hesabı yok.</p>
          ) : (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2">
              {tespitciAdaylar.map((a) => {
                const on = form.kurulumSorumluUserIds.includes(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        patch({
                          kurulumSorumluUserIds: on
                            ? form.kurulumSorumluUserIds.filter((id) => id !== a.id)
                            : [...form.kurulumSorumluUserIds, a.id],
                        });
                      }}
                      className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm ${
                        on ? 'bg-brand-50 text-brand-900' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
                          on ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'
                        }`}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{a.name}</span>
                        <span className="block truncate text-xs text-slate-500">{a.email}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4" data-testid="tespitci-bedel-taslak-tercih">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Tespitçi Bedel Taslağı</h2>
              <p className="mt-1 text-xs text-slate-500">
                Açıkken tespitçi Atanan Dosyalar’da rut, köprü / otoyol ve yemek satırını yazar. Bu taslak
                tespit maliyetine yansır; Gelire Düşür yine yönetici ve finanstadır.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.tespitciBedelTaslagi}
              aria-label="Bedel taslağını tespitçi de görsün"
              data-testid="tespitci-bedel-taslak-anahtar"
              onClick={() => patch({ tespitciBedelTaslagi: !form.tespitciBedelTaslagi })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                form.tespitciBedelTaslagi ? 'bg-brand-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  form.tespitciBedelTaslagi ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-700">
            {form.tespitciBedelTaslagi ? 'Açık — tespitçi taslak yazar' : 'Kapalı — yalnız yönetici / finans'}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Car className="h-4 w-4 text-brand-600" aria-hidden />
            <h2 className="text-sm font-semibold text-slate-900">Araç</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div id="arac-kurulum-kira" className="scroll-mt-24">
              <SettingsFieldLabel htmlFor="arac-kira" help="Kiralık aracın aylık kirası. Gün payı Pazar düşülerek hesaplanır.">Aylık Araç Kirası</SettingsFieldLabel>
              <TrAmountInput id="arac-kira" className={inputCls} value={form.aylikKira} onChange={(v) => patch({ aylikKira: v })} />
              {kira.gunluk > 0 ? (
                <p className="mt-1 text-xs text-slate-500">Bu ay {kira.calismaGunu} gün · günlük {tl(kira.gunluk)}</p>
              ) : null}
            </div>
            <div>
              <SettingsFieldLabel htmlFor="km-asim" help="Kiralık araçta her km için ödenen aşım ücreti.">Km Aşım Ücreti</SettingsFieldLabel>
              <TrAmountInput id="km-asim" className={inputCls} value={form.kmAsimUcreti} onChange={(v) => patch({ kmAsimUcreti: v })} />
            </div>
            <div>
              <SettingsFieldLabel htmlFor="yakit-turu" help="Günlük akaryakıt fiyatı bu türe göre okunur.">Yakıt Türü</SettingsFieldLabel>
              <select id="yakit-turu" className={inputCls} value={form.yakitTuru} onChange={(e) => patch({ yakitTuru: e.target.value as YakitTuru })}>
                {(Object.keys(YAKIT_TURU_LABEL) as YakitTuru[]).map((t) => (
                  <option key={t} value={t}>{YAKIT_TURU_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div id="arac-kurulum-tuketim" className="scroll-mt-24">
              <SettingsFieldLabel htmlFor="tuketim" help="Aracın 100 km’de yaktığı litre.">Yakıt Tüketimi (L/100 km)</SettingsFieldLabel>
              <input
                id="tuketim"
                className={inputCls}
                inputMode="decimal"
                value={form.tuketimL100}
                placeholder="Örn. 7,5"
                onChange={(e) => patch({ tuketimL100: e.target.value.replace(/[^\d,]/g, '') })}
              />
            </div>
            <div id="arac-kurulum-cikis" className="scroll-mt-24 sm:col-span-2 xl:col-span-4">
              <SettingsFieldLabel htmlFor="cikis" help="Dosyada çıkış adresi bununla dolar; dosyada değiştirilebilir.">Varsayılan Çıkış Adresi</SettingsFieldLabel>
              <input
                id="cikis"
                className={inputCls}
                value={form.varsayilanCikisAdresi}
                placeholder="Örn. ofis adresi, ilçe, il"
                onChange={(e) => patch({ varsayilanCikisAdresi: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2">
            <Route className="h-4 w-4 text-brand-600" aria-hidden />
            <h2 className="text-sm font-semibold text-slate-900">Köprü Ve Tünel Geçişleri</h2>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Bu liste geçiş konumudur (rota buradan geçerse satır düşer). Güncel TL ücreti Yandex rotasında önerilir;
            dosyada bir kez teyit edilir. Buraya 0 TL yazmak zorunlu değildir.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Geçiş</th>
                  <th className="w-44 py-2 pr-3 font-medium">Yedek Ücret (İsteğe Bağlı)</th>
                  <th className="w-40 py-2 pr-3 font-medium">Gidiş Ve Dönüş</th>
                  <th className="w-12 py-2" aria-label="İşlem" />
                </tr>
              </thead>
              <tbody>
                {form.gecisler.map((g, i) => (
                  <tr key={g.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="font-medium text-slate-900">{g.ad}</span>
                      {g.lat == null ? <span className="mt-0.5 block text-xs text-slate-500">Dosyada elle eklenir</span> : null}
                    </td>
                    <td className="py-2 pr-3">
                      <TrAmountInput
                        className={inputCls}
                        value={g.ucret}
                        onChange={(v) => patch({ gecisler: form.gecisler.map((r, j) => (j === i ? { ...r, ucret: v } : r)) })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={g.ciftYon}
                        onClick={() => patch({ gecisler: form.gecisler.map((r, j) => (j === i ? { ...r, ciftYon: !r.ciftYon } : r)) })}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${g.ciftYon ? 'bg-brand-600' : 'bg-slate-200'}`}>
                          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${g.ciftYon ? 'translate-x-5' : ''}`} />
                        </span>
                        <span className="text-slate-600">{g.ciftYon ? 'İki yön' : 'Tek yön'}</span>
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        title="Kaldır"
                        aria-label={`${g.ad} kaldır`}
                        onClick={() => patch({ gecisler: form.gecisler.filter((_, j) => j !== i) })}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex max-w-md gap-2">
            <input
              className={inputCls}
              value={newGecis}
              placeholder="Örn. çevre yolu geçişi"
              aria-label="Yeni geçiş adı"
              onChange={(e) => setNewGecis(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addGecis(); }}
            />
            <button type="button" onClick={addGecis} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Plus className="h-4 w-4" /> Geçiş Ekle
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Ücretli Otoyollar</h2>
          <p className="mb-3 text-xs text-slate-500">Rotadaki otoyol km’si bu ücretle çarpılır. Listede olmayan otoyol dosyada ücretsiz görünür ve orada düzeltilebilir.</p>
          {form.otoyollar.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="w-28 py-2 pr-3 font-medium">Otoyol</th>
                    <th className="py-2 pr-3 font-medium">Ad</th>
                    <th className="w-44 py-2 pr-3 font-medium">Km Ücreti</th>
                    <th className="w-12 py-2" aria-label="İşlem" />
                  </tr>
                </thead>
                <tbody>
                  {form.otoyollar.map((o, i) => (
                    <tr key={o.ref} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-900">{o.ref}</td>
                      <td className="py-2 pr-3">
                        <input
                          className={inputCls}
                          value={o.ad}
                          placeholder="Örn. anadolu otoyolu"
                          onChange={(e) => patch({ otoyollar: form.otoyollar.map((r, j) => (j === i ? { ...r, ad: e.target.value } : r)) })}
                          onBlur={() => patch({ otoyollar: form.otoyollar.map((r, j) => (j === i ? { ...r, ad: toTitleCaseTR(r.ad.trim()) } : r)) })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          className={inputCls}
                          inputMode="decimal"
                          value={o.kmUcreti}
                          placeholder="TL / km"
                          onChange={(e) => patch({ otoyollar: form.otoyollar.map((r, j) => (j === i ? { ...r, kmUcreti: e.target.value.replace(/[^\d,]/g, '') } : r)) })}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          title="Kaldır"
                          aria-label={`${o.ref} kaldır`}
                          onClick={() => patch({ otoyollar: form.otoyollar.filter((_, j) => j !== i) })}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Henüz ücretli otoyol girilmedi.</p>
          )}
          <div className="mt-3 flex max-w-xs gap-2">
            <input
              className={inputCls}
              value={newRef}
              placeholder="Örn. O-4"
              aria-label="Otoyol numarası"
              onChange={(e) => setNewRef(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addOtoyol(); }}
            />
            <button type="button" onClick={addOtoyol} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Plus className="h-4 w-4" /> Otoyol Ekle
            </button>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="button" onClick={() => void save()} disabled={saving || loading} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving ? 'Kaydediliyor' : 'Kaydet'}
          </button>
        </div>
      </div>
    </SettingsPageLayout>
  );
}

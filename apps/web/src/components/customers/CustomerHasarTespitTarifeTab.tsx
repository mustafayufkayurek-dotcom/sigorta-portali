'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { SettingsFieldLabel, inputCls } from '@/components/settings/SettingsUI';
import { TrAmountInput } from '@/components/ui/TrAmountInput';
import { API, authHeader } from '@/utils/api';
import { formatSettingsApiError } from '@/utils/settings-api';
import { numberToTrAmountInput, parseTrAmountInput } from '@/utils/tr-amount-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import {
  DEFAULT_HASAR_TESPIT_TARIFE,
  EK_KALEM_TURU_LABEL,
  TARIFE_YONTEM_LABEL,
  normalizeHasarTespitTarife,
  type EkKalemTuru,
  type HasarTespitTarife,
  type TarifeYontem,
} from '@sigorta/shared';

type EkForm = { id: string; ad: string; tur: EkKalemTuru; deger: string; varsayilanMiktar: string };

interface Form {
  yontem: TarifeYontem;
  sabitBedel: string;
  hizmetPayiSabit: string;
  hizmetPayiYuzde: string;
  ekKalemler: EkForm[];
  asgariBedel: string;
  azamiBedel: string;
  not: string;
}

const pct = (n: number | null) => (n == null ? '' : String(n).replace('.', ','));
const pctIn = (v: string) => v.replace(/[^\d,]/g, '');

function toForm(t: HasarTespitTarife): Form {
  return {
    yontem: t.yontem,
    sabitBedel: numberToTrAmountInput(t.sabitBedel),
    hizmetPayiSabit: numberToTrAmountInput(t.hizmetPayiSabit),
    hizmetPayiYuzde: pct(t.hizmetPayiYuzde),
    ekKalemler: t.ekKalemler.map((k) => ({
      id: k.id,
      ad: k.ad,
      tur: k.tur,
      deger: k.tur === 'yuzde' ? pct(k.deger) : numberToTrAmountInput(k.deger),
      varsayilanMiktar: pct(k.varsayilanMiktar),
    })),
    asgariBedel: numberToTrAmountInput(t.asgariBedel),
    azamiBedel: numberToTrAmountInput(t.azamiBedel),
    not: t.not,
  };
}

function fromForm(f: Form): HasarTespitTarife {
  return normalizeHasarTespitTarife({
    yontem: f.yontem,
    sabitBedel: parseTrAmountInput(f.sabitBedel),
    hizmetPayiSabit: parseTrAmountInput(f.hizmetPayiSabit),
    hizmetPayiYuzde: parseTrAmountInput(f.hizmetPayiYuzde),
    ekKalemler: f.ekKalemler.map((k) => ({
      id: k.id,
      ad: k.ad,
      tur: k.tur,
      deger: parseTrAmountInput(k.deger),
      varsayilanMiktar: parseTrAmountInput(k.varsayilanMiktar) ?? 1,
    })),
    asgariBedel: parseTrAmountInput(f.asgariBedel),
    azamiBedel: parseTrAmountInput(f.azamiBedel),
    not: f.not,
  });
}

export function CustomerHasarTespitTarifeTab({ customerId, canEdit }: { customerId: string; canEdit: boolean }) {
  const [form, setForm] = useState<Form>(() => toForm(DEFAULT_HASAR_TESPIT_TARIFE));
  const [kayitli, setKayitli] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [newKalem, setNewKalem] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/hasar-tespit-bedel/tarife/${customerId}`, { headers: authHeader() });
      setForm(toForm(normalizeHasarTespitTarife(res.data?.data?.tarife)));
      setKayitli(Boolean(res.data?.data?.kayitli));
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { void load(); }, [load]);

  const patch = (next: Partial<Form>) => {
    setSavedNote('');
    setForm((f) => ({ ...f, ...next }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSavedNote('');
    try {
      const res = await axios.put(`${API}/hasar-tespit-bedel/tarife/${customerId}`, fromForm(form), { headers: authHeader() });
      setForm(toForm(normalizeHasarTespitTarife(res.data?.data)));
      setKayitli(true);
      setSavedNote('Tarife kaydedildi. Bu müşterinin Hasar Tespit dosyasında hizmet bedeli bu tarifeyle hesaplanır.');
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const addKalem = () => {
    const ad = toTitleCaseTR(newKalem.trim());
    if (!ad) return;
    patch({ ekKalemler: [...form.ekKalemler, { id: `kalem-${Date.now()}`, ad, tur: 'adet', deger: '', varsayilanMiktar: '1' }] });
    setNewKalem('');
  };

  const setKalem = (i: number, next: Partial<EkForm>) =>
    patch({ ekKalemler: form.ekKalemler.map((k, j) => (j === i ? { ...k, ...next } : k)) });

  return (
    <div className="space-y-4" data-testid="musteri-hasar-tespit-tarifesi">
      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-brand-600" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Hasar Tespit Tarifesi</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {kayitli ? 'Bu müşteriye özel tarife kayıtlı.' : 'Henüz tarife girilmedi. Dosyada hesap boş tarifeyle açılır.'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-4">
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          {savedNote ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{savedNote}</p> : null}
          {loading ? <p className="text-sm text-slate-500">Yükleniyor</p> : null}

          <div>
            <SettingsFieldLabel help="Sabit Bedel: dosya başı tek fiyat. Maliyetler + Hizmet Payı: yakıt, köprü, km aşımı ve araç kira payı toplanır, üstüne pay eklenir.">
              Hesap Yöntemi
            </SettingsFieldLabel>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
              {(Object.keys(TARIFE_YONTEM_LABEL) as TarifeYontem[]).map((y) => {
                const on = form.yontem === y;
                return (
                  <button
                    key={y}
                    type="button"
                    aria-pressed={on}
                    disabled={!canEdit}
                    onClick={() => patch({ yontem: y })}
                    className={`rounded-md px-3 py-1.5 text-sm ${on ? 'bg-brand-600 font-semibold text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {TARIFE_YONTEM_LABEL[y]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {form.yontem === 'sabit' ? (
              <div>
                <SettingsFieldLabel htmlFor="tarife-sabit" help="Dosya başı hizmet bedeli (KDV hariç).">Sabit Bedel</SettingsFieldLabel>
                <TrAmountInput id="tarife-sabit" className={inputCls} disabled={!canEdit} value={form.sabitBedel} onChange={(v) => patch({ sabitBedel: v })} />
              </div>
            ) : (
              <>
                <div>
                  <SettingsFieldLabel htmlFor="tarife-pay-sabit" help="Maliyetin üstüne eklenen sabit tutar (KDV hariç).">Hizmet Payı (Sabit)</SettingsFieldLabel>
                  <TrAmountInput id="tarife-pay-sabit" className={inputCls} disabled={!canEdit} value={form.hizmetPayiSabit} onChange={(v) => patch({ hizmetPayiSabit: v })} />
                </div>
                <div>
                  <SettingsFieldLabel htmlFor="tarife-pay-yuzde" help="Maliyet toplamının yüzdesi.">Hizmet Payı (%)</SettingsFieldLabel>
                  <input id="tarife-pay-yuzde" className={inputCls} inputMode="decimal" disabled={!canEdit} value={form.hizmetPayiYuzde} placeholder="Örn. 15" onChange={(e) => patch({ hizmetPayiYuzde: pctIn(e.target.value) })} />
                </div>
              </>
            )}
            <div>
              <SettingsFieldLabel htmlFor="tarife-asgari" help="Hesap bunun altında çıkarsa bu tutar yazılır.">Asgari Bedel</SettingsFieldLabel>
              <TrAmountInput id="tarife-asgari" className={inputCls} disabled={!canEdit} value={form.asgariBedel} onChange={(v) => patch({ asgariBedel: v })} />
            </div>
            <div>
              <SettingsFieldLabel htmlFor="tarife-azami" help="Hesap bunun üstünde çıkarsa bu tutar yazılır.">Azami Bedel</SettingsFieldLabel>
              <TrAmountInput id="tarife-azami" className={inputCls} disabled={!canEdit} value={form.azamiBedel} onChange={(v) => patch({ azamiBedel: v })} />
            </div>
          </div>

          <div>
            <SettingsFieldLabel help="Anlaşmaya göre eklenen kalemler. Adet ve saat birim fiyatla, yüzde maliyet toplamıyla çarpılır. Dosyada miktar değiştirilebilir.">
              Ek Kalemler
            </SettingsFieldLabel>
            {form.ekKalemler.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                      <th className="py-2 pr-3 font-medium">Kalem</th>
                      <th className="w-32 py-2 pr-3 font-medium">Tür</th>
                      <th className="w-40 py-2 pr-3 font-medium">Birim Fiyat / Oran</th>
                      <th className="w-32 py-2 pr-3 font-medium">Varsayılan Miktar</th>
                      <th className="w-12 py-2" aria-label="İşlem" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.ekKalemler.map((k, i) => (
                      <tr key={k.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 pr-3 font-medium text-slate-900">{k.ad}</td>
                        <td className="py-2 pr-3">
                          <select className={inputCls} disabled={!canEdit} value={k.tur} onChange={(e) => setKalem(i, { tur: e.target.value as EkKalemTuru, deger: '' })}>
                            {(Object.keys(EK_KALEM_TURU_LABEL) as EkKalemTuru[]).map((t) => (
                              <option key={t} value={t}>{EK_KALEM_TURU_LABEL[t]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          {k.tur === 'yuzde' ? (
                            <input className={inputCls} inputMode="decimal" disabled={!canEdit} value={k.deger} placeholder="%" onChange={(e) => setKalem(i, { deger: pctIn(e.target.value) })} />
                          ) : (
                            <TrAmountInput className={inputCls} disabled={!canEdit} value={k.deger} onChange={(v) => setKalem(i, { deger: v })} />
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <input className={inputCls} inputMode="decimal" disabled={!canEdit} value={k.varsayilanMiktar} onChange={(e) => setKalem(i, { varsayilanMiktar: pctIn(e.target.value) })} />
                        </td>
                        <td className="py-2 text-right">
                          {canEdit ? (
                            <button
                              type="button"
                              title="Kaldır"
                              aria-label={`${k.ad} kaldır`}
                              onClick={() => patch({ ekKalemler: form.ekKalemler.filter((_, j) => j !== i) })}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Ek kalem yok.</p>
            )}
            {canEdit ? (
              <div className="mt-3 flex max-w-md gap-2">
                <input
                  className={inputCls}
                  value={newKalem}
                  placeholder="Örn. rapor hazırlama"
                  aria-label="Yeni kalem adı"
                  onChange={(e) => setNewKalem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addKalem(); }}
                />
                <button type="button" onClick={addKalem} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Plus className="h-4 w-4" /> Kalem Ekle
                </button>
              </div>
            ) : null}
          </div>

          <div>
            <SettingsFieldLabel htmlFor="tarife-not" help="Anlaşma notu; hesap ekranında görünür.">Anlaşma Notu</SettingsFieldLabel>
            <textarea id="tarife-not" rows={2} className={inputCls} disabled={!canEdit} value={form.not} placeholder="Örn. il dışı tespitlerde ek gün yazılır" onChange={(e) => patch({ not: e.target.value })} />
          </div>

          {canEdit ? (
            <div className="flex justify-end">
              <button type="button" onClick={() => void save()} disabled={saving || loading} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {saving ? 'Kaydediliyor' : 'Kaydet'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

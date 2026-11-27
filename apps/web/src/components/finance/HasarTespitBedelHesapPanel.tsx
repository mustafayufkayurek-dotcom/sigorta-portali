'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { AlertTriangle, Calculator, Fuel, MapPin, Plus, RefreshCw, Route, Trash2 } from 'lucide-react';
import { TrAmountInput } from '@/components/ui/TrAmountInput';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { FinansFieldLabel, finansInputClass } from '@/components/finance/FinansPanelUI';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { API, authHeader } from '@/utils/api';
import { formatSettingsApiError } from '@/utils/settings-api';
import { numberToTrAmountInput, parseTrAmountInput } from '@/utils/tr-amount-input';
import {
  YAKIT_TURU_LABEL,
  gecisSatirlari,
  hesaplaHasarTespitBedeli,
  normalizeHasarTespitArac,
  normalizeHasarTespitTarife,
  otoyolSatirlari,
  type BedelSatiri,
  type HasarTespitAracAyarlari,
  type HasarTespitTarife,
  type YakitTuru,
} from '@sigorta/shared';

interface Ozet {
  dosya: { id: string; fileNo: string; musteriId: string | null; musteriAdi: string; hedefAdres: string; il: string | null; ilce: string | null };
  arac: HasarTespitAracAyarlari;
  tarife: HasarTespitTarife;
  tarifeKayitli: boolean;
  hizmetBedeli: { id: string; amount: number; entryDate: string } | null;
  sonHesap: { tarih: string; sonuc?: { satirlar: BedelSatiri[]; bedel: number; toplamKm: number } } | null;
  sahaTaslak?: {
    tarih?: string;
    cikisAdresi?: string | null;
    toplamKm?: number | null;
    gecisler?: Array<{ id: string; ad: string; adet?: number; ucret: number | null }>;
    otoyollar?: Array<{ ref: string; ad?: string; km?: number; kmUcreti: number | null }>;
    yemekTutar?: number | null;
    yemekNot?: string | null;
    maliyetOnizleme?: number | null;
  } | null;
}

type GecisRow = { id: string; ad: string; adet: string; ucret: string };
type OtoyolRow = { ref: string; ad?: string; km: string; kmUcreti: string };

const tl = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
const dec = (v: string) => v.replace(/[^\d,]/g, '');
const decNum = (v: string) => parseTrAmountInput(v);

export function HasarTespitBedelHesapPanel({ claimId, onDone }: { claimId: string; onDone: () => void }) {
  const [ozet, setOzet] = useState<Ozet | null>(null);
  const [loadError, setLoadError] = useState('');
  const [cikis, setCikis] = useState('');
  const [rotaKm, setRotaKm] = useState('');
  const [rotaNot, setRotaNot] = useState('');
  const [rotaBusy, setRotaBusy] = useState(false);
  const [gidisDonus, setGidisDonus] = useState(true);
  const [gun, setGun] = useState('1');
  const [yakitTuru, setYakitTuru] = useState<YakitTuru>('motorin');
  const [yakitFiyati, setYakitFiyati] = useState('');
  const [yakitKaynak, setYakitKaynak] = useState('');
  const [yakitBusy, setYakitBusy] = useState(false);
  const [gecisler, setGecisler] = useState<GecisRow[]>([]);
  const [otoyollar, setOtoyollar] = useState<OtoyolRow[]>([]);
  const [ekMiktar, setEkMiktar] = useState<Record<string, string>>({});
  const [ekleGecis, setEkleGecis] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sonucNot, setSonucNot] = useState('');
  const [sahaNot, setSahaNot] = useState('');

  const fetchYakit = useCallback(async (o: Ozet, tur: YakitTuru) => {
    if (!o.dosya.il) {
      setYakitKaynak('Dosyada il yok; fiyatı elle yazın.');
      return;
    }
    setYakitBusy(true);
    try {
      const res = await axios.get(`${API}/hasar-tespit-bedel/akaryakit`, {
        headers: authHeader(),
        params: { il: o.dosya.il, ilce: o.dosya.ilce ?? '', tur },
      });
      const d = res.data?.data as { fiyat: number | null; bolge: string | null; kaynak: string; tarih: string; mesaj?: string };
      if (d?.fiyat) {
        setYakitFiyati(numberToTrAmountInput(d.fiyat));
        const tarih = d.tarih ? d.tarih.split('-').reverse().join('.') : '';
        setYakitKaynak(`${d.kaynak} · ${d.bolge ?? o.dosya.il} · ${tarih} · KDV dahil`);
      } else {
        setYakitKaynak(d?.mesaj ?? 'Güncel fiyat okunamadı; fiyatı elle yazın.');
      }
    } catch (e: unknown) {
      setYakitKaynak(formatSettingsApiError(e));
    } finally {
      setYakitBusy(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await axios.get(`${API}/claim-files/${claimId}/hasar-tespit-bedel`, { headers: authHeader() });
      const raw = res.data?.data;
      const o: Ozet = {
        ...raw,
        arac: normalizeHasarTespitArac(raw?.arac),
        tarife: normalizeHasarTespitTarife(raw?.tarife),
      };
      setOzet(o);
      setCikis(o.arac.varsayilanCikisAdresi);
      setYakitTuru(o.arac.yakitTuru);
      setEkMiktar(Object.fromEntries(o.tarife.ekKalemler.map((k) => [k.id, String(k.varsayilanMiktar).replace('.', ',')])));
      const taslak = o.sahaTaslak;
      if (taslak && !o.hizmetBedeli) {
        if (taslak.cikisAdresi) setCikis(taslak.cikisAdresi);
        if (taslak.toplamKm != null && taslak.toplamKm > 0) {
          setRotaKm(String(taslak.toplamKm).replace('.', ','));
        }
        if (Array.isArray(taslak.gecisler) && taslak.gecisler.length) {
          setGecisler(
            taslak.gecisler.map((g) => ({
              id: g.id,
              ad: g.ad,
              adet: String(g.adet ?? 1),
              ucret: numberToTrAmountInput(g.ucret),
            })),
          );
        }
        if (Array.isArray(taslak.otoyollar) && taslak.otoyollar.length) {
          setOtoyollar(
            taslak.otoyollar.map((y) => ({
              ref: y.ref,
              ad: y.ad,
              km: y.km ? String(y.km).replace('.', ',') : '',
              kmUcreti: numberToTrAmountInput(y.kmUcreti),
            })),
          );
        }
        const yemekParca = [
          taslak.yemekTutar != null && taslak.yemekTutar > 0
            ? `Yemek taslağı ${tl(taslak.yemekTutar)}`
            : null,
          taslak.yemekNot || null,
          taslak.maliyetOnizleme != null ? `önizleme ${tl(taslak.maliyetOnizleme)}` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        setSahaNot(
          yemekParca
            ? `Tespitçi taslağı yüklendi. ${yemekParca}. Yemek Gelire Düşür’e girmez; Masraf olarak yazılır.`
            : 'Tespitçi taslağı yüklendi. Köprü / otoyol satırları dolduruldu.',
        );
      } else {
        setSahaNot('');
      }
      if (!o.hizmetBedeli) void fetchYakit(o, o.arac.yakitTuru);
    } catch (e: unknown) {
      setLoadError(formatSettingsApiError(e));
    }
  }, [claimId, fetchYakit]);

  useEffect(() => { void load(); }, [load]);

  const rotaHesapla = async () => {
    if (!ozet) return;
    setRotaBusy(true);
    setError('');
    setRotaNot('');
    try {
      const res = await axios.post(`${API}/claim-files/${claimId}/hasar-tespit-bedel/rota`, { cikisAdresi: cikis }, { headers: authHeader() });
      const d = res.data?.data as {
        km: number;
        dakika: number;
        gecisler: string[];
        otoyollar: Array<{ ref: string; ad?: string; km: number }>;
        gecisUcretOneri?: Array<{ id: string; ucret: number | null }>;
        otoyolUcretOneri?: Array<{ ref: string; kmUcreti: number | null }>;
      };
      setRotaKm(String(d.km).replace('.', ','));
      setRotaNot(`Tek yön ${d.km.toLocaleString('tr-TR')} km · yaklaşık ${Math.floor(d.dakika / 60)} sa ${d.dakika % 60} dk`);
      const gecisOneri = new Map((d.gecisUcretOneri ?? []).map((g) => [g.id, g.ucret]));
      setGecisler(gecisSatirlari(d.gecisler, ozet.arac.gecisler, gidisDonus).map((g) => {
        const oneri = gecisOneri.get(g.id);
        const ucret = oneri != null ? oneri : g.ucret;
        return { id: g.id, ad: g.ad, adet: String(g.adet), ucret: numberToTrAmountInput(ucret) };
      }));
      const otoyolOneri = new Map((d.otoyolUcretOneri ?? []).map((o) => [o.ref.toUpperCase(), o.kmUcreti]));
      setOtoyollar(otoyolSatirlari(d.otoyollar, ozet.arac.otoyollar).map((y) => {
        const oneri = otoyolOneri.get(y.ref.toUpperCase());
        const kmUcreti = oneri != null ? oneri : y.kmUcreti;
        return {
          ref: y.ref,
          ad: y.ad,
          km: String(y.km).replace('.', ','),
          kmUcreti: kmUcreti == null ? '' : String(kmUcreti).replace('.', ','),
        };
      }));
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setRotaBusy(false);
    }
  };

  const girdi = useMemo(() => {
    if (!ozet) return null;
    return {
      rotaKm: decNum(rotaKm) ?? 0,
      gidisDonus,
      yakitTuru,
      yakitFiyati: parseTrAmountInput(yakitFiyati),
      tuketimL100: ozet.arac.tuketimL100,
      kmAsimUcreti: ozet.arac.kmAsimUcreti,
      aylikKira: ozet.arac.aylikKira,
      gun: decNum(gun) ?? 1,
      tarih: new Date(),
      gecisler: gecisler.map((g) => ({ id: g.id, ad: g.ad, adet: Number(g.adet) || 0, ucret: parseTrAmountInput(g.ucret) })),
      otoyollar: otoyollar.map((o) => ({ ref: o.ref, ad: o.ad, km: decNum(o.km) ?? 0, kmUcreti: decNum(o.kmUcreti) })),
      tarife: ozet.tarife,
      ekMiktarlar: Object.fromEntries(Object.entries(ekMiktar).map(([k, v]) => [k, decNum(v) ?? 0])),
    };
  }, [ozet, rotaKm, gidisDonus, yakitTuru, yakitFiyati, gun, gecisler, otoyollar, ekMiktar]);

  const sonuc = useMemo(() => (girdi ? hesaplaHasarTespitBedeli(girdi) : null), [girdi]);

  const gelireDusur = async () => {
    if (!girdi || !sonuc) return;
    setSaving(true);
    setError('');
    try {
      const res = await axios.post(
        `${API}/claim-files/${claimId}/hasar-tespit-bedel/gelire-dusur`,
        { ...girdi, tarih: undefined, tarife: undefined, cikisAdresi: cikis, yakitKaynak },
        { headers: authHeader() },
      );
      const d = res.data?.data as { sonuc: { bedel: number }; giderSayisi: number; giderHatalari: string[] };
      const hata = d.giderHatalari?.length ? ` Yazılamayan gider: ${d.giderHatalari.join('; ')}` : '';
      setSonucNot(`${tl(d.sonuc.bedel)} +KDV gelire düştü. ${d.giderSayisi} gider dosyaya yazıldı.${hata}`);
      onDone();
      await load();
    } catch (e: unknown) {
      setError(formatSettingsApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{loadError}</p>;
  }
  if (!ozet) return <p className="p-4 text-sm text-slate-500">Yükleniyor</p>;

  const kilitli = Boolean(ozet.hizmetBedeli);
  const satirlar = kilitli ? (ozet.sonHesap?.sonuc?.satirlar ?? []) : (sonuc?.satirlar ?? []);
  const eklenebilir = ozet.arac.gecisler.filter((g) => !gecisler.some((r) => r.id === g.id));

  return (
    <div className="flex h-full flex-col" data-testid="hasar-tespit-bedel-hesap">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <OpsFirstRunNotice
          noticeId={OPS_NOTICE.hasarTespitBedelHesapla.id}
          title={OPS_NOTICE.hasarTespitBedelHesapla.title}
          body={OPS_NOTICE.hasarTespitBedelHesapla.body}
          testId="hasar-tespit-bedel-seridi"
          compact
        />

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
          <p className="font-semibold text-slate-900">{ozet.dosya.fileNo}{ozet.dosya.musteriAdi ? ` · ${ozet.dosya.musteriAdi}` : ''}</p>
          <p className="mt-0.5 flex items-start gap-1.5 text-slate-600">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            {ozet.dosya.hedefAdres || 'Tespit adresi dosyada yok'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {ozet.tarifeKayitli ? 'Müşteri tarifesi kayıtlı.' : 'Müşteri tarifesi girilmedi.'}{' '}
            {ozet.dosya.musteriId ? (
              <Link href={`/panel/musteriler/${ozet.dosya.musteriId}`} className="font-medium text-brand-700 hover:underline">Tarifeyi aç</Link>
            ) : null}
            {ozet.tarife.not ? <span className="mt-0.5 block">Anlaşma: {ozet.tarife.not}</span> : null}
          </p>
        </div>

        {sahaNot ? (
          <p className="rounded-lg border border-brand-100 bg-brand-50/70 px-3 py-2 text-xs text-brand-900" data-testid="saha-bedel-taslak-not">
            {sahaNot}
          </p>
        ) : null}

        {kilitli ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Bu dosyada hizmet bedeli gelirde: {tl(ozet.hizmetBedeli!.amount)} +KDV. Değiştirmek için cari ekstredeki kaydı düzeltin.
          </p>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Route className="h-4 w-4 text-brand-600" aria-hidden /> Rota
              </div>
              <div>
                <FinansFieldLabel required>Çıkış Adresi</FinansFieldLabel>
                <div className="flex gap-2">
                  <input className={finansInputClass} value={cikis} placeholder="Örn. ofis adresi, ilçe, il" onChange={(e) => setCikis(e.target.value)} />
                  <button
                    type="button"
                    onClick={() => void rotaHesapla()}
                    disabled={rotaBusy || !cikis.trim()}
                    className="shrink-0 rounded-lg border border-brand-600 bg-white px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                  >
                    {rotaBusy ? 'Hesaplanıyor' : 'Rotayı Hesapla'}
                  </button>
                </div>
                {rotaNot ? <p className="mt-1 text-xs text-slate-500">{rotaNot}</p> : null}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FinansFieldLabel required>Tek Yön Km</FinansFieldLabel>
                  <input className={finansInputClass} inputMode="decimal" value={rotaKm} onChange={(e) => setRotaKm(dec(e.target.value))} />
                </div>
                <div>
                  <FinansFieldLabel>Gün</FinansFieldLabel>
                  <input className={finansInputClass} inputMode="decimal" value={gun} onChange={(e) => setGun(dec(e.target.value))} />
                </div>
                <div>
                  <FinansFieldLabel>Yön</FinansFieldLabel>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={gidisDonus}
                    onClick={() => {
                      const next = !gidisDonus;
                      setGidisDonus(next);
                      setGecisler((rows) => rows.map((r) => {
                        const ayar = ozet.arac.gecisler.find((g) => g.id === r.id);
                        return { ...r, adet: String(next && ayar?.ciftYon !== false ? 2 : 1) };
                      }));
                    }}
                    className="flex h-[38px] items-center gap-2 text-sm"
                  >
                    <span className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${gidisDonus ? 'bg-brand-600' : 'bg-slate-200'}`}>
                      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${gidisDonus ? 'translate-x-5' : ''}`} />
                    </span>
                    <span className="text-slate-700">{gidisDonus ? 'Gidiş-dönüş' : 'Tek yön'}</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Fuel className="h-4 w-4 text-brand-600" aria-hidden /> Akaryakıt
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FinansFieldLabel>Yakıt Türü</FinansFieldLabel>
                  <select
                    className={finansInputClass}
                    value={yakitTuru}
                    onChange={(e) => {
                      const t = e.target.value as YakitTuru;
                      setYakitTuru(t);
                      void fetchYakit(ozet, t);
                    }}
                  >
                    {(Object.keys(YAKIT_TURU_LABEL) as YakitTuru[]).map((t) => <option key={t} value={t}>{YAKIT_TURU_LABEL[t]}</option>)}
                  </select>
                </div>
                <div>
                  <FinansFieldLabel required>Litre Fiyatı</FinansFieldLabel>
                  <TrAmountInput className={finansInputClass} value={yakitFiyati} onChange={setYakitFiyati} />
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <button type="button" title="Fiyatı yenile" aria-label="Fiyatı yenile" onClick={() => void fetchYakit(ozet, yakitTuru)} className="rounded p-0.5 text-slate-400 hover:text-brand-700">
                  <RefreshCw className={`h-3.5 w-3.5 ${yakitBusy ? 'animate-spin' : ''}`} />
                </button>
                {yakitBusy ? 'Güncel fiyat okunuyor' : yakitKaynak || 'Fiyat okunmadı'}
              </p>
            </section>

            <section className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Köprü, Tünel Ve Otoyol</p>
              {gecisler.length === 0 && otoyollar.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Rotada ücretli geçiş yok. Gerekirse aşağıdan ekleyin.</p>
              ) : null}
              {gecisler.map((g, i) => (
                <div key={g.id} className="grid grid-cols-[minmax(0,1fr)_64px_120px_28px] items-center gap-2">
                  <span className="truncate text-sm text-slate-800">{g.ad}</span>
                  <input aria-label={`${g.ad} adet`} className={finansInputClass} inputMode="numeric" value={g.adet} onChange={(e) => setGecisler((r) => r.map((x, j) => (j === i ? { ...x, adet: e.target.value.replace(/\D/g, '') } : x)))} />
                  <TrAmountInput className={finansInputClass} value={g.ucret} onChange={(v) => setGecisler((r) => r.map((x, j) => (j === i ? { ...x, ucret: v } : x)))} />
                  <button type="button" title="Kaldır" aria-label={`${g.ad} kaldır`} onClick={() => setGecisler((r) => r.filter((_, j) => j !== i))} className="rounded p-1 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {otoyollar.map((o, i) => (
                <div key={o.ref} className="grid grid-cols-[minmax(0,1fr)_64px_120px_28px] items-center gap-2">
                  <span className="truncate text-sm text-slate-800">{o.ad ? `${o.ref} ${o.ad}` : `${o.ref} Otoyolu`} <span className="text-xs text-slate-500">(km)</span></span>
                  <input aria-label={`${o.ref} km`} className={finansInputClass} inputMode="decimal" value={o.km} onChange={(e) => setOtoyollar((r) => r.map((x, j) => (j === i ? { ...x, km: dec(e.target.value) } : x)))} />
                  <input aria-label={`${o.ref} km ücreti`} className={finansInputClass} inputMode="decimal" placeholder="TL / km" value={o.kmUcreti} onChange={(e) => setOtoyollar((r) => r.map((x, j) => (j === i ? { ...x, kmUcreti: dec(e.target.value) } : x)))} />
                  <button type="button" title="Kaldır" aria-label={`${o.ref} kaldır`} onClick={() => setOtoyollar((r) => r.filter((_, j) => j !== i))} className="rounded p-1 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {eklenebilir.length ? (
                <div className="flex gap-2">
                  <select aria-label="Geçiş ekle" className={finansInputClass} value={ekleGecis} onChange={(e) => setEkleGecis(e.target.value)}>
                    <option value="">Geçiş seçin</option>
                    {eklenebilir.map((g) => <option key={g.id} value={g.id}>{g.ad}</option>)}
                  </select>
                  <button
                    type="button"
                    disabled={!ekleGecis}
                    onClick={() => {
                      const g = ozet.arac.gecisler.find((x) => x.id === ekleGecis);
                      if (!g) return;
                      setGecisler((r) => [...r, { id: g.id, ad: g.ad, adet: String(gidisDonus && g.ciftYon ? 2 : 1), ucret: numberToTrAmountInput(g.ucret) }]);
                      setEkleGecis('');
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Ekle
                  </button>
                </div>
              ) : null}
            </section>

            {ozet.tarife.ekKalemler.length ? (
              <section className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Tarife Ek Kalemleri</p>
                {ozet.tarife.ekKalemler.map((k) => (
                  <div key={k.id} className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-2">
                    <span className="text-sm text-slate-800">{k.ad}</span>
                    <input aria-label={`${k.ad} miktar`} className={finansInputClass} inputMode="decimal" value={ekMiktar[k.id] ?? ''} onChange={(e) => setEkMiktar((m) => ({ ...m, [k.id]: dec(e.target.value) }))} />
                  </div>
                ))}
              </section>
            ) : null}
          </>
        )}

        <section>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Calculator className="h-4 w-4 text-brand-600" aria-hidden /> Hesap
          </div>
          {satirlar.length ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Kalem</th>
                    <th className="px-3 py-2 text-right font-medium">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map((s) => (
                    <tr key={s.kod} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <span className={`block ${s.tur === 'gider' ? 'text-slate-800' : 'font-medium text-slate-900'}`}>{s.ad}</span>
                        <span className={`block text-xs ${s.eksik ? 'text-amber-700' : 'text-slate-500'}`}>{s.aciklama}</span>
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${s.eksik ? 'text-amber-700' : 'text-slate-900'}`}>{tl(s.tutar)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50">
                  {!kilitli && sonuc ? (
                    <tr>
                      <td className="px-3 py-2 text-xs text-slate-500">Maliyet toplamı (dosya gideri)</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-600">{tl(sonuc.maliyetToplami)}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td className="px-3 py-2 font-semibold text-slate-900">
                      Hizmet Bedeli (KDV Hariç)
                      {!kilitli && sonuc?.sinirUygulandi ? (
                        <span className="block text-xs font-normal text-slate-500">Tarifenin {sonuc.sinirUygulandi === 'asgari' ? 'asgari' : 'azami'} bedeli uygulandı</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {tl(kilitli ? (ozet.hizmetBedeli?.amount ?? 0) : (sonuc?.bedel ?? 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {kilitli ? 'Hesap satırı kayıtlı değil; bedel elle girilmiş.' : 'Rotayı hesaplayın veya km yazın.'}
            </p>
          )}
          {!kilitli && sonuc?.eksikler.length ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Eksik fiyat</p>
              <ul className="mt-1 list-disc pl-5">
                {sonuc.eksikler.map((e) => <li key={e}>{e}</li>)}
              </ul>
              <p className="mt-1">
                Araç ve geçiş ücretleri <Link href="/panel/ayarlar/hasar-tespit-arac" className="font-medium underline">Ayarlar</Link>’da,
                tarife müşteri kartındadır.
              </p>
            </div>
          ) : null}
        </section>

        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        {sonucNot ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{sonucNot}</p> : null}
      </div>

      {!kilitli ? (
        <div className="border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            data-testid="hasar-tespit-gelire-dusur"
            onClick={() => void gelireDusur()}
            disabled={saving || !sonuc || sonuc.bedel <= 0 || !(decNum(rotaKm) ?? 0)}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor' : `Gelire Düşür${sonuc && sonuc.bedel > 0 ? ` · ${tl(sonuc.bedel)} +KDV` : ''}`}
          </button>
          <p className="mt-1.5 text-center text-xs text-slate-500">Hizmet bedeli gelire, yakıt, köprü, km aşımı ve kira payı dosya giderine yazılır.</p>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { ArrowRight, Banknote, CalendarRange, CheckCircle2, LayoutGrid, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { DashboardShell, DashboardHeader } from '../_components';
import {
  FinanceQueuesStrip,
  FinanceModulesDrawer,
  FinancePeriodSelector,
} from '@/features/dashboard/components/finance';
import {
  FinansActionButton,
  FinansDataTable,
  FinansFieldLabel,
  FinansModal,
  FinansPanelCard,
  finansInputClass,
} from '@/components/finance/FinansPanelUI';
import { TrAmountInput } from '@/components/ui/TrAmountInput';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { FinansTarihDonemUyariIkon } from '@/components/finance/FinansTarihDonemUyariIkon';
import { FinansVerimlilikAnalizUyariBant } from '@/components/finance/FinansVerimlilikAnalizUyariBant';
import { useToast } from '@/contexts/ToastContext';
import { usePanelConfirm } from '@/components/ui/use-panel-confirm';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import {
  FINANS_KART_YOL,
  masrafYol,
  netSonucYol,
  tahsilEdilenYol,
} from '@/utils/finans-merkez-kart';
import { API, authHeader } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { formatTryAmount } from '@/utils/format-try-amount';
import { parseTrAmountInput } from '@/utils/tr-amount-input';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { getAccessToken } from '@/utils/auth-session';
import type {
  FinansIsletmeSabitDusumOzet,
  FinansIsletmeSabitKalemi,
  FinansIsletmeSabitKategori,
  FinansKurulumDurum,
} from '@sigorta/shared';
import {
  FINANS_ISLETME_SABIT_KATEGORILER,
  resolveFinansIslemDonemSecimDurum,
  finansIsletmeSabitAktifAyda,
  sumFinansIsletmeSabit,
} from '@sigorta/shared';

type KurulumState = {
  kurulum: FinansKurulumDurum;
  seyirAcik: boolean;
  eksikler: string[];
  hesapSayisi: number;
};

type HedefDetay = {
  onerilenAylik: number;
  borcAylikPay: number;
  aylikSabitGider: number;
  karPayi: number;
  borcAySayisi: number;
  karPayiPct: number;
  cariBorc: number;
};

type SeyirState = {
  cariAlacak: number;
  cariBorc: number;
  nakit: number;
  hesapSayisi: number;
  gelir: number;
  gider: number;
  kar: number;
  hedefCiro: number | null;
  hedefDetay: HedefDetay | null;
  hedefKabul: number | null;
  hedefKabulAt: string | null;
  hedefOneriYokNeden: string | null;
  isletmeSabitKalemleri: FinansIsletmeSabitKalemi[];
  isletmeSabitToplam: number;
};

function yeniSabitKalemId(): string {
  return `sabit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function FinansDashboard() {
  const { showToast } = useToast();
  const { confirm, dialog } = usePanelConfirm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [kurulum, setKurulum] = useState<KurulumState | null>(null);
  const [seyir, setSeyir] = useState<SeyirState | null>(null);
  const [sabitDusulenIds, setSabitDusulenIds] = useState<string[]>([]);
  const [sabitDusuyor, setSabitDusuyor] = useState(false);
  const [kurulumKaydediliyor, setKurulumKaydediliyor] = useState(false);
  const [hedefKaydediliyor, setHedefKaydediliyor] = useState(false);
  const [hedefInceleAcik, setHedefInceleAcik] = useState(false);
  const [sabitAdInput, setSabitAdInput] = useState('');
  const [sabitKategori, setSabitKategori] = useState<FinansIsletmeSabitKategori>('Kira Ve Ofis');
  const [sabitTutarInput, setSabitTutarInput] = useState('');
  const [sabitBaslangic, setSabitBaslangic] = useState(() => new Date().toISOString().slice(0, 10));
  const [sabitBitis, setSabitBitis] = useState('');
  const [sabitBitisSuresiz, setSabitBitisSuresiz] = useState(true);
  const [sabitKaydediliyor, setSabitKaydediliyor] = useState(false);
  const [sabitEkleAcik, setSabitEkleAcik] = useState(false);
  const [sabitPartyAccountId, setSabitPartyAccountId] = useState('');
  const [partyAccounts, setPartyAccounts] = useState<
    { id: string; name: string; kindLabel: string }[]
  >([]);

  const applySeyirData = (data: {
    seyirAcik?: boolean;
    cariAlacak?: number;
    cariBorc?: number;
    nakit?: number;
    hesapSayisi?: number;
    gelir?: number;
    gider?: number;
    kar?: number;
    hedefCiro?: Partial<HedefDetay> | null;
    hedefKabul?: number | null;
    hedefKabulAt?: string | null;
    hedefOneriYokNeden?: string | null;
    hedefParametre?: {
      isletmeSabitKalemleri?: FinansIsletmeSabitKalemi[] | null;
      isletmeSabitToplam?: number | null;
    } | null;
  } | null) => {
    if (data?.seyirAcik) {
      const onerilenRaw =
        data.hedefCiro && typeof data.hedefCiro.onerilenAylik === 'number'
          ? Number(data.hedefCiro.onerilenAylik)
          : null;
      const onerilen =
        onerilenRaw != null && Number.isFinite(onerilenRaw) && onerilenRaw > 0
          ? onerilenRaw
          : null;
      const detay: HedefDetay | null =
        data.hedefCiro && onerilen != null
          ? {
              onerilenAylik: onerilen,
              borcAylikPay: Number(data.hedefCiro.borcAylikPay) || 0,
              aylikSabitGider: Number(data.hedefCiro.aylikSabitGider) || 0,
              karPayi: Number(data.hedefCiro.karPayi) || 0,
              borcAySayisi: Number(data.hedefCiro.borcAySayisi) || 12,
              karPayiPct: Number(data.hedefCiro.karPayiPct) || 15,
              cariBorc: Number(data.hedefCiro.cariBorc ?? data.cariBorc) || 0,
            }
          : null;
      const kabulRaw =
        typeof data.hedefKabul === 'number' && Number.isFinite(data.hedefKabul)
          ? Number(data.hedefKabul)
          : null;
      const kalemler = Array.isArray(data.hedefParametre?.isletmeSabitKalemleri)
        ? data.hedefParametre!.isletmeSabitKalemleri!
        : [];
      const toplam =
        typeof data.hedefParametre?.isletmeSabitToplam === 'number'
          ? Number(data.hedefParametre.isletmeSabitToplam)
          : sumFinansIsletmeSabit(kalemler);
      setSeyir({
        cariAlacak: Number(data.cariAlacak) || 0,
        cariBorc: Number(data.cariBorc) || 0,
        nakit: Number(data.nakit) || 0,
        hesapSayisi: Number(data.hesapSayisi) || 0,
        gelir: Number(data.gelir) || 0,
        gider: Number(data.gider) || 0,
        kar: Number(data.kar) || 0,
        hedefCiro: onerilen,
        hedefDetay: detay,
        hedefKabul: kabulRaw != null && kabulRaw > 0 ? kabulRaw : null,
        hedefKabulAt: typeof data.hedefKabulAt === 'string' ? data.hedefKabulAt : null,
        hedefOneriYokNeden:
          typeof data.hedefOneriYokNeden === 'string' ? data.hedefOneriYokNeden : null,
        isletmeSabitKalemleri: kalemler,
        isletmeSabitToplam: toplam,
      });
    } else {
      setSeyir(null);
    }
  };

  const loadKurulumVeSeyir = useCallback(() => {
    axios
      .get(`${API}/finance/party-accounts/setup`, { headers: authHeader() })
      .then((r) => {
        const data = r.data?.data;
        if (data) {
          setKurulum({
            kurulum: data.kurulum,
            seyirAcik: data.seyirAcik === true,
            eksikler: Array.isArray(data.eksikler) ? data.eksikler : [],
            hesapSayisi: Number(data.hesapSayisi) || 0,
          });
        }
      })
      .catch(() => {
        /* kurulum okunamazsa seyiri kesme */
      });

    axios
      .get(`${API}/finance/party-accounts/seyir-ozet`, {
        headers: authHeader(),
        params: { year, month },
      })
      .then((r) => applySeyirData(r.data?.data))
      .catch(() => setSeyir(null));
  }, [year, month]);

  useEffect(() => {
    loadKurulumVeSeyir();
  }, [loadKurulumVeSeyir]);

  const loadSabitDusumDurum = useCallback(() => {
    if (!getAccessToken()) return;
    axios
      .get(`${API}/finance/party-accounts/isletme-sabit/dusum`, {
        headers: authHeader(),
        params: { year, month },
      })
      .then((r) => {
        const ids = r.data?.data?.postedKalemIds;
        setSabitDusulenIds(Array.isArray(ids) ? ids.map(String) : []);
      })
      .catch(() => setSabitDusulenIds([]));
  }, [year, month]);

  useEffect(() => {
    loadSabitDusumDurum();
  }, [loadSabitDusumDurum, seyir?.isletmeSabitKalemleri.length]);

  useEffect(() => {
    if (!getAccessToken()) return;
    let cancelled = false;
    axios
      .get(`${API}/finance/party-accounts`, { headers: authHeader() })
      .then((res) => {
        if (cancelled) return;
        const rows = (res.data?.data ?? []) as Array<{
          id: string;
          name: string;
          kindLabel: string;
        }>;
        setPartyAccounts(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            kindLabel: r.kindLabel,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setPartyAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Cariler’den dönüşte İncele penceresi yeniden açılır. */
  useEffect(() => {
    if (searchParams.get('incele') !== 'hedef') return;
    const y = Number(searchParams.get('year'));
    const m = Number(searchParams.get('month'));
    if (Number.isFinite(y) && y > 0) setYear(y);
    if (Number.isFinite(m) && m > 0) setMonth(m);
    setHedefInceleAcik(true);
    loadKurulumVeSeyir();
    router.replace('/panel/finans', { scroll: false });
  }, [searchParams, router, loadKurulumVeSeyir]);

  const patchKurulum = async (body: Partial<FinansKurulumDurum>) => {
    if (kurulumKaydediliyor) return;
    setKurulumKaydediliyor(true);
    try {
      const r = await axios.patch(`${API}/finance/party-accounts/setup`, body, {
        headers: authHeader(),
      });
      const data = r.data?.data;
      if (data) {
        setKurulum((prev) => ({
          kurulum: data.kurulum,
          seyirAcik: data.seyirAcik === true,
          eksikler: Array.isArray(data.eksikler) ? data.eksikler : [],
          hesapSayisi: prev?.hesapSayisi ?? 0,
        }));
      }
      const seyirRes = await axios.get(`${API}/finance/party-accounts/seyir-ozet`, {
        headers: authHeader(),
      });
      applySeyirData(seyirRes.data?.data);
    } catch {
      /* kart aynı kalır */
    } finally {
      setKurulumKaydediliyor(false);
    }
  };

  const handleHedefKabul = async () => {
    if (!seyir || seyir.hedefCiro == null || hedefKaydediliyor) return;
    const tutar = seyir.hedefCiro;
    setHedefKaydediliyor(true);
    try {
      const r = await axios.patch(
        `${API}/finance/party-accounts/hedef-ciro`,
        { kabul: true, kabulAylik: tutar },
        { headers: { ...authHeader(), 'Content-Type': 'application/json' } },
      );
      applySeyirData(r.data?.data);
      showToast('success', 'Hedef ciro kabul edildi');
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Hedef ciro kaydedilemedi'));
    } finally {
      setHedefKaydediliyor(false);
    }
  };

  const temizleSabitForm = () => {
    setSabitAdInput('');
    setSabitKategori('Kira Ve Ofis');
    setSabitTutarInput('');
    setSabitBaslangic(new Date().toISOString().slice(0, 10));
    setSabitBitis('');
    setSabitBitisSuresiz(true);
    setSabitPartyAccountId('');
  };

  const kaydetIsletmeSabit = async (kalemler: FinansIsletmeSabitKalemi[]) => {
    if (sabitKaydediliyor) return false;
    setSabitKaydediliyor(true);
    try {
      const r = await axios.patch(
        `${API}/finance/party-accounts/hedef-ciro`,
        { isletmeSabitKalemleri: kalemler },
        { headers: { ...authHeader(), 'Content-Type': 'application/json' } },
      );
      applySeyirData(r.data?.data);
      showToast('success', 'Sabit gider tanımlandı');
      return true;
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Sabit gider kaydedilemedi'));
      return false;
    } finally {
      setSabitKaydediliyor(false);
    }
  };

  const acSabitKalemEkle = () => {
    temizleSabitForm();
    setModulesOpen(false);
    setHedefInceleAcik(false);
    setSabitEkleAcik(true);
  };

  const iptalSabitKalemEkle = () => {
    setSabitEkleAcik(false);
    temizleSabitForm();
  };

  const handleSabitKalemEkle = async () => {
    if (!seyir || sabitKaydediliyor) return;
    const ad = toTitleCaseTR(sabitAdInput.trim());
    const tutar = parseTrAmountInput(sabitTutarInput);
    if (!ad) {
      showToast('error', 'Gider adını yazın');
      return;
    }
    if (tutar == null || tutar <= 0) {
      showToast('error', 'Tutarı yazın');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sabitBaslangic)) {
      showToast('error', 'Başlangıç tarihini seçin');
      return;
    }
    const bitis =
      sabitBitisSuresiz || !sabitBitis
        ? null
        : /^\d{4}-\d{2}-\d{2}$/.test(sabitBitis)
          ? sabitBitis
          : null;
    if (!sabitBitisSuresiz && !bitis) {
      showToast('error', 'Bitiş tarihi geçersiz');
      return;
    }
    if (!sabitPartyAccountId) {
      showToast('error', 'Ödeme kaynağı cari seçimi zorunludur');
      return;
    }
    const kalem: FinansIsletmeSabitKalemi = {
      id: yeniSabitKalemId(),
      ad,
      kategori: sabitKategori,
      aylikTutar: tutar,
      tekrar: 'aylik',
      baslangic: sabitBaslangic,
      bitis,
      durum: 'aktif',
      partyAccountId: sabitPartyAccountId,
    };
    const ok = await kaydetIsletmeSabit([...seyir.isletmeSabitKalemleri, kalem]);
    if (ok) {
      temizleSabitForm();
      setSabitEkleAcik(false);
    }
  };

  const handleSabitKalemSil = (id: string) => {
    if (!seyir || sabitKaydediliyor) return;
    void kaydetIsletmeSabit(seyir.isletmeSabitKalemleri.filter((k) => k.id !== id));
  };

  const handleSabitAylikDusum = async () => {
    if (!seyir || sabitDusuyor) return;
    const aday = seyir.isletmeSabitKalemleri.filter((k) =>
      finansIsletmeSabitAktifAyda(k, year, month),
    );
    if (aday.length === 0) {
      showToast('error', 'Bu ay düşülecek aktif sabit gider yok');
      return;
    }
    const bekleyen = aday.filter((k) => !sabitDusulenIds.includes(k.id));
    if (bekleyen.length === 0) {
      showToast('success', 'Bu ayın sabit giderleri cariye zaten düşülmüş');
      return;
    }
    const donemEtiket = `${String(month).padStart(2, '0')}.${year}`;
    const ok = await confirm({
      title: 'Sabit Giderleri Cariye Düş',
      message: `${donemEtiket} dönemi için ${bekleyen.length} kalem seçili carilere yazılacak. Bu işlem ödeme kaydı değildir; aynı ay ikinci kez yazılmaz.`,
      confirmLabel: 'Cariye Düş',
      cancelLabel: 'Vazgeç',
      danger: false,
    });
    if (!ok) return;
    setSabitDusuyor(true);
    try {
      const r = await axios.post(
        `${API}/finance/party-accounts/isletme-sabit/dusum`,
        { year, month },
        { headers: { ...authHeader(), 'Content-Type': 'application/json' } },
      );
      const ozet = r.data?.data as FinansIsletmeSabitDusumOzet | undefined;
      const ids = Array.isArray(ozet?.postedKalemIds)
        ? ozet!.postedKalemIds.map(String)
        : [];
      setSabitDusulenIds(ids);
      const yeni = Number(ozet?.posted) || 0;
      if (yeni > 0) {
        showToast('success', `${yeni} sabit gider cariye düşüldü`);
      } else {
        showToast('success', 'Yeni düşüm yok — mevcut kayıtlar duruyor');
      }
      loadKurulumVeSeyir();
    } catch (e: unknown) {
      showToast('error', getApiErrorMessage(e, 'Cariye düşülemedi'));
    } finally {
      setSabitDusuyor(false);
    }
  };

  const sabitFormTutar = parseTrAmountInput(sabitTutarInput);
  const sabitDonemDurum = resolveFinansIslemDonemSecimDurum(year, month);

  const kurulumAcik = kurulum != null && !kurulum.seyirAcik;
  const cariTanimEksik = kurulumAcik && kurulum.kurulum.cariTanim === false;
  const acilisEksik = kurulumAcik && !kurulum.kurulum.acilisGozdenGecirildi;
  const masrafEksik = kurulumAcik && !kurulum.kurulum.masrafKaynak;
  const seyirHazir = Boolean(seyir && !kurulumAcik);
  const detay = seyir?.hedefDetay;
  const sabitToplam = seyir?.isletmeSabitToplam ?? 0;

  return (
    <DashboardShell>
      <DashboardHeader
        title="Finans Merkezi"
        hideDefaultActions
        showAcilAction={false}
        actions={
          <>
            <FinancePeriodSelector
              year={year}
              month={month}
              onYearChange={setYear}
              onMonthChange={setMonth}
            />
            <Link
              href={FINANS_KART_YOL.donemSonu}
              data-testid="finans-merkez-donem-sonu"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <CalendarRange className="h-4 w-4" />
              Dönem Sonu
            </Link>
            <button
              type="button"
              onClick={() => setModulesOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LayoutGrid className="h-4 w-4" />
              Finans Modülleri
            </button>
            <Link
              href={FINANS_KART_YOL.tahsilatKuyrugu}
              className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              <Banknote className="h-4 w-4" />
              Tahsilat Kuyruğu
              <ArrowRight className="h-3.5 w-3.5 opacity-70" />
            </Link>
          </>
        }
      />

      {kurulumAcik ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950"
          data-testid="finans-merkez-kurulum-seridi"
        >
          <p className="font-semibold">Finans Kurulumu</p>
          <p className="mt-1 text-amber-900">
            Şirket Seyri, aşağıdaki adımlar bitince açılır. Biten adım listeden kalkar.
          </p>
          <ul className="mt-3 space-y-2" data-testid="finans-kurulum-adim-listesi">
            {cariTanimEksik ? (
              <li
                className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2"
                data-testid="finans-kurulum-adim-cari"
              >
                <span className="flex-1 font-medium text-amber-950">Cari hesap tanımı</span>
                <Link
                  href={FINANS_KART_YOL.cariler}
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
                >
                  Carilere Git
                </Link>
                <button
                  type="button"
                  disabled={kurulumKaydediliyor}
                  onClick={() => void patchKurulum({ cariTanim: 'yok' })}
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
                >
                  Şimdilik Cari Yok
                </button>
              </li>
            ) : null}
            {acilisEksik ? (
              <li
                className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2"
                data-testid="finans-kurulum-adim-acilis"
              >
                <span className="flex-1 font-medium text-amber-950">
                  Açılış bakiyesi gözden geçirme
                </span>
                <Link
                  href={FINANS_KART_YOL.cariler}
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
                >
                  Bakiyeleri Gör
                </Link>
                <button
                  type="button"
                  disabled={kurulumKaydediliyor}
                  onClick={() => void patchKurulum({ acilisGozdenGecirildi: true })}
                  className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  data-testid="finans-kurulum-acilis-onay"
                >
                  {kurulumKaydediliyor ? 'Kaydediliyor…' : 'Gözden Geçirdim'}
                </button>
              </li>
            ) : null}
            {masrafEksik ? (
              <li
                className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2"
                data-testid="finans-kurulum-adim-masraf"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-amber-950">Masraf kaynağı</p>
                  <p className="mt-0.5 text-xs text-amber-900/80">
                    Yeni masraf cari seçilmeden kaydolmaz.
                  </p>
                </div>
                <Link
                  href={FINANS_KART_YOL.masraflar}
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
                >
                  Masraflara Git
                </Link>
                <button
                  type="button"
                  disabled={kurulumKaydediliyor}
                  onClick={() => void patchKurulum({ masrafKaynak: true })}
                  className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  data-testid="finans-kurulum-masraf-onay"
                >
                  {kurulumKaydediliyor ? 'Kaydediliyor…' : 'Masraf Kuralını Onayla'}
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {seyirHazir ? (
        <>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-800" data-testid="finans-sirket-seyir-baslik">
              Şirket Seyri
            </h2>
            <FinansVerimlilikAnalizUyariBant href="/panel/finans/karlilik" />
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              data-testid="finans-seyir-donem-ozet"
            >
              <Link
                href={tahsilEdilenYol(year, month)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-brand-300"
                data-testid="finans-seyir-gelir"
              >
                <p className="text-xs font-medium text-slate-500">Gelir</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {formatTryAmount(seyir!.gelir, { fractionDigits: 0 })}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Seçili dönem · Hasar Ve Acil
                </p>
              </Link>
              <Link
                href={masrafYol(year, month)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-brand-300"
                data-testid="finans-seyir-gider"
              >
                <p className="text-xs font-medium text-slate-500">Gider</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {formatTryAmount(seyir!.gider, { fractionDigits: 0 })}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Masraf Ve Acil · {String(month).padStart(2, '0')}.{year}
                </p>
              </Link>
              <Link
                href={netSonucYol(year, month)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-brand-300"
                data-testid="finans-seyir-kar"
              >
                <p className="text-xs font-medium text-slate-500">Kâr</p>
                <p
                  className={`mt-1 text-lg font-semibold tabular-nums ${
                    seyir!.kar < 0 ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  {seyir!.kar < 0
                    ? `−${formatTryAmount(Math.abs(seyir!.kar), { fractionDigits: 0 })}`
                    : formatTryAmount(seyir!.kar, { fractionDigits: 0 })}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">Gelir − Gider</p>
              </Link>
            </div>
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
              data-testid="finans-seyir-cari-ozet"
            >
              <Link
                href={FINANS_KART_YOL.cariler}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-brand-300"
              >
                <p className="text-xs font-medium text-slate-500">Cari Alacak</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {formatTryAmount(seyir!.cariAlacak, { fractionDigits: 0 })}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">Tahsil edilmemiş</p>
              </Link>
              <Link
                href={FINANS_KART_YOL.cariler}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-brand-300"
              >
                <p className="text-xs font-medium text-slate-500">Cari Borç</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {formatTryAmount(seyir!.cariBorc, { fractionDigits: 0 })}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">Ödenecek</p>
              </Link>
              <Link
                href={FINANS_KART_YOL.bankaHesaplari}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-brand-300"
                data-testid="finans-seyir-nakit"
              >
                <p className="text-xs font-medium text-slate-500">Nakit</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {formatTryAmount(seyir!.nakit, { fractionDigits: 0 })}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Banka Ve Kasa · {seyir!.hesapSayisi} cari
                </p>
              </Link>
              <div
                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                data-testid="finans-hedef-ciro-onerisi"
              >
                <p className="text-xs font-medium text-slate-500">
                  {seyir!.hedefKabul != null ? 'Hedef Ciro' : 'Hedef Ciro (Öneri)'}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {seyir!.hedefKabul != null
                    ? formatTryAmount(seyir!.hedefKabul, { fractionDigits: 0 })
                    : seyir!.hedefCiro != null
                      ? formatTryAmount(seyir!.hedefCiro, { fractionDigits: 0 })
                      : '—'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {seyir!.hedefKabul != null ? (
                    <p className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Kabul edildi
                    </p>
                  ) : seyir!.hedefCiro != null ? (
                    <p className="text-[11px] text-slate-400">Aylık · borç payı + sabit + kâr</p>
                  ) : (
                    <p className="text-[11px] text-amber-800" data-testid="finans-hedef-ciro-eksik">
                      Cari borç veya işletme sabiti gerekli
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setHedefInceleAcik(true)}
                    className="ml-auto rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    data-testid="finans-hedef-ciro-incele"
                  >
                    İncele
                  </button>
                  {seyir!.hedefKabul == null && seyir!.hedefCiro != null ? (
                    <button
                      type="button"
                      onClick={() => void handleHedefKabul()}
                      disabled={hedefKaydediliyor}
                      className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                      data-testid="finans-hedef-ciro-kabul"
                    >
                      {hedefKaydediliyor ? 'Kabul Ediliyor…' : 'Kabul Et'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div id="finans-sabit-gider-yonetimi" data-testid="finans-sabit-gider-yonetimi">
            <FinansPanelCard
              title="Sabit Gider Yönetimi"
              subtitle={
                <span className="tabular-nums" data-testid="finans-isletme-sabit-toplam">
                  Aylık tanımlı toplam: {formatTryAmount(sabitToplam, { fractionDigits: 0 })}
                </span>
              }
              action={{
                label: 'Sabit Gider Ekle',
                onClick: acSabitKalemEkle,
                variant: 'primary',
              }}
              noPadding
            >
              {seyir!.isletmeSabitKalemleri.length === 0 ? (
                <p
                  className="px-4 py-3 text-xs text-slate-500"
                  data-testid="finans-isletme-sabit-bos"
                >
                  Sabit gider yok
                </p>
              ) : (
                <>
                  <div className="space-y-2 border-b border-slate-100 px-4 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="text-xs text-slate-500">
                          Üstteki dönem ({String(month).padStart(2, '0')}.{year}) için cariye yazılır.
                          Ödeme kaydı değildir.
                        </p>
                        {sabitDonemDurum.kind !== 'ok' ? (
                          <FinansTarihDonemUyariIkon
                            message={sabitDonemDurum.message}
                            closed={sabitDonemDurum.kind === 'closed'}
                            testId="finans-isletme-sabit-donem-uyari"
                          />
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={sabitDusuyor || sabitKaydediliyor}
                        onClick={() => void handleSabitAylikDusum()}
                        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        data-testid="finans-isletme-sabit-dusum"
                      >
                        {sabitDusuyor ? 'Düşülüyor…' : 'Bu Ayı Cariye Düş'}
                      </button>
                    </div>
                  </div>
                  <FinansDataTable embedded>
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs text-slate-500">
                        <th className="px-4 py-2.5 font-medium">Gider</th>
                        <th className="px-3 py-2.5 font-medium">Ödeme Kaynağı</th>
                        <th className="w-36 px-3 py-2.5 text-right font-medium">Aylık Tutar</th>
                        <th className="w-28 px-3 py-2.5 font-medium">Durum</th>
                        <th className="w-12 px-2 py-2.5">
                          <span className="sr-only">İşlemler</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody data-testid="finans-isletme-sabit-liste">
                      {seyir!.isletmeSabitKalemleri.map((k) => {
                        const cari = partyAccounts.find((p) => p.id === k.partyAccountId);
                        const dusuldu = sabitDusulenIds.includes(k.id);
                        return (
                        <tr
                          key={k.id}
                          className="border-b border-slate-50 last:border-0"
                          data-testid="finans-isletme-sabit-satir"
                        >
                          <td className="px-4 py-2.5 text-sm text-slate-800">
                            <span className="font-medium">{k.ad}</span>
                            {k.kategori ? (
                              <span className="mt-0.5 block text-xs text-slate-400">{k.kategori}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-slate-700">
                            {k.partyAccountId && cari ? (
                              <Link
                                href={`/panel/finans/cariler/${encodeURIComponent(k.partyAccountId)}`}
                                className="font-medium text-brand-700 hover:underline"
                                data-testid="finans-isletme-sabit-cari"
                              >
                                {cari.name}
                              </Link>
                            ) : k.partyAccountId ? (
                              <span className="text-slate-500">Cari bağlı</span>
                            ) : (
                              <span className="text-amber-700">Cari seçilmedi</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                            {formatTryAmount(k.aylikTutar, { fractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2.5 text-sm">
                            <span
                              className={
                                k.durum === 'pasif' ? 'text-slate-500' : 'font-medium text-slate-700'
                              }
                            >
                              {k.durum === 'pasif' ? 'Pasif' : 'Aktif'}
                            </span>
                            {dusuldu ? (
                              <span
                                className="mt-0.5 block text-[11px] font-medium text-slate-600"
                                data-testid="finans-isletme-sabit-dusuldu"
                              >
                                {String(month).padStart(2, '0')}.{year} cariye yazıldı
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <button
                              type="button"
                              disabled={sabitKaydediliyor}
                              onClick={() => handleSabitKalemSil(k.id)}
                              className="inline-flex rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-red-600 disabled:opacity-60"
                              aria-label={`${k.ad} sil`}
                              data-testid="finans-isletme-sabit-sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </FinansDataTable>
                </>
              )}
            </FinansPanelCard>
          </div>

          <FinanceQueuesStrip />
          <OpsFirstRunNotice
            noticeId={OPS_NOTICE.finansTedarikciKuyruk.id}
            title={OPS_NOTICE.finansTedarikciKuyruk.title}
            body={OPS_NOTICE.finansTedarikciKuyruk.body}
            testId="finans-odeme-kuyruk-ilk-kullanim-seridi"
          />
        </>
      ) : null}

      <FinanceModulesDrawer open={modulesOpen} onClose={() => setModulesOpen(false)} />

      <FinansModal
        open={sabitEkleAcik}
        title="Yeni Sabit Gider"
        subtitle="Finans Merkezi / Gider Tanımlama"
        size="lg"
        testId="finans-sabit-gider-tanim-form"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FinansActionButton
              label="Temizle"
              onClick={temizleSabitForm}
              variant="neutral"
              showPlus={false}
              disabled={sabitKaydediliyor}
              testId="finans-isletme-sabit-temizle"
            />
            <div className="flex flex-wrap items-center gap-2">
              <FinansActionButton
                label="İptal"
                onClick={iptalSabitKalemEkle}
                variant="neutral"
                showPlus={false}
                disabled={sabitKaydediliyor}
              />
              <button
                type="button"
                disabled={sabitKaydediliyor}
                onClick={() => void handleSabitKalemEkle()}
                className="inline-flex items-center rounded-lg border border-brand-600 bg-brand-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
                data-testid="finans-isletme-sabit-ekle"
              >
                {sabitKaydediliyor ? 'Kaydediliyor…' : 'Gideri Tanımla'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <FinansFieldLabel required>Gider Adı</FinansFieldLabel>
            <input
              type="text"
              value={sabitAdInput}
              onChange={(e) => setSabitAdInput(e.target.value)}
              onBlur={() => {
                if (sabitAdInput.trim()) {
                  setSabitAdInput(toTitleCaseTR(sabitAdInput.trim()));
                }
              }}
              placeholder="Örn. ofis kirası"
              className={finansInputClass}
              autoFocus
              data-testid="finans-isletme-sabit-ad"
            />
          </div>
          <div>
            <FinansFieldLabel required>Gider Kategorisi</FinansFieldLabel>
            <select
              value={sabitKategori}
              onChange={(e) => setSabitKategori(e.target.value as FinansIsletmeSabitKategori)}
              className={finansInputClass}
              data-testid="finans-isletme-sabit-kategori"
            >
              {FINANS_ISLETME_SABIT_KATEGORILER.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div data-testid="finans-isletme-sabit-cari-alan">
            <FinansFieldLabel required>Ödeme Kaynağı (Cari)</FinansFieldLabel>
            <SearchableSelect
              options={partyAccounts.map((row) => ({
                value: row.id,
                label: `${row.name} · ${row.kindLabel}`,
              }))}
              value={sabitPartyAccountId}
              onChange={setSabitPartyAccountId}
              placeholder="Kredi kartı, banka veya tedarikçi cari ara..."
              emptyText="Cari bulunamadı — önce Cariler’den ekleyin"
              inputClassName={finansInputClass}
            />
            {sabitPartyAccountId ? (
              <div className="mt-2">
                <Link
                  href={`/panel/finans/cariler/${encodeURIComponent(sabitPartyAccountId)}`}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Cari Kartı Aç
                </Link>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div data-testid="finans-isletme-sabit-tutar">
              <FinansFieldLabel required>Tutar</FinansFieldLabel>
              <TrAmountInput
                value={sabitTutarInput}
                onChange={setSabitTutarInput}
                placeholder=""
                className={`${finansInputClass} text-right tabular-nums`}
              />
            </div>
            <div>
              <FinansFieldLabel>Tekrar Sıklığı</FinansFieldLabel>
              <select
                className={finansInputClass}
                value="aylik"
                disabled
                data-testid="finans-isletme-sabit-tekrar"
              >
                <option value="aylik">Aylık</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FinansFieldLabel required>Başlangıç Tarihi</FinansFieldLabel>
              <input
                type="date"
                value={sabitBaslangic}
                onChange={(e) => setSabitBaslangic(e.target.value)}
                className={finansInputClass}
                data-testid="finans-isletme-sabit-baslangic"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600">Bitiş Tarihi</span>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={sabitBitisSuresiz}
                    onChange={(e) => {
                      setSabitBitisSuresiz(e.target.checked);
                      if (e.target.checked) setSabitBitis('');
                    }}
                  />
                  Süresiz
                </label>
              </div>
              {sabitBitisSuresiz ? (
                <div
                  className={`${finansInputClass} bg-slate-50 text-slate-500`}
                  data-testid="finans-isletme-sabit-bitis-suresiz"
                >
                  Süresiz
                </div>
              ) : (
                <input
                  type="date"
                  value={sabitBitis}
                  onChange={(e) => setSabitBitis(e.target.value)}
                  className={finansInputClass}
                  data-testid="finans-isletme-sabit-bitis"
                />
              )}
            </div>
          </div>
          <div
            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3"
            data-testid="finans-sabit-gider-tanim-ozet"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-slate-600">Tanımlanan periyodik gider</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {sabitFormTutar != null && sabitFormTutar > 0
                  ? formatTryAmount(sabitFormTutar, { fractionDigits: 0 })
                  : '—'}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Bu kayıt ödeme yapıldığı anlamına gelmez. Gerçekleşen gider ayrıca izlenir.
            </p>
          </div>
        </div>
      </FinansModal>

      {hedefInceleAcik && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[400] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4"
              role="dialog"
              aria-modal="true"
              data-testid="finans-hedef-ciro-incele-modal"
            >
              <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
                <h3 className="text-base font-semibold text-slate-900">Hedef Ciro Detayı</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Aylık öneri; cari borç payı + aylık işletme sabiti + kâr payı. Sıfır hedef
                  kabul edilmez.
                </p>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Cari borç</span>
                    <span className="font-medium tabular-nums">
                      {formatTryAmount(seyir?.cariBorc ?? 0, { fractionDigits: 0 })}
                    </span>
                  </div>

                  {seyir?.hedefCiro != null || seyir?.hedefKabul != null ? (
                    <dl className="space-y-2" data-testid="finans-hedef-ciro-incele-ozet">
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">
                          Borç aylık pay ({detay?.borcAySayisi ?? 12} ay)
                        </dt>
                        <dd className="font-medium tabular-nums">
                          {formatTryAmount(detay?.borcAylikPay ?? 0, { fractionDigits: 0 })}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Aylık işletme sabiti</dt>
                        <dd className="font-medium tabular-nums">
                          {formatTryAmount(
                            detay?.aylikSabitGider ?? seyir?.isletmeSabitToplam ?? 0,
                            { fractionDigits: 0 },
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Kâr payı (%{detay?.karPayiPct ?? 15})</dt>
                        <dd className="font-medium tabular-nums">
                          {formatTryAmount(detay?.karPayi ?? 0, { fractionDigits: 0 })}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
                        <dt className="font-semibold text-slate-800">Önerilen aylık</dt>
                        <dd className="font-semibold tabular-nums text-slate-900">
                          {formatTryAmount(detay?.onerilenAylik ?? seyir?.hedefCiro ?? 0, {
                            fractionDigits: 0,
                          })}
                        </dd>
                      </div>
                      {seyir?.hedefKabul != null ? (
                        <div className="flex justify-between gap-3">
                          <dt className="text-emerald-700">Kabul edilen</dt>
                          <dd className="font-medium tabular-nums text-emerald-700">
                            {formatTryAmount(seyir.hedefKabul, { fractionDigits: 0 })}
                          </dd>
                        </div>
                      ) : seyir?.hedefCiro != null ? (
                        <button
                          type="button"
                          disabled={hedefKaydediliyor}
                          onClick={() => void handleHedefKabul()}
                          className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                          data-testid="finans-hedef-ciro-kabul-modal"
                        >
                          {hedefKaydediliyor ? 'Kabul Ediliyor…' : 'Kabul Et'}
                        </button>
                      ) : null}
                    </dl>
                  ) : (
                    <div data-testid="finans-hedef-ciro-incele-eksik" className="space-y-3">
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                        {(seyir?.cariBorc ?? 0) <= 0.005 && sabitToplam <= 0.005
                          ? 'Cari borç yok; aylık işletme sabiti de tanımlı değil.'
                          : (seyir?.cariBorc ?? 0) <= 0.005
                            ? 'Cari borç yok. Sabit tanımlı; borç eklenince öneri güçlenir.'
                            : 'Aylık işletme sabiti tanımlanmamış.'}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setHedefInceleAcik(false)}
                  className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Kapat
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      {dialog}
    </DashboardShell>
  );
}

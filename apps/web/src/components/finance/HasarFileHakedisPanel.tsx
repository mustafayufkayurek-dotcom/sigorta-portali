'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { AVANS_REF_PREFIX, isAvansPayment, netHakedisAfterAvans, resolveHasarAvansHesap, withAvansNote } from '@sigorta/shared';
import { FinansEmptyState, FinansMetricGrid, FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { PanelPillTabs } from '@/components/panel/PanelPillTabs';
import { useToast } from '@/contexts/ToastContext';
import { API, authHeader } from '@/utils/api';
import { formatTryAmount } from '@/utils/format-try-amount';
import { fmtDate } from '@/utils/date-helpers';
import {
  buildHasarHakedisGrantLines,
  type HasarHakedisGrantDetail,
} from '@/utils/hasar-hakedis-grant';
import {
  buildAvansIslemleri,
  buildAvansMahsupIslemleri,
  buildHakedisAkis,
  buildHasarHakedisOzet,
  buildOdemePlani,
  classifyHakedisBelge,
  HAKEDIS_KAYNAK_ETIKET,
  HASAR_AVANS_LIMIT_ORAN,
  hakedisDurumEtiket,
  hakedisTutarKirilim,
  personLabel,
  resolveHasarAvansLimit,
  type HakedisKaynak,
} from '@/utils/hasar-hakedis-ozet';
import {
  claimManualDocumentLabel,
  getFileDocuments,
  listClaimInsuredDocumentTypes,
  openFileDocumentView,
  uploadClaimManualDocument,
  type CatalogDocumentType,
  type FileDocument,
} from '@/utils/fileDocumentApi';
import { numberToTrAmountInput, parseTrAmountInput } from '@/utils/tr-amount-input';
import { TrAmountInput } from '@/components/ui/TrAmountInput';

const fmt = (n: number) => formatTryAmount(n, { fractionDigits: 0 });

type DrawerTab = 'hakedis' | 'avans' | 'odeme';

type StatementRow = {
  id: string;
  statementNo?: string;
  status?: string;
  totalAmount?: number;
  notes?: string | null;
  createdAt?: string;
  sentAt?: string | null;
  autoApprovedAt?: string | null;
  vendor?: { name?: string };
  createdBy?: { firstName?: string | null; lastName?: string | null } | null;
};

type StatementDetail = StatementRow & {
  items?: Array<{ totalAmount?: number; vatRate?: number; lineDescription?: string }>;
};

type VendorCtx = {
  id: string;
  name: string;
  paymentDueDays: number | null;
};

type PaymentRow = {
  id: string;
  amount?: number;
  status?: string;
  note?: string | null;
  paymentDate?: string;
  dueDate?: string;
  referenceNo?: string | null;
  method?: string | null;
};

type GrantLine = {
  key: string;
  workGroupId?: string;
  label: string;
  amount: string;
  details: HasarHakedisGrantDetail[];
};

function unwrap(payload: unknown): unknown {
  let cur = payload;
  for (let i = 0; i < 4; i++) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur) && 'data' in cur) {
      cur = (cur as { data: unknown }).data;
      continue;
    }
    break;
  }
  return cur;
}

function asList<T>(payload: unknown): T[] {
  const inner = unwrap(payload);
  if (Array.isArray(inner)) return inner as T[];
  return [];
}

function firstId(payload: unknown): string | null {
  const row = asList<{ id?: string }>(payload)[0];
  if (row?.id) return row.id;
  const inner = unwrap(payload);
  if (inner && typeof inner === 'object' && inner !== null && 'id' in inner) {
    const id = (inner as { id?: unknown }).id;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

function axiosErrorMessage(e: unknown, fallback: string) {
  if (axios.isAxiosError(e)) {
    const msg = e.response?.data?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (Array.isArray(msg) && msg[0]) return String(msg[0]);
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

function durumClass(label: string) {
  if (label === 'Ödendi' || label === 'Onaylandı') return 'bg-emerald-50 text-emerald-800 border-emerald-100';
  if (label === 'Taslak' || label === 'Bekliyor' || label === 'Kontrol') return 'bg-amber-50 text-amber-800 border-amber-100';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function KpiKart({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
        {value == null ? 'Eksik' : `${fmt(value)} TL`}
      </p>
    </div>
  );
}

export function HasarFileHakedisPanel({
  claimId,
  reportId,
  supplierCostHint,
}: {
  claimId: string;
  reportId?: string | null;
  supplierCostHint?: number | null;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hakedis, setHakedis] = useState<StatementRow[]>([]);
  const [vendor, setVendor] = useState<VendorCtx | null>(null);
  const [fileNo, setFileNo] = useState('');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<DrawerTab>('hakedis');
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<GrantLine[]>([]);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [talepDraft, setTalepDraft] = useState('');
  const [tutarDuzenle, setTutarDuzenle] = useState(false);
  const [aciklama, setAciklama] = useState('');
  const [sozlesme, setSozlesme] = useState<number | null>(null);
  const [sozlesmeKaynak, setSozlesmeKaynak] = useState<HakedisKaynak>('teklif');
  const [onerilen, setOnerilen] = useState<number | null>(null);
  const [onerilenKaynak, setOnerilenKaynak] = useState<HakedisKaynak>('metraj');
  const [belgeler, setBelgeler] = useState<FileDocument[]>([]);
  const [dahilBelge, setDahilBelge] = useState<Record<string, boolean>>({});
  const [ozelIds, setOzelIds] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<CatalogDocumentType[]>([]);
  const [ozelTur, setOzelTur] = useState('');
  const [avansDraft, setAvansDraft] = useState('');
  const [avansNeden, setAvansNeden] = useState('Onarım bitmeden');
  const [savingAvans, setSavingAvans] = useState(false);
  const [composing, setComposing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StatementDetail | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const dueDays = vendor?.paymentDueDays === 15 || vendor?.paymentDueDays === 30
    ? vendor.paymentDueDays
    : null;
  const avansRows = payments.filter((row) => isAvansPayment(row));
  const avansHesap = resolveHasarAvansHesap({ payments, statements: hakedis });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hak, ctx, pay] = await Promise.allSettled([
        axios.get(`${API}/vendor-statements`, {
          headers: authHeader(),
          params: { claimFileId: claimId, limit: 50 },
        }),
        axios.get(`${API}/claim-files/${claimId}/budget-supplier-context`, { headers: authHeader() }),
        axios.get(`${API}/payments`, {
          headers: authHeader(),
          params: { claimFileId: claimId, paymentType: 'outgoing', payerType: 'vendor', limit: 200 },
        }),
      ]);
      setHakedis(hak.status === 'fulfilled' ? asList<StatementRow>(hak.value.data) : []);
      if (ctx.status === 'fulfilled') {
        const payload = unwrap(ctx.value.data) as { suppliers?: VendorCtx[] };
        const row = (payload?.suppliers ?? [])[0];
        setVendor(row?.id ? {
          id: row.id,
          name: row.name,
          paymentDueDays: row.paymentDueDays ?? null,
        } : null);
      }
      setPayments(pay.status === 'fulfilled' ? asList<PaymentRow>(pay.value.data) : []);
    } catch {
      setHakedis([]);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    void load();
  }, [load]);

  const closePanel = () => {
    setDrawerOpen(false);
    setOpening(false);
    setSaving(false);
    setOpenGroupKey(null);
    setAvansDraft('');
    setAvansNeden('Onarım bitmeden');
    setTalepDraft('');
    setAciklama('');
    setTab('hakedis');
    setComposing(false);
    setSelectedId(null);
    setDetail(null);
    setMenuOpen(false);
    setTutarDuzenle(false);
  };

  const openGrant = async () => {
    setDrawerOpen(true);
    setOpening(true);
    setTab('hakedis');
    setComposing(false);
    setSelectedId(null);
    setDetail(null);
    try {
      const [claimRes, listRes, budgetRes, docsRes, typesRes] = await Promise.allSettled([
        axios.get(`${API}/claim-files/${claimId}`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimId}/repair-reports`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimId}/budget-versions`, { headers: authHeader() }),
        getFileDocuments('claim_file', claimId),
        listClaimInsuredDocumentTypes(),
      ]);
      const claim = claimRes.status === 'fulfilled'
        ? unwrap(claimRes.value.data) as {
          fileNo?: string;
          claimNo?: string;
          latestRepairReport?: { id?: string; totalSupplierCost?: number };
          estimatedCostAmount?: number;
          financialSummary?: { estimatedCost?: number; vendorCost?: number };
        }
        : null;
      setFileNo(claim?.fileNo || claim?.claimNo || '');
      let id = reportId ?? claim?.latestRepairReport?.id ?? null;
      if (!id && listRes.status === 'fulfilled') {
        id = firstId(listRes.value.data);
      }

      let reportItems: unknown[] = [];
      let reportSupplierTotal = Number(claim?.latestRepairReport?.totalSupplierCost) || 0;
      if (id) {
        const repRes = await axios.get(`${API}/repair-reports/${id}`, { headers: authHeader() });
        const report = unwrap(repRes.data) as { items?: unknown[]; totalSupplierCost?: number };
        reportItems = Array.isArray(report?.items) ? report.items : [];
        reportSupplierTotal = Number(report?.totalSupplierCost) || reportSupplierTotal;
      }

      const versions = budgetRes.status === 'fulfilled' ? asList<{ items?: unknown[] }>(budgetRes.value.data) : [];
      const budgetItems = (versions[0]?.items ?? []) as Array<{
        category?: string | null;
        description?: string | null;
        quantity?: number | null;
        unitPrice?: number | null;
      }>;
      const fileSupplierCost =
        Number(supplierCostHint)
        || Number(claim?.financialSummary?.estimatedCost)
        || Number(claim?.financialSummary?.vendorCost)
        || Number(claim?.estimatedCostAmount)
        || 0;

      const built = buildHasarHakedisGrantLines({
        reportItems: reportItems as Parameters<typeof buildHasarHakedisGrantLines>[0]['reportItems'],
        reportSupplierTotal,
        budgetItems,
        fileSupplierCost,
      });
      setLines(built.map((row) => ({
        key: row.key,
        workGroupId: row.workGroupId,
        label: row.label,
        amount: numberToTrAmountInput(row.amount),
        details: row.details,
      })));
      const fromReport = (reportItems as Array<{ quantity?: number }>).some((item) => Number(item.quantity) > 0);
      const soz = reportSupplierTotal > 0
        ? reportSupplierTotal
        : fileSupplierCost > 0
          ? fileSupplierCost
          : built.reduce((s, row) => s + row.amount, 0) || null;
      setSozlesme(soz && soz > 0 ? soz : null);
      setSozlesmeKaynak(reportSupplierTotal > 0 || fromReport ? 'metraj' : fileSupplierCost > 0 ? 'dosya' : 'teklif');
      const oneri = built.reduce((s, row) => s + row.amount, 0);
      setOnerilen(oneri > 0 ? oneri : null);
      setOnerilenKaynak(fromReport ? 'metraj' : built.length > 0 ? 'teklif' : 'ilerleme');
      setTalepDraft(oneri > 0 ? numberToTrAmountInput(oneri) : '');
      setTutarDuzenle(oneri <= 0);

      const docs = docsRes.status === 'fulfilled' ? docsRes.value : [];
      setBelgeler(docs);
      setDahilBelge(Object.fromEntries(docs.map((doc) => [doc.id, classifyHakedisBelge(doc) === 'onerilen'])));
      setOzelIds([]);
      if (typesRes.status === 'fulfilled') setCatalog(typesRes.value);
    } catch {
      showToast('error', 'Hakediş ekranı açılamadı.');
      closePanel();
      return;
    } finally {
      setOpening(false);
    }
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setComposing(false);
    try {
      const res = await axios.get(`${API}/vendor-statements/${id}`, { headers: authHeader() });
      setDetail(unwrap(res.data) as StatementDetail);
    } catch {
      const row = hakedis.find((item) => item.id === id) ?? null;
      setDetail(row);
    }
  };

  const lineTotal = useMemo(
    () => lines.reduce((sum, line) => sum + (parseTrAmountInput(line.amount) ?? 0), 0),
    [lines],
  );
  const talepBrut = lineTotal > 0 ? lineTotal : (parseTrAmountInput(talepDraft) ?? 0);
  const onayliToplam = hakedis.reduce((s, row) => s + Number(row.totalAmount ?? 0), 0);
  const ozet = buildHasarHakedisOzet({
    sozlesmeTutari: sozlesme,
    sozlesmeKaynak,
    onayliHakedisToplam: onayliToplam,
    buTalepBrut: composing && talepBrut > 0 ? talepBrut : null,
    onerilenTutar: onerilen,
    onerilenKaynak,
    avansToplam: avansHesap.avansToplam,
    oncekiMahsupToplam: avansHesap.alreadyMahsup,
  });
  const kpiKalan = sozlesme != null ? Math.round((sozlesme - onayliToplam) * 100) / 100 : null;
  const avansLimit = resolveHasarAvansLimit(sozlesme);
  const kalanAvansHakki = avansLimit == null
    ? null
    : Math.round(Math.max(0, avansLimit - avansHesap.avansToplam) * 100) / 100;
  const avansIslem = [
    ...buildAvansIslemleri(avansRows),
    ...buildAvansMahsupIslemleri({ payments, statements: hakedis }),
  ];
  const odemePlani = buildOdemePlani({ onayliHakedis: onayliToplam, payments });
  const onerilenBelgeler = belgeler.filter((doc) => classifyHakedisBelge(doc) === 'onerilen');
  const ozelBelgeler = belgeler.filter((doc) => ozelIds.includes(doc.id) || classifyHakedisBelge(doc) === 'ozel');

  const statementOdeme = (row: StatementRow) => {
    const no = String(row.statementNo ?? '');
    return payments.find((pay) =>
      !isAvansPayment(pay)
      && (String(pay.note ?? '').includes(no) || String(pay.referenceNo ?? '').includes(no)),
    );
  };

  const submitAvans = async () => {
    if (!vendor?.id) {
      showToast('error', 'Önce dosyaya tedarikçi atayın.');
      return;
    }
    const amount = parseTrAmountInput(avansDraft) ?? 0;
    if (amount <= 0) {
      showToast('error', 'Avans tutarı girin.');
      return;
    }
    if (kalanAvansHakki != null && amount > kalanAvansHakki + 0.009) {
      showToast('error', `Kullanılabilir avans hakkı ${fmt(kalanAvansHakki)} TL.`);
      return;
    }
    setSavingAvans(true);
    try {
      await axios.post(
        `${API}/payments`,
        {
          claimFileId: claimId,
          paymentType: 'outgoing',
          payerType: 'vendor',
          payerId: vendor.id,
          method: 'eft',
          amount,
          currency: 'TRY',
          paymentDate: new Date().toISOString().slice(0, 10),
          referenceNo: AVANS_REF_PREFIX,
          note: withAvansNote(avansNeden.trim() || 'Onarım bitmeden'),
        },
        { headers: authHeader() },
      );
      showToast('success', 'Avans kaydedildi.');
      setAvansDraft('');
      void load();
    } catch (e) {
      showToast('error', axiosErrorMessage(e, 'Avans kaydedilemedi.'));
    } finally {
      setSavingAvans(false);
    }
  };

  const submitGrant = async () => {
    if (!vendor?.id) {
      showToast('error', 'Önce dosyaya tedarikçi atayın.');
      return;
    }
    if (!dueDays) {
      showToast('error', `${vendor.name} kartında 15 veya 30 gün vade seçili değil.`);
      return;
    }
    const items = (lines.length > 0
      ? lines.map((line) => ({
          lineDescription: line.label,
          workGroupId: line.workGroupId,
          totalAmount: parseTrAmountInput(line.amount) ?? 0,
        }))
      : [{ lineDescription: aciklama.trim() || 'Hakediş talebi', totalAmount: talepBrut }]
    ).filter((item) => item.totalAmount > 0);
    if (items.length === 0) {
      showToast('error', 'Talep tutarı eksik.');
      return;
    }
    if (netHakedisAfterAvans(items.reduce((s, i) => s + i.totalAmount, 0), avansHesap.usableAvans) <= 0) {
      showToast('error', 'Kullanılabilir avans bu talebi kapattı.');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/vendor-statements/grant-hakedis`,
        {
          claimFileId: claimId,
          vendorId: vendor.id,
          items,
        },
        { headers: authHeader() },
      );
      showToast('success', 'Finansa aktarıldı.');
      closePanel();
      router.push('/panel/finans/tahsilatlar?queue=payable');
    } catch (e) {
      showToast('error', axiosErrorMessage(e, 'Hakediş verilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const uploadOzel = async (file: File) => {
    if (!ozelTur) {
      showToast('error', 'Önce evrak türünü seçin.');
      return;
    }
    try {
      const doc = await uploadClaimManualDocument(claimId, ozelTur, file);
      setBelgeler((prev) => [doc, ...prev]);
      setOzelIds((prev) => [doc.id, ...prev]);
      showToast('success', 'Belge eklendi.');
    } catch (e) {
      showToast('error', axiosErrorMessage(e, 'Belge yüklenemedi.'));
    }
  };

  const listedTotal = onayliToplam;
  const aktifDetay = detail ?? hakedis.find((row) => row.id === selectedId) ?? null;
  const detayKirilim = aktifDetay ? hakedisTutarKirilim(aktifDetay) : null;
  const detayOdeme = aktifDetay ? statementOdeme(aktifDetay) : undefined;
  const detayAkis = aktifDetay
    ? buildHakedisAkis({
        status: aktifDetay.status,
        createdAt: aktifDetay.createdAt,
        sentAt: aktifDetay.sentAt,
        autoApprovedAt: aktifDetay.autoApprovedAt,
        createdBy: aktifDetay.createdBy,
        odemeDurumu: detayOdeme?.status,
        odemeTarihi: detayOdeme?.paymentDate,
        vade: detayOdeme?.dueDate,
      })
    : [];

  const drawer = drawerOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-[200] flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Hakediş Yönetimi"
          data-testid="hasar-hakedis-ver-panel"
        >
          <button type="button" onClick={closePanel} aria-label="Paneli kapat" className="absolute inset-0 bg-slate-950/40" />
          <section className="relative flex h-full w-full max-w-[42rem] flex-col border-l border-slate-200 bg-white shadow-2xl">
            <header className="shrink-0 border-b border-slate-100 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900">Hakediş Yönetimi</h2>
                  <p className="mt-1 truncate text-sm text-slate-600">
                    {vendor?.name || 'Tedarikçi atanmamış'}
                    {fileNo ? ` · ${fileNo}` : ''}
                  </p>
                  {dueDays ? (
                    <span className="mt-2 inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                      {dueDays} gün vade
                    </span>
                  ) : (
                    <p className="mt-2 text-xs text-amber-800">Tedarikçi kartında 15 veya 30 gün vade gerekir.</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setComposing(false);
                      setSelectedId(null);
                      setDetail(null);
                      setTab('hakedis');
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Hakediş Geçmişi
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="menü"
                      onClick={() => setMenuOpen((open) => !open)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuOpen ? (
                      <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setMenuOpen(false);
                            router.push('/panel/finans/tahsilatlar?queue=payable');
                          }}
                        >
                          Ödeme kuyruğu
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50"
                    aria-label="Kapat"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div data-testid="hasar-hakedis-bakiye" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <KpiKart label="Sözleşme / Bütçe" value={sozlesme} />
                <KpiKart label="Toplam Avans" value={avansHesap.avansToplam} />
                <KpiKart label="Toplam Hakediş" value={onayliToplam} />
                <KpiKart label="Kalan Bakiye" value={kpiKalan} />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">{HAKEDIS_KAYNAK_ETIKET[sozlesmeKaynak]}</p>

              <div className="mt-3" data-testid="hasar-hakedis-sekme">
                <PanelPillTabs
                  tabs={[
                    { id: 'avans', label: 'Avans İşlemleri' },
                    { id: 'hakedis', label: 'Hakediş İşlemleri' },
                    { id: 'odeme', label: 'Ödeme Planı' },
                  ]}
                  activeId={tab}
                  onSelect={setTab}
                />
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {opening ? (
                <p className="py-10 text-center text-sm text-slate-400">Yükleniyor…</p>
              ) : tab === 'hakedis' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">Hakedişler</p>
                    <button
                      type="button"
                      onClick={() => {
                        setComposing(true);
                        setSelectedId(null);
                        setDetail(null);
                      }}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      + Yeni Hakediş
                    </button>
                  </div>

                  {hakedis.length === 0 ? (
                    <p className="text-sm text-slate-500">Kayıtlı hakediş yok.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-left text-[12px]">
                        <thead className="bg-slate-50 text-[11px] font-medium text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Hakediş No</th>
                            <th className="px-3 py-2">Tarih</th>
                            <th className="px-3 py-2">Tutar (KDV Hariç)</th>
                            <th className="px-3 py-2">KDV</th>
                            <th className="px-3 py-2">Toplam</th>
                            <th className="px-3 py-2">Durum</th>
                            <th className="px-3 py-2">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {hakedis.map((row) => {
                            const kirilim = hakedisTutarKirilim(row);
                            const odeme = statementOdeme(row);
                            const durum = hakedisDurumEtiket({ status: row.status, odemeDurumu: odeme?.status });
                            return (
                              <tr key={row.id} className={selectedId === row.id ? 'bg-blue-50/50' : ''}>
                                <td className="px-3 py-2.5 font-medium text-slate-800">{row.statementNo ?? '—'}</td>
                                <td className="px-3 py-2.5 text-slate-600">{fmtDate(row.createdAt)}</td>
                                <td className="px-3 py-2.5 tabular-nums">{fmt(kirilim.net)} TL</td>
                                <td className="px-3 py-2.5 tabular-nums">{fmt(kirilim.kdv)} TL</td>
                                <td className="px-3 py-2.5 tabular-nums font-semibold">{fmt(kirilim.toplam)} TL</td>
                                <td className="px-3 py-2.5">
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${durumClass(durum)}`}>{durum}</span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <button type="button" className="text-xs font-semibold text-blue-700" onClick={() => void openDetail(row.id)}>
                                    Aç
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {aktifDetay && !composing ? (
                    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold text-slate-800">{aktifDetay.statementNo ?? 'Hakediş detayı'}</p>
                      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                        <div><p className="text-[11px] text-slate-500">Tarih</p><p>{fmtDate(aktifDetay.createdAt)}</p></div>
                        <div><p className="text-[11px] text-slate-500">Hakediş tutarı</p><p className="tabular-nums">{detayKirilim ? `${fmt(detayKirilim.net)} TL` : 'Eksik'}</p></div>
                        <div><p className="text-[11px] text-slate-500">KDV</p><p className="tabular-nums">{detayKirilim ? `${fmt(detayKirilim.kdv)} TL` : 'Eksik'}</p></div>
                        <div><p className="text-[11px] text-slate-500">Toplam</p><p className="tabular-nums font-semibold">{detayKirilim ? `${fmt(detayKirilim.toplam)} TL` : 'Eksik'}</p></div>
                        <div><p className="text-[11px] text-slate-500">Oluşturan</p><p>{personLabel(aktifDetay.createdBy) ?? '—'}</p></div>
                        <div><p className="text-[11px] text-slate-500">Onaylayan</p><p>{aktifDetay.autoApprovedAt ? 'Otomatik' : '—'}</p></div>
                        <div><p className="text-[11px] text-slate-500">Onay tarihi</p><p>{fmtDate(aktifDetay.autoApprovedAt)}</p></div>
                        <div>
                          <p className="text-[11px] text-slate-500">Durum</p>
                          <p>{hakedisDurumEtiket({ status: aktifDetay.status, odemeDurumu: detayOdeme?.status })}</p>
                        </div>
                      </div>
                      {aktifDetay.notes ? (
                        <div>
                          <p className="text-[11px] text-slate-500">Açıklama</p>
                          <p className="text-sm text-slate-700">{aktifDetay.notes}</p>
                        </div>
                      ) : null}
                      <div>
                        <p className="text-[11px] text-slate-500">Belgeler</p>
                        <p className="text-xs text-slate-500">Dosyadan önerilen evrak aşağıda durur. Hakediş kaydına ayrı belge bağı yoktur.</p>
                      </div>
                      <div className="flex gap-2">
                        {detayAkis.map((adim) => (
                          <div key={adim.id} className="min-w-0 flex-1">
                            <div className={`h-1.5 rounded-full ${
                              adim.durum === 'tamam' ? 'bg-emerald-500' : adim.durum === 'aktif' ? 'bg-blue-600' : 'bg-slate-200'
                            }`} />
                            <p className="mt-2 text-[11px] font-semibold text-slate-700">{adim.label}</p>
                            <p className="text-[11px] text-slate-500">{fmtDate(adim.tarih)}</p>
                            {adim.kisi ? <p className="text-[11px] text-slate-400">{adim.kisi}</p> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {composing ? (
                    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold text-slate-800">Yeni hakediş</p>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-slate-500">Sözleşme / Bütçe</p>
                          <p className="mt-1 font-semibold tabular-nums">{sozlesme == null ? 'Eksik' : `${fmt(sozlesme)} TL`}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-slate-500">Önceki hakediş</p>
                          <p className="mt-1 font-semibold tabular-nums">{fmt(onayliToplam)} TL</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-slate-500">Mahsup edilecek avans</p>
                          <p className="mt-1 font-semibold tabular-nums">{fmt(avansHesap.usableAvans)} TL</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-slate-500">Ödenecek net</p>
                          <p className="mt-1 font-semibold tabular-nums">{fmt(ozet.netOdenecek)} TL</p>
                        </div>
                      </div>
                      {ozet.eksikler.map((text) => (
                        <p key={text} className="text-xs text-slate-500">{text}</p>
                      ))}
                      {ozet.uyarilar.map((text) => (
                        <p key={text} className="text-xs font-medium text-amber-800">{text}</p>
                      ))}

                      <div data-testid="hasar-hakedis-is-grubu" className="overflow-hidden rounded-xl border border-slate-200">
                        {lines.length === 0 ? (
                          <div className="px-3.5 py-3">
                            <p className="text-[11px] font-medium text-slate-500">Önerilen tutar</p>
                            <p className="mt-1 text-[11px] text-slate-400">{HAKEDIS_KAYNAK_ETIKET[onerilenKaynak]}</p>
                            {tutarDuzenle || onerilen == null ? (
                              <TrAmountInput
                                value={talepDraft}
                                placeholder="0"
                                onChange={setTalepDraft}
                                className="mt-2 w-full rounded-lg border border-slate-200 py-2 pr-10 text-right text-sm outline-none"
                              />
                            ) : (
                              <div className="mt-2 flex items-center justify-between">
                                <p className="text-sm font-semibold tabular-nums">{fmt(onerilen)} TL</p>
                                <button type="button" className="text-xs font-semibold text-blue-700" onClick={() => setTutarDuzenle(true)}>
                                  Düzelt
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          lines.map((line) => {
                            const open = openGroupKey === line.key;
                            return (
                              <div key={line.key} className="border-b border-slate-100 last:border-b-0">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50/80"
                                  onClick={() => setOpenGroupKey(open ? null : line.key)}
                                >
                                  <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 ${open ? 'rotate-90' : ''}`} />
                                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{line.label}</span>
                                  <span className="text-sm font-semibold tabular-nums">{fmt(parseTrAmountInput(line.amount) ?? 0)} TL</span>
                                </button>
                                {open ? (
                                  <div className="space-y-1.5 border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                                    {line.details.length === 0 ? (
                                      <p className="text-[12px] text-slate-500">Kalem detayı yok.</p>
                                    ) : line.details.map((item, idx) => (
                                      <div key={item.id ?? idx} className="flex justify-between gap-3 text-[13px] text-slate-600">
                                        <span>{item.jobDescription}</span>
                                        <span className="tabular-nums">{fmt(item.amount)} TL</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <label className="block">
                        <span className="text-[11px] font-medium text-slate-500">Açıklama</span>
                        <textarea
                          value={aciklama}
                          onChange={(e) => setAciklama(e.target.value)}
                          rows={2}
                          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                        />
                      </label>

                      <div>
                        <p className="text-xs font-semibold text-slate-800">Dosyadan önerilen belgeler</p>
                        {onerilenBelgeler.length === 0 ? (
                          <p className="mt-2 text-xs text-slate-500">Dosyada önerilecek evrak yok.</p>
                        ) : (
                          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                            {onerilenBelgeler.map((doc) => (
                              <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={Boolean(dahilBelge[doc.id])}
                                  onChange={(e) => setDahilBelge((prev) => ({ ...prev, [doc.id]: e.target.checked }))}
                                />
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 text-left text-sm text-slate-700"
                                  onClick={() => void openFileDocumentView(doc.id)}
                                >
                                  {claimManualDocumentLabel(doc)}
                                  <span className="mt-0.5 block text-[11px] text-slate-400">
                                    {HAKEDIS_KAYNAK_ETIKET.dosya}
                                    {doc.createdAt ? ` · ${fmtDate(doc.createdAt)}` : ''}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-800">Hakedişe özel belgeler</p>
                        <p className="mt-1 text-[11px] text-slate-400">Dosyaya kaydedilir. Ayrı hakediş belgesi modeli yok.</p>
                        <div className="mt-2 flex gap-2">
                          <select
                            value={ozelTur}
                            onChange={(e) => setOzelTur(e.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                          >
                            <option value="">Tür seçin</option>
                            {catalog.map((row) => (
                              <option key={row.id} value={row.id}>{row.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            + Belge Ekle
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (file) void uploadOzel(file);
                            }}
                          />
                        </div>
                        {ozelBelgeler.length > 0 ? (
                          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                            {ozelBelgeler.map((doc) => (
                              <li key={doc.id} className="px-3 py-2 text-sm text-slate-700">
                                {claimManualDocumentLabel(doc)}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : tab === 'avans' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <KpiKart label="Sözleşme / Bütçe" value={sozlesme} />
                    <KpiKart label="Toplam Avans" value={avansHesap.avansToplam} />
                    <KpiKart label="Kullanılan Avans" value={avansHesap.alreadyMahsup} />
                    <KpiKart label="Kalan Avans Hakkı" value={kalanAvansHakki} />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                    <p>Avans limiti: %{Math.round(HASAR_AVANS_LIMIT_ORAN * 100)}</p>
                    <p className="mt-1">Maksimum avans: {avansLimit == null ? 'Eksik' : `${fmt(avansLimit)} TL`}</p>
                    <p className="mt-1">Kullanılabilir avans hakkı hesaplanır; tutarı siz yazmazsınız.</p>
                  </div>
                  {avansIslem.length === 0 ? (
                    <p className="text-sm text-slate-500">Avans işlemi yok.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {avansIslem.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-3 px-3.5 py-3 text-sm">
                          <span>
                            {row.tipLabel} · {fmtDate(row.tarih)} · {row.durum}
                            <span className="mt-0.5 block text-[11px] text-slate-400">{HAKEDIS_KAYNAK_ETIKET[row.kaynak]}</span>
                          </span>
                          <span className="font-semibold tabular-nums">{fmt(row.tutar)} TL</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-800">Yeni avans</p>
                    <label className="block text-[11px] text-slate-500">
                      Avans nedeni
                      <select
                        value={avansNeden}
                        onChange={(e) => setAvansNeden(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-800"
                      >
                        <option>Onarım bitmeden</option>
                        <option>Malzeme</option>
                        <option>Saha işi</option>
                      </select>
                    </label>
                    <TrAmountInput
                      value={avansDraft}
                      placeholder="Avans tutarı"
                      onChange={setAvansDraft}
                      className="w-full rounded-lg border border-slate-200 py-2 pr-10 text-right text-sm outline-none"
                    />
                    <button
                      type="button"
                      disabled={savingAvans || !vendor?.id}
                      onClick={() => void submitAvans()}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                    >
                      Avans Kaydet
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {odemePlani.satirlar.length === 0 ? (
                    <p className="text-sm text-slate-500">Ödeme planı henüz yok. Finansa Aktar ile oluşur.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-left text-[12px]">
                        <thead className="bg-slate-50 text-[11px] font-medium text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Tür</th>
                            <th className="px-3 py-2">Vade tarihi</th>
                            <th className="px-3 py-2">Ödenecek tutar</th>
                            <th className="px-3 py-2">Ödeme durumu</th>
                            <th className="px-3 py-2">Ödeme tarihi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {odemePlani.satirlar.map((row) => (
                            <tr key={row.id}>
                              <td className="px-3 py-2.5">{row.tipLabel ?? (row.tip === 'avans' ? 'Avans' : 'Hakediş')}</td>
                              <td className="px-3 py-2.5">{fmtDate(row.vade)}</td>
                              <td className="px-3 py-2.5 tabular-nums font-semibold">{fmt(row.tutar)} TL</td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${durumClass(row.durum)}`}>{row.durum}</span>
                              </td>
                              <td className="px-3 py-2.5">{fmtDate(row.tarih)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
              <div>
                <p className="text-[11px] text-slate-500">Ödenecek net</p>
                <p className="text-base font-semibold tabular-nums">
                  {composing
                    ? `${fmt(ozet.netOdenecek)} TL`
                    : kpiKalan == null ? 'Eksik' : `${fmt(kpiKalan)} TL`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={closePanel} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  Kapat
                </button>
                {composing ? (
                  <button
                    type="button"
                    disabled={opening || saving || !vendor?.id || !dueDays || ozet.netOdenecek <= 0}
                    onClick={() => void submitGrant()}
                    className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    {saving ? 'Aktarılıyor…' : 'Finansa Aktar'}
                  </button>
                ) : null}
              </div>
            </footer>
          </section>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div data-testid="hasar-gider-hakedis">
        <FinansPanelCard
          title="Tedarikçi Hakedişi"
          subtitle="Gider"
          action={{
            label: 'Hakediş Ver',
            onClick: () => void openGrant(),
            variant: 'primary',
            showPlus: false,
          }}
        >
          <FinansMetricGrid
            items={[
              { label: 'Tedarikçi', value: vendor?.name || 'Atanmamış' },
              { label: 'Vade', value: dueDays ? `${dueDays} gün` : 'Seçilmedi' },
              { label: 'Avans', value: fmt(avansHesap.avansToplam) },
              { label: 'Hakediş', value: fmt(listedTotal) },
            ]}
          />
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">Yükleniyor...</p>
          ) : hakedis.length === 0 ? (
            <FinansEmptyState title="Hakediş yok" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {hakedis.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-slate-700">
                    {s.statementNo} · {s.vendor?.name ?? vendor?.name ?? 'Tedarikçi'}
                  </span>
                  <span className="font-semibold tabular-nums">{fmt(Number(s.totalAmount ?? 0))}</span>
                </li>
              ))}
            </ul>
          )}
        </FinansPanelCard>
      </div>
      {drawer}
    </>
  );
}

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
  hakedisDonemEtiket,
  hakedisDurumEtiket,
  hakedisGerceklesmeOrani,
  hakedisKesintiNet,
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

/** Para birimi tek yerde — `₺ 250.000` (TL soneki yok; çift TL engellenir) */
const fmt = (n: number) => {
  const raw = formatTryAmount(n, { fractionDigits: 0 }).replace(/\s*TL\.?$/i, '').trim();
  return `₺ ${raw}`;
};

type DrawerTab = 'hakedis' | 'avans' | 'odeme';

type StatementRow = {
  id: string;
  statementNo?: string;
  status?: string;
  totalAmount?: number;
  notes?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
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
  if (label === 'Ödendi' || label === 'Onaylandı' || label === 'Tamamlandı') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-100';
  }
  if (label === 'Planlandı' || label === 'Onay Bekliyor' || label === 'Ödeme Bekliyor') {
    return 'bg-blue-50 text-blue-800 border-blue-100';
  }
  if (label === 'Taslak' || label === 'Bekliyor' || label === 'Kontrol') {
    return 'bg-amber-50 text-amber-800 border-amber-100';
  }
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function FinanceSummaryCard({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: number | null;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`mt-2 tabular-nums tracking-tight text-slate-900 ${emphasize ? 'text-xl font-semibold' : 'text-lg font-semibold'}`}>
        {value == null ? '—' : fmt(value)}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{hint}</p> : null}
    </div>
  );
}

function ProgressMini({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5" data-testid="hakedis-gerceklesme">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-medium text-slate-500">Hakediş Gerçekleşme</p>
        <p className="text-sm font-semibold tabular-nums text-slate-900">
          %{clamped.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        </p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function StatusStepper({
  steps,
}: {
  steps: Array<{ id: string; label: string; durum: 'tamam' | 'aktif' | 'bekler' }>;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2" data-testid="hakedis-durum-stepper">
      {steps.map((adim, idx) => {
        const mark = adim.durum === 'tamam' ? '✓' : adim.durum === 'aktif' ? '●' : '○';
        const tone = adim.durum === 'tamam'
          ? 'text-emerald-700'
          : adim.durum === 'aktif'
            ? 'text-blue-700'
            : 'text-slate-400';
        return (
          <li key={adim.id} className="flex items-center gap-1.5 text-[11px] font-medium">
            {idx > 0 ? <span className="text-slate-300" aria-hidden>→</span> : null}
            <span className={tone}>
              <span className="mr-1" aria-hidden>{mark}</span>
              {adim.label}
            </span>
          </li>
        );
      })}
    </ol>
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
  const [avansAciklama, setAvansAciklama] = useState('');
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
    setAvansAciklama('');
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
  const odenenHakedis = odemePlani.odenen;
  const kalanHakedis = sozlesme != null
    ? Math.round((sozlesme - onayliToplam) * 100) / 100
    : kpiKalan;
  const gerceklesmePct = hakedisGerceklesmeOrani(sozlesme, onayliToplam);
  const sonAvans = avansRows
    .slice()
    .sort((a, b) => new Date(b.paymentDate ?? 0).getTime() - new Date(a.paymentDate ?? 0).getTime())[0];
  const avansIslemSayisi = avansRows.filter((r) => r.status === 'pending' || r.status === 'completed').length;
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
    const aciklamaTrim = avansAciklama.trim();
    if (!aciklamaTrim) {
      showToast('error', 'Açıklama zorunludur.');
      return;
    }
    const amount = parseTrAmountInput(avansDraft) ?? 0;
    if (amount <= 0) {
      showToast('error', 'Avans tutarı girin.');
      return;
    }
    if (kalanAvansHakki != null && amount > kalanAvansHakki + 0.009) {
      showToast('error', `Kullanılabilir avans hakkı ${fmt(kalanAvansHakki)}.`);
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
          note: withAvansNote(aciklamaTrim),
        },
        { headers: authHeader() },
      );
      showToast('success', 'Avans kaydedildi.');
      setAvansDraft('');
      setAvansAciklama('');
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

              <div className="mt-3" data-testid="hasar-hakedis-sekme">
                <PanelPillTabs
                  tabs={[
                    { id: 'avans', label: 'Avans İşlemleri' },
                    { id: 'hakedis', label: 'Hakediş İşlemleri' },
                    { id: 'odeme', label: 'Ödeme Planı' },
                  ]}
                  activeId={tab}
                  onSelect={(id: DrawerTab) => {
                    setTab(id);
                    if (id !== 'hakedis') {
                      setComposing(false);
                      setSelectedId(null);
                      setDetail(null);
                    }
                  }}
                />
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {opening ? (
                <p className="py-10 text-center text-sm text-slate-400">Yükleniyor…</p>
              ) : tab === 'hakedis' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-testid="hakedis-ozet-kartlar">
                    <FinanceSummaryCard label="Sözleşme Tutarı" value={sozlesme} hint={HAKEDIS_KAYNAK_ETIKET[sozlesmeKaynak]} emphasize />
                    <FinanceSummaryCard label="Toplam Hakediş" value={onayliToplam} emphasize />
                    <FinanceSummaryCard label="Ödenen" value={odenenHakedis} emphasize />
                    <FinanceSummaryCard label="Kalan Hakediş" value={kalanHakedis} emphasize />
                  </div>
                  <ProgressMini pct={gerceklesmePct} />

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">Hakediş Listesi</p>
                    <button
                      type="button"
                      onClick={() => {
                        setComposing(true);
                        setSelectedId(null);
                        setDetail(null);
                      }}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Hakediş Oluştur
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
                            <th className="px-3 py-2">Dönem</th>
                            <th className="px-3 py-2">Hakediş Tutarı</th>
                            <th className="px-3 py-2">Kesintiler</th>
                            <th className="px-3 py-2">Net Tutar</th>
                            <th className="px-3 py-2">Durum</th>
                            <th className="px-3 py-2">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {hakedis.map((row) => {
                            const tutar = hakedisKesintiNet(row);
                            const odeme = statementOdeme(row);
                            const durum = hakedisDurumEtiket({ status: row.status, odemeDurumu: odeme?.status });
                            return (
                              <tr key={row.id} className={selectedId === row.id ? 'bg-blue-50/50' : ''}>
                                <td className="px-3 py-2.5 font-medium text-slate-800">{row.statementNo ?? '—'}</td>
                                <td className="px-3 py-2.5 text-slate-600">{hakedisDonemEtiket(row)}</td>
                                <td className="px-3 py-2.5 tabular-nums">{fmt(tutar.hakedisTutari)}</td>
                                <td className="px-3 py-2.5 tabular-nums text-slate-600">{fmt(tutar.kesintiler)}</td>
                                <td className="px-3 py-2.5 tabular-nums font-semibold">{fmt(tutar.netTutar)}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${durumClass(durum)}`}>{durum}</span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <button type="button" className="text-xs font-semibold text-blue-700" onClick={() => void openDetail(row.id)}>
                                    Detay
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
                      <p className="text-xs font-semibold text-slate-800">{aktifDetay.statementNo ?? 'Hakediş Detayı'}</p>
                      <StatusStepper steps={detayAkis} />
                      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                        <div><p className="text-[11px] text-slate-500">Dönem</p><p>{hakedisDonemEtiket(aktifDetay)}</p></div>
                        <div><p className="text-[11px] text-slate-500">Hakediş Tutarı</p><p className="tabular-nums">{detayKirilim ? fmt(detayKirilim.toplam) : '—'}</p></div>
                        <div><p className="text-[11px] text-slate-500">Kesintiler</p><p className="tabular-nums">{fmt(hakedisKesintiNet(aktifDetay).kesintiler)}</p></div>
                        <div><p className="text-[11px] text-slate-500">Net Tutar</p><p className="tabular-nums font-semibold">{fmt(hakedisKesintiNet(aktifDetay).netTutar)}</p></div>
                        <div><p className="text-[11px] text-slate-500">Oluşturan</p><p>{personLabel(aktifDetay.createdBy) ?? '—'}</p></div>
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
                    </div>
                  ) : null}

                  {composing ? (
                    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold text-slate-800">Hakediş Oluştur</p>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                          <p className="text-slate-500">Sözleşme</p>
                          <p className="mt-1 font-semibold tabular-nums">{sozlesme == null ? '—' : fmt(sozlesme)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                          <p className="text-slate-500">Önceki Hakediş</p>
                          <p className="mt-1 font-semibold tabular-nums">{fmt(onayliToplam)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                          <p className="text-slate-500">Bu Hakediş</p>
                          <p className="mt-1 font-semibold tabular-nums">{fmt(talepBrut)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                          <p className="text-slate-500">Toplam Hakediş</p>
                          <p className="mt-1 font-semibold tabular-nums">{fmt(onayliToplam + talepBrut)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                          <p className="text-slate-500">Kalan</p>
                          <p className="mt-1 font-semibold tabular-nums">
                            {sozlesme == null ? '—' : fmt(Math.round((sozlesme - onayliToplam - talepBrut) * 100) / 100)}
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Tedarikçi, dosya ve sözleşme bakiyesi otomatik. Mahsup edilecek avans: {fmt(avansHesap.usableAvans)} · Ödenecek net: {fmt(ozet.netOdenecek)}
                      </p>
                      {ozet.eksikler.map((text) => (
                        <p key={text} className="text-xs text-slate-500">{text}</p>
                      ))}
                      {ozet.uyarilar.map((text) => (
                        <p key={text} className="text-xs font-medium text-amber-800">{text}</p>
                      ))}

                      <div data-testid="hasar-hakedis-is-grubu" className="overflow-hidden rounded-xl border border-slate-200">
                        {lines.length === 0 ? (
                          <div className="px-3.5 py-3">
                            <p className="text-[11px] font-medium text-slate-500">Önerilen Tutar</p>
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
                                <p className="text-sm font-semibold tabular-nums">{fmt(onerilen)}</p>
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
                                  <span className="text-sm font-semibold tabular-nums">{fmt(parseTrAmountInput(line.amount) ?? 0)}</span>
                                </button>
                                {open ? (
                                  <div className="space-y-1.5 border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                                    {line.details.length === 0 ? (
                                      <p className="text-[12px] text-slate-500">Kalem detayı yok.</p>
                                    ) : line.details.map((item, idx) => (
                                      <div key={item.id ?? idx} className="flex justify-between gap-3 text-[13px] text-slate-600">
                                        <span>{item.jobDescription}</span>
                                        <span className="tabular-nums">{fmt(item.amount)}</span>
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
                        <p className="text-xs font-semibold text-slate-800">Dosyadan Önerilen Belgeler</p>
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
                        <p className="text-xs font-semibold text-slate-800">Hakedişe Özel Belgeler</p>
                        <p className="mt-1 text-[11px] text-slate-400">Dosyaya kaydedilir. Ayrı hakediş belgesi modeli yok.</p>
                        <div className="mt-2 flex gap-2">
                          <select
                            value={ozelTur}
                            onChange={(e) => setOzelTur(e.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                          >
                            <option value="">Tür Seçin</option>
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
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3" data-testid="avans-ozet-kartlar">
                    <FinanceSummaryCard
                      label="Toplam Avans"
                      value={avansHesap.avansToplam}
                      emphasize
                      hint={`${avansIslemSayisi} işlem${sonAvans?.paymentDate ? ` · Son işlem ${fmtDate(sonAvans.paymentDate)}` : ''}`}
                    />
                    <FinanceSummaryCard label="Kullanılan Avans" value={avansHesap.alreadyMahsup} emphasize />
                    <FinanceSummaryCard
                      label="Kalan Avans Hakkı"
                      value={kalanAvansHakki}
                      emphasize
                      hint={avansLimit == null ? 'Sözleşme tutarı gerekli' : `Limit %${Math.round(HASAR_AVANS_LIMIT_ORAN * 100)} · Maks. ${fmt(avansLimit)}`}
                    />
                  </div>

                  {avansIslem.length === 0 ? (
                    <p className="text-sm text-slate-500">Avans işlemi yok.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {avansIslem.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-3 px-3.5 py-3 text-sm">
                          <span>
                            <span className="font-medium text-slate-800">{row.tipLabel}</span>
                            <span className="mt-0.5 block text-[11px] text-slate-400">
                              {fmtDate(row.tarih)} · {row.durum}
                            </span>
                          </span>
                          <span className="font-semibold tabular-nums">{fmt(row.tutar)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-800">Yeni Avans</p>
                    <label className="block">
                      <span className="text-[11px] font-medium text-slate-500">
                        Açıklama <span className="text-red-500">*</span>
                      </span>
                      <textarea
                        value={avansAciklama}
                        onChange={(e) => setAvansAciklama(e.target.value)}
                        rows={2}
                        required
                        placeholder="Avans açıklamasını yazın"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-slate-500">Tutar</span>
                      <TrAmountInput
                        value={avansDraft}
                        placeholder="0"
                        onChange={setAvansDraft}
                        className="mt-1.5 w-full rounded-lg border border-slate-200 py-2 pr-10 text-right text-sm outline-none"
                      />
                    </label>
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
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-testid="odeme-plani-ozet-kartlar">
                    <FinanceSummaryCard label="Planlanan Ödeme" value={odemePlani.planlanan} emphasize />
                    <FinanceSummaryCard label="Bu Ay" value={odemePlani.buAy} emphasize />
                    <FinanceSummaryCard label="Ödenen" value={odemePlani.odenen} emphasize />
                    <FinanceSummaryCard label="Yaklaşan" value={odemePlani.yaklasan || null} emphasize />
                  </div>

                  {odemePlani.satirlar.length === 0 ? (
                    <p className="text-sm text-slate-500">Ödeme planı henüz yok. Finansa Aktar ile oluşur.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-left text-[12px]">
                        <thead className="bg-slate-50 text-[11px] font-medium text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Tarih</th>
                            <th className="px-3 py-2">Hakediş</th>
                            <th className="px-3 py-2">Tutar</th>
                            <th className="px-3 py-2">Ödeme Durumu</th>
                            <th className="px-3 py-2">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {odemePlani.satirlar.map((row) => (
                            <tr key={row.id}>
                              <td className="px-3 py-2.5 text-slate-600">{fmtDate(row.tarih ?? row.vade)}</td>
                              <td className="px-3 py-2.5 font-medium text-slate-800">
                                {row.baglanti || (row.tipLabel ?? (row.tip === 'avans' ? 'Avans' : 'Hakediş'))}
                              </td>
                              <td className="px-3 py-2.5 tabular-nums font-semibold">{fmt(row.tutar)}</td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${durumClass(row.durum)}`}>{row.durum}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <button
                                  type="button"
                                  className="text-xs font-semibold text-blue-700"
                                  onClick={() => router.push('/panel/finans/tahsilatlar?queue=payable')}
                                >
                                  Detay
                                </button>
                              </td>
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
                <p className="text-[11px] text-slate-500">Ödenecek Net</p>
                <p className="text-base font-semibold tabular-nums">
                  {composing
                    ? fmt(ozet.netOdenecek)
                    : kalanHakedis == null ? '—' : fmt(kalanHakedis)}
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

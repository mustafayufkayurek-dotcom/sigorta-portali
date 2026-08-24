'use client';

/**
 * Bütçe & Satınalma — sağ drawer.
 * Ticari % revizyon: mevcut handleApplyCommercialRevision zinciri.
 * Tedarikçi teklifi: mevcut satır supplier alanlarına iş grubu bazlı dağıtım.
 * Hakediş aktarımı: dosya bütçesi API + tedarikçi vade (15/30).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { repairItemSalesTotal, repairItemResolvedSupplierTotal } from '@sigorta/shared';
import { API, authHeader } from '@/utils/api';
import { formatTryAmount } from '@/utils/format-try-amount';
import { numberToTrAmountInput, parseTrAmountInput } from '@/utils/tr-amount-input';
import { TrAmountInput } from '@/components/ui/TrAmountInput';

type FileSupplier = {
  id: string;
  name: string;
  paymentDueDays?: number | null;
};

type WorkGroup = { id: string; name: string };

type QuoteHistoryEntry = {
  id: string;
  supplierName: string;
  workGroupName: string;
  date: string;
  status: 'guncellendi' | 'beklemede' | 'gonderildi' | 'reddedildi';
  amount: number;
};

function totalSales(item: any) {
  return repairItemSalesTotal(item);
}

function totalSupplier(item: any) {
  return repairItemResolvedSupplierTotal(item);
}

function money(value: number) {
  return formatTryAmount(value, { fractionDigits: 2 });
}

function historyKey(reportId: string) {
  return `meridyen.budget-quotes.history.${reportId}`;
}

function loadHistory(reportId: string): QuoteHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(historyKey(reportId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuoteHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(reportId: string, entries: QuoteHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(historyKey(reportId), JSON.stringify(entries.slice(0, 40)));
}

function efficiencyScore(marginPct: number): { stars: number; label: string } {
  if (marginPct >= 20) return { stars: 5, label: 'Çok İyi' };
  if (marginPct >= 12) return { stars: 4, label: 'İyi' };
  if (marginPct >= 8) return { stars: 3, label: 'Orta' };
  if (marginPct >= 4) return { stars: 2, label: 'Zayıf' };
  return { stars: 1, label: 'Kritik' };
}

function StatusIcon({ reportAmount, quoteAmount }: { reportAmount: number; quoteAmount: number }) {
  if (quoteAmount <= 0) {
    return <span className="text-slate-300 text-sm" aria-hidden>—</span>;
  }
  if (quoteAmount < reportAmount) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center text-status-success" title="Teklif rapor tutarının altında">
        ↓
      </span>
    );
  }
  if (quoteAmount === reportAmount) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-status-success/15 text-status-success" title="Teklif rapor tutarına eşit">
        ✓
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center text-status-warning" title="Teklif rapor tutarının üzerinde">
      ↑
    </span>
  );
}

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count} yıldız`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= count ? 'text-status-success' : 'text-slate-200'}>
          ★
        </span>
      ))}
    </span>
  );
}

const STATUS_BADGE: Record<QuoteHistoryEntry['status'], string> = {
  guncellendi: 'bg-status-success/10 text-status-success border-status-success/20',
  beklemede: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  gonderildi: 'bg-brand-50 text-brand-700 border-brand-100',
  reddedildi: 'bg-status-danger/10 text-status-danger border-status-danger/20',
};

const STATUS_LABEL: Record<QuoteHistoryEntry['status'], string> = {
  guncellendi: 'Güncellendi',
  beklemede: 'Beklemede',
  gonderildi: 'Gönderildi',
  reddedildi: 'Reddedildi',
};

const VADE_WARN_KEY = 'meridyen.vendor-payment-due.warn-dismissed';

function isVadeWarnDismissed(vendorId: string) {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(`${VADE_WARN_KEY}.${vendorId}`);
    if (!raw) return false;
    return Date.now() - Number(raw) < 10 * 60 * 1000;
  } catch {
    return false;
  }
}

function dismissVadeWarn(vendorId: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${VADE_WARN_KEY}.${vendorId}`, String(Date.now()));
}

export function CommercialPricingDrawer({
  open,
  onClose,
  items,
  workGroups,
  canEdit,
  reportId,
  claimFileId,
  onApplyCommercialRevision,
  onApplySupplierGroupQuote,
  onApproveAndTransferToHakedis,
}: {
  open: boolean;
  onClose: () => void;
  items: any[];
  workGroups: WorkGroup[];
  canEdit: boolean;
  reportId: string;
  claimFileId?: string;
  onApplyCommercialRevision: (rates: Record<string, number>) => Promise<void>;
  onApplySupplierGroupQuote: (workGroupId: string, quoteTotal: number) => Promise<void>;
  onApproveAndTransferToHakedis: (quotes: Record<string, number>) => Promise<void>;
}) {
  const [tab, setTab] = useState<'ozet' | 'is-grubu'>('ozet');
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, string>>({});
  const [rates, setRates] = useState<Record<string, string>>({});
  const [globalRate, setGlobalRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<QuoteHistoryEntry[]>([]);
  const [showAddQuote, setShowAddQuote] = useState(false);
  const [newQuote, setNewQuote] = useState({ supplierName: '', workGroupId: '', amount: '' });
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [fileSupplier, setFileSupplier] = useState<FileSupplier | null>(null);
  const [showVadeWarn, setShowVadeWarn] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sales: number; supplier: number }>();
    items.forEach((item) => {
      const id = item.workGroupId ?? item.workGroup?.id ?? '__other__';
      const value = map.get(id) ?? {
        id,
        name: workGroups.find((g) => g.id === id)?.name ?? item.workGroup?.name ?? 'Belirtilmemiş',
        sales: 0,
        supplier: 0,
      };
      value.sales += totalSales(item);
      value.supplier += totalSupplier(item);
      map.set(id, value);
    });
    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [items, workGroups]);

  useEffect(() => {
    if (!open) return;
    setTab('ozet');
    setQuoteDrafts(
      Object.fromEntries(
        groups.map((g) => [g.id, g.supplier > 0 ? numberToTrAmountInput(g.supplier) : '']),
      ),
    );
    setRates({});
    setGlobalRate('');
    setHistory(loadHistory(reportId));
    setShowAddQuote(false);
    setShowAllHistory(false);
  }, [open, reportId, groups]);

  useEffect(() => {
    if (!open || !claimFileId) {
      setFileSupplier(null);
      setShowVadeWarn(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await axios.get(`${API}/claim-files/${claimFileId}/budget-supplier-context`, {
          headers: authHeader(),
        });
        const suppliers = (res.data?.data?.suppliers ?? []) as FileSupplier[];
        const vendor = suppliers[0] ?? null;
        if (cancelled) return;
        setFileSupplier(vendor);
        const missing = Boolean(
          vendor?.id && vendor.paymentDueDays !== 15 && vendor.paymentDueDays !== 30,
        );
        setShowVadeWarn(missing && !isVadeWarnDismissed(vendor!.id));
      } catch {
        if (!cancelled) {
          setFileSupplier(null);
          setShowVadeWarn(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, claimFileId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const reportTotal = groups.reduce((s, g) => s + g.sales, 0);
  const supplierTotal = groups.reduce((s, g) => {
    const draft = parseTrAmountInput(quoteDrafts[g.id] ?? '');
    return s + (draft != null && draft >= 0 ? draft : g.supplier);
  }, 0);
  const profit = reportTotal - supplierTotal;
  const marginPct = reportTotal > 0 ? (profit / reportTotal) * 100 : 0;
  const score = efficiencyScore(marginPct);
  const needsSalesIntervention = marginPct < 8 || profit < 0;
  const goToSalesRevision = () => setTab('is-grubu');

  const rateNum = (value?: string) => {
    const n = parseFloat((value ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const hasRate = Object.values(rates).some((v) => rateNum(v) !== 0);
  const revisedSales = groups.reduce((s, g) => s + g.sales * (1 + rateNum(rates[g.id]) / 100), 0);
  const revisedProfit = revisedSales - supplierTotal;
  const revisedMarginPct = revisedSales > 0 ? (revisedProfit / revisedSales) * 100 : 0;

  const applyGlobalRateToAll = (value: string) => {
    setGlobalRate(value);
    setRates(Object.fromEntries(groups.map((g) => [g.id, value])));
  };

  const commitQuote = async (workGroupId: string) => {
    if (!canEdit) return;
    const amount = parseTrAmountInput(quoteDrafts[workGroupId] ?? '');
    if (amount == null || amount < 0) return;
    setSaving(true);
    try {
      await onApplySupplierGroupQuote(workGroupId, amount);
      const group = groups.find((g) => g.id === workGroupId);
      const entry: QuoteHistoryEntry = {
        id: `${Date.now()}`,
        supplierName: 'Dosya Tedarikçisi',
        workGroupName: group?.name ?? 'İş Grubu',
        date: new Date().toLocaleDateString('tr-TR'),
        status: 'guncellendi',
        amount,
      };
      const next = [entry, ...loadHistory(reportId)];
      saveHistory(reportId, next);
      setHistory(next);
    } finally {
      setSaving(false);
    }
  };

  const applyCommercial = async () => {
    if (!hasRate || !canEdit) return;
    setSaving(true);
    try {
      await onApplyCommercialRevision(
        Object.fromEntries(groups.map((g) => [g.id, rateNum(rates[g.id])])),
      );
      setRates({});
      setGlobalRate('');
    } finally {
      setSaving(false);
    }
  };

  const vendorDueMissing = Boolean(
    fileSupplier?.id && fileSupplier.paymentDueDays !== 15 && fileSupplier.paymentDueDays !== 30,
  );

  const approveAndTransfer = async () => {
    if (!canEdit || !onApproveAndTransferToHakedis) return;
    if (vendorDueMissing) {
      setShowVadeWarn(true);
      return;
    }
    const quotes: Record<string, number> = {};
    for (const g of groups) {
      const draft = parseTrAmountInput(quoteDrafts[g.id] ?? '');
      const amount = draft != null && draft >= 0 ? draft : g.supplier;
      if (amount > 0) quotes[g.id] = amount;
    }
    if (Object.keys(quotes).length === 0) return;
    setSaving(true);
    try {
      await onApproveAndTransferToHakedis(quotes);
      const stamp = new Date().toLocaleDateString('tr-TR');
      const entries: QuoteHistoryEntry[] = Object.entries(quotes).map(([id, amount]) => ({
        id: `${Date.now()}-${id}`,
        supplierName: 'Dosya Tedarikçisi',
        workGroupName: groups.find((g) => g.id === id)?.name ?? 'İş Grubu',
        date: stamp,
        status: 'gonderildi' as const,
        amount,
      }));
      const next = [...entries, ...loadHistory(reportId)];
      saveHistory(reportId, next);
      setHistory(next);
    } finally {
      setSaving(false);
    }
  };

  const addHistoryQuote = () => {
    const amount = parseTrAmountInput(newQuote.amount);
    if (!newQuote.supplierName.trim() || !newQuote.workGroupId || amount == null || amount <= 0) return;
    const wg = groups.find((g) => g.id === newQuote.workGroupId);
    const entry: QuoteHistoryEntry = {
      id: `${Date.now()}`,
      supplierName: newQuote.supplierName.trim(),
      workGroupName: wg?.name ?? 'İş Grubu',
      date: new Date().toLocaleDateString('tr-TR'),
      status: 'beklemede',
      amount,
    };
    const next = [entry, ...loadHistory(reportId)];
    saveHistory(reportId, next);
    setHistory(next);
    setNewQuote({ supplierName: '', workGroupId: '', amount: '' });
    setShowAddQuote(false);
  };

  if (!open) return null;

  const visibleHistory = showAllHistory ? history : history.slice(0, 4);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Bütçe ve Satınalma">
      <button type="button" onClick={onClose} aria-label="Paneli kapat" className="absolute inset-0 bg-slate-950/30" />
      <section className="relative flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl border-l border-slate-200">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-bold text-slate-900">Bütçe & Satınalma</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Kapat"
          >
            ✕
          </button>
        </header>

        <nav className="flex shrink-0 gap-1 border-b border-slate-100 px-5" role="tablist">
          {([
            { id: 'ozet' as const, label: 'Özet' },
            { id: 'is-grubu' as const, label: 'İş Grubu Bazlı' },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
                tab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Üst yönlendirme şeridi: simülasyon + (iş grubunda) toplu % — kaydırılınca kaybolmaz */}
        <div className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-white">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 grid grid-cols-3 gap-1.5 text-center">
              <div>
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">Satış</p>
                <p className="mt-0.5 truncate text-xs font-bold tabular-nums">{money(revisedSales)}</p>
              </div>
              <div>
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">Kâr</p>
                <p className={`mt-0.5 truncate text-xs font-bold tabular-nums ${revisedProfit >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                  {money(revisedProfit)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">Marj</p>
                <p className={`mt-0.5 truncate text-xs font-bold tabular-nums ${revisedMarginPct >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                  %{revisedMarginPct.toFixed(1).replace('.', ',')}
                </p>
              </div>
            </div>
            {tab === 'is-grubu' && (
              <label className="flex w-[4.75rem] shrink-0 flex-col rounded-lg border border-slate-600 bg-slate-800/90 px-2 py-1">
                <span className="text-[9px] font-medium text-slate-400">% Revize</span>
                <input
                  disabled={!canEdit}
                  type="number"
                  min={-99}
                  step="0.1"
                  value={globalRate}
                  onChange={(e) => applyGlobalRateToAll(e.target.value)}
                  placeholder="15"
                  className="w-full bg-transparent text-right text-sm font-bold outline-none disabled:cursor-not-allowed"
                />
              </label>
            )}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
            {tab === 'is-grubu'
              ? hasRate
                ? 'Revizyon önizlemesi · Kalıcı uygulama altta'
                : 'Oran girin; metraj değişmez, satış fiyatı güncellenir'
              : 'Satınalma özeti · Satış revizyonu için İş Grubu Bazlı'}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-900">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-200 text-[10px] font-bold text-sky-800">i</span>
            <p>Satınalma (teklif / hakediş) ve satış (% revize) bu panelde. Metraj yalnız ana raporda.</p>
          </div>

          {tab === 'ozet' && needsSalesIntervention && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900">
              <p className="font-semibold">Satış müdahalesi gerekebilir</p>
              <p className="mt-1">
                Beklenen kâr düşük veya negatif. Alternatif tedarikçi bulunamazsa rapordaki satış
                fiyatlarını buradan revize edin; metrajı ana tabloda bilinçli olarak güncelleyin.
              </p>
              <button
                type="button"
                onClick={goToSalesRevision}
                className="mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
              >
                % Revize Et
              </button>
            </div>
          )}

          {fileSupplier && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px]">
              <p className="text-slate-500">Hakediş Tedarikçisi</p>
              <p className="mt-0.5 font-semibold text-slate-800">{fileSupplier.name}</p>
              <p className="mt-1 text-slate-500">
                Ödeme vadesi:{' '}
                {fileSupplier.paymentDueDays === 15 || fileSupplier.paymentDueDays === 30
                  ? <span className="font-semibold text-brand-700">{fileSupplier.paymentDueDays} Gün</span>
                  : <span className="font-semibold text-amber-700">Seçilmedi</span>}
              </p>
            </div>
          )}

          {showVadeWarn && fileSupplier && vendorDueMissing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900">
              <p className="font-semibold">Tedarikçi kartı güncellenmeli</p>
              <p className="mt-1">
                {fileSupplier.name} için hakediş ödeme vadesi (15 veya 30 gün) seçili değil.
                Kartı güncellemeden hakedişe aktarım yapılamaz.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link
                  href={`/panel/tedarikciler/${fileSupplier.id}`}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
                >
                  Kartı Güncelle
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    dismissVadeWarn(fileSupplier.id);
                    setShowVadeWarn(false);
                  }}
                  className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Şimdilik Gizle
                </button>
              </div>
            </div>
          )}

          {tab === 'ozet' && (
            <>
              <section className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-800">İş Grubu Bazlı Teklifler</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500">
                        <th className="px-4 py-2.5 text-left font-medium">İş Grubu</th>
                        <th className="px-2 py-2.5 text-right font-medium">Rapor Tutarı</th>
                        <th className="px-4 py-2.5 text-right font-medium">Tedarikçi Teklifi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {groups.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                            Henüz iş grubu kalemi yok.
                          </td>
                        </tr>
                      ) : (
                        groups.map((g) => {
                          const draft = parseTrAmountInput(quoteDrafts[g.id] ?? '') ?? g.supplier;
                          return (
                            <tr key={g.id} className="align-middle">
                              <td className="px-4 py-3 font-medium text-slate-800">{g.name}</td>
                              <td className="px-2 py-3 text-right tabular-nums text-slate-600">{money(g.sales)}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center justify-end gap-1.5">
                                  <TrAmountInput
                                    disabled={!canEdit || saving}
                                    className="w-[7.5rem] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right text-xs font-semibold text-slate-800"
                                    value={quoteDrafts[g.id] ?? ''}
                                    onChange={(v) => setQuoteDrafts((p) => ({ ...p, [g.id]: v }))}
                                    onBlur={() => void commitQuote(g.id)}
                                  />
                                  <StatusIcon reportAmount={g.sales} quoteAmount={draft} />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-100 px-4 py-3">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setShowAddQuote((v) => !v)}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-40"
                  >
                    + Tedarikçi Teklifi Ekle
                  </button>
                  {showAddQuote && (
                    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                      <input
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                        placeholder="Tedarikçi Adı"
                        value={newQuote.supplierName}
                        onChange={(e) => setNewQuote((p) => ({ ...p, supplierName: e.target.value }))}
                      />
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                        value={newQuote.workGroupId}
                        onChange={(e) => setNewQuote((p) => ({ ...p, workGroupId: e.target.value }))}
                      >
                        <option value="">İş Grubu Seçin</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <TrAmountInput
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                        placeholder="Teklif Tutarı"
                        value={newQuote.amount}
                        onChange={(amount) => setNewQuote((p) => ({ ...p, amount }))}
                      />
                      <button
                        type="button"
                        onClick={addHistoryQuote}
                        className="w-full rounded-xl bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        Kaydet
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Kârlılık Özeti</h3>
                <dl className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-600">Rapor Toplamı (A)</dt>
                    <dd className="font-semibold tabular-nums text-brand-700">{money(reportTotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-600">Onaylı Tedarikçi Maliyeti (B)</dt>
                    <dd className="font-semibold tabular-nums text-amber-700">{money(supplierTotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-600">Beklenen Brüt Kâr (A - B)</dt>
                    <dd className={`font-semibold tabular-nums ${profit >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                      {money(profit)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-600">Beklenen Kârlılık Oranı</dt>
                    <dd className={`font-semibold tabular-nums ${marginPct >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                      %{marginPct.toFixed(2).replace('.', ',')}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5">
                    <dt className="text-slate-600">Verimlilik Skoru</dt>
                    <dd className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <Stars count={score.stars} />
                      <span className="text-slate-500">({score.label})</span>
                    </dd>
                  </div>
                </dl>
                {canEdit && (
                  <button
                    type="button"
                    onClick={goToSalesRevision}
                    className="mt-3 w-full rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                  >
                    Satış Fiyatlarını Revize Et
                  </button>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Teklif Geçmişi</h3>
                  {history.length > 4 && (
                    <button
                      type="button"
                      onClick={() => setShowAllHistory((v) => !v)}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      {showAllHistory ? 'Daralt' : 'Tümünü Gör'}
                    </button>
                  )}
                </div>
                {visibleHistory.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                    Henüz teklif geçmişi yok.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                    {visibleHistory.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-800">
                            {h.supplierName}
                            <span className="font-normal text-slate-400"> ({h.workGroupName})</span>
                          </p>
                          <p className="text-[10px] text-slate-400">{h.date} · {money(h.amount)}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[h.status]}`}>
                          {STATUS_LABEL[h.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {tab === 'is-grubu' && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-700">
                İş Grubu Bazlı Ticari Revizyon
              </div>
              {groups.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400">Henüz iş grubu kalemi yok.</p>
              ) : (
                groups.map((g) => {
                  const r = rateNum(rates[g.id]);
                  const newSales = g.sales * (1 + r / 100);
                  return (
                    <div
                      key={g.id}
                      className="grid grid-cols-[1fr_88px] gap-3 border-b border-slate-100 px-4 py-3 last:border-0"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{g.name}</p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Rapor: {money(g.sales)} · Teklif: {money(g.supplier)}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-700">Ticari Fiyat: {money(newSales)}</p>
                      </div>
                      <label className="self-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                        <span className="text-[10px] text-slate-400">Oran %</span>
                        <input
                          disabled={!canEdit}
                          type="number"
                          min={-99}
                          step="0.1"
                          value={rates[g.id] ?? ''}
                          onChange={(e) => setRates((p) => ({ ...p, [g.id]: e.target.value }))}
                          className="mt-0.5 w-full bg-transparent text-right text-sm font-bold outline-none disabled:cursor-not-allowed"
                        />
                      </label>
                    </div>
                  );
                })
              )}
            </section>
          )}
        </div>

        {tab === 'ozet' && (
          <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-white px-5 py-3">
            <p className="text-[11px] leading-relaxed text-slate-500">
              Onaylanan tedarikçi teklifleri dosya bütçesine aktarılır; metraj ve rapor içeriği değişmez.
            </p>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Kapat
              </button>
              <button
                type="button"
                disabled={!canEdit || saving || supplierTotal <= 0 || vendorDueMissing}
                onClick={() => void approveAndTransfer()}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                title={vendorDueMissing ? 'Önce tedarikçi kartında 15 veya 30 gün vade seçin' : undefined}
              >
                {saving ? 'Aktarılıyor…' : 'Onayla ve Hakedişe Aktar'}
              </button>
            </div>
          </footer>
        )}

        {tab === 'is-grubu' && (
          <footer className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-white px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              İptal
            </button>
            <button
              type="button"
              disabled={!canEdit || !hasRate || saving}
              onClick={() => void applyCommercial()}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'Uygulanıyor…' : 'Ticari Revizyonu Uygula'}
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}

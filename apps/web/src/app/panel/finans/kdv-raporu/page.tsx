'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { API, authHeader } from '@/utils/api';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { formatTryAmount } from '@/utils/format-try-amount';

function fmtCurrency(n: number | null | undefined) {
  return formatTryAmount(n, { fractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR');
}

const MONTHS = [
  { value: 1, label: 'Ocak' }, { value: 2, label: 'Şubat' }, { value: 3, label: 'Mart' },
  { value: 4, label: 'Nisan' }, { value: 5, label: 'Mayıs' }, { value: 6, label: 'Haziran' },
  { value: 7, label: 'Temmuz' }, { value: 8, label: 'Ağustos' }, { value: 9, label: 'Eylül' },
  { value: 10, label: 'Ekim' }, { value: 11, label: 'Kasım' }, { value: 12, label: 'Aralık' },
];

type VatMethod =
  | 'invoice_settlement'
  | 'invoice_sales'
  | 'invoice_purchase'
  | 'operational'
  | 'compare';

const METHODS: Array<{
  id: VatMethod;
  label: string;
  sub: string;
  recommended?: boolean;
}> = [
  {
    id: 'invoice_settlement',
    label: 'Fatura Mahsupu',
    sub: 'Satış − Alış = Ödenecek KDV',
    recommended: true,
  },
  { id: 'invoice_sales', label: 'Satış Faturaları', sub: 'Hesaplanan KDV (borç)' },
  { id: 'invoice_purchase', label: 'Gider Faturaları', sub: 'İndirilecek KDV (alacak)' },
  { id: 'operational', label: 'Operasyonel Fişler', sub: 'Masraf & fiş tahmini' },
  { id: 'compare', label: 'Karşılaştırma', sub: 'Fatura vs operasyonel fark' },
];

const SOURCE_LABEL: Record<string, string> = {
  sales_invoice: 'Satış Faturası',
  purchase_invoice: 'Alış Faturası',
  expense: 'Masraf Fişi',
  overhead: 'Sabit Gider',
  cost_entry: 'Dosya Maliyeti',
  revenue: 'Operasyonel Gelir',
};

interface VatLine {
  id: string;
  source: string;
  date: string;
  description: string | null;
  category: string;
  group: string;
  fileNo: string | null;
  documentNo: string | null;
  counterparty: string | null;
  status: string | null;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  grossAmount: number;
  direction: 'input' | 'output';
}

interface VatSummary {
  outputNet: number;
  outputVat: number;
  outputGross: number;
  outputCount: number;
  inputNet: number;
  inputVat: number;
  inputGross: number;
  inputCount: number;
  netVatPayable: number;
  netVatCredit: number;
}

interface VatReport {
  period: { label: string };
  method: VatMethod;
  methodology: { title: string; description: string; formula: string };
  summary: VatSummary;
  lines: VatLine[];
  invoiceSection: {
    summary: VatSummary;
    salesLines: VatLine[];
    purchaseLines: VatLine[];
  };
  operationalSection: { summary: VatSummary; lines: VatLine[] };
  compare?: { invoiceNetPayable: number; operationalNetPayable: number; difference: number; note: string };
  notes: string[];
}

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

export default function KdvRaporuPage() {
  const router = useRouter();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [annual, setAnnual] = useState(false);
  const [method, setMethod] = useState<VatMethod>('invoice_settlement');
  const [detailTab, setDetailTab] = useState<'mahsup' | 'sales' | 'purchase' | 'lines'>('mahsup');
  const [report, setReport] = useState<VatReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    axios
      .get(`${API}/finance/analytics/vat-report`, {
        headers: authHeader(),
        params: { year, month: annual ? 0 : month, method },
      })
      .then((r) => setReport(r.data?.data ?? r.data))
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          router.push('/giris');
          return;
        }
        setError('KDV raporu yüklenemedi.');
        setReport(null);
      })
      .finally(() => setLoading(false));
  }, [year, month, annual, method, router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (method === 'invoice_sales') setDetailTab('sales');
    else if (method === 'invoice_purchase') setDetailTab('purchase');
    else if (method === 'operational') setDetailTab('lines');
    else setDetailTab('mahsup');
  }, [method]);

  const displayLines = useMemo(() => {
    if (!report) return [];
    if (detailTab === 'sales') return report.invoiceSection.salesLines;
    if (detailTab === 'purchase') return report.invoiceSection.purchaseLines;
    return report.lines;
  }, [report, detailTab]);

  const exportCsv = () => {
    if (!report) return;
    const header = [
      'Tarih', 'Kaynak', 'Belge No', 'Dosya', 'Kategori', 'Açıklama',
      'KDV Hariç', 'KDV %', 'KDV Tutarı', 'Genel Toplam', 'Yön', 'Durum',
    ];
    const rows = report.lines.map((l) => [
      fmtDate(l.date),
      SOURCE_LABEL[l.source] ?? l.source,
      l.documentNo ?? '',
      l.fileNo ?? '',
      l.category,
      (l.description ?? '').replace(/"/g, '""'),
      l.netAmount.toFixed(2),
      l.vatRate,
      l.vatAmount.toFixed(2),
      l.grossAmount.toFixed(2),
      l.direction === 'input' ? 'İndirilecek' : 'Hesaplanan',
      l.status ?? '',
    ]);
    const csv = [header, ...rows].map((row) => row.map((c) => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kdv-${method}-${year}${annual ? '' : `-${String(month).padStart(2, '0')}`}.csv`;
    a.click();
  };

  const s = report?.summary;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-5 space-y-4">
      <FinansSubpageBreadcrumb current="KDV Raporu" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">KDV Raporu & Mahsup</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {report?.period.label ?? 'Dönem seçin'} · Satış KDV − Alış KDV = ödenecek vergi
          </p>
        </div>
        <PeriodControls
          year={year} month={month} annual={annual}
          onYear={setYear} onMonth={setMonth} onAnnual={setAnnual}
          onExport={exportCsv} exportDisabled={!report?.lines.length}
        />
      </div>

      <section>
        <div className="flex flex-wrap gap-1.5">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                method === m.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className="text-xs font-semibold flex items-center gap-1.5">
                {m.label}
                {m.recommended && (
                  <span className="text-[8px] font-bold px-1 py-px rounded bg-emerald-100 text-emerald-700">Önerilen</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="animate-pulse h-48 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : report && s ? (
        <>
          {method === 'compare' && report.compare && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CompareCard label="Fatura mahsupu" value={fmtCurrency(report.compare.invoiceNetPayable)} tone="blue" />
              <CompareCard label="Operasyonel tahmin" value={fmtCurrency(report.compare.operationalNetPayable)} tone="amber" />
              <CompareCard
                label="Fark"
                value={fmtCurrency(report.compare.difference)}
                tone={Math.abs(report.compare.difference) < 1 ? 'emerald' : 'red'}
                sub={report.compare.note}
              />
            </div>
          )}

          {(method === 'invoice_settlement' || method === 'compare') && (
            <SettlementWaterfall
              outputVat={report.invoiceSection.summary.outputVat}
              inputVat={report.invoiceSection.summary.inputVat}
              netPayable={report.invoiceSection.summary.netVatPayable}
              netCredit={report.invoiceSection.summary.netVatCredit}
              salesCount={report.invoiceSection.summary.outputCount}
              purchaseCount={report.invoiceSection.summary.inputCount}
            />
          )}

          {/* KPI row for other methods */}
          {method !== 'invoice_settlement' && method !== 'compare' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {method === 'invoice_sales' && (
                <>
                  <KpiCard label="Hesaplanan KDV" value={fmtCurrency(s.outputVat)} sub={`${s.outputCount} satış faturası`} tone="emerald" />
                  <KpiCard label="Matrah (KDV hariç)" value={fmtCurrency(s.outputNet)} sub="Satış toplamı" tone="slate" />
                  <KpiCard label="Brüt Toplam" value={fmtCurrency(s.outputGross)} sub="KDV dahil" tone="slate" />
                </>
              )}
              {method === 'invoice_purchase' && (
                <>
                  <KpiCard label="İndirilecek KDV" value={fmtCurrency(s.inputVat)} sub={`${s.inputCount} alış faturası`} tone="amber" />
                  <KpiCard label="Matrah (KDV hariç)" value={fmtCurrency(s.inputNet)} sub="Alış toplamı" tone="slate" />
                  <KpiCard label="Brüt Toplam" value={fmtCurrency(s.inputGross)} sub="KDV dahil" tone="slate" />
                </>
              )}
              {method === 'operational' && (
                <>
                  <KpiCard label="İndirilecek KDV" value={fmtCurrency(s.inputVat)} sub={`${s.inputCount} gider kalemi`} tone="amber" />
                  <KpiCard label="Hesaplanan KDV" value={fmtCurrency(s.outputVat)} sub={`${s.outputCount} gelir kalemi`} tone="emerald" />
                  <KpiCard
                    label="Tahmini Net KDV"
                    value={fmtCurrency(s.netVatPayable > 0 ? s.netVatPayable : -s.netVatCredit)}
                    sub={s.netVatPayable > 0 ? 'Ödenecek' : 'Mahsup / iade potansiyeli'}
                    tone="blue"
                  />
                </>
              )}
            </div>
          )}

          {/* Detail tabs */}
          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
            {(method === 'invoice_settlement' || method === 'compare'
              ? ([
                  ['mahsup', 'Mahsup Özeti'],
                  ['sales', `Satış Faturaları (${report.invoiceSection.salesLines.length})`],
                  ['purchase', `Gider Faturaları (${report.invoiceSection.purchaseLines.length})`],
                  ['lines', 'Tüm Kalemler'],
                ] as const)
              : method === 'invoice_sales'
                ? ([['sales', 'Satış Faturaları']] as const)
                : method === 'invoice_purchase'
                  ? ([['purchase', 'Gider Faturaları']] as const)
                  : ([['lines', 'Operasyonel Kalemler']] as const)
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDetailTab(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  detailTab === id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {detailTab === 'mahsup' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InvoiceSummaryPanel
                title="Satış — Hesaplanan KDV"
                tone="emerald"
                summary={report.invoiceSection.summary}
                side="output"
                emptyHint={
                  <span>
                    Satış faturası yok.{' '}
                    <Link href="/panel/finans/faturalar" className="text-brand-600 underline">Faturalar</Link>
                    {' '}ekranından ekleyin.
                  </span>
                }
              />
              <InvoiceSummaryPanel
                title="Alış — İndirilecek KDV"
                tone="amber"
                summary={report.invoiceSection.summary}
                side="input"
                emptyHint={
                  <span>
                    Alış faturası yok.{' '}
                    <Link href="/panel/finans/faturalar" className="text-brand-600 underline">Faturalar</Link>
                    {' '}ekranında alış olarak kaydedin.
                  </span>
                }
              />
            </div>
          ) : (
            <LinesTable lines={displayLines} summary={report.summary} showDirection={method !== 'invoice_sales' && method !== 'invoice_purchase'} />
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
            {report.methodology.formula}. Taslak ve iptal faturalar dahil değildir. Resmi beyan için mali müşavirin onayı gerekir.
          </p>
        </>
      ) : null}
    </div>
  );
}

function PeriodControls({
  year, month, annual, onYear, onMonth, onAnnual, onExport, exportDisabled,
}: {
  year: number; month: number; annual: boolean;
  onYear: (y: number) => void; onMonth: (m: number) => void; onAnnual: (v: boolean) => void;
  onExport: () => void; exportDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-[10px] tracking-wide text-slate-500 mb-1">Yıl</label>
        <select value={year} onChange={(e) => onYear(parseInt(e.target.value, 10))}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
          {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      {!annual && (
        <div>
          <label className="block text-[10px] tracking-wide text-slate-500 mb-1">Ay</label>
          <select value={month} onChange={(e) => onMonth(parseInt(e.target.value, 10))}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
        <input type="checkbox" checked={annual} onChange={(e) => onAnnual(e.target.checked)} className="rounded" />
        Yıllık
      </label>
      <button type="button" onClick={onExport} disabled={exportDisabled}
        className="text-sm px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40">
        CSV İndir
      </button>
    </div>
  );
}

function SettlementWaterfall({
  outputVat, inputVat, netPayable, netCredit, salesCount, purchaseCount,
}: {
  outputVat: number; inputVat: number; netPayable: number; netCredit: number;
  salesCount: number; purchaseCount: number;
}) {
  const net = netPayable > 0 ? netPayable : netCredit;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-700">
        <CompactVatCell
          label="Hesaplanan KDV"
          meta={`${salesCount} satış faturası`}
          value={outputVat}
          className="text-emerald-700 dark:text-emerald-400"
        />
        <CompactVatCell
          label="İndirilecek KDV"
          meta={`${purchaseCount} alış faturası`}
          value={inputVat}
          className="text-amber-700 dark:text-amber-400"
        />
        <CompactVatCell
          label={netPayable > 0 ? 'Devlete ödenecek' : 'Mahsup / iade pot.'}
          meta="Net pozisyon"
          value={net}
          className={netPayable > 0 ? 'text-blue-700 dark:text-blue-300 font-bold' : 'text-violet-700 dark:text-violet-300 font-bold'}
          highlight
        />
      </div>
    </div>
  );
}

function CompactVatCell({
  label, meta, value, className, highlight,
}: {
  label: string; meta: string; value: number; className: string; highlight?: boolean;
}) {
  return (
    <div className={`px-4 py-3 ${highlight ? 'bg-slate-50 dark:bg-slate-700/30' : ''}`}>
      <p className="text-[10px] tracking-wide text-slate-500">{label}</p>
      <p className="text-[10px] text-slate-400">{meta}</p>
      <p className={`text-lg tabular-nums mt-1 ${className}`}>{fmtCurrency(value)}</p>
    </div>
  );
}

function InvoiceSummaryPanel({
  title, tone, summary, side, emptyHint,
}: {
  title: string;
  tone: 'emerald' | 'amber';
  summary: VatSummary;
  side: 'input' | 'output';
  emptyHint: React.ReactNode;
}) {
  const count = side === 'output' ? summary.outputCount : summary.inputCount;
  const net = side === 'output' ? summary.outputNet : summary.inputNet;
  const vat = side === 'output' ? summary.outputVat : summary.inputVat;
  const gross = side === 'output' ? summary.outputGross : summary.inputGross;
  const border = tone === 'emerald' ? 'border-emerald-100' : 'border-amber-100';

  return (
    <div className={`rounded-lg border ${border} bg-white dark:bg-slate-800 overflow-hidden`}>
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-xs font-semibold text-slate-800 dark:text-white">{title}</h3>
      </div>
      <div className="p-3">
        {count === 0 ? (
          <p className="text-xs text-slate-400 leading-relaxed">{emptyHint}</p>
        ) : (
          <dl className="space-y-3">
            <Row label="Fatura adedi" value={String(count)} />
            <Row label="Matrah (KDV hariç)" value={fmtCurrency(net)} />
            <Row label="KDV tutarı" value={fmtCurrency(vat)} bold />
            <Row label="Genel toplam" value={fmtCurrency(gross)} />
          </dl>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular-nums ${bold ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>{value}</dd>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  const tones: Record<string, string> = {
    emerald: 'border-emerald-100 bg-emerald-50/70',
    amber: 'border-amber-100 bg-amber-50/70',
    blue: 'border-blue-100 bg-blue-50/70',
    slate: 'border-slate-200 bg-white',
  };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone] ?? tones.slate}`}>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

function CompareCard({ label, value, tone, sub }: { label: string; value: string; tone: string; sub?: string }) {
  const tones: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50/70',
    amber: 'border-amber-200 bg-amber-50/70',
    emerald: 'border-emerald-200 bg-emerald-50/70',
    red: 'border-red-200 bg-red-50/70',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-1">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-2">{sub}</p>}
    </div>
  );
}

function LinesTable({
  lines, summary, showDirection,
}: {
  lines: VatLine[];
  summary: VatSummary;
  showDirection?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {['Tarih', 'Belge No', 'Kaynak', 'Dosya', 'Kategori', 'Açıklama', 'Matrah', 'KDV %', 'KDV', 'Toplam', ...(showDirection ? ['Yön'] : []), 'Durum'].map((h) => (
                <th key={h} className={`px-3 py-2 text-xs font-semibold text-slate-500 ${
                  ['Matrah', 'KDV', 'Toplam'].includes(h) ? 'text-right' : 'text-left'
                }`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {lines.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-12 text-center text-slate-400 text-sm">Bu dönemde kayıt yok</td></tr>
            ) : lines.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(l.date)}</td>
                <td className="px-3 py-2 text-xs font-mono">{l.documentNo ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{SOURCE_LABEL[l.source] ?? l.source}</td>
                <td className="px-3 py-2 text-xs font-mono">{l.fileNo ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{l.category}</td>
                <td className="px-3 py-2 text-xs max-w-[180px] truncate">{l.description ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(l.netAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">%{l.vatRate}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-amber-700">{fmtCurrency(l.vatAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(l.grossAmount)}</td>
                {showDirection && (
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      l.direction === 'input' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {l.direction === 'input' ? 'İndirilecek' : 'Hesaplanan'}
                    </span>
                  </td>
                )}
                <td className="px-3 py-2 text-xs text-slate-400">{l.status ?? '—'}</td>
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-700/50 font-semibold text-xs">
              <tr>
                <td colSpan={6} className="px-3 py-2 text-right text-slate-500">Toplam</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(summary.inputNet + summary.outputNet)}</td>
                <td />
                <td className="px-3 py-2 text-right tabular-nums text-amber-700">{fmtCurrency(summary.inputVat + summary.outputVat)}</td>
                <td colSpan={showDirection ? 3 : 2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { API, authHeader } from '@/utils/api';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import { FinansEmptyState, FinansKpiStrip, FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { FinansTablePager } from '@/components/finance/FinansTablePager';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableColGroup,
  PanelTableScroll,
  PanelOrderedHeaderRow,
  PanelListToolbarPickers,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { FINANS_TABLE_PAGE_KEYS, readFinansTablePageSize, sliceFinansPage, type FinansTablePageSize } from '@/utils/finans-table-page';
import { formatTryAmount } from '@/utils/format-try-amount';
import { HintIcon } from '@/components/ui/HintIcon';

const KDV_LINE_COLUMNS: TableColumnDef[] = [
  { id: 'date', label: 'Tarih', defaultWidth: 96, minWidth: 80 },
  { id: 'documentNo', label: 'Belge No', defaultWidth: 110, minWidth: 88 },
  { id: 'source', label: 'Kaynak', defaultWidth: 120, minWidth: 96 },
  { id: 'fileNo', label: 'Dosya', defaultWidth: 100, minWidth: 80 },
  { id: 'category', label: 'Kategori', defaultWidth: 110, minWidth: 88 },
  { id: 'description', label: 'Açıklama', defaultWidth: 160, minWidth: 100 },
  { id: 'netAmount', label: 'Matrah', defaultWidth: 108, minWidth: 88 },
  { id: 'vatRate', label: 'KDV %', defaultWidth: 72, minWidth: 64 },
  { id: 'vatAmount', label: 'KDV', defaultWidth: 96, minWidth: 80 },
  { id: 'grossAmount', label: 'Toplam', defaultWidth: 108, minWidth: 88 },
  { id: 'direction', label: 'Yön', defaultWidth: 100, minWidth: 80 },
  { id: 'status', label: 'Durum', defaultWidth: 88, minWidth: 72 },
];

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
    <div className="min-h-screen bg-white dark:bg-slate-900 space-y-5 p-6">
      <FinansSubpageBreadcrumb current="KDV Raporu" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="inline-flex items-center gap-1.5 text-xl font-bold text-slate-900 dark:text-white">
            KDV Raporu
            <HintIcon text="Satış KDV eksi alış KDV’dir. Seçilen ayda fatura yoksa sıfır doğrudur; ayı Faturalar’dan bakın. Resmi beyanname değildir." />
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {report?.period.label ?? 'Dönem seçin'}
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
            <FinansKpiStrip
              tone="light"
              items={[
                { label: 'Fatura mahsupu', value: fmtCurrency(report.compare.invoiceNetPayable), accent: 'text-slate-800' },
                { label: 'Operasyonel tahmin', value: fmtCurrency(report.compare.operationalNetPayable), accent: 'text-amber-400' },
                {
                  label: 'Fark',
                  value: fmtCurrency(report.compare.difference),
                  accent: Math.abs(report.compare.difference) < 1 ? 'text-emerald-400' : 'text-red-400',
                },
              ]}
            />
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
            <FinansKpiStrip
              tone="light"
              items={
                method === 'invoice_sales'
                  ? [
                      { label: 'Hesaplanan KDV', value: fmtCurrency(s.outputVat), accent: s.outputVat > 0 ? 'text-emerald-400' : 'text-slate-400' },
                      { label: 'Matrah (KDV hariç)', value: fmtCurrency(s.outputNet), accent: 'text-slate-800' },
                      { label: 'Brüt Toplam', value: fmtCurrency(s.outputGross), accent: 'text-slate-800' },
                    ]
                  : method === 'invoice_purchase'
                    ? [
                        { label: 'İndirilecek KDV', value: fmtCurrency(s.inputVat), accent: s.inputVat > 0 ? 'text-amber-400' : 'text-slate-400' },
                        { label: 'Matrah (KDV hariç)', value: fmtCurrency(s.inputNet), accent: 'text-slate-800' },
                        { label: 'Brüt Toplam', value: fmtCurrency(s.inputGross), accent: 'text-slate-800' },
                      ]
                    : [
                        { label: 'İndirilecek KDV', value: fmtCurrency(s.inputVat), accent: s.inputVat > 0 ? 'text-amber-400' : 'text-slate-400' },
                        { label: 'Hesaplanan KDV', value: fmtCurrency(s.outputVat), accent: s.outputVat > 0 ? 'text-emerald-400' : 'text-slate-400' },
                        {
                          label: 'Tahmini Net KDV',
                          value: fmtCurrency(s.netVatPayable > 0 ? s.netVatPayable : -s.netVatCredit),
                          accent: s.netVatPayable > 0 ? 'text-blue-400' : 'text-slate-800',
                        },
                      ]
              }
            />
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
                summary={report.invoiceSection.summary}
                side="output"
                emptyHint={
                  <span>
                    Bu ay satış faturası yok; sıfır doğrudur.{' '}
                    <Link href="/panel/finans/faturalar" className="text-brand-600 underline">Faturalar</Link>
                    {' '}ekranındaki aya bakın.
                  </span>
                }
              />
              <InvoiceSummaryPanel
                title="Alış — İndirilecek KDV"
                summary={report.invoiceSection.summary}
                side="input"
                emptyHint={
                  <span>
                    Bu ay alış faturası yok; sıfır doğrudur.{' '}
                    <Link href="/panel/finans/faturalar" className="text-brand-600 underline">Faturalar</Link>
                    {' '}ekranındaki aya bakın.
                  </span>
                }
              />
            </div>
          ) : (
            <FinansPanelCard title="KDV Kalemleri" subtitle={`${displayLines.length} kayıt`} noPadding>
              <LinesTable lines={displayLines} summary={report.summary} showDirection={method !== 'invoice_sales' && method !== 'invoice_purchase'} />
            </FinansPanelCard>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
            {report.methodology.formula}. Taslak fatura girer; iptal girmez. Bu sayfa bilgi içindir, resmi KDV beyannamesi değildir.
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
  title, summary, side, emptyHint,
}: {
  title: string;
  summary: VatSummary;
  side: 'input' | 'output';
  emptyHint: React.ReactNode;
}) {
  const count = side === 'output' ? summary.outputCount : summary.inputCount;
  const net = side === 'output' ? summary.outputNet : summary.inputNet;
  const vat = side === 'output' ? summary.outputVat : summary.inputVat;
  const gross = side === 'output' ? summary.outputGross : summary.inputGross;

  return (
    <FinansPanelCard title={title}>
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
    </FinansPanelCard>
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

function LinesTable({
  lines, summary, showDirection,
}: {
  lines: VatLine[];
  summary: VatSummary;
  showDirection?: boolean;
}) {
  const colDefs = useMemo(
    () => (showDirection ? KDV_LINE_COLUMNS : KDV_LINE_COLUMNS.filter((c) => c.id !== 'direction')),
    [showDirection],
  );
  const tableColumns = usePanelTableColumns(
    showDirection ? 'table-cols:finans-kdv-dir' : 'table-cols:finans-kdv',
    colDefs,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<FinansTablePageSize>(() =>
    readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.kdv, 20),
  );
  const paged = sliceFinansPage(lines, page, pageSize);

  return (
    <TableColumnsProvider value={tableColumns}>
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
        <PanelListToolbarPickers>
          <PanelTableColumnPicker tableColumns={tableColumns} />
        </PanelListToolbarPickers>
      </div>
      <PanelTableScroll>
        <table className="text-sm" style={panelTableLayoutStyle(tableColumns)}>
          <PanelTableColGroup />
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              <PanelOrderedHeaderRow
                tableColumns={tableColumns}
                thClass={(id) =>
                  ['netAmount', 'vatRate', 'vatAmount', 'grossAmount'].includes(id)
                    ? 'px-3 py-2 text-xs font-semibold text-slate-500 text-right'
                    : 'px-3 py-2 text-xs font-semibold text-slate-500'
                }
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {lines.length === 0 ? (
              <tr><td colSpan={tableColumns.prefs.orderedVisibleColumns.length} className="px-4 py-8"><FinansEmptyState title="Bu dönemde KDV kaydı yok." description="Seçilen ayda satış veya alış faturası yoksa burası boş kalır. Ayı Faturalar’dan kontrol edin." /></td></tr>
            ) : paged.slice.map((l) => {
              const cells: Record<string, ReactNode> = {
                date: (
                  <PanelTableTd key="date" colId="date" className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(l.date)}</PanelTableTd>
                ),
                documentNo: (
                  <PanelTableTd key="documentNo" colId="documentNo" className="px-3 py-2 text-xs font-mono">{l.documentNo ?? '—'}</PanelTableTd>
                ),
                source: (
                  <PanelTableTd key="source" colId="source" className="px-3 py-2 text-xs">{SOURCE_LABEL[l.source] ?? l.source}</PanelTableTd>
                ),
                fileNo: (
                  <PanelTableTd key="fileNo" colId="fileNo" className="px-3 py-2 text-xs font-mono">{l.fileNo ?? '—'}</PanelTableTd>
                ),
                category: (
                  <PanelTableTd key="category" colId="category" className="px-3 py-2 text-xs">{l.category}</PanelTableTd>
                ),
                description: (
                  <PanelTableTd key="description" colId="description" className="px-3 py-2 text-xs max-w-[180px] truncate">{l.description ?? '—'}</PanelTableTd>
                ),
                netAmount: (
                  <PanelTableTd key="netAmount" colId="netAmount" className="px-3 py-2 text-right tabular-nums">{fmtCurrency(l.netAmount)}</PanelTableTd>
                ),
                vatRate: (
                  <PanelTableTd key="vatRate" colId="vatRate" className="px-3 py-2 text-right tabular-nums">%{l.vatRate}</PanelTableTd>
                ),
                vatAmount: (
                  <PanelTableTd key="vatAmount" colId="vatAmount" className="px-3 py-2 text-right tabular-nums font-medium text-amber-700">{fmtCurrency(l.vatAmount)}</PanelTableTd>
                ),
                grossAmount: (
                  <PanelTableTd key="grossAmount" colId="grossAmount" className="px-3 py-2 text-right tabular-nums">{fmtCurrency(l.grossAmount)}</PanelTableTd>
                ),
                direction: (
                  <PanelTableTd key="direction" colId="direction" className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      l.direction === 'input' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {l.direction === 'input' ? 'İndirilecek' : 'Hesaplanan'}
                    </span>
                  </PanelTableTd>
                ),
                status: (
                  <PanelTableTd key="status" colId="status" className="px-3 py-2 text-xs text-slate-400">{l.status ?? '—'}</PanelTableTd>
                ),
              };
              return (
                <tr key={l.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                  {tableColumns.prefs.orderedVisibleColumns.map((col) => cells[col.id] ?? null)}
                </tr>
              );
            })}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-700/50 font-semibold text-xs">
              <tr>
                {(() => {
                  const numericIds = new Set(['netAmount', 'vatRate', 'vatAmount', 'grossAmount']);
                  const lastText = [...tableColumns.prefs.orderedVisibleColumns].reverse().find((c) => !numericIds.has(c.id));
                  return tableColumns.prefs.orderedVisibleColumns.map((col) => {
                    if (col.id === 'netAmount') {
                      return <td key={col.id} className="px-3 py-2 text-right tabular-nums">{fmtCurrency(summary.inputNet + summary.outputNet)}</td>;
                    }
                    if (col.id === 'vatAmount') {
                      return <td key={col.id} className="px-3 py-2 text-right tabular-nums text-amber-700">{fmtCurrency(summary.inputVat + summary.outputVat)}</td>;
                    }
                    if (col.id === lastText?.id) {
                      return <td key={col.id} className="px-3 py-2 text-right text-slate-500">Toplam</td>;
                    }
                    return <td key={col.id} className="px-3 py-2" />;
                  });
                })()}
              </tr>
            </tfoot>
          )}
        </table>
      </PanelTableScroll>
      {lines.length > 0 ? (
        <FinansTablePager
          page={paged.safePage}
          pageSize={pageSize}
          total={paged.total}
          storageKey={FINANS_TABLE_PAGE_KEYS.kdv}
          onPageChange={setPage}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        />
      ) : null}
    </TableColumnsProvider>
  );
}

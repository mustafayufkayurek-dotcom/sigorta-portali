'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ArrowLeft, Banknote, Check, Receipt, Wallet, X } from 'lucide-react';
import { AVANS_REF_PREFIX, isAvansPayment, isHakedisMahsupPayment, resolveHasarAvansHesap, withAvansNote } from '@sigorta/shared';
import { FinanceRowActions, printFinanceSlip, vendorEkstreHref } from '@/components/finance/FinanceRowActions';
import { FinansPanelCard } from '@/components/finance/FinansPanelUI';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableColGroup,
  PanelTableTd,
  PanelTableTh,
  SortablePanelTableTh,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { cycleClientSort, sortRowsByClientSort, type ClientSortState } from '@/utils/panel-table-sort';
import { useToast } from '@/contexts/ToastContext';
import { API, authHeader } from '@/utils/api';
import { formatTryAmount } from '@/utils/format-try-amount';
import { fmtDate } from '@/utils/date-helpers';
import {
  buildHasarHakedisGrantLines,
  buildHasarHakedisSecimSatirlari,
  DOSYA_ODEME_IS_GRUBU_YOK,
  DOSYA_ODEME_TEDARIKCI_YOK,
  dosyaOdemeIsGrubu,
  dosyaOdemeTedarikciAdi,
  hasarHakedisKalan,
  isHasarHakedisSatiriPasif,
  isOrnekHakedisSatiri,
  ORNEK_HAKEDIS_TEDARIKCILERI,
  ornekHakedisAvans,
  type HasarHakedisGrantDetail,
  type HasarHakedisSecimSatiri,
} from '@/utils/hasar-hakedis-grant';
import {
  buildHakedisAkis,
  buildHasarHakedisOzet,
  HAKEDIS_KAYNAK_ETIKET,
  hakedisDurumEtiket,
  hakedisKesintiNet,
  hakedisTutarKirilim,
  resolveHasarAvansLimit,
  type HakedisKaynak,
} from '@/utils/hasar-hakedis-ozet';
import { numberToTrAmountInput, parseTrAmountInput } from '@/utils/tr-amount-input';
import { normalizeTrDateValue } from '@/utils/tr-date-input';
import { TrAmountInput } from '@/components/ui/TrAmountInput';
import { TrDateInput } from '@/components/ui/TrDateInput';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Tek format: `12.500 TL` — ₺ önek ve ikinci TL yok. */
const fmt = (n: number) => formatTryAmount(n, { fractionDigits: 0 });

type DrawerTab = 'avans' | 'hakedis' | 'odeme';
type DosyaOdeme = {
  id: string;
  odemeTarihi?: string;
  talepTarihi?: string;
  tur: 'Avans' | 'Hakediş' | 'Masraf';
  tutar: number;
  durum: string;
  vendorId?: string | null;
  vendorName: string;
  workGroupLabel: string;
  fileId?: string | null;
  fileNo?: string | null;
  note?: string;
};

const DOSYA_ODEME_COLUMNS: TableColumnDef[] = [
  { id: 'odemeTarihi', label: 'Ödeme Tarihi', defaultWidth: 128, minWidth: 108 },
  { id: 'talepTarihi', label: 'Hakediş Talep Tarihi', defaultWidth: 176, minWidth: 140 },
  { id: 'vendorName', label: 'Tedarikçi Adı Soyadı', defaultWidth: 200, minWidth: 140 },
  { id: 'fileNo', label: 'Dosya', defaultWidth: 140, minWidth: 108 },
  { id: 'workGroup', label: 'İş Grubu', defaultWidth: 148, minWidth: 112 },
  { id: 'tur', label: 'Tür', defaultWidth: 96, minWidth: 80 },
  { id: 'tutar', label: 'Tutar', defaultWidth: 112, minWidth: 88 },
  { id: 'durum', label: 'Durum', defaultWidth: 112, minWidth: 88 },
  { id: 'actions', label: 'İşlemler', defaultWidth: 96, minWidth: 80, pin: 'end', alwaysVisible: true, resizable: false },
];

function paymentDokumLayoutStyle(tableColumns: ReturnType<typeof usePanelTableColumns>) {
  const total = tableColumns.prefs.orderedVisibleColumns.reduce(
    (sum, col) => sum + tableColumns.widths.getWidth(col.id),
    0,
  );
  const totalPx = Math.max(total, 880);
  return { tableLayout: 'fixed' as const, width: `${totalPx}px`, minWidth: `${totalPx}px` };
}
type Composer = 'none' | 'avans' | 'hakedis';
type SozlesmeCevap = 'var' | 'yok' | null;

type DosyaSozlesme = {
  id: string;
  contractNo?: string;
  status?: string;
  contractDate?: string;
  signedAt?: string | null;
  vendor?: { id?: string; name?: string };
  vendorName?: string;
};

const SOZLESME_DURUM: Record<string, string> = {
  draft: 'Taslak',
  ready: 'Hazır',
  sent: 'Gönderildi',
  vendor_signed: 'İmzalandı',
  cancelled: 'İptal',
};

async function openDosyaSozlesmePdf(id: string) {
  const res = await axios.get(`${API}/vendor-contracts/${id}/pdf`, {
    headers: authHeader(),
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

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
  vendor?: { id?: string; name?: string };
  createdBy?: { firstName?: string | null; lastName?: string | null } | null;
  items?: Array<{
    lineDescription?: string | null;
    workGroupId?: string | null;
    workGroup?: { name?: string | null } | null;
    totalAmount?: number | null;
    vatRate?: number | null;
  }>;
};

type StatementDetail = StatementRow;

type VendorCtx = {
  id: string;
  name: string;
  paymentDueDays: number | null;
  workGroups?: Array<{ id: string; name: string }>;
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
  payerId?: string | null;
  createdAt?: string;
  claimFileId?: string | null;
  claimFile?: { id?: string; fileNo?: string | null } | null;
  vendorName?: string | null;
  vendorStatementItem?: {
    lineDescription?: string | null;
    statement?: { id?: string; createdAt?: string; sentAt?: string | null } | null;
  } | null;
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

function StatusPill({ label }: { label: string }) {
  const tone = label === 'Ödendi' || label === 'Onaylandı' || label === 'Tamamlandı'
    ? 'bg-emerald-50 text-emerald-800'
    : label === 'Ödeme Bekliyor' || label === 'Onay Bekliyor'
      ? 'bg-blue-50 text-blue-800'
      : 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

function BudgetStrip({
  sozlesme,
  kullanilan,
  kalan,
}: {
  sozlesme: number | null;
  kullanilan: number;
  kalan: number | null;
}) {
  const total = sozlesme && sozlesme > 0 ? sozlesme : 0;
  const usedPct = total > 0 ? Math.min(100, (kullanilan / total) * 100) : 0;
  const cells: Array<{ label: string; value: string; accent: string; testid?: string }> = [
    { label: 'Bütçe', value: sozlesme == null ? '—' : fmt(sozlesme), accent: 'text-slate-900' },
    { label: 'Kullanılan', value: fmt(kullanilan), accent: kullanilan > 0 ? 'text-slate-900' : 'text-slate-500' },
    { label: 'Kalan', value: kalan == null ? '—' : fmt(kalan), accent: 'text-blue-800', testid: 'hasar-hakedis-bakiye' },
  ];
  return (
    <div data-testid="hakedis-finans-ozet">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70">
        <div className="grid grid-cols-3 divide-x divide-slate-200">
          {cells.map((cell) => (
            <div key={cell.label} className="px-2 py-2.5 text-center" data-testid={cell.testid}>
              <p className="text-[11px] font-medium leading-none text-slate-500">{cell.label}</p>
              <p className={`mt-1.5 text-[15px] font-semibold tabular-nums leading-none ${cell.accent}`}>
                {cell.value}
              </p>
            </div>
          ))}
        </div>
        <div className="h-1.5 bg-slate-200/80" aria-hidden>
          <div className="h-full bg-blue-600" style={{ width: `${usedPct}%` }} />
        </div>
      </div>
      <span className="sr-only">Sözleşme / Bütçe</span>
      <span className="sr-only">Toplam Avans</span>
      <span className="sr-only">Toplam Hakediş</span>
      <span className="sr-only">Verilen avans</span>
      <span className="sr-only">Kalan Bakiye</span>
    </div>
  );
}

function PaymentDokum({
  rows,
  fileNo,
  claimId,
}: {
  rows: DosyaOdeme[];
  fileNo?: string;
  claimId: string;
}) {
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const tableColumns = usePanelTableColumns('table-cols:hasar-dosya-odeme-v3', DOSYA_ODEME_COLUMNS);
  const sorted = useMemo(
    () =>
      sortRowsByClientSort(rows, clientSort, (row, key) => {
        switch (key) {
          case 'odemeTarihi':
            return row.odemeTarihi ?? '';
          case 'talepTarihi':
            return row.talepTarihi ?? '';
          case 'vendorName':
            return row.vendorName;
          case 'fileNo':
            return row.fileNo ?? '';
          case 'workGroup':
            return row.workGroupLabel;
          case 'tur':
            return row.tur;
          case 'tutar':
            return row.tutar;
          case 'durum':
            return row.durum;
          default:
            return '';
        }
      }),
    [rows, clientSort],
  );
  if (rows.length === 0) {
    return <p className="py-2 text-[13px] font-normal text-slate-500">Bu dosyada ödeme veya masraf yok.</p>;
  }
  const returnTo = `/panel/hasar-dosyalari/${claimId}?grup=finans&alt=gider-butce`;
  const cols = tableColumns.prefs.orderedVisibleColumns;
  return (
    <TableColumnsProvider value={tableColumns}>
      <div className="mb-1 flex justify-end">
        <PanelTableColumnPicker tableColumns={tableColumns} />
      </div>
      <div className="overflow-x-auto">
        <table className="text-left text-[12px]" data-testid="dosya-tedarikci-odeme-dokum" style={paymentDokumLayoutStyle(tableColumns)}>
          <PanelTableColGroup />
          <thead className="text-[11px] font-medium text-slate-400">
            <tr className="border-b border-slate-200">
              {cols.map((col) => (
                col.id === 'actions' ? (
                  <PanelTableTh key={col.id} colId={col.id} className="py-1.5 text-center font-medium">{col.label}</PanelTableTh>
                ) : (
                  <SortablePanelTableTh
                    key={col.id}
                    colId={col.id}
                    sortKey={col.id}
                    activeSortKey={clientSort?.key ?? null}
                    sortDir={clientSort?.dir ?? 'asc'}
                    onSort={(k) => setClientSort((p) => cycleClientSort(p, k))}
                    className="py-1.5 text-center font-medium"
                  >
                    {col.label}
                  </SortablePanelTableTh>
                )
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((row) => (
              <tr key={row.id}>
                {cols.map((col) => {
                  switch (col.id) {
                    case 'odemeTarihi':
                      return <PanelTableTd key={col.id} colId={col.id} className="py-2 font-normal text-slate-500">{fmtDate(row.odemeTarihi)}</PanelTableTd>;
                    case 'talepTarihi':
                      return <PanelTableTd key={col.id} colId={col.id} className="py-2 font-normal text-slate-500">{fmtDate(row.talepTarihi)}</PanelTableTd>;
                    case 'vendorName':
                      return (
                        <PanelTableTd key={col.id} colId={col.id} className={`py-2 font-medium ${
                          row.vendorName === DOSYA_ODEME_TEDARIKCI_YOK ? 'text-red-700' : 'text-slate-800'
                        }`}>{row.vendorName}</PanelTableTd>
                      );
                    case 'fileNo': {
                      const no = row.fileNo || '—';
                      const buDosya = row.fileId === claimId;
                      return (
                        <PanelTableTd key={col.id} colId={col.id} className="py-2 font-medium text-slate-800">
                          {buDosya || !row.fileId ? (
                            no
                          ) : (
                            <a href={`/panel/hasar-dosyalari/${row.fileId}?grup=finans&alt=gider-butce`} className="text-blue-700 hover:underline">
                              {no}
                            </a>
                          )}
                        </PanelTableTd>
                      );
                    }
                    case 'workGroup':
                      return (
                        <PanelTableTd key={col.id} colId={col.id} className={`py-2 font-medium ${
                          row.workGroupLabel === DOSYA_ODEME_IS_GRUBU_YOK ? 'text-red-700' : 'text-slate-800'
                        }`}>{row.workGroupLabel}</PanelTableTd>
                      );
                    case 'tur':
                      return <PanelTableTd key={col.id} colId={col.id} className="py-2 font-normal text-slate-700">{row.tur}</PanelTableTd>;
                    case 'tutar':
                      return <PanelTableTd key={col.id} colId={col.id} align="right" className="py-2 font-medium tabular-nums text-slate-900">{fmt(row.tutar)}</PanelTableTd>;
                    case 'durum':
                      return <PanelTableTd key={col.id} colId={col.id} className="py-2"><StatusPill label={row.durum} /></PanelTableTd>;
                    case 'actions':
                      return (
                        <PanelTableTd key={col.id} colId={col.id} align="right" className="py-2">
                          <FinanceRowActions
                            onPrint={() => printFinanceSlip({
                              title: row.tur,
                              fileNo: row.fileNo || fileNo,
                              workGroup: row.workGroupLabel,
                              date: fmtDate(row.odemeTarihi),
                              talepDate: fmtDate(row.talepTarihi),
                              amount: row.tutar,
                              status: row.durum,
                              note: row.note,
                            })}
                            ekstreHref={vendorEkstreHref({
                              vendorId: row.vendorId,
                              fromFile: claimId,
                              fileNo,
                              returnTo,
                            })}
                          />
                        </PanelTableTd>
                      );
                    default:
                      return null;
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableColumnsProvider>
  );
}

function StatementLine({
  label,
  value,
  hint,
  deduct,
  strong,
}: {
  label: string;
  value: number | null;
  hint?: string;
  deduct?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[3px]">
      <p className={strong ? 'text-[13px] font-medium text-slate-900' : 'text-[13px] font-normal text-slate-600'}>
        {deduct && value ? <span className="mr-1 text-slate-400">−</span> : null}
        {label}
        {hint ? <span className="ml-2 text-[11px] font-normal text-slate-400">{hint}</span> : null}
      </p>
      <p className={`tabular-nums ${strong ? 'text-[16px] font-medium text-slate-900' : 'text-[13px] font-normal text-slate-800'}`}>
        {value == null ? '—' : fmt(value)}
      </p>
    </div>
  );
}

function HakedisTedarikciKartlari({
  rows,
  emptySuppliers,
  pasif,
  avansOf,
  verilenOf,
  saving,
  sendingKey,
  onGonder,
}: {
  rows: HasarHakedisSecimSatiri[];
  emptySuppliers: boolean;
  pasif: (row: HasarHakedisSecimSatiri) => boolean;
  avansOf: (vendorId: string) => number;
  verilenOf: (vendorId: string) => number;
  saving: boolean;
  sendingKey: string | null;
  onGonder: (row: HasarHakedisSecimSatiri) => void;
}) {
  if (emptySuppliers) {
    return <p className="text-[12px] font-normal text-slate-500">Dosyada görevli tedarikçi yok.</p>;
  }
  if (rows.length === 0) {
    return <p className="text-[12px] font-normal text-slate-500">Bu dosyada iş grubu bütçesi yok.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const avans = avansOf(row.vendorId);
        const kalan = hasarHakedisKalan(row.amount, avans, verilenOf(row.vendorId));
        const isPasif = pasif(row) || kalan <= 0;
        return (
          <li
            key={row.key}
            className={`rounded-xl border px-3 py-3 ${
              isPasif ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-[11px] font-medium text-slate-500">Tedarikçi</p>
            <p className={`text-[13px] font-medium ${isPasif ? 'text-slate-500' : 'text-slate-800'}`}>
              {row.vendorName}
            </p>
            <p className="mt-2 text-[11px] font-medium text-slate-500">İş Grubu</p>
            <p className={`text-[13px] font-medium ${
              row.workGroupLabel === 'İş Grubu Yok' ? 'text-red-700' : isPasif ? 'text-slate-500' : 'text-slate-800'
            }`}>{row.workGroupLabel}</p>
            <div className={`mt-2 space-y-0.5 ${isPasif ? 'text-slate-400' : 'text-slate-600'}`}>
              <StatementLine label="Bütçe" value={row.amount} />
              <StatementLine label="Ödenen Avans" value={avans} />
              <StatementLine label="Kalan Hakediş" value={kalan} strong />
            </div>
            {isPasif ? (
              <p className="mt-2 text-[12px] font-medium text-slate-500">Hakediş verildi</p>
            ) : (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onGonder(row)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {saving && sendingKey === row.key ? 'Aktarılıyor…' : 'Finansa Aktar'}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CircleStepper({
  steps,
}: {
  steps: Array<{ id: string; label: string; durum: 'tamam' | 'aktif' | 'bekler'; tarih?: string | null }>;
}) {
  const visible = steps.filter((adim) => adim.id !== 'tamamlandi');
  return (
    <ol className="flex items-start" data-testid="hakedis-durum-stepper">
      {visible.map((adim, idx) => {
        const done = adim.durum === 'tamam';
        const active = adim.durum === 'aktif';
        return (
          <li key={adim.id} className="flex min-w-0 flex-1 items-start">
            {idx > 0 ? (
              <span className={`mt-3 h-px flex-1 ${done || active ? 'bg-slate-300' : 'bg-slate-200'}`} />
            ) : null}
            <div className="flex w-[4.25rem] shrink-0 flex-col items-center text-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium ${
                  done
                    ? 'bg-emerald-600 text-white'
                    : active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.25} /> : idx + 1}
              </span>
              <span className={`mt-1.5 text-[11px] font-medium ${active ? 'text-blue-700' : 'text-slate-600'}`}>
                {adim.label}
              </span>
              {adim.tarih ? (
                <span className="mt-0.5 text-[10px] font-normal text-slate-400">{fmtDate(adim.tarih)}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SozlesmeSoru({
  cevap,
  yokNeden,
  kayitlar,
  yukleniyor,
  vendorName,
  onVar,
  onYok,
  onYokNeden,
  onPdfHata,
}: {
  cevap: SozlesmeCevap;
  yokNeden: string;
  kayitlar: DosyaSozlesme[];
  yukleniyor: boolean;
  vendorName?: string;
  onVar: () => void;
  onYok: () => void;
  onYokNeden: (value: string) => void;
  onPdfHata: (e: unknown) => void;
}) {
  return (
    <div data-testid="dosya-sozlesme-soru" className="rounded-xl border border-slate-200 px-3 py-3">
      <p className="text-[13px] font-medium text-slate-800">Dosyada sözleşme var mı?</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onVar}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${
            cevap === 'var'
              ? 'bg-blue-600 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Var
        </button>
        <button
          type="button"
          onClick={onYok}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${
            cevap === 'yok'
              ? 'bg-blue-600 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Yok
        </button>
      </div>
      {cevap === 'var' ? (
        <div className="mt-2">
          {yukleniyor ? (
            <p className="text-[12px] font-normal text-slate-400">Sözleşme yükleniyor…</p>
          ) : kayitlar.length === 0 ? null : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
              {kayitlar.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-800">
                      {row.contractNo || 'Sözleşme'}
                    </p>
                    <p className="mt-0.5 text-[11px] font-normal text-slate-400">
                      {row.vendor?.name || row.vendorName || vendorName || 'Tedarikçi'}
                      {' · '}
                      {fmtDate(row.signedAt ?? row.contractDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill label={SOZLESME_DURUM[row.status ?? ''] ?? row.status ?? '—'} />
                    <button
                      type="button"
                      onClick={() => {
                        void openDosyaSozlesmePdf(row.id).catch(onPdfHata);
                      }}
                      className="text-[12px] font-medium text-blue-700 hover:underline"
                    >
                      Görüntüle
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {cevap === 'yok' ? (
        <label className="mt-2 block">
          <span className="text-[11px] font-medium text-slate-500">
            Sözleşme Yoksa Açıklayınız <span className="text-red-500">*</span>
          </span>
          <textarea
            value={yokNeden}
            onChange={(e) => onYokNeden(e.target.value)}
            rows={2}
            required
            placeholder="Neden sözleşme olmadığını yazın"
            className="mt-1 min-h-[56px] w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] font-normal outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
      ) : null}
    </div>
  );
}

const SAYFA_SECIM: Array<{
  id: 'avans' | 'hakedis';
  label: string;
  Icon: typeof Wallet;
}> = [
  { id: 'avans', label: 'Avans', Icon: Wallet },
  { id: 'hakedis', label: 'Hakediş', Icon: Receipt },
];
const ODEME_SECIM = { id: 'odeme', label: 'Ödemeler' } as const;

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
  const [hakedis, setHakedis] = useState<StatementRow[]>([]);
  const [vendor, setVendor] = useState<VendorCtx | null>(null);
  const [suppliers, setSuppliers] = useState<VendorCtx[]>([]);
  const [catalogWorkGroupIds, setCatalogWorkGroupIds] = useState<string[]>([]);
  const [fileNo, setFileNo] = useState('');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [tedarikciHareketleri, setTedarikciHareketleri] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<Array<{
    id: string;
    amount?: number;
    description?: string;
    date?: string;
    createdAt?: string;
    status?: string;
    vendorId?: string | null;
    vendorName?: string | null;
    workGroup?: { name?: string | null } | null;
    workGroupName?: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [, setFilter] = useState<DrawerTab>('avans');
  const [composer, setComposer] = useState<Composer>('none');
  const [, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<GrantLine[]>([]);
  const [, setOpenGroupKey] = useState<string | null>(null);
  const [, setTalepDraft] = useState('');
  const [, setTutarDuzenle] = useState(false);
  const [, setAciklama] = useState('');
  const [sozlesme, setSozlesme] = useState<number | null>(null);
  const [sozlesmeKaynak, setSozlesmeKaynak] = useState<HakedisKaynak>('teklif');
  const [onerilen, setOnerilen] = useState<number | null>(null);
  const [onerilenKaynak, setOnerilenKaynak] = useState<HakedisKaynak>('metraj');
  const [avansDraft, setAvansDraft] = useState('');
  const [avansAciklama, setAvansAciklama] = useState('');
  const [avansTarih, setAvansTarih] = useState(todayIso);
  const [savingAvans, setSavingAvans] = useState(false);
  const [sozlesmeCevap, setSozlesmeCevap] = useState<SozlesmeCevap>(null);
  const [sozlesmeYokNeden, setSozlesmeYokNeden] = useState('');
  const [dosyaSozlesmeleri, setDosyaSozlesmeleri] = useState<DosyaSozlesme[]>([]);
  const [sozlesmeYukleniyor, setSozlesmeYukleniyor] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StatementDetail | null>(null);
  const [secilenHakedisKey, setSecilenHakedisKey] = useState<string | null>(null);

  const dueDays = vendor?.paymentDueDays === 15 || vendor?.paymentDueDays === 30
    ? vendor.paymentDueDays
    : null;
  const avansHesap = resolveHasarAvansHesap({ payments, statements: hakedis });

  const hydrateGrantSource = useCallback(async () => {
    const hint = Number(supplierCostHint) || 0;
    if (hint > 0) {
      setSozlesme(hint);
      setSozlesmeKaynak('dosya');
    }
    const req = { headers: authHeader(), timeout: 8000 };
    const [claimRes, listRes, budgetRes] = await Promise.allSettled([
      axios.get(`${API}/claim-files/${claimId}`, req),
      axios.get(`${API}/claim-files/${claimId}/repair-reports`, req),
      axios.get(`${API}/claim-files/${claimId}/budget-versions`, req),
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
      const repWait = await Promise.allSettled([
        axios.get(`${API}/repair-reports/${id}`, req),
      ]);
      if (repWait[0]?.status === 'fulfilled') {
        const report = unwrap(repWait[0].value.data) as { items?: unknown[]; totalSupplierCost?: number };
        reportItems = Array.isArray(report?.items) ? report.items : [];
        reportSupplierTotal = Number(report?.totalSupplierCost) || reportSupplierTotal;
      }
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
  }, [claimId, reportId, supplierCostHint]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hak, ctx, pay, exp] = await Promise.allSettled([
        axios.get(`${API}/vendor-statements`, {
          headers: authHeader(),
          params: { claimFileId: claimId, limit: 50 },
        }),
        axios.get(`${API}/claim-files/${claimId}/budget-supplier-context`, { headers: authHeader() }),
        axios.get(`${API}/payments`, {
          headers: authHeader(),
          params: { claimFileId: claimId, paymentType: 'outgoing', payerType: 'vendor', limit: 200 },
        }),
        axios.get(`${API}/expenses`, {
          headers: authHeader(),
          params: { fileCaseId: claimId, limit: 200 },
        }),
      ]);
      setHakedis(hak.status === 'fulfilled' ? asList<StatementRow>(hak.value.data) : []);
      if (ctx.status === 'fulfilled') {
        const payload = unwrap(ctx.value.data) as {
          suppliers?: VendorCtx[];
          catalogWorkGroups?: Array<{ id: string }>;
        };
        const rows = (payload?.suppliers ?? []).filter((row) => row.id);
        const gercek = await Promise.all(rows.map(async (row) => {
          try {
            const res = await axios.get(`${API}/vendors/${row.id}`, { headers: authHeader() });
            const full = unwrap(res.data) as {
              vendorWorkGroups?: Array<{ workGroup?: { id?: string; name?: string } }>;
            };
            const workGroups = (full.vendorWorkGroups ?? [])
              .map((item) => item.workGroup)
              .filter((g): g is { id: string; name: string } => Boolean(g?.id && g.name));
            return { ...row, workGroups };
          } catch {
            return { ...row, workGroups: [] as Array<{ id: string; name: string }> };
          }
        }));
        setSuppliers(gercek);
        setCatalogWorkGroupIds([]);
        setVendor((cur) => {
          const keep = cur?.id ? gercek.find((row) => row.id === cur.id) : null;
          const row = keep ?? gercek[0];
          return row?.id ? {
            id: row.id,
            name: row.name,
            paymentDueDays: row.paymentDueDays ?? null,
            workGroups: row.workGroups,
          } : null;
        });
      }
      const payRows = pay.status === 'fulfilled' ? asList<PaymentRow>(pay.value.data) : [];
      setPayments(payRows);
      setExpenses(exp.status === 'fulfilled' ? asList(exp.value.data) : []);
      const adaylar: Array<{ id: string; name: string }> = [];
      const seen = new Set<string>();
      const pushAday = (id?: string | null, name?: string | null) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        adaylar.push({ id, name: name || 'Tedarikçi' });
      };
      if (ctx.status === 'fulfilled') {
        const payload = unwrap(ctx.value.data) as { suppliers?: VendorCtx[] };
        for (const row of payload?.suppliers ?? []) pushAday(row.id, row.name);
      }
      for (const row of payRows) pushAday(row.payerId, row.vendorName);
      const hareketler = (await Promise.all(adaylar.map(async (row) => {
        try {
          const res = await axios.get(`${API}/payments`, {
            headers: authHeader(),
            params: { paymentType: 'outgoing', payerType: 'vendor', payerId: row.id, limit: 200 },
          });
          return asList<PaymentRow>(res.data);
        } catch {
          return [] as PaymentRow[];
        }
      }))).flat();
      const byId = new Map<string, PaymentRow>();
      for (const row of hareketler) byId.set(row.id, row);
      setTedarikciHareketleri([...byId.values()].filter((row) => row.claimFileId && row.claimFileId !== claimId));
      try {
        await hydrateGrantSource();
      } catch {
        /* Liste boş kalır; çekmece tekrar dener. */
      }
    } catch {
      setHakedis([]);
      setTedarikciHareketleri([]);
    } finally {
      setLoading(false);
    }
  }, [claimId, hydrateGrantSource]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeComposer = () => {
    setComposer('none');
    setAvansDraft('');
    setAvansAciklama('');
    setAvansTarih(todayIso());
    setOpenGroupKey(null);
  };

  const closePanel = () => {
    setDrawerOpen(false);
    setOpening(false);
    setSaving(false);
    setOpenGroupKey(null);
    setAvansDraft('');
    setAvansAciklama('');
    setAvansTarih(todayIso());
    setSozlesmeCevap(null);
    setSozlesmeYokNeden('');
    setDosyaSozlesmeleri([]);
    setTalepDraft('');
    setAciklama('');
    setFilter('avans');
    setComposer('none');
    setSelectedId(null);
    setDetail(null);
    setTutarDuzenle(false);
    setSecilenHakedisKey(null);
  };

  const goToPayments = () => {
    setDrawerOpen(false);
    router.push(`/panel/finans/tahsilatlar?queue=payable&claimFileId=${claimId}`);
  };

  const openGrant = async (baslangic?: 'avans' | 'hakedis', satir?: HasarHakedisSecimSatiri) => {
    setDrawerOpen(true);
    setOpening(true);
    setFilter(baslangic ?? 'avans');
    setComposer(baslangic ?? 'none');
    setSelectedId(null);
    setDetail(null);
    setSecilenHakedisKey(satir?.key ?? null);
    if (satir) {
      setVendor({
        id: satir.vendorId,
        name: satir.vendorName,
        paymentDueDays: satir.paymentDueDays,
        workGroups: suppliers.find((item) => item.id === satir.vendorId)?.workGroups,
      });
      setAciklama(satir.workGroupLabel);
    }
    try {
      await hydrateGrantSource();
    } catch {
      showToast('error', 'Dosya verisi tam gelmedi. Kayıtlı hareketler duruyor.');
    } finally {
      setOpening(false);
    }
  };

  const openDetail = async (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
    setComposer('none');
    if (selectedId === id) {
      setDetail(null);
      return;
    }
    try {
      const res = await axios.get(`${API}/vendor-statements/${id}`, { headers: authHeader() });
      setDetail(unwrap(res.data) as StatementDetail);
    } catch {
      const row = hakedis.find((item) => item.id === id) ?? null;
      setDetail(row);
    }
  };

  const secimSatirlari = useMemo(
    () => buildHasarHakedisSecimSatirlari({
      lines: lines.map((line) => ({
        key: line.key,
        workGroupId: line.workGroupId,
        label: line.label,
        amount: parseTrAmountInput(line.amount) ?? 0,
        details: line.details,
      })),
      suppliers,
      catalogWorkGroupIds,
    }),
    [lines, suppliers, catalogWorkGroupIds],
  );
  const hakedisSayfaSatirlari = useMemo(
    () => [...secimSatirlari, ...ORNEK_HAKEDIS_TEDARIKCILERI],
    [secimSatirlari],
  );
  const hakedisGonderildiVendorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of hakedis) {
      const id = row.vendor?.id;
      if (id && String(row.status ?? '').toLowerCase() !== 'cancelled') ids.add(id);
    }
    for (const row of payments) {
      if (!row.payerId) continue;
      if (isAvansPayment(row) || isHakedisMahsupPayment(row)) continue;
      ids.add(row.payerId);
    }
    return Array.from(ids);
  }, [hakedis, payments]);
  const secilenSatir = secimSatirlari.find((row) => row.key === secilenHakedisKey) ?? null;

  const satirPasif = (row: HasarHakedisSecimSatiri) => isHasarHakedisSatiriPasif({
    vendorId: row.vendorId,
    workGroupId: row.workGroupId,
    kalanHakedis: hasarHakedisKalan(row.amount, vendorAvans(row.vendorId), vendorVerilenHakedis(row.vendorId)),
    statements: hakedis.map((item) => ({
      vendorId: item.vendor?.id,
      vendor: item.vendor,
      status: item.status,
    })),
    hakedisGonderildiVendorIds,
  });

  const selectHakedisSatiri = (row: HasarHakedisSecimSatiri) => {
    if (satirPasif(row)) return;
    const supplier = suppliers.find((item) => item.id === row.vendorId);
    setVendor({
      id: row.vendorId,
      name: row.vendorName,
      paymentDueDays: row.paymentDueDays ?? supplier?.paymentDueDays ?? null,
      workGroups: supplier?.workGroups,
    });
    setSecilenHakedisKey(row.key);
    setComposer('hakedis');
    setSelectedId(null);
    setDetail(null);
    setAciklama(row.workGroupLabel);
  };

  const vendorAvans = (vendorId: string) => {
    const ornek = ornekHakedisAvans(vendorId);
    if (ornek != null) return ornek;
    const rows = payments.filter((row) => row.payerId === vendorId && isAvansPayment(row));
    if (rows.length > 0) {
      return Math.round(rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) * 100) / 100;
    }
    if (suppliers.length === 1 && suppliers[0]?.id === vendorId) return avansHesap.avansToplam;
    return 0;
  };

  const vendorVerilenHakedis = (vendorId: string) => {
    let fromStatements = 0;
    for (const row of hakedis) {
      if (row.vendor?.id !== vendorId) continue;
      if (String(row.status ?? '').toLowerCase() === 'cancelled') continue;
      fromStatements += Number(row.totalAmount ?? 0);
    }
    if (fromStatements > 0) return Math.round(fromStatements * 100) / 100;
    let fromPayments = 0;
    for (const row of payments) {
      if (row.payerId !== vendorId) continue;
      if (isAvansPayment(row) || isHakedisMahsupPayment(row)) continue;
      fromPayments += Number(row.amount ?? 0);
    }
    return Math.round(fromPayments * 100) / 100;
  };

  const talepBrut = secilenSatir
    ? hasarHakedisKalan(
      secilenSatir.amount,
      vendorAvans(secilenSatir.vendorId),
      vendorVerilenHakedis(secilenSatir.vendorId),
    )
    : 0;
  const onayliToplam = hakedis.reduce((s, row) => s + Number(row.totalAmount ?? 0), 0);
  buildHasarHakedisOzet({
    sozlesmeTutari: sozlesme,
    sozlesmeKaynak,
    onayliHakedisToplam: onayliToplam,
    buTalepBrut: composer === 'hakedis' && secilenSatir ? talepBrut : null,
    onerilenTutar: onerilen,
    onerilenKaynak,
    avansToplam: avansHesap.avansToplam,
    oncekiMahsupToplam: avansHesap.alreadyMahsup,
  });
  const avansLimit = resolveHasarAvansLimit(sozlesme);
  const kalanAvansHakki = avansLimit == null
    ? null
    : Math.round(Math.max(0, avansLimit - avansHesap.avansToplam) * 100) / 100;
  const verilenToplam = vendor?.id
    ? vendorVerilenHakedis(vendor.id)
    : onayliToplam;
  const kullanilanTutar = Math.round((Math.max(onayliToplam, verilenToplam) + avansHesap.avansToplam) * 100) / 100;
  const kalanTutar = sozlesme != null
    ? Math.round((sozlesme - kullanilanTutar) * 100) / 100
    : null;
  const avansTutarDraft = parseTrAmountInput(avansDraft) ?? 0;
  const avansLimitAsim = kalanAvansHakki != null && avansTutarDraft > kalanAvansHakki + 0.009;
  const avansButceAsim = sozlesme != null && avansTutarDraft > 0
    && (kullanilanTutar + avansTutarDraft) > sozlesme + 0.009;
  const hakedisButceAsim = sozlesme != null && talepBrut > 0
    && (onayliToplam + talepBrut) > sozlesme + 0.009;
  const sozlesmeHazir = sozlesmeCevap === 'var'
    ? true
    : sozlesmeCevap === 'yok'
      ? Boolean(sozlesmeYokNeden.trim())
      : false;

  const cagirDosyaSozlesmesi = async () => {
    setSozlesmeCevap('var');
    setSozlesmeYukleniyor(true);
    try {
      const res = await axios.get(`${API}/vendor-contracts`, {
        headers: authHeader(),
        params: { claimFileId: claimId },
      });
      const rows = asList<DosyaSozlesme>(res.data).filter((row) => row.status !== 'cancelled');
      const vendorRows = vendor?.id
        ? rows.filter((row) => row.vendor?.id === vendor.id)
        : rows;
      setDosyaSozlesmeleri(vendorRows.length > 0 ? vendorRows : rows);
    } catch (e) {
      setDosyaSozlesmeleri([]);
      showToast('error', axiosErrorMessage(e, 'Sözleşme yüklenemedi.'));
    } finally {
      setSozlesmeYukleniyor(false);
    }
  };
  const statementOdeme = (row: StatementRow) => {
    const no = String(row.statementNo ?? '');
    return payments.find((pay) =>
      !isAvansPayment(pay)
      && (String(pay.note ?? '').includes(no) || String(pay.referenceNo ?? '').includes(no)),
    );
  };

  const dosyaOdemeleri = useMemo<DosyaOdeme[]>(() => {
    const grantLabels = lines.map((line) => line.label);
    const statementLabelsOf = (vendorId?: string | null) => hakedis
      .filter((item) => (item.vendor?.id ?? null) === (vendorId ?? null))
      .flatMap((item) => (item.items ?? []).map((line) => line.lineDescription || line.workGroup?.name));
    const odemeKaynak = [...payments, ...tedarikciHareketleri];
    const gorulen = new Set<string>();
    const odeme = odemeKaynak
      .filter((row) => !isHakedisMahsupPayment(row) && !gorulen.has(row.id) && (gorulen.add(row.id), true))
      .map((row) => {
        const supplier = suppliers.find((item) => item.id === row.payerId);
        const odenmis = row.status === 'completed';
        const talep = row.vendorStatementItem?.statement?.createdAt
          ?? row.vendorStatementItem?.statement?.sentAt
          ?? row.createdAt
          ?? (!odenmis ? (row.paymentDate ?? row.dueDate) : undefined);
        const satirDosyaId = row.claimFileId ?? (row.claimFile?.id ?? null);
        return {
          id: row.id,
          odemeTarihi: odenmis ? (row.paymentDate ?? row.dueDate) : undefined,
          talepTarihi: talep,
          tur: isAvansPayment(row) ? 'Avans' as const : 'Hakediş' as const,
          tutar: Number(row.amount ?? 0),
          durum: odenmis ? 'Ödendi' : row.status === 'pending' ? 'Bekliyor' : (row.status || '—'),
          vendorId: row.payerId,
          vendorName: dosyaOdemeTedarikciAdi({
            vendorName: row.vendorName,
            supplierName: supplier?.name,
            fallbackName: vendor?.name,
          }),
          workGroupLabel: dosyaOdemeIsGrubu({
            lineDescription: row.vendorStatementItem?.lineDescription,
            supplierWorkGroups: supplier?.workGroups,
            grantLabels,
            statementLabels: statementLabelsOf(row.payerId),
          }),
          fileId: satirDosyaId,
          fileNo: row.claimFile?.fileNo || (satirDosyaId === claimId ? fileNo : null),
          note: row.note ?? undefined,
        };
      });
    const masraf = expenses.map((row) => {
      const supplier = suppliers.find((item) => item.id === row.vendorId);
      return {
        id: row.id,
        odemeTarihi: row.date ?? row.createdAt,
        talepTarihi: undefined,
        tur: 'Masraf' as const,
        tutar: Number(row.amount ?? 0),
        durum: row.status === 'approved' || row.status === 'completed' ? 'Onaylandı' : row.status === 'pending' ? 'Bekliyor' : (row.status || '—'),
        vendorId: row.vendorId,
        vendorName: dosyaOdemeTedarikciAdi({
          vendorName: row.vendorName,
          supplierName: supplier?.name,
        }),
        workGroupLabel: dosyaOdemeIsGrubu({
          workGroupName: row.workGroup?.name ?? row.workGroupName,
          supplierWorkGroups: supplier?.workGroups,
          grantLabels,
        }),
        fileId: claimId,
        fileNo,
        note: row.description,
      };
    });
    return [...odeme, ...masraf].sort((a, b) => new Date(b.talepTarihi ?? b.odemeTarihi ?? 0).getTime() - new Date(a.talepTarihi ?? a.odemeTarihi ?? 0).getTime());
  }, [payments, tedarikciHareketleri, expenses, suppliers, vendor?.name, lines, hakedis, claimId, fileNo]);

  const submitAvans = async () => {
    if (!vendor?.id) {
      showToast('error', 'Önce dosyaya tedarikçi atayın.');
      return;
    }
    if (!sozlesmeCevap) {
      showToast('error', 'Dosyada sözleşme var mı sorun.');
      return;
    }
    if (!sozlesmeHazir) {
      showToast('error', 'Sözleşme yoksa açıklayınız.');
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
    const talepTarihi = normalizeTrDateValue(avansTarih);
    if (!talepTarihi) {
      showToast('error', 'Avans talep tarihi girin.');
      return;
    }
    if (sozlesme != null && (kullanilanTutar + amount) > sozlesme + 0.009) {
      showToast('error', 'Bu tutar bütçeyi aşıyor. Avans onaylanmaz.');
      return;
    }
    if (kalanAvansHakki != null && amount > kalanAvansHakki + 0.009) {
      showToast('error', 'Avans limiti aşıyor. Bu tutar onaylanmaz.');
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
          paymentDate: talepTarihi,
          referenceNo: AVANS_REF_PREFIX,
          note: withAvansNote(
            sozlesmeCevap === 'yok'
              ? `${aciklamaTrim} · Sözleşme yok: ${sozlesmeYokNeden.trim()}`
              : aciklamaTrim,
          ),
        },
        { headers: authHeader() },
      );
      showToast('success', 'Avans kaydedildi.');
      closeComposer();
      void load();
    } catch (e) {
      showToast('error', axiosErrorMessage(e, 'Avans kaydedilemedi.'));
    } finally {
      setSavingAvans(false);
    }
  };

  const submitGrant = async (hedef?: HasarHakedisSecimSatiri) => {
    const satir = hedef ?? secilenSatir;
    if (!satir) {
      showToast('error', 'Hakediş verilecek tedarikçiyi seçin.');
      return;
    }
    if (isOrnekHakedisSatiri(satir)) {
      showToast('error', 'Örnek tedarikçi finansa gönderilmez.');
      return;
    }
    if (satirPasif(satir)) {
      showToast('error', 'Bu tedarikçiye hakediş verildi.');
      return;
    }
    const kalan = hasarHakedisKalan(
      satir.amount,
      vendorAvans(satir.vendorId),
      vendorVerilenHakedis(satir.vendorId),
    );
    if (kalan <= 0) {
      showToast('error', 'Kalan hakediş yok.');
      return;
    }
    selectHakedisSatiri(satir);
    const vade = satir.paymentDueDays === 15 || satir.paymentDueDays === 30
      ? satir.paymentDueDays
      : dueDays;
    if (!vade) {
      showToast('error', `${satir.vendorName} kartında 15 veya 30 gün vade seçili değil.`);
      return;
    }
    if (!sozlesmeCevap) {
      showToast('error', 'Dosyada sözleşme var mı sorun.');
      return;
    }
    if (!sozlesmeHazir) {
      showToast('error', 'Sözleşme yoksa açıklayınız.');
      return;
    }
    if (hakedisButceAsim) {
      showToast('error', 'Bu tutar bütçeyi aşıyor. Hakediş onaylanmaz.');
      return;
    }
    const items = [{
      lineDescription: satir.workGroupLabel,
      workGroupId: satir.workGroupId,
      totalAmount: kalan,
    }].filter((item) => item.totalAmount > 0);
    if (items.length === 0) {
      showToast('error', 'Talep tutarı eksik.');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/vendor-statements/grant-hakedis`,
        {
          claimFileId: claimId,
          vendorId: satir.vendorId,
          items,
        },
        { headers: authHeader() },
      );
      showToast('success', 'Finansa aktarıldı.');
      closePanel();
      router.push(`/panel/finans/tahsilatlar?queue=payable&claimFileId=${claimId}`);
    } catch (e) {
      showToast('error', axiosErrorMessage(e, 'Hakediş verilemedi.'));
    } finally {
      setSaving(false);
    }
  };

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
          <button type="button" onClick={closePanel} aria-label="Paneli kapat" className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]" />
          <section className="relative flex h-full w-full max-w-[460px] flex-col rounded-l-xl bg-white shadow-2xl">
            <header className="shrink-0 px-4 pt-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-medium leading-none text-slate-900">
                    {composer === 'none' ? 'Hakediş Yönetimi' : composer === 'avans' ? 'Avans Talebi' : 'Hakediş'}
                  </h2>
                  {composer !== 'none' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setComposer('none');
                        setSecilenHakedisKey(null);
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-blue-700 hover:underline"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                      Geri
                    </button>
                  ) : null}
                  <p className="mt-1.5 truncate text-[13px] font-normal text-slate-600">
                    {vendor?.name || 'Tedarikçi atanmamış'}
                    {fileNo ? ` · ${fileNo}` : ''}
                  </p>
                  {dueDays ? (
                    <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                      {dueDays} gün vade
                    </span>
                  ) : (
                    <p className="mt-2 text-[11px] font-normal text-amber-800">Tedarikçi kartında 15 veya 30 gün vade gerekir.</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={goToPayments}
                    className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-blue-700 hover:bg-blue-50"
                  >
                    Ödemeleri gör
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50"
                    aria-label="Kapat"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <BudgetStrip sozlesme={sozlesme} kullanilan={kullanilanTutar} kalan={kalanTutar} />
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {composer === 'none' ? (
                  <div data-testid="hasar-hakedis-sekme" className="space-y-3" role="group" aria-label="İşlem seçimi">
                    <div
                      data-testid="hasar-hakedis-tedarikci-sayisi"
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <Banknote className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-medium text-slate-500">Ödenen Avans Toplamı</span>
                        <span className="mt-0.5 block text-[15px] font-semibold tabular-nums text-slate-900">
                          {fmt(avansHesap.avansToplam)}
                        </span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {SAYFA_SECIM.map((secim) => {
                        const Icon = secim.Icon;
                        return (
                          <button
                            key={secim.id}
                            type="button"
                            data-testid="hasar-hakedis-islem-kart"
                            onClick={() => {
                              setFilter(secim.id);
                              setComposer(secim.id);
                              setSelectedId(null);
                              setDetail(null);
                              if (secim.id !== 'hakedis') setSecilenHakedisKey(null);
                            }}
                            className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left hover:border-blue-600 hover:bg-blue-50"
                          >
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                              <Icon className="h-5 w-5" strokeWidth={1.75} />
                            </span>
                            <span className="text-[13px] font-medium text-slate-800">{secim.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {composer === 'avans' ? (
                  <div id="yeni-avans" className="space-y-3">
                    <div className="rounded-xl border border-slate-200 px-3 py-3">
                      <p className="text-[13px] font-medium text-slate-800">Yeni Avans Talebi</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-[11px] font-medium text-slate-500">
                            Talep tarihi <span className="text-red-500">*</span>
                          </span>
                          <TrDateInput
                            value={avansTarih}
                            onChange={setAvansTarih}
                            aria-label="Avans talep tarihi"
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-normal outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-medium text-slate-500">
                            Tutar <span className="text-red-500">*</span>
                          </span>
                          <TrAmountInput
                            id="hasar-avans-tutar"
                            autoFocus
                            value={avansDraft}
                            placeholder="0"
                            onChange={setAvansDraft}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-9 text-right text-[13px] font-medium tabular-nums outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </label>
                      </div>
                      <label className="mt-3 block">
                        <span className="text-[11px] font-medium text-slate-500">
                          Açıklama <span className="text-red-500">*</span>
                        </span>
                        <textarea
                          value={avansAciklama}
                          onChange={(e) => setAvansAciklama(e.target.value)}
                          rows={3}
                          required
                          placeholder="Avans talebinin nedenini açıklayın"
                          className="mt-1 min-h-[72px] w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] font-normal outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </label>
                      {avansButceAsim ? (
                        <p className="mt-1.5 text-[12px] font-normal text-red-700">Bu tutar bütçeyi aşıyor.</p>
                      ) : avansLimitAsim ? (
                        <p className="mt-1.5 text-[12px] font-normal text-red-700">Avans limiti aşıyor.</p>
                      ) : null}
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          disabled={savingAvans}
                          onClick={() => void submitAvans()}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                        >
                          {savingAvans ? 'Gönderiliyor…' : 'Finans Onayına Gönder'}
                        </button>
                      </div>
                    </div>
                    <SozlesmeSoru
                      cevap={sozlesmeCevap}
                      yokNeden={sozlesmeYokNeden}
                      kayitlar={dosyaSozlesmeleri}
                      yukleniyor={sozlesmeYukleniyor}
                      vendorName={vendor?.name}
                      onVar={() => void cagirDosyaSozlesmesi()}
                      onYok={() => {
                        setSozlesmeCevap('yok');
                        setDosyaSozlesmeleri([]);
                      }}
                      onYokNeden={setSozlesmeYokNeden}
                      onPdfHata={(e) => showToast('error', axiosErrorMessage(e, 'Sözleşme açılamadı.'))}
                    />
                  </div>
                ) : null}

                {composer === 'hakedis' ? (
                  <div className="space-y-3">
                    <div data-testid="hasar-hakedis-is-grubu" className="space-y-2">
                      <span className="sr-only">{HAKEDIS_KAYNAK_ETIKET[onerilenKaynak]}</span>
                      <HakedisTedarikciKartlari
                        rows={hakedisSayfaSatirlari}
                        emptySuppliers={suppliers.length === 0 && hakedisSayfaSatirlari.length === 0}
                        pasif={satirPasif}
                        avansOf={vendorAvans}
                        verilenOf={vendorVerilenHakedis}
                        saving={saving}
                        sendingKey={secilenHakedisKey}
                        onGonder={(row) => void submitGrant(row)}
                      />
                    </div>
                    {secimSatirlari.some((row) => !satirPasif(row)) ? (
                      <SozlesmeSoru
                        cevap={sozlesmeCevap}
                        yokNeden={sozlesmeYokNeden}
                        kayitlar={dosyaSozlesmeleri}
                        yukleniyor={sozlesmeYukleniyor}
                        vendorName={vendor?.name}
                        onVar={() => void cagirDosyaSozlesmesi()}
                        onYok={() => {
                          setSozlesmeCevap('yok');
                          setDosyaSozlesmeleri([]);
                        }}
                        onYokNeden={setSozlesmeYokNeden}
                        onPdfHata={(e) => showToast('error', axiosErrorMessage(e, 'Sözleşme açılamadı.'))}
                      />
                    ) : null}
                    {hakedis.length > 0 ? (
                      <div>
                        <p className="text-[13px] font-medium text-slate-800">Verilen hakedişler</p>
                        <ul className="mt-2 space-y-2" data-testid="hakedis-ozet-kartlar">
                          {hakedis.map((row) => {
                            const odeme = statementOdeme(row);
                            const durum = hakedisDurumEtiket({ status: row.status, odemeDurumu: odeme?.status });
                            const kirilim = hakedisTutarKirilim(row);
                            const open = Boolean(selectedId === row.id && aktifDetay);
                            return (
                              <li key={row.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
                                <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => void openDetail(row.id)}>
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-medium text-slate-800">{row.statementNo ?? 'Hakediş'}</p>
                                    <p className="mt-0.5 text-[11px] font-normal text-slate-400">
                                      {fmtDate(row.createdAt ?? row.periodStart)}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-[13px] font-medium tabular-nums text-slate-900">{fmt(kirilim.toplam)}</p>
                                    <div className="mt-1 flex justify-end"><StatusPill label={durum} /></div>
                                  </div>
                                </button>
                                {open && aktifDetay ? (
                                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                                      <div><p className="text-[11px] text-slate-400">Hakediş Tutarı</p><p className="font-medium tabular-nums">{detayKirilim ? fmt(detayKirilim.net) : '—'}</p></div>
                                      <div><p className="text-[11px] text-slate-400">KDV</p><p className="font-medium tabular-nums">{detayKirilim ? fmt(detayKirilim.kdv) : '—'}</p></div>
                                      <div><p className="text-[11px] text-slate-400">Toplam Tutar</p><p className="font-medium tabular-nums">{detayKirilim ? fmt(detayKirilim.toplam) : '—'}</p></div>
                                      <div><p className="text-[11px] text-slate-400">Avans Mahsubu</p><p className="font-medium tabular-nums">{fmt(hakedisKesintiNet(aktifDetay).kesintiler)}</p></div>
                                      <div><p className="text-[11px] text-slate-400">Ödenecek Net</p><p className="font-medium tabular-nums">{fmt(hakedisKesintiNet(aktifDetay).netTutar)}</p></div>
                                      <div><p className="text-[11px] text-slate-400">Onay Tarihi</p><p className="font-medium">{fmtDate(aktifDetay.autoApprovedAt)}</p></div>
                                    </div>
                                    {aktifDetay.notes ? (
                                      <p className="text-[12px] font-normal leading-snug text-slate-600">{aktifDetay.notes}</p>
                                    ) : null}
                                    <CircleStepper steps={detayAkis} />
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

            </div>

            <footer className="sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-2.5">
                <button
                  type="button"
                  onClick={goToPayments}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-blue-700 hover:bg-blue-50"
                >
                  Ödemeleri gör
                </button>
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Kapat
                </button>
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
          <div data-testid="hasar-hakedis-sayfa-listesi">
            <p className="text-[12px] font-medium text-slate-700">Tedarikçi Ödemeleri Ve Avansları</p>
            <span className="sr-only">{ODEME_SECIM.label}</span>
            {loading ? (
              <p className="py-3 text-[13px] text-slate-400">Yükleniyor...</p>
            ) : (
              <PaymentDokum rows={dosyaOdemeleri} fileNo={fileNo} claimId={claimId} />
            )}
          </div>
        </FinansPanelCard>
      </div>
      {drawer}
    </>
  );
}

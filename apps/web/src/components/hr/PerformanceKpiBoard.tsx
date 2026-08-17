'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { formatTryAmount } from '@/utils/format-try-amount';

export type KpiDetailKind = 'written' | 'approved' | 'revenue' | 'profit';
export type PeriodMode = 'week' | 'month' | 'year' | 'custom';

type StaffOption = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleLabel: string;
};

type ReportRow = {
  reportId: string;
  reportNo: string;
  claimFileId: string;
  fileNo: string;
  status: string;
  statusLabel: string;
  salesAmount: number;
  supplierCost: number;
  profitAmount: number;
  reportDate: string | null;
  createdAt: string;
  authorName: string;
  isApproved: boolean;
};

type KpiPayload = {
  scope: 'all' | 'user';
  userId: string | null;
  userName: string | null;
  roleLabel: string | null;
  period?: string;
  periodLabel: string;
  kpis: {
    reportsWritten: number;
    reportsApproved: number;
    revenue: number;
    profit: number;
  };
  staffOptions: StaffOption[];
  details?: {
    kind: KpiDetailKind;
    title: string;
    rows: ReportRow[];
  };
};

type Props = {
  preview?: boolean;
};

const PREVIEW_STAFF: StaffOption[] = [
  {
    userId: 'preview-asli',
    firstName: 'Aslı',
    lastName: 'Güngör',
    email: 'asli@example.com',
    roleLabel: 'Dosya Sorumlusu',
  },
  {
    userId: 'preview-ayse',
    firstName: 'Ayşe',
    lastName: 'Demir',
    email: 'ayse@example.com',
    roleLabel: 'Dosya Sorumlusu',
  },
];

function withSupplier(row: Omit<ReportRow, 'supplierCost'> & { supplierCost?: number }): ReportRow {
  return {
    ...row,
    supplierCost:
      row.supplierCost ??
      Math.max(0, Number(row.salesAmount || 0) - Number(row.profitAmount || 0)),
  };
}

const PREVIEW_ROWS_ASLI: ReportRow[] = [
  withSupplier({
    reportId: 'r1',
    reportNo: 'OR-2026-0142',
    claimFileId: 'c1',
    fileNo: 'HSR-2026-0142',
    status: 'approved',
    statusLabel: 'Onaylandı',
    salesAmount: 48500,
    profitAmount: 12200,
    reportDate: '2026-07-12T00:00:00.000Z',
    createdAt: '2026-07-12T10:00:00.000Z',
    authorName: 'Aslı Güngör',
    isApproved: true,
  }),
  withSupplier({
    reportId: 'r2',
    reportNo: 'OR-2026-0155',
    claimFileId: 'c2',
    fileNo: 'HSR-2026-0155',
    status: 'approved',
    statusLabel: 'Onaylandı',
    salesAmount: 31200,
    profitAmount: 8400,
    reportDate: '2026-07-28T00:00:00.000Z',
    createdAt: '2026-07-28T14:00:00.000Z',
    authorName: 'Aslı Güngör',
    isApproved: true,
  }),
  withSupplier({
    reportId: 'r3',
    reportNo: 'OR-2026-0168',
    claimFileId: 'c3',
    fileNo: 'ACL-2026-0088',
    status: 'draft',
    statusLabel: 'Taslak',
    salesAmount: 0,
    profitAmount: 0,
    reportDate: '2026-08-02T00:00:00.000Z',
    createdAt: '2026-08-02T09:00:00.000Z',
    authorName: 'Aslı Güngör',
    isApproved: false,
  }),
  withSupplier({
    reportId: 'r4',
    reportNo: 'OR-2026-0171',
    claimFileId: 'c4',
    fileNo: 'HSR-2026-0201',
    status: 'pending_approval',
    statusLabel: 'Onay Bekliyor',
    salesAmount: 18750,
    profitAmount: 4100,
    reportDate: '2026-08-04T00:00:00.000Z',
    createdAt: '2026-08-04T11:00:00.000Z',
    authorName: 'Aslı Güngör',
    isApproved: false,
  }),
];

function periodLabelFor(mode: PeriodMode, dateFrom: string, dateTo: string): string {
  const now = new Date();
  if (mode === 'week') return 'Son 7 Gün';
  if (mode === 'month') {
    const label = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toLocaleUpperCase('tr-TR') + label.slice(1);
  }
  if (mode === 'custom' && dateFrom && dateTo) return `${dateFrom} – ${dateTo}`;
  return `${now.getFullYear()} Yılı`;
}

function inPeriod(iso: string, mode: PeriodMode, dateFrom: string, dateTo: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  let from: Date;
  let to = new Date(now);
  to.setHours(23, 59, 59, 999);
  if (mode === 'week') {
    from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  } else if (mode === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (mode === 'custom' && dateFrom && dateTo) {
    from = new Date(`${dateFrom}T00:00:00`);
    to = new Date(`${dateTo}T23:59:59.999`);
  } else {
    from = new Date(now.getFullYear(), 0, 1);
  }
  return d >= from && d <= to;
}

function buildPreview(
  userId: string | null,
  detail: KpiDetailKind | undefined,
  period: PeriodMode,
  dateFrom: string,
  dateTo: string,
): KpiPayload {
  const allRows = [
    ...PREVIEW_ROWS_ASLI,
    withSupplier({
      reportId: 'r5',
      reportNo: 'OR-2026-0101',
      claimFileId: 'c5',
      fileNo: 'HSR-2026-0101',
      status: 'approved',
      statusLabel: 'Onaylandı',
      salesAmount: 22000,
      profitAmount: 5500,
      reportDate: '2026-06-10T00:00:00.000Z',
      createdAt: '2026-06-10T10:00:00.000Z',
      authorName: 'Ayşe Demir',
      isApproved: true,
    }),
  ].filter((r) => inPeriod(r.createdAt, period, dateFrom, dateTo));

  const rows =
    userId === 'preview-asli'
      ? allRows.filter((r) => r.authorName === 'Aslı Güngör')
      : userId === 'preview-ayse'
        ? allRows.filter((r) => r.authorName === 'Ayşe Demir')
        : allRows;
  const approved = rows.filter((r) => r.isApproved);
  const selected = PREVIEW_STAFF.find((s) => s.userId === userId) ?? null;
  const kpis = {
    reportsWritten: rows.length,
    reportsApproved: approved.length,
    revenue: approved.reduce((s, r) => s + r.salesAmount, 0),
    profit: approved.reduce((s, r) => s + r.profitAmount, 0),
  };
  let details: KpiPayload['details'];
  if (detail === 'written') details = { kind: detail, title: 'Yazılan Raporlar', rows };
  if (detail === 'approved') details = { kind: detail, title: 'Onaylanan Raporlar', rows: approved };
  if (detail === 'revenue')
    details = {
      kind: detail,
      title: 'Ciro Detayı (Onaylı Raporlar)',
      rows: approved.filter((r) => r.salesAmount > 0),
    };
  if (detail === 'profit')
    details = {
      kind: detail,
      title: 'Kâr Detayı (Onaylı Raporlar)',
      rows: approved.filter((r) => r.profitAmount !== 0),
    };
  return {
    scope: userId ? 'user' : 'all',
    userId,
    userName: selected ? `${selected.firstName} ${selected.lastName}` : null,
    roleLabel: selected?.roleLabel ?? null,
    period,
    periodLabel: periodLabelFor(period, dateFrom, dateTo),
    kpis,
    staffOptions: PREVIEW_STAFF,
    details,
  };
}

function formatShortDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function reportDetailHref(row: ReportRow) {
  return `/panel/hasar-dosyalari/${row.claimFileId}/onarim-raporu/${row.reportId}`;
}

function supplierBudgetHref(row: ReportRow) {
  return `${reportDetailHref(row)}#dosya-butcesi`;
}

const PERIOD_OPTIONS: { value: PeriodMode; label: string }[] = [
  { value: 'week', label: 'Haftalık' },
  { value: 'month', label: 'Aylık' },
  { value: 'year', label: 'Yıllık' },
  { value: 'custom', label: 'Tarih Aralığı' },
];

export function PerformanceKpiBoard({ preview = false }: Props) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [period, setPeriod] = useState<PeriodMode>('year');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeDetail, setActiveDetail] = useState<KpiDetailKind | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [data, setData] = useState<KpiPayload | null>(
    preview ? buildPreview(null, undefined, 'year', '', '') : null,
  );
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');

  const load = useCallback(
    async (userId: string, detail: KpiDetailKind | null, p: PeriodMode, from: string, to: string) => {
      if (preview) {
        setData(buildPreview(userId || null, detail ?? undefined, p, from, to));
        setLoading(false);
        return;
      }
      if (p === 'custom' && (!from || !to)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const params: Record<string, string> = { period: p };
        if (userId) params.userId = userId;
        if (detail) params.detail = detail;
        if (p === 'custom') {
          params.dateFrom = from;
          params.dateTo = to;
        }
        const r = await axios.get(`${API}/task-assignments/performance-kpis`, {
          headers: authHeader(),
          params,
        });
        setData(r.data.data ?? r.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Performans verisi alınamadı');
      } finally {
        setLoading(false);
      }
    },
    [preview],
  );

  useEffect(() => {
    void load(selectedUserId, activeDetail, period, dateFrom, dateTo);
  }, [load, selectedUserId, activeDetail, period, dateFrom, dateTo]);

  const cards = useMemo(() => {
    const k = data?.kpis;
    return [
      {
        key: 'written' as const,
        label: 'Yazılan Rapor',
        hint: 'Personelin oluşturduğu raporlar',
        value: loading || !k ? '—' : String(k.reportsWritten),
        icon: FileText,
        iconClass: 'bg-brand-50 text-brand-600',
      },
      {
        key: 'approved' as const,
        label: 'Onaylanan Rapor',
        hint: 'Onaylanmış rapor adedi',
        value: loading || !k ? '—' : String(k.reportsApproved),
        icon: CheckCircle2,
        iconClass: 'bg-status-success/10 text-status-success',
      },
      {
        key: 'revenue' as const,
        label: 'Ciro',
        hint: 'Onaylı rapor satış toplamı',
        value: loading || !k ? '—' : formatTryAmount(k.revenue, { fractionDigits: 0 }),
        icon: Wallet,
        iconClass: 'bg-slate-100 text-content-secondary',
      },
      {
        key: 'profit' as const,
        label: 'Kâr',
        hint: 'Onaylı rapor brüt kâr',
        value: loading || !k ? '—' : formatTryAmount(k.profit, { fractionDigits: 0 }),
        icon: TrendingUp,
        iconClass: 'bg-status-success/10 text-status-success',
      },
    ];
  }, [data, loading]);

  const detailRows = data?.details?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm font-semibold text-content-primary">Performans Özeti</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-content-tertiary">Personel</label>
            <select
              className="min-w-[200px] rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-content-primary"
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setActiveDetail(null);
                setSelectedReport(null);
              }}
            >
              <option value="">Tümü</option>
              {(data?.staffOptions ?? PREVIEW_STAFF).map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.firstName} {s.lastName} · {s.roleLabel}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-content-tertiary">Dönem</label>
            <div className="flex flex-wrap rounded-xl border border-border bg-white p-0.5">
              {PERIOD_OPTIONS.map((opt) => {
                const active = period === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setPeriod(opt.value);
                      setActiveDetail(null);
                      setSelectedReport(null);
                    }}
                    className={`rounded-[10px] px-3 py-2 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-brand-600 text-white'
                        : 'text-content-secondary hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          {period === 'custom' ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-content-tertiary">Başlangıç</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-content-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-content-tertiary">Bitiş</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-content-primary"
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

      {period === 'custom' && (!dateFrom || !dateTo) ? (
        <p className="text-xs text-content-tertiary">Analiz için başlangıç ve bitiş tarihi seçin.</p>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const active = activeDetail === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                setSelectedReport(null);
                setActiveDetail((prev) => (prev === card.key ? null : card.key));
              }}
              className={`rounded-xl border bg-white px-4 pb-4 pt-3 text-left transition-colors ${
                active
                  ? 'border-brand-600 ring-2 ring-brand-600/30'
                  : 'border-border hover:border-brand-200 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-content-tertiary">{card.label}</p>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconClass}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
              </div>
              <p className="mt-2 text-xl font-bold tracking-tight text-content-primary tabular-nums sm:text-2xl">
                {card.value}
              </p>
              <p className="mt-1 text-[11px] text-content-tertiary">{card.hint}</p>
              <p className="mt-2 text-[11px] font-semibold text-brand-600">
                {active ? 'Detayı Kapat' : 'Rapor Detayına Git →'}
              </p>
            </button>
          );
        })}
      </div>

      {activeDetail && data?.details ? (
        <div className="rounded-2xl border border-border bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 bg-slate-50/70">
            <div>
              <p className="text-sm font-semibold text-content-primary">{data.details.title}</p>
              <p className="text-xs text-content-tertiary mt-0.5">
                {data.periodLabel} · {detailRows.length} kayıt
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveDetail(null);
                setSelectedReport(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-content-secondary hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Kapat
            </button>
          </div>

          {detailRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-content-tertiary">
              Bu görünümde kayıt yok.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-content-tertiary">
                    <th className="px-4 py-3 font-medium">Rapor No</th>
                    <th className="px-4 py-3 font-medium">Dosya No</th>
                    {!selectedUserId ? (
                      <th className="px-4 py-3 font-medium">Personel</th>
                    ) : null}
                    <th className="px-4 py-3 font-medium">Durum</th>
                    <th className="px-4 py-3 font-medium text-right">Dosya Bedeli</th>
                    <th className="px-4 py-3 font-medium text-right">Kâr</th>
                    <th className="px-4 py-3 font-medium">Tarih</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailRows.map((row) => (
                    <tr key={row.reportId} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium text-content-primary">{row.reportNo}</td>
                      <td className="px-4 py-3 text-content-secondary">{row.fileNo}</td>
                      {!selectedUserId ? (
                        <td className="px-4 py-3 text-content-secondary">{row.authorName || '—'}</td>
                      ) : null}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            row.isApproved
                              ? 'bg-status-success/10 text-status-success'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-content-primary">
                        {formatTryAmount(row.salesAmount, { fractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-content-primary">
                        {formatTryAmount(row.profitAmount, { fractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-content-tertiary">
                        {formatShortDate(row.reportDate ?? row.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedReport(row)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                        >
                          Detay
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {selectedReport ? (
        <>
          <button
            type="button"
            aria-label="Kapat"
            className="fixed inset-0 z-40 bg-slate-900/30"
            onClick={() => setSelectedReport(null)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-content-primary">Rapor Detayı</p>
                <p className="mt-0.5 truncate text-xs text-content-tertiary">
                  {selectedReport.reportNo} · {selectedReport.fileNo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="rounded-xl border border-border p-2 text-content-secondary hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <div className="rounded-xl border border-border bg-slate-50/70 px-4 py-3">
                <p className="text-xs text-content-tertiary">Durum</p>
                <p className="mt-1 text-sm font-semibold text-content-primary">
                  {selectedReport.statusLabel}
                </p>
                {!selectedUserId && selectedReport.authorName ? (
                  <p className="mt-1 text-xs text-content-secondary">{selectedReport.authorName}</p>
                ) : null}
              </div>

              {preview ? (
                <>
                  <div className="rounded-xl border border-border bg-white px-4 py-3">
                    <p className="text-xs font-medium text-content-tertiary">Dosya Bedeli</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-content-primary">
                      {formatTryAmount(selectedReport.salesAmount, { fractionDigits: 0 })}
                    </p>
                    <p className="mt-2 text-[11px] text-content-tertiary">
                      Önizleme — canlıda rapor detayına gider
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-white px-4 py-3">
                    <p className="text-xs font-medium text-content-tertiary">Tedarikçi Maliyeti</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-content-primary">
                      {formatTryAmount(selectedReport.supplierCost, { fractionDigits: 0 })}
                    </p>
                    <p className="mt-2 text-[11px] text-content-tertiary">
                      Önizleme — canlıda iş grubu bütçesine gider
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <a
                    href={reportDetailHref(selectedReport)}
                    className="block rounded-xl border border-border bg-white px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-content-tertiary">Dosya Bedeli</p>
                      <ChevronRight className="h-4 w-4 text-brand-600" />
                    </div>
                    <p className="mt-1 text-lg font-bold tabular-nums text-content-primary">
                      {formatTryAmount(selectedReport.salesAmount, { fractionDigits: 0 })}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-brand-600">Rapor Detayına Git →</p>
                  </a>
                  <a
                    href={supplierBudgetHref(selectedReport)}
                    className="block rounded-xl border border-border bg-white px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-content-tertiary">Tedarikçi Maliyeti</p>
                      <ChevronRight className="h-4 w-4 text-brand-600" />
                    </div>
                    <p className="mt-1 text-lg font-bold tabular-nums text-content-primary">
                      {formatTryAmount(selectedReport.supplierCost, { fractionDigits: 0 })}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-brand-600">
                      İş Grubu Bütçesine Git →
                    </p>
                  </a>
                </>
              )}

              <div className="rounded-xl border border-border bg-white px-4 py-3">
                <p className="text-xs font-medium text-content-tertiary">Kâr</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-content-primary">
                  {formatTryAmount(selectedReport.profitAmount, { fractionDigits: 0 })}
                </p>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

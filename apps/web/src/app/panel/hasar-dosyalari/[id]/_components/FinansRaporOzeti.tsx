'use client';

import Link from 'next/link';
import { resolveFileFinanceKpis } from '@sigorta/shared';
import {
  repairReportStatusLabel,
} from '@/utils/repair-report-status';
import { fmtCurrency } from './claim-detail-utils';

type FinansMetrik = {
  label: string;
  value: string;
  accent?: string;
  highlight?: boolean;
};

export type FinansOzetSummary = {
  totalCost?: number;
  actualCost?: number;
  totalRevenue?: number;
  actualRevenue?: number;
  totalCollected?: number;
  estimatedRevenue?: number;
  estimatedCost?: number;
};

export function FinansMetrikHucre({ metrik }: { metrik: FinansMetrik }) {
  return (
    <div
      className={`px-3 py-3 text-center border-b border-r border-slate-100 last:border-r-0 ${
        metrik.highlight ? 'bg-slate-50/80' : 'bg-white'
      }`}
    >
      <p className="text-[11px] font-medium text-slate-500 leading-none">{metrik.label}</p>
      <p
        className={`mt-1.5 text-base font-semibold tabular-nums tracking-tight leading-none ${
          metrik.accent ?? 'text-slate-800'
        }`}
      >
        {metrik.value}
      </p>
    </div>
  );
}

function metrikFromAmount(
  label: string,
  amount: number | null | undefined,
  opts?: { highlight?: boolean; accent?: string },
): FinansMetrik {
  const n = Number(amount);
  return {
    label,
    value: Number.isFinite(n) ? fmtCurrency(n) : '—',
    highlight: opts?.highlight,
    accent: opts?.accent,
  };
}

export function FinansRaporOzeti({
  claim,
  summary,
  onOpenFinansTab,
  reportEditHref,
  compact = false,
}: {
  claim: any;
  /** financial-summary yanıtı; yoksa claim / rapor alanları kullanılır */
  summary?: FinansOzetSummary | null;
  onOpenFinansTab?: () => void;
  /** Onarım raporu düzenleme sayfası — doğrudan navigasyon */
  reportEditHref?: string | null;
  /** Üst bant: yalnızca KPI ızgarası */
  compact?: boolean;
}) {
  const rapor = claim.latestRepairReport as {
    reportNo?: string;
    status?: string;
    totalSalesAmount?: number;
    totalSupplierCost?: number;
    grossProfit?: number;
    grossMarginPct?: number;
  } | null;

  const kpis = resolveFileFinanceKpis({
    report: rapor,
    claim,
    summary: summary ?? claim.financialSummary ?? null,
  });

  const hasMoney =
    kpis.planRevenue > 0 ||
    kpis.planCost > 0 ||
    kpis.actualRevenue > 0 ||
    kpis.actualCost > 0 ||
    kpis.netProfit !== 0;

  const karAccent = kpis.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700';
  const gelirLabel = kpis.actualRevenue > 0 ? 'Faturalanan Gelir' : 'Dosya Bedeli';
  const giderLabel = kpis.hasFileExpenses ? 'Fiili Gider' : 'Tedarikçi Bütçesi';
  const primaryMetrikleri = [
    metrikFromAmount(gelirLabel, kpis.displayRevenue, { highlight: true }),
    metrikFromAmount(giderLabel, kpis.displayCost),
    metrikFromAmount(kpis.profitLabel, kpis.netProfit, { highlight: true, accent: karAccent }),
  ];

  const tahsilEdilen = Number(summary?.totalCollected ?? claim.collectedAmount ?? 0) || 0;
  const faturalananGelir = kpis.hasActuals ? kpis.actualRevenue : 0;
  const tahsilatOrani =
    faturalananGelir > 0 ? Math.min(100, Math.round((tahsilEdilen / faturalananGelir) * 100)) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className={`flex items-center justify-between gap-3 px-5 py-3 ${compact ? 'bg-slate-800 py-2.5' : 'bg-slate-800'}`}>
        <div>
          <p className="text-[11px] font-medium text-slate-400 leading-none">Finans Özeti</p>
          <p className={`font-medium text-slate-100 mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
            {rapor ? `${rapor.reportNo} · ${repairReportStatusLabel(rapor.status)}` : 'Dosya Mali Durumu'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {tahsilatOrani != null && (
            <div className="hidden sm:block text-right">
              <p className="text-[10px] text-slate-400 leading-none">Tahsilat (Fiili)</p>
              <p className={`text-sm font-semibold tabular-nums ${tahsilatOrani >= 100 ? 'text-emerald-400' : 'text-white'}`}>
                %{tahsilatOrani}
              </p>
            </div>
          )}
          {reportEditHref && rapor && (
            <Link
              href={reportEditHref}
              className="text-xs font-medium text-slate-300 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg px-2.5 py-1 transition-colors"
            >
              Rapora Git →
            </Link>
          )}
          {onOpenFinansTab && (
            <button
              type="button"
              onClick={onOpenFinansTab}
              className="text-xs font-medium text-slate-300 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg px-2.5 py-1 transition-colors"
            >
              Finans Detayı →
            </button>
          )}
        </div>
      </div>

      {!hasMoney ? (
        <div className="px-5 py-6 text-center">
          <p className="text-sm text-slate-500">Bu dosyada henüz rapor veya fatura tutarı yok.</p>
        </div>
      ) : (
        <div>
          {!compact && (
            <div className="px-5 py-1.5 bg-slate-50 border-b border-slate-100">
              <p className="text-[10px] font-medium text-slate-500">
                {kpis.profitLabel}
              </p>
            </div>
          )}
          <div className="grid grid-cols-3">
            {primaryMetrikleri.map((m) => (
              <FinansMetrikHucre key={m.label} metrik={m} />
            ))}
          </div>
        </div>
      )}

      {tahsilatOrani != null && (
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
            <span>Tahsilat İlerlemesi (Fiili)</span>
            <span className="tabular-nums font-medium text-slate-700">
              {fmtCurrency(tahsilEdilen)} / {fmtCurrency(faturalananGelir)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${tahsilatOrani >= 100 ? 'bg-status-success' : 'bg-blue-500'}`}
              style={{ width: `${tahsilatOrani}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

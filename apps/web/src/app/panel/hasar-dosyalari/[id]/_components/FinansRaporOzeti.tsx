'use client';

import {
  repairReportStatusLabel,
} from '@/utils/repair-report-status';
import { fmtCurrency, fmtCurrencyCompact } from './claim-detail-utils';

type FinansMetrik = {
  label: string;
  value: string;
  fullValue?: string;
  accent?: string;
  highlight?: boolean;
};

export type FinansOzetSummary = {
  totalCost?: number;
  actualCost?: number;
  totalRevenue?: number;
  actualRevenue?: number;
  totalCollected?: number;
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
        className={`mt-1.5 text-lg font-semibold tabular-nums tracking-tight leading-none ${
          metrik.accent ?? 'text-slate-900'
        }`}
        title={metrik.fullValue}
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
  const n = amount ?? 0;
  return {
    label,
    value: fmtCurrencyCompact(n),
    fullValue: fmtCurrency(n),
    highlight: opts?.highlight,
    accent: opts?.accent,
  };
}

function resolveFiiliGider(
  claim: {
    actualCostAmount?: number | null;
    financialSummary?: { totalCost?: number; actualCost?: number } | null;
  },
  summary?: FinansOzetSummary | null,
): number {
  return (
    summary?.totalCost
    ?? summary?.actualCost
    ?? claim.financialSummary?.totalCost
    ?? claim.financialSummary?.actualCost
    ?? claim.actualCostAmount
    ?? 0
  );
}

function buildFiiliMetrikleri(
  claim: {
    actualCostAmount?: number | null;
    invoicedAmount?: number | null;
    collectedAmount?: number | null;
    financialSummary?: { totalCost?: number; actualCost?: number; actualRevenue?: number; totalRevenue?: number; totalCollected?: number } | null;
  },
  summary?: FinansOzetSummary | null,
): FinansMetrik[] {
  const fiiliGider = resolveFiiliGider(claim, summary);
  const faturalananGelir =
    summary?.totalRevenue ?? summary?.actualRevenue
    ?? claim.financialSummary?.totalRevenue ?? claim.financialSummary?.actualRevenue
    ?? claim.invoicedAmount ?? 0;
  const tahsilEdilen =
    summary?.totalCollected
    ?? claim.financialSummary?.totalCollected
    ?? claim.collectedAmount ?? 0;

  return [
    metrikFromAmount('Fiili Gider', fiiliGider),
    metrikFromAmount('Faturalanan Gelir', faturalananGelir, { highlight: true }),
    metrikFromAmount('Tahsil Edilen', tahsilEdilen, {
      highlight: true,
      accent: tahsilEdilen > 0 ? 'text-emerald-700' : undefined,
    }),
  ];
}

function buildPlanMetrikleri(rapor: {
  totalSalesAmount?: number;
  totalSupplierCost?: number;
}): FinansMetrik[] {
  return [
    metrikFromAmount('Rapor Toplamı (KDV Hariç)', rapor.totalSalesAmount, { highlight: true }),
    metrikFromAmount('Tedarikçi Bütçesi (KDV Hariç)', rapor.totalSupplierCost),
  ];
}

export function FinansRaporOzeti({
  claim,
  summary,
  onOpenFinansTab,
  onOpenRaporlarTab,
  compact = false,
}: {
  claim: any;
  /** financial-summary yanıtı; yoksa claim alanları kullanılır */
  summary?: FinansOzetSummary | null;
  onOpenFinansTab?: () => void;
  onOpenRaporlarTab?: () => void;
  /** Üst bant: yalnızca KPI ızgarası */
  compact?: boolean;
}) {
  const rapor = claim.latestRepairReport as {
    reportNo?: string;
    status?: string;
    totalSalesAmount?: number;
    totalSupplierCost?: number;
  } | null;

  const planMetrikleri = rapor ? buildPlanMetrikleri(rapor) : [];
  const fiiliMetrikleri = buildFiiliMetrikleri(claim, summary);

  const faturalananGelir =
    summary?.totalRevenue ?? summary?.actualRevenue ?? claim.invoicedAmount ?? 0;
  const tahsilEdilen = summary?.totalCollected ?? claim.collectedAmount ?? 0;
  const tahsilatOrani =
    faturalananGelir > 0 ? Math.min(100, Math.round((tahsilEdilen / faturalananGelir) * 100)) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className={`flex items-center justify-between gap-3 px-5 py-3 ${compact ? 'bg-slate-800 py-2.5' : 'bg-slate-900'}`}>
        <div>
          <p className="text-[11px] font-medium text-slate-400 leading-none">Finans Özeti</p>
          <p className={`font-semibold text-white mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
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
          {onOpenRaporlarTab && rapor && (
            <button
              type="button"
              onClick={onOpenRaporlarTab}
              className="text-xs font-medium text-slate-300 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg px-2.5 py-1 transition-colors"
            >
              Rapora Git →
            </button>
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

      {rapor ? (
        <div>
          {!compact && (
            <div className="px-5 py-1.5 bg-slate-50 border-b border-slate-100">
              <p className="text-[10px] font-medium text-slate-500">Plan (Rapor)</p>
            </div>
          )}
          <div className={`grid grid-cols-2 ${compact ? 'border-b border-slate-100' : ''}`}>
            {planMetrikleri.map((m) => (
              <FinansMetrikHucre key={m.label} metrik={m} />
            ))}
          </div>
          {!compact && (
            <div className="px-5 py-1.5 bg-slate-50 border-b border-t border-slate-100">
              <p className="text-[10px] font-medium text-slate-500">Fiili</p>
            </div>
          )}
          <div className="grid grid-cols-3">
            {fiiliMetrikleri.map((m) => (
              <FinansMetrikHucre key={m.label} metrik={m} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3">
          {fiiliMetrikleri.map((m) => (
            <FinansMetrikHucre key={m.label} metrik={m} />
          ))}
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
              className={`h-full rounded-full transition-all ${tahsilatOrani >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${tahsilatOrani}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

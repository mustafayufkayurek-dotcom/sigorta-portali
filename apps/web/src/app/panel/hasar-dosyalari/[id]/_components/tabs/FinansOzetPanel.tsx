'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { FinansRaporOzeti } from '../FinansRaporOzeti';
import { API, authHeader, fmtCurrency, fmtDate } from '../claim-detail-utils';
import { CollapsibleSectionCard } from '../claim-detail-ui';

function PlAmountCell({
  amount,
  className = 'text-slate-900',
}: {
  amount: number;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap w-[7.5rem] sm:w-[8.5rem] ${className}`}>
      {fmtCurrency(amount)}
    </td>
  );
}

function PlRow({
  label,
  amount,
  amountClassName,
}: {
  label: string;
  amount: number;
  amountClassName?: string;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <td className="px-3 py-2 text-sm text-slate-600">{label}</td>
      <PlAmountCell amount={amount} className={amountClassName} />
    </tr>
  );
}

function PlBreakdownCard({
  title,
  accent,
  children,
  totalLabel,
  totalAmount,
}: {
  title: string;
  accent: 'blue' | 'red' | 'emerald';
  children: React.ReactNode;
  totalLabel: string;
  totalAmount: number;
}) {
  const totalStyles = {
    blue: 'bg-blue-50/70 text-blue-800',
    red: 'bg-red-50/70 text-red-700',
    emerald: 'bg-emerald-50/70 text-emerald-800',
  }[accent];

  const amountStyles = {
    blue: 'text-blue-700 font-bold',
    red: 'text-red-600 font-bold',
    emerald: 'text-emerald-700 font-bold',
  }[accent];

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-600">{title}</p>
      </div>
      <table className="w-full text-sm">
        <tbody>{children}</tbody>
        <tfoot>
          <tr className={totalStyles}>
            <td className="px-3 py-2.5 text-sm font-semibold">{totalLabel}</td>
            <PlAmountCell amount={totalAmount} className={amountStyles} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function FinansOzetPanel({
  claim,
  claimId,
  onOpenRaporlarTab,
}: {
  claim: any;
  claimId: string;
  onOpenRaporlarTab?: () => void;
}) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/claim-files/${claimId}/financial-summary`, { headers: authHeader() });
      setSummary(r.data.data ?? r.data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await axios.post(`${API}/finance/analytics/recalculate/${claimId}`, {}, { headers: authHeader() });
      load();
    } catch { /* sessiz */ }
    finally { setRecalculating(false); }
  };

  const s = summary;
  const isProfit = s ? (s.grossProfit ?? s.netProfit ?? 0) >= 0 : true;
  const netProfit = s?.netProfit ?? s?.grossProfit ?? 0;
  const netMargin = s?.netMarginPct ?? s?.grossMarginPct ?? 0;

  return (
    <div className="space-y-4">
      <FinansRaporOzeti
        claim={claim}
        summary={loading ? null : s}
        onOpenRaporlarTab={onOpenRaporlarTab}
      />

      {loading ? (
        <div className="py-8 text-center text-slate-400 text-sm">Özet hesaplanıyor...</div>
      ) : !s ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
          <p className="text-sm text-slate-500">Henüz finansal özet yok.</p>
          <p className="text-xs text-slate-400 mt-1">Gelir, gider veya fatura ekledikten sonra otomatik hesaplanır.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={`rounded-xl border shadow-sm p-4 text-center ${isProfit ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <p className="text-xs text-slate-500 mb-1">Net Kâr</p>
              <p className={`text-xl font-bold tabular-nums ${isProfit ? 'text-green-700' : 'text-red-700'}`}>{fmtCurrency(netProfit)}</p>
            </div>
            <div className={`rounded-xl border shadow-sm p-4 text-center ${isProfit ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <p className="text-xs text-slate-500 mb-1">Kâr Marjı</p>
              <p className={`text-xl font-bold tabular-nums ${isProfit ? 'text-green-700' : 'text-red-700'}`}>{Number(netMargin).toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Kalan Bakiye</p>
              <p className="text-xl font-bold text-orange-600 tabular-nums">{fmtCurrency(s.outstandingBalance ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Son Hesaplama</p>
              <p className="text-sm font-medium text-slate-700">{fmtDate(s.lastCalculatedAt)}</p>
            </div>
          </div>

          <CollapsibleSectionCard
            title="Dosya P&L Detayı"
            subtitle={`Gelir ${fmtCurrency(s.totalRevenue ?? s.actualRevenue ?? 0)} · Gider ${fmtCurrency(s.totalCost ?? s.actualCost ?? 0)}`}
            defaultOpen={false}
          >
            <div className="pt-3 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                <p className="text-xs text-slate-500">
                  Son hesaplama:{' '}
                  <span className="font-medium text-slate-700">{fmtDate(s.lastCalculatedAt)}</span>
                </p>
                <button
                  type="button"
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="text-xs font-medium text-slate-600 border border-slate-300 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {recalculating ? 'Hesaplanıyor…' : 'Yeniden Hesapla'}
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <PlBreakdownCard
                  title="Gelir Kırılımı"
                  accent="blue"
                  totalLabel="Toplam Gelir"
                  totalAmount={s.totalRevenue ?? s.actualRevenue ?? 0}
                >
                  <PlRow label="Dosya Bedeli" amount={s.fileFeeRevenue ?? 0} />
                  <PlRow label="Ekstra İşler" amount={s.extraWorkRevenue ?? 0} />
                </PlBreakdownCard>

                <PlBreakdownCard
                  title="Gider Kırılımı"
                  accent="red"
                  totalLabel="Toplam Gider"
                  totalAmount={s.totalCost ?? s.actualCost ?? 0}
                >
                  <PlRow label="Tedarikçi Hakediş" amount={s.vendorCost ?? 0} />
                  <PlRow label="Saha Giderleri" amount={s.fieldExpenseCost ?? 0} />
                  <PlRow label="Malzeme" amount={s.materialCost ?? 0} />
                  <PlRow
                    label="Diğer Değişken"
                    amount={(s.communicationCost ?? 0) + (s.otherVariableCost ?? 0)}
                  />
                  <PlRow label="Sabit Gider Payı" amount={s.overheadShare ?? 0} />
                </PlBreakdownCard>
              </div>

              <PlBreakdownCard
                title="Tahsilat"
                accent="emerald"
                totalLabel="Toplam Tahsilat"
                totalAmount={s.totalCollected ?? 0}
              >
                <PlRow
                  label="Sigorta Şirketinden Tahsilat"
                  amount={s.collectedFromInsurer ?? 0}
                  amountClassName="text-emerald-700"
                />
                <PlRow
                  label="Sigortalıdan Tahsilat"
                  amount={s.collectedFromInsured ?? 0}
                  amountClassName="text-emerald-700"
                />
              </PlBreakdownCard>
            </div>
          </CollapsibleSectionCard>
        </>
      )}
    </div>
  );
}

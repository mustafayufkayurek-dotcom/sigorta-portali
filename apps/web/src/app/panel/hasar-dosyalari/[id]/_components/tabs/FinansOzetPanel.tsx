'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { FinansRaporOzeti } from '../FinansRaporOzeti';
import { API, authHeader, fmtCurrency, fmtDate } from '../claim-detail-utils';
import { CollapsibleSectionCard } from '../claim-detail-ui';

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
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="text-xs text-slate-500 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  {recalculating ? 'Hesaplanıyor...' : 'Yeniden Hesapla'}
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Gelir Kırılımı</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Dosya Bedeli</span><span className="font-medium">{fmtCurrency(s.fileFeeRevenue ?? 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Ekstra İşler</span><span className="font-medium">{fmtCurrency(s.extraWorkRevenue ?? 0)}</span></div>
                  <div className="flex justify-between text-sm font-bold border-t border-slate-100 pt-1 mt-1"><span>Toplam Gelir</span><span className="text-blue-700">{fmtCurrency(s.totalRevenue ?? s.actualRevenue ?? 0)}</span></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Gider Kırılımı</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Tedarikçi Hakediş</span><span className="font-medium">{fmtCurrency(s.vendorCost ?? 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Saha Giderleri</span><span className="font-medium">{fmtCurrency(s.fieldExpenseCost ?? 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Malzeme</span><span className="font-medium">{fmtCurrency(s.materialCost ?? 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Diğer Değişken</span><span className="font-medium">{fmtCurrency((s.communicationCost ?? 0) + (s.otherVariableCost ?? 0))}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Sabit Gider Payı</span><span className="font-medium">{fmtCurrency(s.overheadShare ?? 0)}</span></div>
                  <div className="flex justify-between text-sm font-bold border-t border-slate-100 pt-1 mt-1"><span>Toplam Gider</span><span className="text-red-600">{fmtCurrency(s.totalCost ?? s.actualCost ?? 0)}</span></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Tahsilat</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Sigorta Şirketinden Tahsilat</span><span className="font-medium text-green-700">{fmtCurrency(s.collectedFromInsurer ?? 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">Sigortalıdan Tahsil</span><span className="font-medium text-green-700">{fmtCurrency(s.collectedFromInsured ?? 0)}</span></div>
                </div>
              </div>
            </div>
          </CollapsibleSectionCard>
        </>
      )}
    </div>
  );
}

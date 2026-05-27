'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { AlertTriangle, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useSlaSummary } from '../../hooks/use-dashboard-data';
import { WidgetShell, WidgetSkeleton, WidgetEmpty } from '../widget-frame';
import { computeSlaOverall, mapSlaToCards } from '../../utils/kpi-mappers';

interface SlaRiskWidgetProps {
  staggerIndex?: number;
}

export function SlaRiskWidget({ staggerIndex = 0 }: SlaRiskWidgetProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useSlaSummary();
  const [showDetail, setShowDetail] = useState(false);
  const byStatus = Array.isArray(data?.byStatus) ? data.byStatus : [];

  const safeData = useMemo(() => ({ byStatus }), [byStatus]);
  const slaOverall = useMemo(() => computeSlaOverall(safeData), [safeData]);
  const slaCards = useMemo(() => mapSlaToCards(slaOverall), [slaOverall]);
  const hasRisk = slaOverall.atRisk > 0 || slaOverall.critical > 0;

  return (
    <WidgetShell
      title="SLA Risk Dağılımı"
      icon={<AlertTriangle className="h-5 w-5 text-rose-500" />}
      staggerIndex={staggerIndex}
      isLoaded={!isLoading}
      error={isError}
      errorMessage={error?.message || 'SLA dağılımı yüklenemedi.'}
      onRetry={() => void refetch()}
    >
      {isLoading || isFetching ? (
        <WidgetSkeleton variant="card" rows={4} />
      ) : !byStatus.length ? (
        <WidgetEmpty
          icon={Shield}
          message="Aktif dosya bulunmuyor. İlk dosyanızı ekleyin →"
          actionLabel="Yeni dosya ekle"
          actionHref="/panel/hasar-dosyalari"
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {slaCards.map((card) => (
              <div key={card.label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className={`text-xs font-medium ${card.text}`}>{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
                <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={`h-2 rounded-full ${card.color} transition-all`}
                    style={{ width: `${Math.min(100, (card.value / Math.max(1, slaOverall.total)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowDetail((prev) => !prev)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Statü detayı {showDetail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {hasRisk ? (
              <Link
                href="/panel/hasar-dosyalari?status=sla_exceeded"
                className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Riskli dosyaları görüntüle
              </Link>
            ) : (
              <span className="text-xs font-medium text-slate-400">Aktif SLA riski yok</span>
            )}
          </div>
          {showDetail && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              {byStatus.map((item) => (
                <div key={item.statusCode} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{item.statusName}</span>
                  <div className="flex gap-3">
                    <span className="text-emerald-600">{item.normal} ✓</span>
                    {item.warning > 0 && <span className="text-amber-600">{item.warning} ⚠</span>}
                    {item.critical > 0 && <span className="text-red-600">{item.critical} ✕</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, BellRing, ChevronDown, ChevronUp, ListChecks, Users } from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { SectionCard, StatusBadge } from '@/components/ui';

type CriticalItem = { fileNo: string };
type CriticalAlertsResponse = {
  slaEscalations: CriticalItem[];
  inactiveFiles: CriticalItem[];
  totalCritical: number;
};

type PendingActionItem = {
  fileNo: string;
  action: string;
  pendingSince: string;
  priority?: 'low' | 'medium' | 'high' | 'critical' | string;
};
type PendingActionsResponse = { items: PendingActionItem[]; total: number };

type SlaSummaryResponse = {
  byStatus: Array<{ status: string; count: number }>;
  overall: { total: number; healthy: number; atRisk: number; critical: number };
};

type OwnershipItem = {
  userName: string;
  activeFiles: number;
  criticalFiles: number;
  avgDaysPerFile?: number;
};
type OwnershipLoadResponse = { items: OwnershipItem[] };

type FinanceItem = {
  fileNo: string;
  amount: number;
  daysPending: number;
  insuranceCompany: string;
};
type FinanceBottlenecksResponse = {
  pendingPayments: FinanceItem[];
  totalPendingAmount: number;
  overdueInvoices: number;
};

type ActivityItem = {
  fileNo: string;
  action: string;
  description: string;
  userName: string;
  createdAt: string;
};
type ActivityFeedResponse = { items: ActivityItem[] };

const getDaysAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const getRelativeTime = (dateStr: string) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return `${Math.max(1, min)} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  return `${Math.floor(hr / 24)} gün önce`;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(
    amount || 0,
  );

function WidgetSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="h-10 rounded bg-slate-200 dark:bg-slate-700" />
      ))}
    </div>
  );
}

export default function PanelPage() {
  const router = useRouter();
  const [showSlaDetail, setShowSlaDetail] = useState(false);

  const criticalQuery = useApiQuery<CriticalAlertsResponse>(['dashboard-critical-alerts'], '/dashboard/critical-alerts');
  const pendingQuery = useApiQuery<PendingActionsResponse>(['dashboard-pending-actions'], '/dashboard/pending-actions');
  const slaQuery = useApiQuery<SlaSummaryResponse>(['dashboard-sla-summary'], '/dashboard/sla-summary');
  const ownershipQuery = useApiQuery<OwnershipLoadResponse>(['dashboard-ownership-load'], '/dashboard/ownership-load');
  const financeQuery = useApiQuery<FinanceBottlenecksResponse>(
    ['dashboard-finance-bottlenecks'],
    '/dashboard/finance-bottlenecks',
  );
  const activityQuery = useApiQuery<ActivityFeedResponse>(['dashboard-activity-feed'], '/dashboard/activity-feed?limit=20');

  const slaCards = useMemo(() => {
    const overall = slaQuery.data?.overall;
    if (!overall) return [];
    return [
      { label: 'Toplam', value: overall.total, color: 'bg-slate-500', text: 'text-slate-700 dark:text-slate-200' },
      { label: 'Sağlıklı', value: overall.healthy, color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
      { label: 'Riskli', value: overall.atRisk, color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
      { label: 'Kritik', value: overall.critical, color: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
    ];
  }, [slaQuery.data]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        {criticalQuery.data?.totalCritical ? (
          <SectionCard title="Kritik Uyarılar" className="border-red-300 bg-gradient-to-r from-red-600 to-orange-500 text-white">
            {criticalQuery.isLoading ? (
              <WidgetSkeleton rows={2} />
            ) : criticalQuery.error ? (
              <p className="text-sm">Kritik uyarılar alınamadı.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => criticalQuery.data?.slaEscalations?.[0]?.fileNo && router.push(`/panel/hasar-dosyalari/${criticalQuery.data.slaEscalations[0].fileNo}`)}
                  className="rounded-lg bg-white/10 p-4 text-left hover:bg-white/20"
                >
                  <p className="text-4xl font-bold">{criticalQuery.data?.slaEscalations?.length ?? 0}</p>
                  <p className="mt-1 text-sm font-medium">SLA Aşan Dosyalar</p>
                </button>
                <button
                  type="button"
                  onClick={() => criticalQuery.data?.inactiveFiles?.[0]?.fileNo && router.push(`/panel/hasar-dosyalari/${criticalQuery.data.inactiveFiles[0].fileNo}`)}
                  className="rounded-lg bg-white/10 p-4 text-left hover:bg-white/20"
                >
                  <p className="text-4xl font-bold">{criticalQuery.data?.inactiveFiles?.length ?? 0}</p>
                  <p className="mt-1 text-sm font-medium">Hareketsiz Dosyalar (48h+)</p>
                </button>
              </div>
            )}
          </SectionCard>
        ) : null}

        <SectionCard title="Bekleyen Aksiyonlar" icon={<BellRing className="h-5 w-5 text-amber-500" />}>
          {pendingQuery.isLoading ? (
            <WidgetSkeleton rows={5} />
          ) : pendingQuery.error ? (
            <p className="text-sm text-red-600">Bekleyen aksiyonlar alınamadı.</p>
          ) : !pendingQuery.data?.items?.length ? (
            <p className="text-sm text-slate-500">Bekleyen aksiyon yok</p>
          ) : (
            <div className="space-y-2">
              {pendingQuery.data.items.map((item) => (
                <button
                  key={`${item.fileNo}-${item.action}`}
                  type="button"
                  onClick={() => router.push(`/panel/hasar-dosyalari/${item.fileNo}`)}
                  className="grid w-full grid-cols-1 gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-left hover:bg-amber-100/70 md:grid-cols-4"
                >
                  <span className="font-semibold">{item.fileNo}</span>
                  <span className="text-sm">{item.action}</span>
                  <span className="text-sm text-slate-600">{getDaysAgo(item.pendingSince)} gün önce</span>
                  <StatusBadge label={item.priority || 'normal'} variant={item.priority === 'critical' ? 'danger' : item.priority === 'high' ? 'warning' : 'neutral'} size="sm" />
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard title="SLA Risk Dağılımı" icon={<AlertTriangle className="h-5 w-5 text-rose-500" />}>
            {slaQuery.isLoading ? (
              <WidgetSkeleton rows={4} />
            ) : slaQuery.error ? (
              <p className="text-sm text-red-600">SLA özeti alınamadı.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {slaCards.map((card) => (
                    <div key={card.label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <p className={`text-xs ${card.text}`}>{card.label}</p>
                      <p className="text-2xl font-bold">{card.value}</p>
                      <div className="mt-2 h-2 rounded bg-slate-200 dark:bg-slate-800">
                        <div className={`h-2 rounded ${card.color}`} style={{ width: `${Math.min(100, (card.value / Math.max(1, slaQuery.data?.overall.total || 1)) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSlaDetail((prev) => !prev)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  byStatus detayı {showSlaDetail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showSlaDetail && (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    {slaQuery.data?.byStatus?.map((item) => (
                      <div key={item.status} className="flex items-center justify-between text-sm">
                        <span>{item.status}</span>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Ownership Yoğunluğu" icon={<Users className="h-5 w-5 text-indigo-500" />}>
            {ownershipQuery.isLoading ? (
              <WidgetSkeleton rows={5} />
            ) : ownershipQuery.error ? (
              <p className="text-sm text-red-600">Ownership verisi alınamadı.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 text-left">Kullanıcı</th>
                      <th className="py-2 text-right">Aktif</th>
                      <th className="py-2 text-right">Kritik</th>
                      <th className="py-2 text-right">Ort. Gün/Dosya</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownershipQuery.data?.items?.map((item) => (
                      <tr key={item.userName} className={item.criticalFiles > 0 ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                        <td className="py-2">{item.userName}</td>
                        <td className="py-2 text-right">{item.activeFiles}</td>
                        <td className="py-2 text-right font-semibold">{item.criticalFiles}</td>
                        <td className="py-2 text-right">{item.avgDaysPerFile ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard title="Finans Darboğazları" icon={<ListChecks className="h-5 w-5 text-emerald-600" />}>
            {financeQuery.isLoading ? (
              <WidgetSkeleton rows={5} />
            ) : financeQuery.error ? (
              <p className="text-sm text-red-600">Finans darboğazları alınamadı.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs text-slate-500">Toplam Bekleyen Tutar</p>
                  <p className="text-3xl font-bold">{formatCurrency(financeQuery.data?.totalPendingAmount || 0)}</p>
                  <p className="text-sm text-red-600">Geciken Fatura: {financeQuery.data?.overdueInvoices || 0}</p>
                </div>
                <div className="space-y-2">
                  {(financeQuery.data?.pendingPayments || []).slice(0, 5).map((item) => (
                    <button
                      key={`${item.fileNo}-${item.insuranceCompany}`}
                      type="button"
                      onClick={() => router.push(`/panel/hasar-dosyalari/${item.fileNo}`)}
                      className="grid w-full grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 md:grid-cols-4"
                    >
                      <span className="font-semibold">{item.fileNo}</span>
                      <span>{formatCurrency(item.amount)}</span>
                      <span>{item.daysPending} gün</span>
                      <span className="truncate">{item.insuranceCompany}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Haftalık Özet (Aktivite Feed)" icon={<BellRing className="h-5 w-5 text-blue-500" />}>
            {activityQuery.isLoading ? (
              <WidgetSkeleton rows={5} />
            ) : activityQuery.error ? (
              <p className="text-sm text-red-600">Aktivite feed alınamadı.</p>
            ) : (
              <div className="space-y-3">
                {(activityQuery.data?.items || []).slice(0, 8).map((item) => (
                  <button
                    key={`${item.fileNo}-${item.createdAt}-${item.action}`}
                    type="button"
                    onClick={() => router.push(`/panel/hasar-dosyalari/${item.fileNo}`)}
                    className="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-slate-500">
                        {item.userName} · {getRelativeTime(item.createdAt)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </section>

        <SectionCard title="Son Aktiviteler" icon={<BellRing className="h-5 w-5 text-slate-500" />}>
          {activityQuery.isLoading ? (
            <WidgetSkeleton rows={10} />
          ) : activityQuery.error ? (
            <p className="text-sm text-red-600">Son aktiviteler alınamadı.</p>
          ) : (
            <div className="space-y-3">
              {(activityQuery.data?.items || []).map((item) => (
                <button
                  key={`${item.fileNo}-${item.createdAt}-timeline`}
                  type="button"
                  onClick={() => router.push(`/panel/hasar-dosyalari/${item.fileNo}`)}
                  className="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-sm">{item.description}</p>
                    <p className="text-xs text-slate-500">
                      {item.fileNo} · {item.userName} · {getRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
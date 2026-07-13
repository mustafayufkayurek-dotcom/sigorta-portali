'use client';

import Link from 'next/link';
import { AlertTriangle, Clock, FileCheck, Send } from 'lucide-react';
import { useApprovalDelays } from '../../hooks/use-dashboard-data';
import { WidgetShell, WidgetSkeleton, WidgetEmpty } from '../widget-frame';
import { formatWidgetErrorMessage } from '../../utils/widget-errors';
import { repairReportStatusLabel } from '@/utils/repair-report-status';

const CATEGORY_LINKS: Record<string, string> = {
  pending_approval: '/panel/hasar-dosyalari?repairReportStatus=pending_approval',
  external_approval: '/panel/hasar-dosyalari?repairReportStatus=sent_for_external_approval',
  submitted: '/panel/hasar-dosyalari?repairReportStatus=submitted',
};

const CATEGORY_LABELS: Record<string, string> = {
  pending_approval: 'Dosya Sorumlusu Onayı',
  external_approval: 'Dış Onay Yanıtı',
  submitted: 'Eksperden Gelen Rapor',
};

function formatWaitingLabel(hours: number) {
  if (hours >= 48) return `${Math.round(hours / 24)} gün`;
  return `${hours} saat`;
}

interface ApprovalDelayWidgetProps {
  staggerIndex?: number;
  /** Dosya sorumlusu merkezi: admin kart diline yakın kompakt boşluk */
  compact?: boolean;
}

export function ApprovalDelayWidget({ staggerIndex = 0, compact = false }: ApprovalDelayWidgetProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useApprovalDelays();
  const summary = data?.summary;
  const items = Array.isArray(data?.items) ? data.items : [];
  const total = summary?.total ?? 0;

  return (
    <WidgetShell
      title="Onay Gecikmeleri"
      subtitle="24 Saat Üzeri Bekleyen Onarım Raporu Onayları"
      variant="alert"
      staggerIndex={staggerIndex}
      compact={compact}
      isLoaded={!isLoading}
      error={isError}
      errorMessage={formatWidgetErrorMessage(error, 'Onay gecikmeleri alınamadı.')}
      onRetry={() => void refetch()}
    >
      {isLoading || isFetching ? (
        <WidgetSkeleton rows={3} className="min-h-[200px]" />
      ) : total === 0 ? (
        <WidgetEmpty
          icon={FileCheck}
          message="Geciken onay bekleyen dosya bulunmuyor. Atanan hasar dosyalarınızı kontrol edebilirsiniz."
          actionLabel="Hasar Dosyalarına Git"
          actionHref="/panel/hasar-dosyalari"
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href={CATEGORY_LINKS.pending_approval}
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
            >
              <p className="text-3xl font-bold text-amber-800 dark:text-amber-200">{summary?.pendingApproval ?? 0}</p>
              <p className="mt-1 text-sm font-medium text-amber-900 dark:text-amber-100">Onay Bekleyen Rapor</p>
            </Link>
            <Link
              href={CATEGORY_LINKS.external_approval}
              className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 transition-colors hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40"
            >
              <p className="text-3xl font-bold text-indigo-800 dark:text-indigo-200">{summary?.externalApproval ?? 0}</p>
              <p className="mt-1 text-sm font-medium text-indigo-900 dark:text-indigo-100">Dış Onay Bekleyen</p>
            </Link>
            <Link
              href={CATEGORY_LINKS.submitted}
              className="rounded-lg border border-blue-200 bg-blue-50 p-4 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
            >
              <p className="text-3xl font-bold text-blue-800 dark:text-blue-200">{summary?.submitted ?? 0}</p>
              <p className="mt-1 text-sm font-medium text-blue-900 dark:text-blue-100">İşlenmemiş Eksper Raporu</p>
            </Link>
          </div>

          {(summary?.critical ?? 0) > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>{summary?.critical}</strong> dosyada 48 saat ve üzeri onay gecikmesi var.
              </span>
            </div>
          )}

          <div className="space-y-2">
            {items.slice(0, 6).map((item) => (
              <Link
                key={`${item.id}-${item.reportId}`}
                href={`/panel/hasar-dosyalari/${item.id}`}
                className={`flex flex-col gap-1 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  item.severity === 'critical'
                    ? 'border-red-200 bg-red-50/60 hover:bg-red-100/70 dark:border-red-900/40 dark:bg-red-950/20'
                    : 'border-amber-200 bg-amber-50/40 hover:bg-amber-100/60 dark:border-amber-900/30 dark:bg-amber-950/15'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white">{item.fileNo}</p>
                  <p className="text-xs text-slate-500">
                    {item.reportNo} · {CATEGORY_LABELS[item.category] ?? repairReportStatusLabel(item.status)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className={item.severity === 'critical' ? 'font-semibold text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}>
                    {formatWaitingLabel(item.hoursWaiting)} Bekliyor
                  </span>
                  {item.severity === 'critical' && (
                    <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white">Kritik</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {total > 6 && (
            <Link
              href="/panel/hasar-dosyalari?repairReportStatus=pending_approval"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              <Send className="h-4 w-4" />
              Tüm Geciken Dosyaları Görüntüle
            </Link>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

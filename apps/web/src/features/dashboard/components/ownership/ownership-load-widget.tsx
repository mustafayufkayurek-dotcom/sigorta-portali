'use client';

import { Users } from 'lucide-react';
import { useOwnershipLoad } from '../../hooks/use-dashboard-data';
import { WidgetShell, WidgetSkeleton, WidgetEmpty } from '../widget-frame';

interface OwnershipLoadWidgetProps {
  staggerIndex?: number;
}

export function OwnershipLoadWidget({ staggerIndex = 0 }: OwnershipLoadWidgetProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useOwnershipLoad();

  return (
    <WidgetShell
      title="Ownership Yoğunluğu"
      icon={<Users className="h-5 w-5 text-indigo-500" />}
      staggerIndex={staggerIndex}
      isLoaded={!isLoading}
      error={isError}
      errorMessage={error?.message || 'Ownership verisi yüklenemedi.'}
      onRetry={() => void refetch()}
    >
      {isLoading || isFetching ? (
        <WidgetSkeleton variant="table" rows={4} />
      ) : !data?.items?.length ? (
        <WidgetEmpty
          icon={Users}
          message="Personel ataması yapılmamış. Personel yönetimi →"
          actionLabel="Personel yönetimi"
          actionHref="/panel/personel-yonetimi"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 text-left font-medium text-slate-500">Kullanıcı</th>
                <th className="py-2 text-right font-medium text-slate-500">Aktif</th>
                <th className="py-2 text-right font-medium text-slate-500">Kritik</th>
                <th className="py-2 text-right font-medium text-slate-500">Ort. Gün</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr
                  key={item.userId || item.userName}
                  className={`border-b border-slate-100 dark:border-slate-800 ${item.criticalFiles > 0 ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                >
                  <td className="py-2.5 font-medium text-slate-900 dark:text-white">{item.userName}</td>
                  <td className="py-2.5 text-right">{item.activeFiles}</td>
                  <td className="py-2.5 text-right font-semibold text-red-600">{item.criticalFiles || '—'}</td>
                  <td className="py-2.5 text-right text-slate-500">{item.avgDaysPerFile ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetShell>
  );
}

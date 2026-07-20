'use client';

import { SlidePanel } from '@/components/SlidePanel';
import type { ActionRequiredItem, ManagerSummaryColumn } from '../_lib/survey-results-types';

export function ManagerSummaryDetailDrawer({
  open,
  onClose,
  columns,
  actionItems,
}: {
  open: boolean;
  onClose: () => void;
  columns: ManagerSummaryColumn[];
  actionItems: ActionRequiredItem[];
}) {
  return (
    <SlidePanel open={open} onClose={onClose} title="Yönetici Özeti Detayı" width={480}>
      <div className="space-y-4 text-sm">
        {columns.map((col) => (
          <div key={col.id} className="rounded-lg border border-slate-100 px-3 py-2.5">
            <p className="text-xs font-semibold text-slate-800">{col.title}</p>
            <p className="mt-1 text-slate-600">{col.body}</p>
          </div>
        ))}

        <div>
          <p className="mb-2 text-xs font-semibold text-slate-800">Aksiyon Gerektiren Sonuçlar</p>
          {actionItems.length === 0 ? (
            <p className="text-xs text-slate-400">Şu an aksiyon gerektiren sonuç yok.</p>
          ) : (
            <ul className="space-y-2">
              {actionItems.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-100 px-3 py-2">
                  <p className="font-medium text-slate-800">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="font-medium">Öneri: </span>
                    {item.recommendation}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SlidePanel>
  );
}

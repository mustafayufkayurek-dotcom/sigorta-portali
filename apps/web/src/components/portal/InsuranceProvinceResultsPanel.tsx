'use client';

import type { InsuranceProvinceStat } from '@/utils/insurance-portal-monitoring';
import { toTitleCaseTR } from '@/utils/text-helpers';

type InsuranceProvinceResultsPanelProps = {
  rows: InsuranceProvinceStat[];
  preferenceLabel: string;
  emptyText?: string;
};

/**
 * Sigorta ihbarları için Türkiye geneli il bazlı sonuç paneli.
 * Harita/API etiketleri göstermez — yalnızca operasyon sayıları.
 */
export function InsuranceProvinceResultsPanel({
  rows,
  preferenceLabel,
  emptyText = 'Seçili kapsamda il bazlı sonuç henüz oluşmadı.',
}: InsuranceProvinceResultsPanelProps) {
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const coveredCities = rows.filter((r) => r.city !== 'Belirtilmemiş').length;
  const totalFiles = rows.reduce((s, r) => s + r.total, 0);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">Türkiye Geneli · İl Bazlı Sonuçlar</h3>
          <p className="mt-1 text-xs text-slate-500">
            {preferenceLabel} kapsamında illere göre dosya dağılımı.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-700">
            {coveredCities} İl
          </span>
          <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-brand-700">
            {totalFiles} Dosya
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm font-medium text-slate-500">{emptyText}</p>
          <p className="mt-1 text-xs text-slate-400">
            Merkezi ihbarlar geldikçe iller burada listelenir.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
              <span>İl</span>
              <span>Dağılım</span>
              <span className="text-right">Toplam</span>
              <span className="text-right">Açık</span>
              <span className="text-right">Tespit</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((row) => {
                const widthPct = Math.max(6, Math.round((row.total / maxTotal) * 100));
                return (
                  <li
                    key={row.city}
                    className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))] items-center gap-2 px-3 py-2.5"
                  >
                    <span className="truncate text-sm font-semibold text-slate-800">
                      {toTitleCaseTR(row.city)}
                    </span>
                    <div className="min-w-0">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-600"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-right text-sm font-semibold tabular-nums text-slate-800">
                      {row.total}
                    </span>
                    <span className="text-right text-sm tabular-nums text-slate-600">{row.open}</span>
                    <span className="text-right text-sm tabular-nums text-slate-600">{row.tespit}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}

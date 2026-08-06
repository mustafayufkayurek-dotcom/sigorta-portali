'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileWarning,
  FolderOpen,
  Users,
} from 'lucide-react';
import { DAY_END_SUPERVISION_PREVIEW } from './attendance-day-end.preview';

type AuditRow = {
  id: string;
  fullName: string;
  department: string;
  workScope: 'Ofis' | 'Saha' | 'Riskli İş';
  requiredTotal: number;
  requiredUploaded: number;
  missingCount: number;
  missingTitles: string[];
};

const PREVIEW_AUDIT: AuditRow[] = DAY_END_SUPERVISION_PREVIEW.employees.map((e, idx) => {
  const missingCount = idx % 3 === 0 ? 2 + (idx % 2) : 0;
  const requiredTotal = 9;
  return {
    id: e.id,
    fullName: e.fullName,
    department: e.department,
    workScope: (['Ofis', 'Saha', 'Riskli İş'] as const)[idx % 3],
    requiredTotal,
    requiredUploaded: requiredTotal - missingCount,
    missingCount,
    missingTitles:
      missingCount === 0
        ? []
        : ['Kvkk Açık Rıza', 'İmzalı Ücret Bordrosu', 'Sağlık Raporu'].slice(0, missingCount),
  };
});

type Props = {
  onOpenEmployee?: (id: string, name: string) => void;
};

type FilterKey = 'all' | 'missing' | 'ok';

const TONE_CLASS = {
  brand: {
    wrap: 'border-slate-100 bg-slate-50/70 hover:border-slate-200',
    icon: 'bg-brand-50 text-brand-600',
    value: 'text-content-primary',
  },
  warning: {
    wrap: 'border-amber-100 bg-amber-50/40 hover:border-amber-200',
    icon: 'bg-amber-100 text-status-warning',
    value: 'text-status-warning',
  },
  danger: {
    wrap: 'border-red-100 bg-red-50/50 hover:border-red-200',
    icon: 'bg-red-100 text-status-danger',
    value: 'text-status-danger',
  },
} as const;

/**
 * Özlük evrak denetimi — kimin evrakı eksik / tamam.
 */
export function HrDocumentsAuditPanel({ onOpenEmployee }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const rows = useMemo(() => {
    if (filter === 'missing') return PREVIEW_AUDIT.filter((r) => r.missingCount > 0);
    if (filter === 'ok') return PREVIEW_AUDIT.filter((r) => r.missingCount === 0);
    return PREVIEW_AUDIT;
  }, [filter]);

  const totals = useMemo(
    () => ({
      people: PREVIEW_AUDIT.length,
      missingPeople: PREVIEW_AUDIT.filter((r) => r.missingCount > 0).length,
      missingDocs: PREVIEW_AUDIT.reduce((s, r) => s + r.missingCount, 0),
    }),
    [],
  );

  const windows = [
    {
      key: 'all' as const,
      label: 'Personel',
      hint: 'Tüm aktif kadro',
      value: totals.people,
      icon: Users,
      tone: 'brand' as const,
    },
    {
      key: 'missing' as const,
      label: 'Evrakı Eksik Personel',
      hint: 'Zorunlu evrakı eksik',
      value: totals.missingPeople,
      icon: FileWarning,
      tone: 'warning' as const,
    },
    {
      key: 'ok' as const,
      label: 'Toplam Eksik Evrak',
      hint: 'Kadro genelinde eksik adet',
      value: totals.missingDocs,
      icon: AlertTriangle,
      tone: 'danger' as const,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-100/90 px-4 py-3 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
              <FolderOpen className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-content-primary">Özlük Evrak Denetimi</h3>
              <p className="mt-0.5 text-xs text-content-tertiary">
                Kadro Bazında Eksik / Tamam Zorunlu Evrak
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 bg-slate-50/50 p-4 sm:grid-cols-3 sm:p-5">
          {windows.map((card) => {
            const Icon = card.icon;
            const tone = TONE_CLASS[card.tone];
            const isActive =
              (card.key === 'all' && filter === 'all') ||
              (card.key === 'missing' && filter === 'missing');
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  if (card.key === 'ok') setFilter('missing');
                  else setFilter(card.key);
                }}
                className={`rounded-xl border bg-white p-4 text-left transition-colors ${tone.wrap} ${
                  isActive ? 'ring-2 ring-brand-600 ring-offset-1' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone.icon}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${tone.value}`}>{card.value}</p>
                </div>
                <p className="mt-3 text-sm font-semibold text-content-primary">{card.label}</p>
                <p className="mt-0.5 text-xs text-content-tertiary">{card.hint}</p>
              </button>
            );
          })}
        </div>

        {totals.missingPeople > 0 ? (
          <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl border border-status-warning/30 bg-status-warning/5 px-4 py-3 sm:mx-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
            <p className="text-xs text-content-secondary">
              Eksik zorunlu evrak denetim riskidir. Satırdaki göz ile personel evrak listesine gidin.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3 sm:px-5">
          {(
            [
              { key: 'all' as const, label: 'Tümü' },
              { key: 'missing' as const, label: 'Eksikler' },
              { key: 'ok' as const, label: 'Tamamlananlar' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                filter === item.key
                  ? 'bg-brand-600 text-white'
                  : 'border border-border bg-white text-content-secondary hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="table-head-row">
              <tr>
                <th className="table-th text-left">Personel</th>
                <th className="table-th text-left">Çalışma Tipi</th>
                <th className="table-th">Zorunlu</th>
                <th className="table-th">Eksik</th>
                <th className="table-th text-left">Eksik Evraklar</th>
                <th className="table-th">Durum</th>
                <th
                  className="sticky right-0 z-[1] border-l border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-xs font-semibold tracking-wide text-slate-500 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                  style={{ width: 72, minWidth: 72 }}
                >
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="table-body">
              {rows.map((row) => (
                <tr key={row.id} className="table-row">
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      className="text-left font-medium text-brand-700 hover:underline"
                      onClick={() => onOpenEmployee?.(row.id, row.fullName)}
                    >
                      {row.fullName}
                    </button>
                    <p className="text-xs text-content-tertiary">{row.department}</p>
                  </td>
                  <td className="px-5 py-3 text-content-secondary">{row.workScope}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {row.requiredUploaded}/{row.requiredTotal}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums font-semibold text-status-warning">
                    {row.missingCount}
                  </td>
                  <td className="max-w-[220px] px-5 py-3 text-xs text-content-secondary">
                    {row.missingTitles.length ? row.missingTitles.join(' · ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.missingCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-warning/15 px-2.5 py-1 text-[11px] font-semibold text-status-warning">
                        <FileWarning className="h-3 w-3" />
                        Eksik
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-success/15 px-2.5 py-1 text-[11px] font-semibold text-status-success">
                        <CheckCircle2 className="h-3 w-3" />
                        Tamam
                      </span>
                    )}
                  </td>
                  <td
                    className="sticky right-0 z-[1] border-l border-slate-100 bg-white px-3 py-3 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                    style={{ width: 72, minWidth: 72 }}
                  >
                    <button
                      type="button"
                      title="Evrak Listesi"
                      aria-label="Evrak Listesi"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-800"
                      onClick={() => onOpenEmployee?.(row.id, row.fullName)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Printer, X } from 'lucide-react';
import { PortalBreakdownBarCard } from '@/components/panel/portal-breakdown-bar-card';
import { PortalWeeklyTrendCard } from '@/components/panel/portal-weekly-trend-card';
import {
  buildPastMonthOptions,
  buildPastYearOptions,
  buildPortalActivitySeries,
  portalActivityRangeLabel,
  type PortalActivityRange,
} from '@/utils/portal-weekly-activity';
import {
  buildDosyaKonusuStats,
  buildInsuranceBranchStats,
  filterInsuranceFilesByDimensions,
  insuranceBranchOf,
  insuranceCityOf,
  insuranceExpertOf,
  type InsuranceClaimLike,
  type InsuranceNamedCountStat,
} from '@/utils/insurance-portal-monitoring';
import { resolveClaimDosyaKonusu, toTitleCaseTR } from '@/utils/text-helpers';
import { fetchAcilDosyaKonusuCatalog } from '@/utils/portal-api';

type TrackOpt = 'expert_monitor' | 'direct_process';

type InsuranceDetailedStatsModalProps = {
  open: boolean;
  onClose: () => void;
  files: InsuranceClaimLike[];
  /** Asistans portalı: yalnız Acil Yardım; kanal / eksper filtresi yok */
  variant?: 'insurance' | 'assistance';
};

const TRACK_OPTS_INSURANCE = [
  { id: 'expert_monitor' as const, label: 'Eksper İhbarlı' },
  { id: 'direct_process' as const, label: 'Departman İhbarlı' },
] as const;

function toggleLabel(list: string[], value: string): string[] {
  const key = value.toLocaleLowerCase('tr-TR');
  const exists = list.some((x) => x.toLocaleLowerCase('tr-TR') === key);
  if (exists) return list.filter((x) => x.toLocaleLowerCase('tr-TR') !== key);
  return [...list, value];
}

function toggleTrack(list: TrackOpt[], value: TrackOpt): TrackOpt[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function uniqueSorted(values: string[]): string[] {
  const map = new Map<string, string>();
  for (const v of values) {
    const key = v.toLocaleLowerCase('tr-TR');
    if (!map.has(key)) map.set(key, v);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'tr'));
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function FilterColumn({
  title,
  onClear,
  children,
}: {
  title: string;
  onClear?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-500">{title}</p>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold text-brand-600 hover:underline"
          >
            Temizle
          </button>
        ) : null}
      </div>
      <div className="flex max-h-[5.5rem] flex-wrap gap-1.5 overflow-y-auto">{children}</div>
    </div>
  );
}

function BranchResultTable({
  rows,
  emptyText,
  variant = 'insurance',
}: {
  rows: InsuranceNamedCountStat[];
  emptyText: string;
  variant?: 'insurance' | 'assistance';
}) {
  const isAssistance = variant === 'assistance';
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
        <p className="text-sm font-medium text-slate-500">{emptyText}</p>
      </div>
    );
  }
  const gridClass = isAssistance
    ? 'grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_repeat(2,minmax(0,0.7fr))] gap-2'
    : 'grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))] gap-2';
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <div className="min-w-[480px]">
        <div className={`${gridClass} border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500`}>
          <span>{isAssistance ? 'Dosya Konusu' : 'Branş / Konu'}</span>
          <span>Dağılım</span>
          <span className="text-right">Toplam</span>
          <span className="text-right">Açık</span>
          {!isAssistance ? <span className="text-right">Onarım</span> : null}
        </div>
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const widthPct = Math.max(6, Math.round((row.total / maxTotal) * 100));
            return (
              <li key={row.label} className={`${gridClass} items-center px-3 py-2.5`}>
                <span className="truncate text-sm font-semibold text-slate-800">
                  {toTitleCaseTR(row.label)}
                </span>
                <div className="min-w-0">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${widthPct}%` }} />
                  </div>
                </div>
                <span className="text-right text-sm font-semibold tabular-nums text-slate-800">{row.total}</span>
                <span className="text-right text-sm tabular-nums text-slate-600">{row.open}</span>
                {!isAssistance ? (
                  <span className="text-right text-sm tabular-nums text-slate-600">{row.repair}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Detaylı istatistik — filtreler yan yana; branş bar + haftalık trend (Dosya Sorumlusu dilinde).
 */
export function InsuranceDetailedStatsModal({
  open,
  onClose,
  files,
  variant = 'insurance',
}: InsuranceDetailedStatsModalProps) {
  const isAssistance = variant === 'assistance';
  const trackOpts = TRACK_OPTS_INSURANCE;
  const [tracks, setTracks] = useState<TrackOpt[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [experts, setExperts] = useState<string[]>([]);
  const [acilCatalog, setAcilCatalog] = useState<string[]>([]);
  const [activityRange, setActivityRange] = useState<PortalActivityRange>({
    kind: 'last_days',
    days: 7,
  });
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setTracks([]);
    setCities([]);
    setExperts([]);
    setActivityRange({ kind: 'last_days', days: 7 });
  }, [open]);

  useEffect(() => {
    if (!open || !isAssistance) return;
    let cancelled = false;
    fetchAcilDosyaKonusuCatalog()
      .then((names) => {
        if (!cancelled) setAcilCatalog(names);
      })
      .catch(() => {
        if (!cancelled) setAcilCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isAssistance]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const scopedByTrack = useMemo(
    () => filterInsuranceFilesByDimensions(files, { tracks }),
    [files, tracks],
  );

  const cityOptions = useMemo(
    () => uniqueSorted(scopedByTrack.map((f) => insuranceCityOf(f))),
    [scopedByTrack],
  );
  const expertOptions = useMemo(
    () => (isAssistance ? [] : uniqueSorted(scopedByTrack.map((f) => insuranceExpertOf(f)))),
    [scopedByTrack, isAssistance],
  );

  const filtered = useMemo(
    () =>
      filterInsuranceFilesByDimensions(files, {
        tracks,
        cities,
        experts: isAssistance ? [] : experts,
      }),
    [files, tracks, cities, experts, isAssistance],
  );

  const branchRows = useMemo(() => {
    if (!isAssistance) return buildInsuranceBranchStats(filtered);
    return buildDosyaKonusuStats(filtered, acilCatalog, (file, catalog) => {
      const label = resolveClaimDosyaKonusu(
        {
          lossType: file.lossType,
          productBranch: file.productBranch,
          claimSubject: file.claimSubject,
        },
        catalog,
      );
      return label === '—' ? 'Belirtilmemiş' : label;
    });
  }, [filtered, isAssistance, acilCatalog]);
  const branchChartData = useMemo(
    () =>
      branchRows.map((r) => ({
        label: toTitleCaseTR(r.label),
        count: r.total,
      })),
    [branchRows],
  );
  const pastMonthOptions = useMemo(() => buildPastMonthOptions(), []);
  const pastYearOptions = useMemo(() => buildPastYearOptions(), []);
  const activityRangeLabel = portalActivityRangeLabel(activityRange);
  const weeklyTrend = useMemo(
    () => buildPortalActivitySeries(filtered, activityRange),
    [filtered, activityRange],
  );

  const selectionSummary = useMemo(() => {
    const parts: string[] = [];
    if (isAssistance) {
      parts.push('Acil Yardım');
    } else if (tracks.length === 0) {
      parts.push('Toplam Portföy');
    } else {
      if (tracks.includes('expert_monitor')) parts.push('Eksper İhbarlı');
      if (tracks.includes('direct_process')) parts.push('Departman İhbarlı');
    }
    if (cities.length > 0) parts.push(`İl: ${cities.map((c) => toTitleCaseTR(c)).join(', ')}`);
    if (!isAssistance && experts.length > 0) {
      parts.push(`Eksper: ${experts.map((e) => toTitleCaseTR(e)).join(', ')}`);
    }
    parts.push(activityRangeLabel);
    return parts.join(' · ');
  }, [tracks, cities, experts, activityRangeLabel, isAssistance]);

  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;

    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"/><title>Detaylı İstatistik</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#0f172a;padding:24px;margin:0}
  h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:20px 0 8px}
  p{font-size:12px;color:#475569;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
  th{background:#f8fafc} td.num,th.num{text-align:right}
  @media print{body{padding:12px}}
</style></head><body>${node.innerHTML}</body></html>`;

    // Popup engeli / noopener sorununa karşı iframe ile yazdır
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDoc = frameWindow?.document;
    if (!frameWindow || !frameDoc) {
      document.body.removeChild(iframe);
      return;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    const cleanup = () => {
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 800);
    };

    const trigger = () => {
      try {
        frameWindow.focus();
        frameWindow.print();
      } finally {
        cleanup();
      }
    };

    if (frameDoc.readyState === 'complete') {
      window.setTimeout(trigger, 50);
    } else {
      iframe.onload = () => window.setTimeout(trigger, 50);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-slate-950/45" aria-label="Kapat" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Detaylı İstatistik</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {isAssistance
                ? 'İl ve dönem seçerek dosya konusu kırılımı ile dosya hareketini görün.'
                : 'İl, eksper ve dönem seçerek branş kırılımı ile dosya hareketini görün.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" strokeWidth={2} />
              Yazdır
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3.5">
          {/* Çoklu seçimler yan yana — grafik alanını ezmesin */}
          <div
            className={`grid grid-cols-1 gap-2 ${isAssistance ? 'md:grid-cols-1' : 'md:grid-cols-3'}`}
          >
            {!isAssistance ? (
              <FilterColumn title="Kanal (Çoklu Seçim)">
                <Chip label="Toplam" active={tracks.length === 0} onClick={() => setTracks([])} />
                {trackOpts.map((opt) => (
                  <Chip
                    key={opt.id}
                    label={opt.label}
                    active={tracks.includes(opt.id)}
                    onClick={() => setTracks((prev) => toggleTrack(prev, opt.id))}
                  />
                ))}
              </FilterColumn>
            ) : null}

            <FilterColumn
              title="İl (Çoklu Seçim)"
              onClear={cities.length > 0 ? () => setCities([]) : undefined}
            >
              {cityOptions.length === 0 ? (
                <p className="text-xs text-slate-400">İl kaydı yok</p>
              ) : (
                cityOptions.map((city) => (
                  <Chip
                    key={city}
                    label={toTitleCaseTR(city)}
                    active={cities.some((c) => c.toLocaleLowerCase('tr-TR') === city.toLocaleLowerCase('tr-TR'))}
                    onClick={() => setCities((prev) => toggleLabel(prev, city))}
                  />
                ))
              )}
            </FilterColumn>

            {!isAssistance ? (
              <FilterColumn
                title="Eksper (Çoklu Seçim)"
                onClear={experts.length > 0 ? () => setExperts([]) : undefined}
              >
                {expertOptions.length === 0 ? (
                  <p className="text-xs text-slate-400">Eksper kaydı yok</p>
                ) : (
                  expertOptions.map((expert) => (
                    <Chip
                      key={expert}
                      label={toTitleCaseTR(expert)}
                      active={experts.some(
                        (e) => e.toLocaleLowerCase('tr-TR') === expert.toLocaleLowerCase('tr-TR'),
                      )}
                      onClick={() => setExperts((prev) => toggleLabel(prev, expert))}
                    />
                  ))
                )}
              </FilterColumn>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Seçim:</span> {selectionSummary}
              <span className="mx-1.5 text-slate-300">·</span>
              Eşleşen dosya:{' '}
              <span className="font-semibold tabular-nums text-slate-800">{filtered.length}</span>
            </p>
          </div>

          {/* Grafikler önde — Dosya Sorumlusu dilinde */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <PortalBreakdownBarCard
              title={isAssistance ? 'Dosya Konusu Dağılımı' : 'Branş Dağılımı'}
              data={branchChartData}
              emptyText={
                isAssistance
                  ? 'Seçime uyan dosya konusu dağılımı yok.'
                  : 'Seçime uyan branş dağılımı yok.'
              }
            />
            <PortalWeeklyTrendCard
              title={`Dosya Hareketi · ${activityRangeLabel}`}
              data={weeklyTrend}
              emptyText="Seçime uyan dönemde dosya hareketi görünmüyor."
              showEmptyChart
              headerAside={
                <>
                  {(
                    [
                      { days: 7 as const, label: 'Son 7 Gün' },
                      { days: 15 as const, label: 'Son 15 Gün' },
                      { days: 30 as const, label: 'Son 1 Ay' },
                    ] as const
                  ).map((opt) => {
                    const active =
                      activityRange.kind === 'last_days' && activityRange.days === opt.days;
                    return (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setActivityRange({ kind: 'last_days', days: opt.days })}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                          active
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                  <label className="sr-only" htmlFor="stats-activity-month">
                    Ay Seç
                  </label>
                  <select
                    id="stats-activity-month"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                    value={
                      activityRange.kind === 'month'
                        ? `${activityRange.year}-${activityRange.month}`
                        : ''
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      const [y, m] = v.split('-').map(Number);
                      setActivityRange({ kind: 'month', year: y, month: m });
                    }}
                  >
                    <option value="">Ay Seç</option>
                    {pastMonthOptions.map((opt) => (
                      <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor="stats-activity-year">
                    Yıl Seç
                  </label>
                  <select
                    id="stats-activity-year"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                    value={activityRange.kind === 'year' ? String(activityRange.year) : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      setActivityRange({ kind: 'year', year: Number(v) });
                    }}
                  >
                    <option value="">Yıl Seç</option>
                    {pastYearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </>
              }
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {isAssistance ? 'Dosya Konusu Kırılımı' : 'Branş Kırılımı'}
            </h3>
            <p className="text-xs text-slate-500">
              {isAssistance
                ? 'Seçilen il kesişiminde dosya konusu sayıları.'
                : 'Seçilen il ve eksper kesişiminde branş / konu sayıları.'}
            </p>
            <BranchResultTable
              rows={branchRows}
              variant={isAssistance ? 'assistance' : 'insurance'}
              emptyText={
                isAssistance
                  ? 'Seçime uyan dosya yok. İl seçimini değiştirin.'
                  : 'Seçime uyan dosya yok. İl veya eksper seçimini değiştirin.'
              }
            />
          </div>
        </div>

        <div ref={printRef} className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0" aria-hidden>
          <h1>Detaylı İstatistik</h1>
          <p>{selectionSummary}</p>
          <p>Eşleşen dosya: {filtered.length}</p>
          <h2>{isAssistance ? 'Dosya Konusu Kırılımı' : 'Branş Kırılımı'}</h2>
          <table>
            <thead>
              <tr>
                <th>{isAssistance ? 'Dosya Konusu' : 'Branş'}</th>
                <th className="num">Toplam</th>
                <th className="num">Açık</th>
                {!isAssistance ? <th className="num">Onarım</th> : null}
              </tr>
            </thead>
            <tbody>
              {branchRows.map((r) => (
                <tr key={r.label}>
                  <td>{toTitleCaseTR(r.label)}</td>
                  <td className="num">{r.total}</td>
                  <td className="num">{r.open}</td>
                  {!isAssistance ? <td className="num">{r.repair}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Dosya Listesi (Özet)</h2>
          <table>
            <thead>
              <tr>
                <th>Dosya</th>
                <th>İl</th>
                {!isAssistance ? <th>Eksper</th> : null}
                <th>{isAssistance ? 'Dosya Konusu' : 'Branş'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((f) => (
                <tr key={f.id}>
                  <td>{f.fileNo ?? f.fileNumber ?? '—'}</td>
                  <td>{toTitleCaseTR(insuranceCityOf(f))}</td>
                  {!isAssistance ? <td>{toTitleCaseTR(insuranceExpertOf(f))}</td> : null}
                  <td>
                    {toTitleCaseTR(
                      isAssistance
                        ? resolveClaimDosyaKonusu(
                            {
                              lossType: f.lossType,
                              productBranch: f.productBranch,
                              claimSubject: f.claimSubject,
                            },
                            acilCatalog,
                          )
                        : insuranceBranchOf(f),
                    )}
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

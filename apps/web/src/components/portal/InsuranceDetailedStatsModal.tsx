'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, X } from 'lucide-react';
import {
  buildInsuranceBranchStats,
  filterInsuranceFilesByDimensions,
  insuranceBranchOf,
  insuranceCityOf,
  insuranceExpertOf,
  type InsuranceClaimLike,
  type InsuranceNamedCountStat,
} from '@/utils/insurance-portal-monitoring';
import { toTitleCaseTR } from '@/utils/text-helpers';

type TrackOpt = 'expert_monitor' | 'direct_process';

type InsuranceDetailedStatsModalProps = {
  open: boolean;
  onClose: () => void;
  files: InsuranceClaimLike[];
};

const TRACK_OPTS = [
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
      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function BranchResultTable({
  rows,
  emptyText,
}: {
  rows: InsuranceNamedCountStat[];
  emptyText: string;
}) {
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
        <p className="text-sm font-medium text-slate-500">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <div className="min-w-[480px]">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
          <span>Branş / Konu</span>
          <span>Dağılım</span>
          <span className="text-right">Toplam</span>
          <span className="text-right">Açık</span>
          <span className="text-right">Onarım</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const widthPct = Math.max(6, Math.round((row.total / maxTotal) * 100));
            return (
              <li
                key={row.label}
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))] items-center gap-2 px-3 py-2.5"
              >
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
                <span className="text-right text-sm tabular-nums text-slate-600">{row.repair}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Detaylı istatistik — beyaz zemin; il + eksper + kanal çoklu seçimi ile branş kırılımı.
 */
export function InsuranceDetailedStatsModal({
  open,
  onClose,
  files,
}: InsuranceDetailedStatsModalProps) {
  const [tracks, setTracks] = useState<TrackOpt[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [experts, setExperts] = useState<string[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setTracks([]);
    setCities([]);
    setExperts([]);
  }, [open]);

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
    () => uniqueSorted(scopedByTrack.map((f) => insuranceExpertOf(f))),
    [scopedByTrack],
  );

  const filtered = useMemo(
    () =>
      filterInsuranceFilesByDimensions(files, {
        tracks,
        cities,
        experts,
      }),
    [files, tracks, cities, experts],
  );

  const branchRows = useMemo(() => buildInsuranceBranchStats(filtered), [filtered]);

  const selectionSummary = useMemo(() => {
    const parts: string[] = [];
    if (tracks.length === 0) parts.push('Toplam Portföy');
    else {
      if (tracks.includes('expert_monitor')) parts.push('Eksper İhbarlı');
      if (tracks.includes('direct_process')) parts.push('Departman İhbarlı');
    }
    if (cities.length > 0) parts.push(`İl: ${cities.map((c) => toTitleCaseTR(c)).join(', ')}`);
    if (experts.length > 0) parts.push(`Eksper: ${experts.map((e) => toTitleCaseTR(e)).join(', ')}`);
    return parts.join(' · ');
  }, [tracks, cities, experts]);

  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;
    const win = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720');
    if (!win) return;
    win.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"/><title>Detaylı İstatistik</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#0f172a;padding:24px;margin:0}
  h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:20px 0 8px}
  p{font-size:12px;color:#475569;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
  th{background:#f8fafc} td.num,th.num{text-align:right}
</style></head><body>${node.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-slate-950/45" aria-label="Kapat" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Detaylı İstatistik</h2>
            <p className="mt-1 text-xs text-slate-500">
              Birden fazla il ve eksper seçerek branş kırılımını görün (ör. Adana + eksper → yangın / dahili su).
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-500">Kanal (Çoklu Seçim)</p>
            <div className="flex flex-wrap gap-2">
              <Chip
                label="Toplam"
                active={tracks.length === 0}
                onClick={() => setTracks([])}
              />
              {TRACK_OPTS.map((opt) => (
                <Chip
                  key={opt.id}
                  label={opt.label}
                  active={tracks.includes(opt.id)}
                  onClick={() => setTracks((prev) => toggleTrack(prev, opt.id))}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-slate-500">İl (Çoklu Seçim)</p>
              {cities.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCities([])}
                  className="text-[11px] font-semibold text-brand-600 hover:underline"
                >
                  Temizle
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-slate-500">Eksper (Çoklu Seçim)</p>
              {experts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setExperts([])}
                  className="text-[11px] font-semibold text-brand-600 hover:underline"
                >
                  Temizle
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Seçim:</span> {selectionSummary}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Eşleşen dosya: <span className="font-semibold tabular-nums text-slate-800">{filtered.length}</span>
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Branş Kırılımı</h3>
            <p className="text-xs text-slate-500">
              Seçilen il ve eksper kesişiminde branş / konu sayıları (yangın, dahili su vb.).
            </p>
            <BranchResultTable
              rows={branchRows}
              emptyText="Seçime uyan dosya yok. İl veya eksper seçimini değiştirin."
            />
          </div>
        </div>

        <div ref={printRef} className="hidden" aria-hidden>
          <h1>Detaylı İstatistik</h1>
          <p>{selectionSummary}</p>
          <p>Eşleşen dosya: {filtered.length}</p>
          <h2>Branş Kırılımı</h2>
          <table>
            <thead>
              <tr>
                <th>Branş</th>
                <th className="num">Toplam</th>
                <th className="num">Açık</th>
                <th className="num">Onarım</th>
              </tr>
            </thead>
            <tbody>
              {branchRows.map((r) => (
                <tr key={r.label}>
                  <td>{toTitleCaseTR(r.label)}</td>
                  <td className="num">{r.total}</td>
                  <td className="num">{r.open}</td>
                  <td className="num">{r.repair}</td>
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
                <th>Eksper</th>
                <th>Branş</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((f) => (
                <tr key={f.id}>
                  <td>{f.fileNo ?? f.fileNumber ?? '—'}</td>
                  <td>{toTitleCaseTR(insuranceCityOf(f))}</td>
                  <td>{toTitleCaseTR(insuranceExpertOf(f))}</td>
                  <td>{toTitleCaseTR(insuranceBranchOf(f))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import {
  formatSmartMeasureDims,
  smartMeasureElementTypeLabel,
  AI_CONFIDENCE_LEVEL_LABELS,
} from '@/components/smart-measures/smart-measure.constants';
import { openSmartMeasurePdfBlob } from '@/components/smart-measures/open-smart-measure-pdf';

type VersionRow = {
  id: string;
  versionNo: number;
  widthMm?: number | null;
  heightMm?: number | null;
  depthMm?: number | null;
  areaM2?: number | null;
  aiConfidence?: number | null;
  aiConfidenceLevel?: string | null;
  measuredAt: string;
  source?: string;
  measuredBy?: { firstName?: string | null; lastName?: string | null } | null;
  display?: {
    widthCm?: number | null;
    heightCm?: number | null;
    depthCm?: number | null;
  } | null;
};

type MetrajLine = {
  label: string;
  quantityText: string;
  unit: string;
  note?: string;
};

type ElementRow = {
  id: string;
  title: string;
  elementType: string;
  locationLabel?: string | null;
  roomLabel?: string | null;
  createdAt: string;
  latestVersion?: VersionRow | null;
  versions?: VersionRow[];
  metraj?: MetrajLine[];
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function personName(u?: { firstName?: string | null; lastName?: string | null } | null) {
  if (!u) return '—';
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
}

function confidenceLabel(v?: number | null, level?: string | null): string | null {
  if (level && AI_CONFIDENCE_LEVEL_LABELS[level]) return AI_CONFIDENCE_LEVEL_LABELS[level];
  if (v == null || !Number.isFinite(v)) return null;
  const pct = v <= 1 ? Math.round(v * 100) : Math.round(v);
  return `%${pct}`;
}

function metrajSummary(lines?: MetrajLine[]): string | null {
  if (!lines?.length) return null;
  return lines.map((l) => `${l.label}: ${l.quantityText} ${l.unit}`).join(' · ');
}

interface SmartMeasureListProps {
  claimFileId: string;
  refreshKey?: number;
  showEmpty?: boolean;
}

export function SmartMeasureList({
  claimFileId,
  refreshKey = 0,
  showEmpty = true,
}: SmartMeasureListProps) {
  const [items, setItems] = useState<ElementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<VersionRow[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/claim-files/${claimFileId}/smart-measures`, {
        headers: authHeader(),
      });
      const list = r.data?.data ?? r.data ?? [];
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [claimFileId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const openHistory = async (elementId: string) => {
    if (expandedId === elementId) {
      setExpandedId(null);
      setHistory(null);
      return;
    }
    setExpandedId(elementId);
    setHistoryLoading(true);
    try {
      const r = await axios.get(`${API}/claim-files/${claimFileId}/smart-measures/${elementId}`, {
        headers: authHeader(),
      });
      const versions = r.data?.data?.versions ?? [];
      setHistory(Array.isArray(versions) ? versions : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openPdf = async (row: ElementRow) => {
    setPdfError(null);
    setPdfBusyId(row.id);
    try {
      const res = await axios.get(
        `${API}/claim-files/${claimFileId}/smart-measures/${row.id}/pdf`,
        {
          headers: authHeader(),
          responseType: 'blob',
          validateStatus: () => true,
        },
      );
      if (res.status >= 400) {
        let msg = 'Pdf Açılamadı.';
        try {
          const text = await (res.data as Blob).text();
          const parsed = JSON.parse(text) as { message?: string };
          if (parsed.message) msg = parsed.message;
        } catch {
          /* */
        }
        setPdfError(msg);
        return;
      }
      const result = await openSmartMeasurePdfBlob(
        res.data as Blob,
        `akilli-olcum-${row.id.slice(0, 8)}.pdf`,
      );
      if (!result.ok) setPdfError(result.message);
    } catch {
      setPdfError('Pdf Açılamadı.');
    } finally {
      setPdfBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        Akıllı ölçümler yükleniyor…
      </div>
    );
  }

  if (!items.length) {
    if (!showEmpty) return null;
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4">
        <p className="text-sm font-semibold text-slate-800">Akıllı Ölçümler</p>
        <p className="mt-1 text-xs text-slate-500">
          Henüz kayıt yok. Ölçüm mobil uygulamadan (Kamera ile Ölç) gelecek; web yalnızca görüntüler.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">Akıllı Ölçümler</p>
        <p className="text-xs text-slate-500">Ölçüm geçmişi korunur · silinmez</p>
      </div>
      {pdfError ? (
        <p className="border-b border-status-danger/20 bg-status-danger/5 px-4 py-2 text-xs text-status-danger">
          {pdfError}
        </p>
      ) : null}
      <ul className="divide-y divide-slate-100">
        {items.map((row) => {
          const v = row.latestVersion;
          const conf = confidenceLabel(v?.aiConfidence, v?.aiConfidenceLevel);
          const place = [row.locationLabel, row.roomLabel].filter(Boolean).join(' · ');
          const metrajText = metrajSummary(row.metraj);
          return (
            <li key={row.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{row.title}</p>
                  <p className="text-xs text-slate-500">
                    {smartMeasureElementTypeLabel(row.elementType)}
                    {place ? ` · ${place}` : ''}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {v ? formatSmartMeasureDims(v) : 'Ölçü yok'}
                    {conf ? (
                      <span className="ml-2 text-xs text-slate-500">Güven {conf}</span>
                    ) : null}
                  </p>
                  {metrajText ? (
                    <p className="mt-0.5 text-xs text-slate-600">{metrajText}</p>
                  ) : null}
                  {v ? (
                    <p className="mt-0.5 text-xs text-slate-400">
                      Sürüm {v.versionNo} · {fmtDate(v.measuredAt)} · {personName(v.measuredBy)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!v || pdfBusyId === row.id}
                    onClick={() => void openPdf(row)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {pdfBusyId === row.id ? 'Hazırlanıyor…' : 'Pdf Aç'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openHistory(row.id)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {expandedId === row.id ? 'Gizle' : 'Geçmiş'}
                  </button>
                </div>
              </div>
              {expandedId === row.id && (
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {historyLoading ? (
                    <p>Geçmiş yükleniyor…</p>
                  ) : !history?.length ? (
                    <p>Sürüm bulunamadı.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {history.map((h) => (
                        <li key={h.id} className="flex flex-wrap justify-between gap-2">
                          <span>
                            v{h.versionNo}: {formatSmartMeasureDims(h)}
                          </span>
                          <span className="text-slate-400">{fmtDate(h.measuredAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
